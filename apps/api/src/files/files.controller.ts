import { BadRequestException,Body,ConflictException,Controller,Delete,ForbiddenException,Get,NotFoundException,Param,ParseUUIDPipe,Patch,Post,Req,Res,ServiceUnavailableException,UploadedFile,UseGuards,UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { PutObjectCommand,GetObjectCommand,HeadBucketCommand,CreateBucketCommand,DeleteObjectCommand,S3Client } from '@aws-sdk/client-s3';
import { createHash } from 'node:crypto';
import { and,eq,isNull,desc,inArray } from 'drizzle-orm';
import { z } from 'zod';
import { DbService } from '../db/db.service';
import { AuthGuard } from '../auth/auth.guard';
import { files,fileShares,recipients,userKeys,activityLogs,users,trustedRecipientKeys } from '../db/schema';
import { readInput,recipientShape } from '../common/helpers';
import { SecurityMonitorService } from '../security/security-monitor.service';
const uploadShape=z.object({
  id:z.string().uuid(),displayLabel:z.string().min(1).max(160),iv:z.string().min(12).max(40),
  manifest:z.object({version:z.literal(1),fileId:z.string().uuid(),cipherHash:z.string().length(64),cipherBytes:z.number().int().min(16).max(22_000_000),iv:z.string().min(12).max(40),algorithm:z.literal('AES-256-GCM'),createdAt:z.string()}),
  signature:z.string().min(2000).max(8000),signerPublicKey:z.string().min(2000).max(5000),
  envelopes:z.array(recipientShape).min(1).max(10),initialShareExpiresAt:z.iso.datetime().optional()
});
const shareShape=z.object({recipientId:z.string().uuid(),envelope:recipientShape,expiresAt:z.iso.datetime().optional()});
@Controller('files') @UseGuards(AuthGuard)
export class FilesController {
  private s3=new S3Client({region:process.env.S3_REGION||'us-east-1',endpoint:process.env.S3_ENDPOINT||'http://storage:9000',forcePathStyle:true,credentials:{accessKeyId:process.env.S3_ACCESS_KEY||'',secretAccessKey:process.env.S3_SECRET_KEY||''}});
  private bucket=process.env.S3_BUCKET||'pqfile-ciphertext';
  constructor(private readonly svc:DbService,private readonly monitor:SecurityMonitorService){}
  private storageUnavailable(action:string,err:unknown):ServiceUnavailableException{
    const name=err && typeof err==='object' && 'name' in err ? String(err.name) : 'UnknownError';
    const http=err && typeof err==='object' && '$metadata' in err
      ? (err as {$metadata?:{httpStatusCode?:number}}).$metadata?.httpStatusCode : undefined;
    // Do not log SDK credentials, object keys, uploaded data or plaintext.
    console.error(`[PQFile storage] ${action} failed: ${name}${http?` (HTTP ${http})`:''}`);
    return new ServiceUnavailableException('Kho lưu trữ ciphertext tạm thời không sẵn sàng. Kiểm tra dịch vụ storage/RustFS.');
  }
  private async ensureBucket(){
    try {await this.s3.send(new HeadBucketCommand({Bucket:this.bucket}));return;}
    catch(e:unknown){
      const name=e && typeof e==='object' && 'name' in e ? String(e.name) : '';
      const status=e && typeof e==='object' && '$metadata' in e
        ? (e as {$metadata?:{httpStatusCode?:number}}).$metadata?.httpStatusCode : undefined;
      // A 403/timeout means storage is unavailable, not that the bucket is absent.
      if(status!==404 && !['NotFound','NoSuchBucket'].includes(name))throw this.storageUnavailable('head-bucket',e);
      try {await this.s3.send(new CreateBucketCommand({Bucket:this.bucket}));}
      catch(createError:unknown){
        const code=createError && typeof createError==='object' && 'name' in createError ? String(createError.name) : '';
        if(code!=='BucketAlreadyOwnedByYou'&&code!=='BucketAlreadyExists')throw this.storageUnavailable('create-bucket',createError);
      }
    }
  }
  private async permitted(userId:string,fileId:string){
    const [f]=await this.svc.db.select().from(files).where(and(eq(files.id,fileId),isNull(files.deletedAt),eq(files.status,'ACTIVE'))).limit(1);
    if(!f)throw new NotFoundException('Tệp không tồn tại');
    if(f.ownerId===userId)return f;
    const [share]=await this.svc.db.select().from(fileShares).where(and(eq(fileShares.fileId,fileId),eq(fileShares.sharedWith,userId),isNull(fileShares.revokedAt))).limit(1);
    if(!share || (share.expiresAt && share.expiresAt.getTime()<=Date.now())){
      await this.monitor.denied(userId,fileId).catch(()=>{});
      throw new ForbiddenException('Bạn không được cấp quyền truy cập');
    }
    return f;
  }
  private async selfEnvelope(fileId:string,userId:string){const [e]=await this.svc.db.select().from(recipients).where(and(eq(recipients.fileId,fileId),eq(recipients.userId,userId))).limit(1);return e||null;}
  private async recipientCache(uid:string, rows:typeof files.$inferSelect[]){
    const cache=new Map<string,typeof recipients.$inferSelect>();
    if(!rows.length)return cache;
    const matched=await this.svc.db.select().from(recipients).where(and(eq(recipients.userId,uid),inArray(recipients.fileId,rows.map(r=>r.id))));
    for(const r of matched)cache.set(r.fileId,r);
    return cache;
  }
  private async toResponse(f:typeof files.$inferSelect,uid:string,cache?:Map<string,typeof recipients.$inferSelect>){return {id:f.id,ownerId:f.ownerId,displayLabel:f.displayLabel,sourceType:f.sourceType,cipherSize:f.cipherSize,iv:f.iv,createdAt:f.createdAt,deletedAt:f.deletedAt,manifest:f.manifest,signature:f.signature,signerPublicKey:f.signerPublicKey,envelope:cache?cache.get(f.id)||null:await this.selfEnvelope(f.id,uid)};}
  private async owned(userId:string,fileId:string){const [f]=await this.svc.db.select().from(files).where(and(eq(files.id,fileId),eq(files.ownerId,userId))).limit(1);if(!f)throw new NotFoundException('Không tìm thấy tệp của bạn');return f;}
  @Get() async list(@Req() req:any){
    const uid=req.user.id;
    const owned=await this.svc.db.select().from(files).where(and(eq(files.ownerId,uid),isNull(files.deletedAt),eq(files.status,'ACTIVE')));
    const grants=await this.svc.db.select({file:files,share:fileShares}).from(fileShares).innerJoin(files,eq(files.id,fileShares.fileId)).where(and(eq(fileShares.sharedWith,uid),isNull(fileShares.revokedAt),isNull(files.deletedAt),eq(files.status,'ACTIVE')));
    const combined=[...owned,...grants.filter(g=>!g.share.expiresAt||g.share.expiresAt>new Date()).map(g=>g.file)].filter((f,i,a)=>a.findIndex(x=>x.id===f.id)===i);
    combined.sort((a,b)=>b.createdAt.getTime()-a.createdAt.getTime());
    const cache=await this.recipientCache(uid,combined);
    return await Promise.all(combined.map(f=>this.toResponse(f,uid,cache)));
  }
  /** Accessible library with live incoming/outgoing share metadata.
   * Always enforce the same active-file and expiry restrictions as GET /files.
   * Original plaintext names and contents are never present in this response.
   */
  @Get('library') async library(@Req()req:any){
    const uid=req.user.id;
    const [owned,incoming,outgoing]=await Promise.all([
      this.svc.db.select().from(files).where(and(eq(files.ownerId,uid),isNull(files.deletedAt),eq(files.status,'ACTIVE'))),
      this.svc.db.select({file:files,share:fileShares,ownerName:users.displayName,ownerEmail:users.email})
        .from(fileShares).innerJoin(files,eq(fileShares.fileId,files.id)).innerJoin(users,eq(files.ownerId,users.id))
        .where(and(eq(fileShares.sharedWith,uid),isNull(fileShares.revokedAt),isNull(files.deletedAt),eq(files.status,'ACTIVE'))),
      this.svc.db.select({fileId:fileShares.fileId,expiresAt:fileShares.expiresAt})
        .from(fileShares).where(and(eq(fileShares.sharedBy,uid),isNull(fileShares.revokedAt)))
    ]);
    const now=Date.now();
    const validIncoming=incoming.filter(r=>!r.share.expiresAt||r.share.expiresAt.getTime()>now);
    const validOutgoing=outgoing.filter(r=>!r.expiresAt||r.expiresAt.getTime()>now);
    const outgoingByFile=new Map<string,number>();
    for(const s of validOutgoing)outgoingByFile.set(s.fileId,(outgoingByFile.get(s.fileId)||0)+1);
    // Lightweight library listing: never send per-file signatures, encrypted envelopes
    // or manifests for hundreds of rows. GET /files/:id fetches crypto metadata on demand
    // when the owner explicitly previews, downloads or shares a particular file.
    const summary=(f:typeof files.$inferSelect)=>({id:f.id,ownerId:f.ownerId,
      displayLabel:f.displayLabel,sourceType:f.sourceType,cipherSize:f.cipherSize,
      createdAt:f.createdAt,deletedAt:f.deletedAt});
    const ownedRows=owned.map(f=>({...summary(f),ownerName:null,ownerEmail:null,
      sharedAt:null,expiresAt:null,permission:null,recipientCount:outgoingByFile.get(f.id)||0}));
    const incomingRows=validIncoming.map(r=>({...summary(r.file),ownerName:r.ownerName,
      ownerEmail:r.ownerEmail,sharedAt:r.share.createdAt,expiresAt:r.share.expiresAt,
      permission:r.share.permission,recipientCount:0}));
    const items=[...ownedRows,...incomingRows].sort((a,b)=>
      new Date(b.sharedAt||b.createdAt).getTime()-new Date(a.sharedAt||a.createdAt).getTime());
    return {items,counts:{all:items.length,received:incomingRows.length,sent:ownedRows.filter(r=>r.recipientCount>0).length}};
  }
  @Get('trash') async trash(@Req()req:any){
    const owned=await this.svc.db.select().from(files).where(and(eq(files.ownerId,req.user.id),eq(files.status,'TRASH'))).orderBy(desc(files.deletedAt));
    const cache=await this.recipientCache(req.user.id,owned);
    return Promise.all(owned.map(f=>this.toResponse(f,req.user.id,cache)));
  }
  @Get(':id') async getOne(@Req() req:any,@Param('id',new ParseUUIDPipe())id:string){const f=await this.permitted(req.user.id,id);return this.toResponse(f,req.user.id);}
  @Post() @UseInterceptors(FileInterceptor('ciphertext',{limits:{fileSize:21*1024*1024}}))
  async create(@Req() req:any,@UploadedFile() file:Express.Multer.File,@Body('metadata')metadata:string){
    if(!file?.buffer || !metadata)throw new BadRequestException('Thiếu ciphertext hoặc metadata');
    let raw:any;try{raw=JSON.parse(metadata)}catch{throw new BadRequestException('Metadata không hợp lệ')}
    const data=readInput(uploadShape,raw);
    if(data.id!==data.manifest.fileId || data.iv!==data.manifest.iv || data.manifest.cipherBytes!==file.buffer.byteLength || file.buffer.byteLength>21*1024*1024)throw new BadRequestException('Kích thước hoặc định danh không hợp lệ');
    const hash=createHash('sha256').update(file.buffer).digest('hex');
    if(hash!==data.manifest.cipherHash)throw new BadRequestException('Checksum ciphertext không khớp');
    if(!data.envelopes.some(e=>e.userId===req.user.id))throw new BadRequestException('Bắt buộc có envelope cho chủ sở hữu');
    const [activeSigner]=await this.svc.db.select().from(userKeys).where(and(eq(userKeys.userId,req.user.id),eq(userKeys.purpose,'DSA'),eq(userKeys.publicKey,data.signerPublicKey),eq(userKeys.status,'ACTIVE'))).limit(1);
    if(!activeSigner)throw new BadRequestException('Khóa chữ ký không phải khóa đã đăng ký');
    if(data.initialShareExpiresAt&&new Date(data.initialShareExpiresAt).getTime()<=Date.now())throw new BadRequestException('Hạn chia sẻ phải trong tương lai');
    if(new Set(data.envelopes.map(e=>e.userId)).size!==data.envelopes.length)throw new BadRequestException('Envelope trùng');
    if(data.envelopes.some(e=>Boolean(e.hybridEphemeralPublic)!==Boolean(data.envelopes[0].hybridEphemeralPublic)))
      throw new BadRequestException('Các envelope của cùng tệp phải có cùng chính sách lai');
    for(const e of data.envelopes){
      const [rotating]=await this.svc.db.select({id:userKeys.id}).from(userKeys).where(and(eq(userKeys.userId,e.userId),
        eq(userKeys.purpose,'KEM'),eq(userKeys.status,'PENDING'))).limit(1);
      if(rotating)throw new ConflictException('Một tài khoản người nhận đang xoay vòng khóa. Hãy hoàn tất trước khi tải lên.');

      const [key]=await this.svc.db.select().from(userKeys).where(and(eq(userKeys.id,e.keyId),eq(userKeys.userId,e.userId),eq(userKeys.purpose,'KEM'),eq(userKeys.status,'ACTIVE'))).limit(1);
      if(!key)throw new BadRequestException('Khóa người nhận không hợp lệ');
    }
    // Pin recipient keys before encryption for another account. The server never
    // trusts a public key merely because it was present in a directory lookup.
    for(const e of data.envelopes){
      if(e.hybridEphemeralPublic){
        const [xkey]=await this.svc.db.select().from(userKeys).where(and(eq(userKeys.userId,e.userId),eq(userKeys.purpose,'X25519'),eq(userKeys.status,'ACTIVE'))).limit(1);
        if(!xkey)throw new ConflictException('Tài khoản nhận chưa có X25519 đang hoạt động. Không thể tải tệp mã hóa lai.');
      }
      if(e.userId!==req.user.id){
        const [key]=await this.svc.db.select({fingerprint:userKeys.fingerprint}).from(userKeys).where(eq(userKeys.id,e.keyId)).limit(1);
        const [pin]=await this.svc.db.select().from(trustedRecipientKeys)
          .where(and(eq(trustedRecipientKeys.ownerId,req.user.id),eq(trustedRecipientKeys.recipientId,e.userId),
            eq(trustedRecipientKeys.keyId,e.keyId),eq(trustedRecipientKeys.fingerprint,key.fingerprint))).limit(1);
        if(!pin)throw new ConflictException('Khóa người nhận chưa được xác minh ngoài băng hoặc đã thay đổi. Vào Mật mã nâng cao → Khóa tin cậy.');
        if(e.hybridEphemeralPublic){
          const [xkey]=await this.svc.db.select().from(userKeys).where(and(eq(userKeys.userId,e.userId),eq(userKeys.purpose,'X25519'),eq(userKeys.status,'ACTIVE'))).limit(1);
          if(!xkey||pin.xKeyId!==xkey.id||pin.xFingerprint!==xkey.fingerprint)
            throw new ConflictException('Khóa X25519 người nhận chưa được xác minh ngoài băng.');
        }
      }
    }
    // Avoid overwriting an existing ciphertext object if a submitted file ID collides.
    const [existingFile]=await this.svc.db.select({id:files.id}).from(files).where(eq(files.id,data.id)).limit(1);
    if(existingFile)throw new ConflictException('Định danh tệp đã tồn tại');
    const key=`ciphertext/${req.user.id}/${data.id}.bin`;
    await this.ensureBucket();
    try {await this.s3.send(new PutObjectCommand({Bucket:this.bucket,Key:key,Body:file.buffer,ContentType:'application/octet-stream',Metadata:{sha256:hash}}));}
    catch(e){throw this.storageUnavailable('upload-ciphertext',e);}
    try{
      await this.svc.db.transaction(async tx=>{
        await tx.insert(files).values({id:data.id,ownerId:req.user.id,displayLabel:data.displayLabel,objectKey:key,cipherSize:file.buffer.byteLength,iv:data.iv,manifest:data.manifest,signature:data.signature,signerPublicKey:data.signerPublicKey});
        await tx.insert(recipients).values(data.envelopes.map(e=>({fileId:data.id,userId:e.userId,recipientKeyId:e.keyId,kemCiphertext:e.kemCiphertext,wrapIv:e.wrapIv,wrappedKey:e.wrappedKey,hybridEphemeralPublic:e.hybridEphemeralPublic||null,hybridSalt:e.hybridSalt||null})));
        const other=data.envelopes.filter(e=>e.userId!==req.user.id);
        if(other.length)await tx.insert(fileShares).values(other.map(e=>({fileId:data.id,sharedBy:req.user.id,sharedWith:e.userId,expiresAt:data.initialShareExpiresAt?new Date(data.initialShareExpiresAt):undefined})));
        await tx.insert(activityLogs).values({actorId:req.user.id,action:'FILE_ENCRYPT_UPLOAD',resourceType:'file',resourceId:data.id});
      });
    }catch(e){await this.s3.send(new DeleteObjectCommand({Bucket:this.bucket,Key:key})).catch(()=>{});throw e;}
    return {id:data.id,ok:true};
  }
  @Get(':id/blob') async blob(@Req() req:any,@Param('id',new ParseUUIDPipe())id:string,@Res()res:Response){
    const f=await this.permitted(req.user.id,id);
    await this.ensureBucket();
    let data;
    try {data=await this.s3.send(new GetObjectCommand({Bucket:this.bucket,Key:f.objectKey}));}
    catch(e:unknown){
      const name=e && typeof e==='object' && 'name' in e ? String(e.name) : '';
      if(['NoSuchKey','NotFound','NoSuchObject'].includes(name))throw new NotFoundException('Không tìm thấy ciphertext trong kho lưu trữ.');
      throw this.storageUnavailable('download-ciphertext',e);
    }
    if(!data.Body)throw new NotFoundException('Không tìm thấy ciphertext');
    let bytes;
    try{bytes=await data.Body.transformToByteArray();}
    catch(e){throw this.storageUnavailable('read-ciphertext',e);}
    await this.monitor.downloaded(req.user.id,id).catch(()=>{});
    res.setHeader('Content-Type','application/octet-stream');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Disposition',`attachment; filename="${f.id}.ciphertext"`);
    res.send(Buffer.from(bytes));
  }
  @Post(':id/shares') async share(@Req() req:any,@Param('id',new ParseUUIDPipe())id:string,@Body()raw:any){
    const data=readInput(shareShape,raw);const f=await this.permitted(req.user.id,id);
    if(f.ownerId!==req.user.id)throw new ForbiddenException('Chỉ chủ sở hữu được chia sẻ');
    if(data.envelope.userId!==data.recipientId || data.recipientId===req.user.id)throw new BadRequestException('Người nhận không hợp lệ');
    if(data.expiresAt&&new Date(data.expiresAt).getTime()<=Date.now())
      throw new BadRequestException('Hạn chia sẻ phải nằm trong tương lai');
    const [key]=await this.svc.db.select().from(userKeys).where(and(eq(userKeys.id,data.envelope.keyId),eq(userKeys.userId,data.recipientId),eq(userKeys.purpose,'KEM'),eq(userKeys.status,'ACTIVE'))).limit(1);
    if(!key)throw new BadRequestException('Khóa người nhận không hợp lệ');
    const [ownerEnvelope]=await this.svc.db.select({hybridEphemeralPublic:recipients.hybridEphemeralPublic}).from(recipients)
      .where(and(eq(recipients.fileId,id),eq(recipients.userId,req.user.id))).limit(1);
    if(Boolean(ownerEnvelope?.hybridEphemeralPublic)!==Boolean(data.envelope.hybridEphemeralPublic))
      throw new ConflictException('Không được hạ cấp chế độ bọc khóa so với tệp gốc');
    const [pin]=await this.svc.db.select().from(trustedRecipientKeys)
      .where(and(eq(trustedRecipientKeys.ownerId,req.user.id),eq(trustedRecipientKeys.recipientId,data.recipientId),
        eq(trustedRecipientKeys.keyId,data.envelope.keyId),eq(trustedRecipientKeys.fingerprint,key.fingerprint))).limit(1);
    if(!pin)throw new ConflictException('Khóa người nhận chưa được xác minh ngoài băng hoặc đã thay đổi. Vào Mật mã nâng cao → Khóa tin cậy.');
    if(data.envelope.hybridEphemeralPublic){
      const [xkey]=await this.svc.db.select().from(userKeys).where(and(eq(userKeys.userId,data.recipientId),eq(userKeys.purpose,'X25519'),eq(userKeys.status,'ACTIVE'))).limit(1);
      if(!xkey||xkey.id!==pin.xKeyId||xkey.fingerprint!==pin.xFingerprint)
        throw new ConflictException('Khóa X25519 người nhận chưa được xác minh ngoài băng.');
    }
    const [rotating]=await this.svc.db.select({id:userKeys.id}).from(userKeys).where(and(eq(userKeys.userId,data.recipientId),
      eq(userKeys.purpose,'KEM'),eq(userKeys.status,'PENDING'))).limit(1);
    if(rotating)throw new ConflictException('Người nhận đang xoay khóa. Tạm ngừng cấp quyền mới.');
    const [recipientAccount]=await this.svc.db.select({status:users.status}).from(users).where(eq(users.id,data.recipientId)).limit(1);
    if(!recipientAccount||recipientAccount.status!=='ACTIVE')throw new BadRequestException('Tài khoản người nhận không còn hoạt động');
    const [existing]=await this.svc.db.select().from(fileShares).where(and(eq(fileShares.fileId,id),eq(fileShares.sharedWith,data.recipientId))).limit(1);
    if(existing && !existing.revokedAt && (!existing.expiresAt || existing.expiresAt.getTime()>Date.now()))throw new BadRequestException('Tệp đã được chia sẻ với người này');
    await this.svc.db.transaction(async tx=>{
      const envelope={recipientKeyId:data.envelope.keyId,kemCiphertext:data.envelope.kemCiphertext,wrapIv:data.envelope.wrapIv,wrappedKey:data.envelope.wrappedKey,hybridEphemeralPublic:data.envelope.hybridEphemeralPublic||null,hybridSalt:data.envelope.hybridSalt||null};
      // Re-grants repair a missing envelope and rotate the recipient's wrapped CEK.
      // `onConflictDoUpdate` also handles shares created by earlier research imports.
      await tx.insert(recipients).values({fileId:id,userId:data.recipientId,...envelope})
        .onConflictDoUpdate({target:[recipients.fileId,recipients.userId],set:envelope});
      if(existing){
        await tx.update(fileShares).set({revokedAt:null,expiresAt:data.expiresAt?new Date(data.expiresAt):null,
          sharedBy:req.user.id,createdAt:new Date()}).where(eq(fileShares.id,existing.id));
      }else{
        await tx.insert(fileShares).values({fileId:id,sharedBy:req.user.id,sharedWith:data.recipientId,
          expiresAt:data.expiresAt?new Date(data.expiresAt):undefined});
      }
      await tx.insert(activityLogs).values({actorId:req.user.id,action:'FILE_SHARE',resourceType:'file',resourceId:id,
        details:{recipientId:data.recipientId,expiresAt:data.expiresAt||null}});
    });return {ok:true};
  }
  @Get(':id/shares') async shares(@Req()req:any,@Param('id',new ParseUUIDPipe())id:string){const f=await this.permitted(req.user.id,id);if(f.ownerId!==req.user.id)throw new ForbiddenException();return await this.svc.db.select({email:users.email,displayName:users.displayName,revokedAt:fileShares.revokedAt,expiresAt:fileShares.expiresAt,sharedWith:fileShares.sharedWith}).from(fileShares).innerJoin(users,eq(fileShares.sharedWith,users.id)).where(eq(fileShares.fileId,id));}
  @Patch(':id/label') async rename(@Req()req:any,@Param('id',new ParseUUIDPipe())id:string,@Body()raw:any){
    const {label}=readInput(z.object({label:z.string().trim().min(1).max(160)}),raw);
    const f=await this.owned(req.user.id,id);
    if(f.status!=='ACTIVE')throw new BadRequestException('Khôi phục tệp trước khi đổi nhãn');
    await this.svc.db.transaction(async tx=>{
      await tx.update(files).set({displayLabel:label}).where(eq(files.id,id));
      await tx.insert(activityLogs).values({actorId:req.user.id,action:'FILE_RENAME',resourceType:'file',resourceId:id});
    });
    return {ok:true};
  }
  @Post(':id/restore') async restore(@Req()req:any,@Param('id',new ParseUUIDPipe())id:string){
    const f=await this.owned(req.user.id,id);
    if(f.status!=='TRASH')throw new BadRequestException('Tệp không nằm trong thùng rác');
    await this.svc.db.transaction(async tx=>{
      await tx.update(files).set({deletedAt:null,status:'ACTIVE'}).where(eq(files.id,id));
      await tx.insert(activityLogs).values({actorId:req.user.id,action:'FILE_RESTORE',resourceType:'file',resourceId:id});
    });return {ok:true};
  }
  @Delete(':id/permanent') async permanent(@Req()req:any,@Param('id',new ParseUUIDPipe())id:string){
    const f=await this.owned(req.user.id,id);
    if(f.status!=='TRASH')throw new BadRequestException('Đưa tệp vào thùng rác trước khi xóa vĩnh viễn');
    // Remove remote ciphertext before deleting database records. If S3 fails, metadata is preserved.
    try{await this.s3.send(new DeleteObjectCommand({Bucket:this.bucket,Key:f.objectKey}));}
    catch(e){throw this.storageUnavailable('delete-ciphertext',e);}
    await this.svc.db.transaction(async tx=>{
      await tx.insert(activityLogs).values({actorId:req.user.id,action:'FILE_DELETE_PERMANENT',resourceType:'file',resourceId:id});
      await tx.delete(files).where(eq(files.id,id));
    });return {ok:true};
  }
  @Delete(':id/shares/:recipientId') async revoke(@Req()req:any,@Param('id',new ParseUUIDPipe())id:string,@Param('recipientId',new ParseUUIDPipe())uid:string){
    const f=await this.permitted(req.user.id,id);
    if(f.ownerId!==req.user.id)throw new ForbiddenException();
    const [grant]=await this.svc.db.select({id:fileShares.id,revokedAt:fileShares.revokedAt}).from(fileShares)
      .where(and(eq(fileShares.fileId,id),eq(fileShares.sharedWith,uid))).limit(1);
    if(!grant)throw new NotFoundException('Không tìm thấy lượt chia sẻ');
    if(grant.revokedAt)return {ok:true};
    await this.svc.db.transaction(async tx=>{
      await tx.update(fileShares).set({revokedAt:new Date()}).where(eq(fileShares.id,grant.id));
      await tx.insert(activityLogs).values({actorId:req.user.id,action:'FILE_SHARE_REVOKE',resourceType:'file',resourceId:id,
        details:{recipientId:uid}});
    });
    return {ok:true};
  }
  @Delete(':id') async remove(@Req()req:any,@Param('id',new ParseUUIDPipe())id:string){const f=await this.permitted(req.user.id,id);if(f.ownerId!==req.user.id)throw new ForbiddenException();await this.svc.db.transaction(async tx=>{await tx.update(files).set({deletedAt:new Date(),status:'TRASH'}).where(eq(files.id,id));await tx.insert(activityLogs).values({actorId:req.user.id,action:'FILE_TRASH',resourceType:'file',resourceId:id});});return {ok:true};}
}

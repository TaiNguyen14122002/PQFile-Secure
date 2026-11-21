import { BadRequestException,Body,ConflictException,Controller,ForbiddenException,Get,NotFoundException,Param,ParseUUIDPipe,Post,Req,UseGuards } from '@nestjs/common';
import { and,eq,desc } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard';
import { DbService } from '../db/db.service';
import { activityLogs,keyBackups,pqcKeyHistory,pqcRecoveryPlans,recipients,trustedRecipientKeys,userKeys,users } from '../db/schema';
import { readInput } from '../common/helpers';
import { appendKeyEvent,eventDigest } from './key-history';
import { recoveryPlanJson } from './optional-json-response';

const uuid=z.string().uuid();
const proofSchema=z.string().min(4000).max(5000);
const encryptedBackup=z.string().min(100).max(200000);
const publicKem=z.object({keyId:uuid,oldKeyId:uuid,algorithm:z.enum(['ML-KEM-512','ML-KEM-768','ML-KEM-1024']),
  publicKey:z.string().min(1000).max(5000),fingerprint:z.string().regex(/^[a-f0-9]{64}$/),backup:encryptedBackup,proof:proofSchema});
const envelopeShape=z.object({fileId:uuid,oldKeyId:uuid,newKeyId:uuid,kemCiphertext:z.string().min(500).max(4000),
  wrapIv:z.string().min(14).max(50),wrappedKey:z.string().min(45).max(150),
  hybridEphemeralPublic:z.string().min(35).max(80).optional(),hybridSalt:z.string().min(35).max(80).optional(),proof:proofSchema}).refine(v=>Boolean(v.hybridEphemeralPublic)===Boolean(v.hybridSalt));
const batchItemShape=z.object({fileId:uuid,oldKeyId:uuid,newKeyId:uuid,kemCiphertext:z.string().min(500).max(4000),
  wrapIv:z.string().min(14).max(50),wrappedKey:z.string().min(45).max(150),
  hybridEphemeralPublic:z.string().min(35).max(80).optional(),hybridSalt:z.string().min(35).max(80).optional()})
  .refine(v=>Boolean(v.hybridEphemeralPublic)===Boolean(v.hybridSalt));
const payloadShape=z.object({v:z.literal(1),groupId:uuid,threshold:z.number().int().min(2).max(5),total:z.number().int().min(2).max(5),
  iv:z.string().min(12).max(60),ciphertext:z.string().min(50).max(100000),createdAt:z.string().max(80)}).refine(v=>v.threshold<=v.total);
const pinShape=z.object({recipientId:uuid,keyId:uuid,fingerprint:z.string().regex(/^[a-f0-9]{64}$/),
 xKeyId:uuid.optional(),xFingerprint:z.string().regex(/^[a-f0-9]{64}$/).optional(),confirmed:z.literal(true),proof:proofSchema});
const sha=(v:string)=>createHash('sha256').update(Buffer.from(v,'base64')).digest('hex');
const shaText=(v:string)=>createHash('sha256').update(v,'utf8').digest('hex');
const isB64=(s:string)=>/^[A-Za-z0-9+/]+={0,2}$/.test(s);

@Controller('pqc') @UseGuards(AuthGuard)
export class PqcController {
 constructor(private readonly svc:DbService){}
 private async requireProof(userId:string,operation:string,parts:string[],proof:string){
   const [dsa]=await this.svc.db.select({publicKey:userKeys.publicKey}).from(userKeys)
     .where(and(eq(userKeys.userId,userId),eq(userKeys.purpose,'DSA'),eq(userKeys.status,'ACTIVE'))).limit(1);
   if(!dsa||!proof||!isB64(proof)||Buffer.from(proof,'base64').length!==3309)
     throw new ForbiddenException('Thiếu bằng chứng sở hữu khóa ký ML-DSA');
   const content=Buffer.from(JSON.stringify(['PQFILE:PQC:AUTH:V1',operation,...parts]),'utf8');
   try{if(!ml_dsa65.verify(Buffer.from(proof,'base64'),content,Buffer.from(dsa.publicKey,'base64')))
     throw new Error('invalid');}
   catch{throw new ForbiddenException('Chữ ký xác nhận thao tác khóa không hợp lệ');}
 }
 private async registeredKey(userId:string,status='ACTIVE'){
   const [key]=await this.svc.db.select().from(userKeys).where(and(eq(userKeys.userId,userId),eq(userKeys.purpose,'KEM'),eq(userKeys.status,status))).limit(1);
   return key||null;
 }
 @Get('rotation/plan') async rotationPlan(@Req()req:any){
   const uid=req.user.id;const [active,pending,items,backup]=await Promise.all([
     this.registeredKey(uid),this.registeredKey(uid,'PENDING'),
     this.svc.db.select({fileId:recipients.fileId,recipientKeyId:recipients.recipientKeyId,
       kemCiphertext:recipients.kemCiphertext,wrapIv:recipients.wrapIv,wrappedKey:recipients.wrappedKey,hybridEphemeralPublic:recipients.hybridEphemeralPublic,hybridSalt:recipients.hybridSalt})
       .from(recipients).where(eq(recipients.userId,uid)),
     this.svc.db.select({id:keyBackups.id}).from(keyBackups).where(eq(keyBackups.userId,uid)).limit(1)
   ]);
   return {active:active&&{id:active.id,algorithm:active.algorithm,publicKey:active.publicKey,fingerprint:active.fingerprint},
     pending:pending&&{id:pending.id,algorithm:pending.algorithm,publicKey:pending.publicKey,fingerprint:pending.fingerprint},
     items,hasBackup:!!backup.length,remaining:items.filter(x=>x.recipientKeyId===active?.id).length,
     migrated:items.filter(x=>x.recipientKeyId===pending?.id).length};
 }
 @Post('rotation/start') async startRotation(@Req()req:any,@Body()raw:any){
   const input=readInput(publicKem,raw),uid=req.user.id;
   const sizes={'ML-KEM-512':800,'ML-KEM-768':1184,'ML-KEM-1024':1568};
   if(!isB64(input.publicKey)||Buffer.from(input.publicKey,'base64').length!==sizes[input.algorithm]||sha(input.publicKey)!==input.fingerprint)
     throw new BadRequestException('Khóa KEM mới sai kích thước hoặc fingerprint');
   await this.requireProof(uid,'rotation.start',[input.keyId,input.oldKeyId,input.algorithm,input.fingerprint,shaText(input.backup)],input.proof);
   return await this.svc.db.transaction(async tx=>{
     const [old]=await tx.select().from(userKeys).where(and(eq(userKeys.userId,uid),eq(userKeys.id,input.oldKeyId),eq(userKeys.purpose,'KEM'),eq(userKeys.status,'ACTIVE'))).limit(1);
     if(!old)throw new ConflictException('Khóa cũ không còn hoạt động');
     const [pending]=await tx.select().from(userKeys).where(and(eq(userKeys.userId,uid),eq(userKeys.status,'PENDING'))).limit(1);
     if(pending)throw new ConflictException('Đã có lần xoay khóa chưa hoàn tất');
     const [backup]=await tx.select({id:keyBackups.id}).from(keyBackups).where(eq(keyBackups.userId,uid)).limit(1);
     if(!backup)throw new BadRequestException('Tài khoản chưa có bản sao lưu kho khóa');
     await tx.insert(userKeys).values({id:input.keyId,userId:uid,purpose:'KEM',algorithm:input.algorithm,publicKey:input.publicKey,fingerprint:input.fingerprint,status:'PENDING'});
     await tx.update(keyBackups).set({encryptedBlob:input.backup}).where(eq(keyBackups.userId,uid));
     await tx.insert(activityLogs).values({actorId:uid,action:'KEY_ROTATION_START',resourceType:'key',resourceId:input.keyId});
     return {ok:true,keyId:input.keyId};
   });
 }
 @Post('rotation/rewrap') async rewrap(@Req()req:any,@Body()raw:any){
   const input=readInput(envelopeShape,raw),uid=req.user.id;
   await this.requireProof(uid,'rotation.rewrap',[input.fileId,input.oldKeyId,input.newKeyId,input.kemCiphertext,input.wrapIv,input.wrappedKey,
     input.hybridEphemeralPublic||'',input.hybridSalt||''],input.proof);
   if(!isB64(input.kemCiphertext)||!isB64(input.wrapIv)||!isB64(input.wrappedKey)||
     Buffer.from(input.wrapIv,'base64').length!==12||Buffer.from(input.wrappedKey,'base64').length!==48)
     throw new BadRequestException('Bọc khóa không đúng định dạng AES-GCM');
   return await this.svc.db.transaction(async tx=>{
     const [[old],[pending]]=await Promise.all([
       tx.select().from(userKeys).where(and(eq(userKeys.id,input.oldKeyId),eq(userKeys.userId,uid),eq(userKeys.status,'ACTIVE'))).limit(1),
       tx.select().from(userKeys).where(and(eq(userKeys.id,input.newKeyId),eq(userKeys.userId,uid),eq(userKeys.status,'PENDING'))).limit(1)
     ]);
     if(!old||!pending)throw new ConflictException('Trạng thái vòng đời khóa đã thay đổi');
     const ctBytes={'ML-KEM-512':768,'ML-KEM-768':1088,'ML-KEM-1024':1568}[pending.algorithm as 'ML-KEM-512'|'ML-KEM-768'|'ML-KEM-1024'];
     if(!ctBytes||Buffer.from(input.kemCiphertext,'base64').length!==ctBytes)throw new BadRequestException('Độ dài ML-KEM ciphertext sai');
     const [record]=await tx.select().from(recipients).where(and(eq(recipients.fileId,input.fileId),eq(recipients.userId,uid))).limit(1);
     if(!record)throw new NotFoundException('Không có envelope của tài khoản');
     if(record.recipientKeyId===input.newKeyId)return {ok:true,skipped:true};
     if(Boolean(record.hybridEphemeralPublic)!==Boolean(input.hybridEphemeralPublic))throw new ConflictException('Không được hạ cấp chế độ bọc khóa lai khi xoay KEM');
     if(record.recipientKeyId!==input.oldKeyId)throw new ConflictException('Envelope đã được thay bằng khóa khác');
     await tx.update(recipients).set({recipientKeyId:input.newKeyId,kemCiphertext:input.kemCiphertext,wrapIv:input.wrapIv,wrappedKey:input.wrappedKey,hybridEphemeralPublic:input.hybridEphemeralPublic||null,hybridSalt:input.hybridSalt||null})
       .where(and(eq(recipients.id,record.id),eq(recipients.recipientKeyId,input.oldKeyId)));
     await tx.insert(activityLogs).values({actorId:uid,action:'KEY_REWRAP_CEK',resourceType:'file',resourceId:input.fileId,details:{from:input.oldKeyId,to:input.newKeyId}});
     return {ok:true};
   });
 }
 @Post('rotation/rewrap-batch') async rewrapBatch(@Req()req:any,@Body()raw:any){
   const data=readInput(z.object({items:z.array(batchItemShape).min(1).max(20),proof:proofSchema}),raw);
   const uid=req.user.id,items=data.items;
   if(new Set(items.map(x=>x.fileId)).size!==items.length)throw new BadRequestException('Danh sách tái bọc chứa tệp trùng');
   await this.requireProof(uid,'rotation.batch',[shaText(JSON.stringify(items))],data.proof);
   return this.svc.db.transaction(async tx=>{
     const [active]=await tx.select().from(userKeys).where(and(eq(userKeys.userId,uid),eq(userKeys.id,items[0].oldKeyId),eq(userKeys.purpose,'KEM'),eq(userKeys.status,'ACTIVE'))).limit(1);
     const [pending]=await tx.select().from(userKeys).where(and(eq(userKeys.userId,uid),eq(userKeys.id,items[0].newKeyId),eq(userKeys.purpose,'KEM'),eq(userKeys.status,'PENDING'))).limit(1);
     if(!active||!pending)throw new ConflictException('Cặp khóa xoay đang chờ không hợp lệ');
     const ctBytes={'ML-KEM-512':768,'ML-KEM-768':1088,'ML-KEM-1024':1568}[pending.algorithm as 'ML-KEM-512'|'ML-KEM-768'|'ML-KEM-1024'];
     let count=0;
     for(const item of items){
       if(item.oldKeyId!==active.id||item.newKeyId!==pending.id)throw new BadRequestException('Các envelope phải sử dụng cùng cặp khóa');
       if(!isB64(item.kemCiphertext)||!isB64(item.wrapIv)||!isB64(item.wrappedKey)||
         Buffer.from(item.kemCiphertext,'base64').length!==ctBytes||Buffer.from(item.wrapIv,'base64').length!==12||
         Buffer.from(item.wrappedKey,'base64').length!==48)throw new BadRequestException('Envelope có định dạng không hợp lệ');
       const [stored]=await tx.select().from(recipients).where(and(eq(recipients.fileId,item.fileId),eq(recipients.userId,uid))).limit(1);
       if(!stored||stored.recipientKeyId!==active.id)throw new ConflictException('Dữ liệu CEK đã thay đổi. Tải lại kế hoạch để tiếp tục.');
       if(Boolean(stored.hybridEphemeralPublic)!==Boolean(item.hybridEphemeralPublic))throw new ConflictException('Không được hạ cấp chế độ lai');
       await tx.update(recipients).set({recipientKeyId:pending.id,kemCiphertext:item.kemCiphertext,wrapIv:item.wrapIv,
         wrappedKey:item.wrappedKey,hybridEphemeralPublic:item.hybridEphemeralPublic||null,hybridSalt:item.hybridSalt||null})
         .where(eq(recipients.id,stored.id));
       await tx.insert(activityLogs).values({actorId:uid,action:'KEY_REWRAP_CEK',resourceType:'file',resourceId:item.fileId,details:{from:active.id,to:pending.id}});
       count++;
     }
     return {ok:true,updated:count};
   });
 }
 @Post('rotation/finalize') async finalize(@Req()req:any,@Body()raw:any){
   const input=readInput(z.object({oldKeyId:uuid,newKeyId:uuid,backup:encryptedBackup,proof:proofSchema}),raw),uid=req.user.id;
   await this.requireProof(uid,'rotation.finalize',[input.oldKeyId,input.newKeyId,shaText(input.backup)],input.proof);
   return this.svc.db.transaction(async tx=>{
     const [old]=await tx.select().from(userKeys).where(and(eq(userKeys.id,input.oldKeyId),eq(userKeys.userId,uid),eq(userKeys.status,'ACTIVE'))).limit(1);
     const [next]=await tx.select().from(userKeys).where(and(eq(userKeys.id,input.newKeyId),eq(userKeys.userId,uid),eq(userKeys.status,'PENDING'))).limit(1);
     if(!old||!next)throw new ConflictException('Khóa cũ hoặc mới không hợp lệ');
     const remaining=await tx.select({id:recipients.id}).from(recipients).where(and(eq(recipients.userId,uid),eq(recipients.recipientKeyId,old.id))).limit(1);
     if(remaining.length)throw new ConflictException('Vẫn còn tài liệu chưa được tái bọc. Không thể ngừng khóa cũ.');
     await tx.update(keyBackups).set({encryptedBlob:input.backup}).where(eq(keyBackups.userId,uid));
     // A recovery plan created for the old keyset cannot restore the rotated KEM.
     await tx.delete(pqcRecoveryPlans).where(eq(pqcRecoveryPlans.userId,uid));
     await tx.update(userKeys).set({status:'RETIRED'}).where(eq(userKeys.id,old.id));
     await tx.update(userKeys).set({status:'ACTIVE'}).where(eq(userKeys.id,next.id));
     await appendKeyEvent(tx,uid,next.id,'KEY_ROTATED',next.fingerprint);
     await tx.insert(activityLogs).values({actorId:uid,action:'KEY_ROTATION_FINISHED',resourceType:'key',resourceId:next.id});
     return {ok:true};
   });
 }
 @Post('rotation/cancel') async cancel(@Req()req:any,@Body()raw:any){
   const input=readInput(z.object({pendingKeyId:uuid,backup:encryptedBackup,proof:proofSchema}),raw),uid=req.user.id;
   await this.requireProof(uid,'rotation.cancel',[input.pendingKeyId,shaText(input.backup)],input.proof);
   return this.svc.db.transaction(async tx=>{
     const [pending]=await tx.select().from(userKeys).where(and(eq(userKeys.id,input.pendingKeyId),eq(userKeys.userId,uid),eq(userKeys.status,'PENDING'))).limit(1);
     if(!pending)throw new NotFoundException('Không có lần xoay khóa chờ xử lý');
     const migrated=await tx.select({id:recipients.id}).from(recipients).where(and(eq(recipients.userId,uid),eq(recipients.recipientKeyId,pending.id))).limit(1);
     if(migrated.length)throw new ConflictException('Đã tái bọc một số tài liệu. Hãy tiếp tục hoàn tất, không thể hủy an toàn.');
     await tx.update(userKeys).set({status:'CANCELLED'}).where(eq(userKeys.id,pending.id));
     await tx.update(keyBackups).set({encryptedBlob:input.backup}).where(eq(keyBackups.userId,uid));
     await tx.insert(activityLogs).values({actorId:uid,action:'KEY_ROTATION_CANCELLED',resourceType:'key',resourceId:pending.id});
     return {ok:true};
   });
 }
 @Post('hybrid/enable') async enableX25519(@Req()req:any,@Body()raw:any){
   const data=readInput(z.object({publicKey:z.string().min(40).max(100),fingerprint:z.string().regex(/^[a-f0-9]{64}$/),backup:encryptedBackup,proof:proofSchema}),raw);
   const uid=req.user.id;
   if(!isB64(data.publicKey)||Buffer.from(data.publicKey,'base64').length!==32||sha(data.publicKey)!==data.fingerprint)
     throw new BadRequestException('Khóa công khai X25519 phải có 32 byte hợp lệ');
   await this.requireProof(uid,'hybrid.enable',[data.publicKey,data.fingerprint,shaText(data.backup)],data.proof);
   return this.svc.db.transaction(async tx=>{
     const [old]=await tx.select().from(userKeys).where(and(eq(userKeys.userId,uid),eq(userKeys.purpose,'X25519'),eq(userKeys.status,'ACTIVE'))).limit(1);
     if(old)throw new ConflictException('Đã có khóa X25519 hoạt động');
     const [pending]=await tx.select().from(userKeys).where(and(eq(userKeys.userId,uid),eq(userKeys.status,'PENDING'))).limit(1);
     if(pending)throw new ConflictException('Hoàn tất hoặc hủy xoay KEM trước khi kích hoạt X25519');
     const [saved]=await tx.select({id:keyBackups.id}).from(keyBackups).where(eq(keyBackups.userId,uid)).limit(1);
     if(!saved)throw new NotFoundException('Chưa có kho khóa để bổ sung X25519');
     const [key]=await tx.insert(userKeys).values({userId:uid,purpose:'X25519',algorithm:'X25519',publicKey:data.publicKey,fingerprint:data.fingerprint}).returning({id:userKeys.id});
     await tx.update(keyBackups).set({encryptedBlob:data.backup}).where(eq(keyBackups.userId,uid));
     await tx.delete(pqcRecoveryPlans).where(eq(pqcRecoveryPlans.userId,uid));
     await appendKeyEvent(tx,uid,key.id,'X25519_ENABLED',data.fingerprint);
     await tx.insert(activityLogs).values({actorId:uid,action:'X25519_ENABLED',resourceType:'key',resourceId:key.id});
     return {ok:true,keyId:key.id};
   });
 }
 @Get('recovery') async recovery(@Req()req:any){
   const [plan]=await this.svc.db.select({encryptedPayload:pqcRecoveryPlans.encryptedPayload,updatedAt:pqcRecoveryPlans.updatedAt})
     .from(pqcRecoveryPlans).where(eq(pqcRecoveryPlans.userId,req.user.id)).limit(1);
   return recoveryPlanJson(plan);
 }
 @Post('recovery') async saveRecovery(@Req()req:any,@Body()raw:any){
   const payload=readInput(payloadShape,raw);const uid=req.user.id;
   const proof=readInput(z.object({proof:proofSchema}),raw).proof;
   await this.requireProof(uid,'recovery.create',[payload.groupId,shaText(JSON.stringify(payload))],proof);
   await this.svc.db.transaction(async tx=>{
     await tx.insert(pqcRecoveryPlans).values({userId:uid,groupId:payload.groupId,encryptedPayload:payload})
       .onConflictDoUpdate({target:pqcRecoveryPlans.userId,set:{groupId:payload.groupId,encryptedPayload:payload,updatedAt:new Date()}});
     await tx.insert(activityLogs).values({actorId:uid,action:'KEY_RECOVERY_PLAN_UPDATED',resourceType:'key',details:{groupId:payload.groupId,threshold:payload.threshold,total:payload.total}});
   });return {ok:true};
 }
 @Post('recovery/restore-backup') async restoreBackup(@Req()req:any,@Body()raw:any){
   const data=readInput(z.object({backup:encryptedBackup,kemFingerprint:z.string().length(64),dsaFingerprint:z.string().length(64),proof:proofSchema}),raw);const uid=req.user.id;
   await this.requireProof(uid,'recovery.restore',[shaText(data.backup),data.kemFingerprint,data.dsaFingerprint],data.proof);
   const [pending]=await this.svc.db.select().from(userKeys).where(and(eq(userKeys.userId,uid),eq(userKeys.purpose,'KEM'),eq(userKeys.status,'PENDING'))).limit(1);
   if(pending)throw new ConflictException('Không thể thay bản sao lưu trong khi đang xoay khóa. Hãy tiếp tục hoặc hoàn tất xoay khóa.');
   const keys=await this.svc.db.select().from(userKeys).where(and(eq(userKeys.userId,uid),eq(userKeys.status,'ACTIVE')));
   if(!keys.some(k=>k.purpose==='KEM'&&k.fingerprint===data.kemFingerprint)||!keys.some(k=>k.purpose==='DSA'&&k.fingerprint===data.dsaFingerprint))
     throw new ForbiddenException('Khóa khôi phục không khớp khóa công khai đang hoạt động');
   const [saved]=await this.svc.db.select({id:keyBackups.id}).from(keyBackups).where(eq(keyBackups.userId,uid)).limit(1);
   if(!saved)throw new NotFoundException('Không tìm thấy bản sao lưu');
   await this.svc.db.transaction(async tx=>{
     await tx.update(keyBackups).set({encryptedBlob:data.backup}).where(eq(keyBackups.userId,uid));
     await tx.insert(activityLogs).values({actorId:uid,action:'KEY_RECOVERY_BACKUP_RESTORED',resourceType:'key'});
   });return {ok:true};
 }
 @Get('trust') async trustList(@Req()req:any){
   const list=await this.svc.db.select({recipientId:trustedRecipientKeys.recipientId,keyId:trustedRecipientKeys.keyId,
     fingerprint:trustedRecipientKeys.fingerprint,xKeyId:trustedRecipientKeys.xKeyId,xFingerprint:trustedRecipientKeys.xFingerprint,verifiedAt:trustedRecipientKeys.verifiedAt,
     email:users.email,displayName:users.displayName})
     .from(trustedRecipientKeys).innerJoin(users,eq(trustedRecipientKeys.recipientId,users.id))
     .where(eq(trustedRecipientKeys.ownerId,req.user.id));
   return await Promise.all(list.map(async pin=>{const current=await this.registeredKey(pin.recipientId);
     const [xkey]=await this.svc.db.select().from(userKeys).where(and(eq(userKeys.userId,pin.recipientId),eq(userKeys.purpose,'X25519'),eq(userKeys.status,'ACTIVE'))).limit(1);
     const xValid=!xkey?(!pin.xKeyId&&!pin.xFingerprint):pin.xKeyId===xkey.id&&pin.xFingerprint===xkey.fingerprint;
     return {...pin,status:!current?'NO_ACTIVE_KEY':current.id===pin.keyId&&current.fingerprint===pin.fingerprint&&xValid?'TRUSTED':'KEY_CHANGED',
       currentFingerprint:current?.fingerprint||null};}));
 }
 @Get('trust/:recipientId') async trustDetail(@Req()req:any,@Param('recipientId',new ParseUUIDPipe())recipientId:string){
   const [recipient]=await this.svc.db.select({id:users.id,email:users.email,displayName:users.displayName})
     .from(users).where(eq(users.id,recipientId)).limit(1);
   if(!recipient)throw new NotFoundException('Tài khoản nhận không tồn tại');
   const [current,pins,history,xkeys]=await Promise.all([
     this.registeredKey(recipientId),
     this.svc.db.select().from(trustedRecipientKeys).where(and(eq(trustedRecipientKeys.ownerId,req.user.id),eq(trustedRecipientKeys.recipientId,recipientId))).limit(1),
     this.svc.db.select().from(pqcKeyHistory).where(eq(pqcKeyHistory.userId,recipientId)).orderBy(pqcKeyHistory.sequence).limit(200),
     this.svc.db.select().from(userKeys).where(and(eq(userKeys.userId,recipientId),eq(userKeys.purpose,'X25519'),eq(userKeys.status,'ACTIVE'))).limit(1)
   ]);
   let prev='0'.repeat(64),chainOk=true;
   for(const e of history){if(e.prevHash!==prev||e.entryHash!==eventDigest(recipientId,e.keyId,e.eventType,e.fingerprint,prev))chainOk=false;prev=e.entryHash;}
   const xkey=xkeys[0];
   const xValid=!xkey?(!pins[0]?.xKeyId&&!pins[0]?.xFingerprint):pins[0]?.xKeyId===xkey.id&&pins[0]?.xFingerprint===xkey.fingerprint;
   return {recipient,current:current&&{id:current.id,algorithm:current.algorithm,publicKey:current.publicKey,fingerprint:current.fingerprint},
     currentX:xkey?{id:xkey.id,publicKey:xkey.publicKey,fingerprint:xkey.fingerprint}:null,
     pin:pins[0]||null,status:!current?'NO_ACTIVE_KEY':pins.length===0?'UNVERIFIED':
       pins[0].keyId===current.id&&pins[0].fingerprint===current.fingerprint&&xValid?'TRUSTED':'KEY_CHANGED',
     history:history.map(x=>({eventType:x.eventType,keyId:x.keyId,fingerprint:x.fingerprint,prevHash:x.prevHash,entryHash:x.entryHash,createdAt:x.createdAt})),
     chainOk,externallyAnchored:false};
 }
 @Post('trust/pin') async trustPin(@Req()req:any,@Body()raw:any){
   const data=readInput(pinShape,raw);const uid=req.user.id;
   await this.requireProof(uid,'trust.pin',[data.recipientId,data.keyId,data.fingerprint,data.xKeyId||'',data.xFingerprint||''],data.proof);
   if(data.recipientId===uid)throw new BadRequestException('Không cần ghim khóa của chính mình');
   const current=await this.registeredKey(data.recipientId);
   if(!current||current.id!==data.keyId||current.fingerprint!==data.fingerprint)throw new ConflictException('Khóa người nhận đã thay đổi. Kiểm tra lại ngoài băng.');
   const [xkey]=await this.svc.db.select().from(userKeys).where(and(eq(userKeys.userId,data.recipientId),eq(userKeys.purpose,'X25519'),eq(userKeys.status,'ACTIVE'))).limit(1);
   if(xkey&&(data.xKeyId!==xkey.id||data.xFingerprint!==xkey.fingerprint))throw new ConflictException('Fingerprint X25519 người nhận chưa được xác nhận');
   await this.svc.db.transaction(async tx=>{
     await tx.insert(trustedRecipientKeys).values({ownerId:uid,recipientId:data.recipientId,keyId:current.id,fingerprint:current.fingerprint,
       xKeyId:xkey?.id||null,xFingerprint:xkey?.fingerprint||null})
       .onConflictDoUpdate({target:[trustedRecipientKeys.ownerId,trustedRecipientKeys.recipientId],set:{keyId:current.id,fingerprint:current.fingerprint,xKeyId:xkey?.id||null,xFingerprint:xkey?.fingerprint||null,verifiedAt:new Date()}});
     await tx.insert(activityLogs).values({actorId:uid,action:'RECIPIENT_KEY_VERIFIED',resourceType:'key',resourceId:current.id,details:{recipientId:data.recipientId}});
   });return {ok:true};
 }
}

import { Body,Controller,Get,Post,Req,UseGuards,BadRequestException,ConflictException } from '@nestjs/common';
import { and,eq } from 'drizzle-orm';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { DbService } from '../db/db.service';
import { keyBackups,userKeys } from '../db/schema';
import { AuthGuard } from '../auth/auth.guard';
import { readInput } from '../common/helpers';
import { appendKeyEvent } from './key-history';
import { keyBackupJson } from './optional-json-response';
const keySchema=z.object({kemAlgorithm:z.enum(['ML-KEM-512','ML-KEM-768','ML-KEM-1024']),kemPublic:z.string().min(1000).max(5000),kemFingerprint:z.string().length(64),dsaPublic:z.string().min(2000).max(5000),dsaFingerprint:z.string().length(64),backup:z.string().min(100).max(200000),x25519Public:z.string().min(40).max(100).optional(),x25519Fingerprint:z.string().length(64).optional()});
@Controller('keys') @UseGuards(AuthGuard)
export class KeysController{
 constructor(private readonly svc:DbService){}
 @Get() async list(@Req() req:any){return await this.svc.db.select({id:userKeys.id,purpose:userKeys.purpose,algorithm:userKeys.algorithm,publicKey:userKeys.publicKey,fingerprint:userKeys.fingerprint,status:userKeys.status}).from(userKeys).where(eq(userKeys.userId,req.user.id));}
 @Get('backup') async backup(@Req() req:any){const [backup]=await this.svc.db.select({encryptedBlob:keyBackups.encryptedBlob,createdAt:keyBackups.createdAt}).from(keyBackups).where(eq(keyBackups.userId,req.user.id)).orderBy(keyBackups.createdAt).limit(1);return keyBackupJson(backup);}
 @Post() async save(@Req() req:any,@Body() raw:any){
   const data=readInput(keySchema,raw); const userId=req.user.id;
   const hash=(base64:string)=>createHash('sha256').update(Buffer.from(base64,'base64')).digest('hex');
   if(hash(data.kemPublic)!==data.kemFingerprint || hash(data.dsaPublic)!==data.dsaFingerprint)throw new BadRequestException('Fingerprint khóa công khai không khớp');
   if(Boolean(data.x25519Public)!==Boolean(data.x25519Fingerprint)||
     (data.x25519Public && (Buffer.from(data.x25519Public,'base64').length!==32||hash(data.x25519Public)!==data.x25519Fingerprint)))
     throw new BadRequestException('Fingerprint khóa X25519 không hợp lệ');
   const kemSize={'ML-KEM-512':800,'ML-KEM-768':1184,'ML-KEM-1024':1568}[data.kemAlgorithm];
   if(Buffer.from(data.kemPublic,'base64').byteLength!==kemSize || Buffer.from(data.dsaPublic,'base64').byteLength!==1952)throw new BadRequestException('Chiều dài khóa công khai không hợp lệ');
   return await this.svc.db.transaction(async tx=>{
      const [exists]=await tx.select({id:userKeys.id}).from(userKeys).where(and(eq(userKeys.userId,userId),eq(userKeys.purpose,'KEM'),eq(userKeys.status,'ACTIVE'))).limit(1);
      if(exists) throw new ConflictException('Đã có bộ khóa; chưa hỗ trợ xoay khóa tự động');
      const [kem]=await tx.insert(userKeys).values({userId,purpose:'KEM',algorithm:data.kemAlgorithm,publicKey:data.kemPublic,fingerprint:data.kemFingerprint}).returning({id:userKeys.id});
      await tx.insert(userKeys).values({userId,purpose:'DSA',algorithm:'ML-DSA-65',publicKey:data.dsaPublic,fingerprint:data.dsaFingerprint});
      await appendKeyEvent(tx,userId,kem.id,'KEY_REGISTERED',data.kemFingerprint);
      if(data.x25519Public){
        const [x]=await tx.insert(userKeys).values({userId,purpose:'X25519',algorithm:'X25519',publicKey:data.x25519Public,fingerprint:data.x25519Fingerprint!}).returning({id:userKeys.id});
        await appendKeyEvent(tx,userId,x.id,'X25519_REGISTERED',data.x25519Fingerprint!);
      }
      await tx.insert(keyBackups).values({userId,encryptedBlob:data.backup});

      return {ok:true,keyId:kem.id};
   });
 }
}

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { z } from 'zod';
export const digest = (t:string)=>createHash('sha256').update(t).digest('hex');
export function readInput<T extends z.ZodTypeAny>(schema:T,value:unknown):z.infer<T>{
  const out=schema.safeParse(value);
  if(!out.success) throw new BadRequestException(out.error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; '));
  return out.data;
}
export const recipientShape = z.object({
  userId:z.string().uuid(), keyId:z.string().uuid(),
  kemCiphertext:z.string().min(100).max(5000), wrapIv:z.string().min(12).max(40), wrappedKey:z.string().min(30).max(400),
  hybridEphemeralPublic:z.string().min(35).max(80).optional(),hybridSalt:z.string().min(35).max(80).optional()
}).refine(v=>Boolean(v.hybridEphemeralPublic)===Boolean(v.hybridSalt),{message:'Envelope lai cần đủ hai thành phần X25519'});
export const isUuid=(id:string)=>z.string().uuid().safeParse(id).success;

import { Controller,Get,Query,Req,UseGuards } from '@nestjs/common';
import { and,eq,ilike,ne } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { userKeys,users } from '../db/schema';
import { AuthGuard } from '../auth/auth.guard';
@Controller('users') @UseGuards(AuthGuard)
export class UsersController {
 constructor(private readonly svc:DbService){}
 @Get('search') async search(@Req() req:any,@Query('q') q=''){
   if(q.trim().length<3) return [];
   const matches=await this.svc.db.select({id:users.id,email:users.email,displayName:users.displayName}).from(users).where(and(ilike(users.email,`%${q.slice(0,80).replaceAll('%','')}%`),ne(users.id,req.user.id),eq(users.status,'ACTIVE'))).limit(8);
   const out=[];
   for(const u of matches){const [key]=await this.svc.db.select({id:userKeys.id,algorithm:userKeys.algorithm,publicKey:userKeys.publicKey,fingerprint:userKeys.fingerprint}).from(userKeys).where(and(eq(userKeys.userId,u.id),eq(userKeys.purpose,'KEM'),eq(userKeys.status,'ACTIVE'))).limit(1); if(key){const [xkey]=await this.svc.db.select({id:userKeys.id,publicKey:userKeys.publicKey,fingerprint:userKeys.fingerprint}).from(userKeys)
      .where(and(eq(userKeys.userId,u.id),eq(userKeys.purpose,'X25519'),eq(userKeys.status,'ACTIVE'))).limit(1);
      out.push({...u,key:{...key,x25519Public:xkey?.publicKey||null,x25519KeyId:xkey?.id||null,x25519Fingerprint:xkey?.fingerprint||null}});}}
   return out;
 }
}

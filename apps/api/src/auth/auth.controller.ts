import { Body,Controller,Get,Post,Req,Res,UseGuards,UnauthorizedException,ConflictException } from '@nestjs/common';
import type { Request,Response } from 'express';
import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import * as argon2 from 'argon2';
import { z } from 'zod';
import { DbService } from '../db/db.service';
import { sessions, users } from '../db/schema';
import { digest,readInput } from '../common/helpers';
import { AuthGuard } from './auth.guard';
import { SecurityMonitorService } from '../security/security-monitor.service';
const registerSchema=z.object({email:z.email().max(255),password:z.string().min(12).max(128),displayName:z.string().min(2).max(150)});
const loginSchema=z.object({email:z.email(),password:z.string()});
@Controller('auth')
export class AuthController {
 constructor(private readonly service:DbService,private readonly monitor:SecurityMonitorService){}
 private async startSession(userId:string,res:Response){
   const token=randomBytes(32).toString('hex');
   await this.service.db.insert(sessions).values({userId,tokenHash:digest(token),expiresAt:new Date(Date.now()+7*86400000)});
   res.cookie('pq_session',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:7*86400000});
 }
 @Post('register') async register(@Body() raw:any,@Res({passthrough:true}) res:Response){
   const data=readInput(registerSchema,raw); const email=data.email.toLowerCase().trim();
   const [found]=await this.service.db.select({id:users.id}).from(users).where(eq(users.email,email));
   if(found) throw new ConflictException('Email đã tồn tại');
   const hash=await argon2.hash(data.password,{type:argon2.argon2id});
   const [record]=await this.service.db.insert(users).values({email,displayName:data.displayName,passwordHash:hash}).returning({id:users.id,email:users.email,displayName:users.displayName});
   await this.startSession(record.id,res); return {user:{...record,role:'USER'}};
 }
 @Post('login') async login(@Body() raw:any,@Res({passthrough:true}) res:Response,@Req() req:Request){
   const input=readInput(loginSchema,raw);
   const [record]=await this.service.db.select().from(users).where(eq(users.email,input.email.toLowerCase().trim()));
   if(!record || record.status!=='ACTIVE' || !(await argon2.verify(record.passwordHash,input.password))) throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
   await this.startSession(record.id,res);
   await this.monitor.login(record.id,req).catch(()=>{});
   return {user:{id:record.id,email:record.email,displayName:record.displayName,role:record.role}};
 }
 @UseGuards(AuthGuard) @Get('me') me(@Req() req:any){return {user:req.user};}
 @UseGuards(AuthGuard) @Post('logout') async logout(@Req() req:Request,@Res({passthrough:true})res:Response){
   const cookie=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('pq_session='));
   if(cookie) await this.service.db.delete(sessions).where(eq(sessions.tokenHash,digest(cookie.slice(11))));
   res.clearCookie('pq_session',{path:'/'});return {ok:true};
 }
}

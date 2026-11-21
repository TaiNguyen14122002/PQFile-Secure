import { Controller,ForbiddenException,Get,Req,UseGuards } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { AuthGuard } from '../auth/auth.guard';
import { users } from '../db/schema';
@Controller('admin') @UseGuards(AuthGuard)
export class AdminController{
 constructor(private readonly svc:DbService){}
 @Get('users') async list(@Req()req:any){if(req.user.role!=='SYSTEM_ADMIN')throw new ForbiddenException();return this.svc.db.select({id:users.id,email:users.email,displayName:users.displayName,role:users.role,status:users.status}).from(users).limit(100);}
}

import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { and,eq,gt } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { sessions,users } from '../db/schema';
import { digest } from '../common/helpers';
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly db:DbService){}
  async canActivate(ctx:ExecutionContext){
    const req=ctx.switchToHttp().getRequest<Request & {user?:any}>();
    const cookie=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('pq_session='));
    const token=cookie?.slice('pq_session='.length);
    if(!token) throw new UnauthorizedException('Vui lòng đăng nhập');
    const [record]=await this.db.db.select({user:users}).from(sessions).innerJoin(users,eq(users.id,sessions.userId)).where(and(eq(sessions.tokenHash,digest(token)),gt(sessions.expiresAt,new Date()))).limit(1);
    if(!record || record.user.status!=='ACTIVE') throw new UnauthorizedException('Phiên đã hết hạn hoặc tài khoản bị khóa');
    req.user={id:record.user.id,email:record.user.email,displayName:record.user.displayName,role:record.user.role};
    return true;
  }
}

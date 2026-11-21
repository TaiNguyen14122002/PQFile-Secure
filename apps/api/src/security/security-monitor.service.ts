import { Injectable } from '@nestjs/common';
import { createHmac, randomBytes } from 'node:crypto';
import type { Request } from 'express';
import { and, count, desc, eq, gte, isNull } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { activityLogs, securityEvents } from '../db/schema';

/** Anomaly detection baseline. Never receives or parses plaintext file content. */
@Injectable()
export class SecurityMonitorService {
  private readonly secret=process.env.SECURITY_HMAC_KEY||randomBytes(32).toString('hex');
  constructor(private readonly svc:DbService) {
    if(!process.env.SECURITY_HMAC_KEY)console.warn('[PQFile] SECURITY_HMAC_KEY missing: device pseudonyms reset when API restarts');
  }
  private deviceTag(req:Request){
    // User-Agent is only a weak signal, not a cryptographically trusted device ID.
    const agent=String(req.headers['user-agent']||'unknown').slice(0,400);
    return createHmac('sha256',this.secret).update(agent).digest('hex').slice(0,40);
  }
  async login(userId:string,req:Request){
    const tag=this.deviceTag(req);
    const [previous]=await this.svc.db.select({id:securityEvents.id})
      .from(securityEvents).where(and(eq(securityEvents.userId,userId),eq(securityEvents.eventType,'LOGIN_OBSERVED'))).limit(1);
    const [known]=await this.svc.db.select({id:securityEvents.id}).from(securityEvents)
      .where(and(eq(securityEvents.userId,userId),eq(securityEvents.eventType,'LOGIN_OBSERVED'),eq(securityEvents.deviceTag,tag))).limit(1);
    await this.svc.db.insert(securityEvents).values({userId,eventType:'LOGIN_OBSERVED',riskScore:0,deviceTag:tag,
      reason:'Dấu hiệu trình duyệt đăng nhập (đã băm, không phải định danh thiết bị chắc chắn)'});
    if(previous&&!known)await this.svc.db.insert(securityEvents).values({userId,eventType:'UNFAMILIAR_BROWSER',riskScore:40,
      deviceTag:tag,reason:'Phát hiện trình duyệt/chuỗi User-Agent chưa từng ghi nhận'});
  }
  async downloaded(userId:string,fileId:string){
    const recent=new Date(Date.now()-60_000);
    const [previous]=await this.svc.db.select({value:count()}).from(securityEvents)
      .where(and(eq(securityEvents.userId,userId),eq(securityEvents.eventType,'DOWNLOAD_OBSERVED'),gte(securityEvents.createdAt,recent)));
    const inMinute=(previous?.value||0)+1;
    await this.svc.db.transaction(async tx=>{
      await tx.insert(securityEvents).values({userId,eventType:'DOWNLOAD_OBSERVED',riskScore:0,
        reason:'Ghi nhận lượt tải ciphertext'});
      await tx.insert(activityLogs).values({actorId:userId,action:'FILE_DOWNLOAD',resourceType:'file',resourceId:fileId});
      if(inMinute===5||inMinute===10)await tx.insert(securityEvents).values({userId,eventType:'DOWNLOAD_BURST',
        riskScore:inMinute>=10?85:65,reason:`${inMinute} lần tải trong khoảng 60 giây`});
    });
  }
  async denied(userId:string,fileId:string){
    const recent=new Date(Date.now()-5*60_000);
    const [previous]=await this.svc.db.select({value:count()}).from(securityEvents)
      .where(and(eq(securityEvents.userId,userId),eq(securityEvents.eventType,'ACCESS_DENIED'),gte(securityEvents.createdAt,recent)));
    const inWindow=(previous?.value||0)+1;
    await this.svc.db.transaction(async tx=>{
      await tx.insert(securityEvents).values({userId,eventType:'ACCESS_DENIED',riskScore:0,
        reason:'Truy cập tài nguyên không được cấp quyền'});
      if(inWindow===3||inWindow===7)await tx.insert(securityEvents).values({userId,eventType:'DENIED_BURST',
        riskScore:inWindow>=7?90:70,reason:`${inWindow} lần từ chối truy cập trong khoảng 5 phút`});
    });
  }
  async summary(userId:string){
    const [unread]=await this.svc.db.select({value:count()}).from(securityEvents)
      .where(and(eq(securityEvents.userId,userId),isNull(securityEvents.acknowledgedAt),gte(securityEvents.riskScore,40)));
    const [critical]=await this.svc.db.select({value:count()}).from(securityEvents)
      .where(and(eq(securityEvents.userId,userId),isNull(securityEvents.acknowledgedAt),gte(securityEvents.riskScore,80)));
    return {unread:unread?.value||0,critical:critical?.value||0};
  }
  async list(userId:string){
    return await this.svc.db.select({id:securityEvents.id,eventType:securityEvents.eventType,riskScore:securityEvents.riskScore,
      reason:securityEvents.reason,createdAt:securityEvents.createdAt,acknowledgedAt:securityEvents.acknowledgedAt})
      .from(securityEvents).where(and(eq(securityEvents.userId,userId),gte(securityEvents.riskScore,40)))
      .orderBy(desc(securityEvents.createdAt)).limit(100);
  }
}

import { BadRequestException, Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { and, count, desc, eq, gte, ilike, isNotNull, isNull, lte, or } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { activityLogs, securityEvents } from '../db/schema';
import { AuthGuard } from '../auth/auth.guard';
import { SecurityMonitorService } from './security-monitor.service';
import { optionalQueryText } from '../common/query-params';

type SecurityStatus='all'|'unread'|'reviewed';
function numberParam(value:string|undefined, fallback:number, min:number, max:number):number {
  if(value===undefined)return fallback;
  if(!/^\d+$/.test(value))throw new BadRequestException('Tham số phân trang không hợp lệ');
  return Math.min(max,Math.max(min,Number(value)));
}
function dayParam(value:string|undefined,last=false):Date|undefined {
  if(!value)return undefined;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new BadRequestException('Ngày phải có dạng YYYY-MM-DD');
  const date=new Date(`${value}T${last?'23:59:59.999':'00:00:00.000'}Z`);
  if(Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==value)throw new BadRequestException('Ngày không hợp lệ');
  return date;
}
@Controller('security')
@UseGuards(AuthGuard)
export class SecurityController {
 constructor(private readonly svc:DbService,private readonly monitor:SecurityMonitorService){}
 @Get('summary') async summary(@Req()req:any){return this.monitor.summary(req.user.id);}
 // Legacy list remains for old clients; the new page uses server-side filters/pagination.
 @Get('alerts') async alerts(@Req()req:any){return this.monitor.list(req.user.id);}
 @Get('alerts/paged')
 async paged(@Req()req:any,@Query('page') pageRaw?:string,@Query('size') sizeRaw?:string,
  @Query('status') statusRaw?:string,@Query('severity') severityRaw?:string,
  @Query('q') qRaw?:string,@Query('from') fromRaw?:string,@Query('to') toRaw?:string){
  const page=numberParam(optionalQueryText(pageRaw,'page'),1,1,100000),
    pageSize=numberParam(optionalQueryText(sizeRaw,'size'),15,5,100);
  const status=(optionalQueryText(statusRaw,'status')||'all') as SecurityStatus;
  if(!['all','unread','reviewed'].includes(status))throw new BadRequestException('Trạng thái không hợp lệ');
  const severity=optionalQueryText(severityRaw,'severity')||'all';
  if(!['all','critical','high','medium'].includes(severity))throw new BadRequestException('Mức độ không hợp lệ');
  const q=(optionalQueryText(qRaw,'q')||'').trim();if(q.length>100)throw new BadRequestException('Từ khóa quá dài');
  const from=dayParam(optionalQueryText(fromRaw,'from')),to=dayParam(optionalQueryText(toRaw,'to'),true);
  if(from&&to&&from>to)throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
  const conditions=[eq(securityEvents.userId,req.user.id),gte(securityEvents.riskScore,40)];
  if(status==='unread')conditions.push(isNull(securityEvents.acknowledgedAt));
  if(status==='reviewed')conditions.push(isNotNull(securityEvents.acknowledgedAt));
  if(severity==='critical')conditions.push(gte(securityEvents.riskScore,80));
  if(severity==='high'){conditions.push(gte(securityEvents.riskScore,60));conditions.push(lte(securityEvents.riskScore,79));}
  if(severity==='medium'){conditions.push(gte(securityEvents.riskScore,40));conditions.push(lte(securityEvents.riskScore,59));}
  if(from)conditions.push(gte(securityEvents.createdAt,from));
  if(to)conditions.push(lte(securityEvents.createdAt,to));
  if(q){const pattern=`%${q.replace(/[\\%_]/g,'\\$&')}%`;
   conditions.push(or(ilike(securityEvents.eventType,pattern),ilike(securityEvents.reason,pattern))!);
  }
  const filter=and(...conditions);
  const [items,totals,summary]=await Promise.all([
   this.svc.db.select({id:securityEvents.id,eventType:securityEvents.eventType,riskScore:securityEvents.riskScore,
    reason:securityEvents.reason,createdAt:securityEvents.createdAt,acknowledgedAt:securityEvents.acknowledgedAt})
    .from(securityEvents).where(filter).orderBy(desc(securityEvents.createdAt),desc(securityEvents.id))
    .limit(pageSize).offset((page-1)*pageSize),
   this.svc.db.select({value:count()}).from(securityEvents).where(filter),
   this.monitor.summary(req.user.id)
  ]);
  return {items,total:totals[0]?.value??0,page,pageSize,summary};
 }
 @Patch('alerts/acknowledge-all') async acknowledgeAll(@Req()req:any,@Body()body:any){
  // Deliberately acknowledge only currently unreviewed alerts belonging to the current user.
  if(body && (typeof body!=='object'||Array.isArray(body)||Object.keys(body).length>0))
   throw new BadRequestException('Không hỗ trợ tham số bổ sung');
  const updated=await this.svc.db.transaction(async tx=>{
    const changed=await tx.update(securityEvents).set({acknowledgedAt:new Date()})
     .where(and(eq(securityEvents.userId,req.user.id),gte(securityEvents.riskScore,40),isNull(securityEvents.acknowledgedAt)))
     .returning({id:securityEvents.id});
    if(changed.length)await tx.insert(activityLogs).values({actorId:req.user.id,action:'SECURITY_ALERT_ACK_ALL',
     resourceType:'security',details:{count:changed.length}});
    return changed.length;
  });
  return {ok:true,updated};
 }
 @Patch('alerts/:id/ack') async acknowledge(@Req()req:any,@Param('id',new ParseUUIDPipe())id:string){
  return this.svc.db.transaction(async tx=>{
   const [changed]=await tx.update(securityEvents).set({acknowledgedAt:new Date()})
    .where(and(eq(securityEvents.id,id),eq(securityEvents.userId,req.user.id),gte(securityEvents.riskScore,40)))
    .returning({id:securityEvents.id});
   if(!changed)throw new NotFoundException('Không tìm thấy cảnh báo của bạn');
   await tx.insert(activityLogs).values({actorId:req.user.id,action:'SECURITY_ALERT_ACK',resourceType:'security',resourceId:id});
   return {ok:true};
  });
 }
}

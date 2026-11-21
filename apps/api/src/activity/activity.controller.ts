import { BadRequestException, Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { and, count, desc, eq, gte, ilike, lte, or } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { AuthGuard } from '../auth/auth.guard';
import { activityLogs, files } from '../db/schema';

function parseDay(value:string|undefined,endOfDay=false):Date|undefined {
  if(!value)return undefined;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new BadRequestException('Ngày phải có dạng YYYY-MM-DD');
  const date=new Date(`${value}T${endOfDay?'23:59:59.999':'00:00:00.000'}Z`);
  if(Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==value)
    throw new BadRequestException('Ngày không hợp lệ');
  return date;
}

@Controller('activity')
@UseGuards(AuthGuard)
export class ActivityController {
  constructor(private readonly svc:DbService) {}

  @Get()
  async list(@Req() req:any) {
    return this.svc.db.select({id:activityLogs.id,action:activityLogs.action,
      resourceType:activityLogs.resourceType,createdAt:activityLogs.createdAt})
      .from(activityLogs).where(eq(activityLogs.actorId,req.user.id))
      .orderBy(desc(activityLogs.createdAt),desc(activityLogs.id)).limit(50);
  }

  /** Search/filter happens BEFORE pagination; results are restricted to the signed-in actor. */
  @Get('paged')
  async paged(@Req() req:any,@Query('page') pageRaw?:string,@Query('size') sizeRaw?:string,
    @Query('q') qRaw?:string,@Query('action') actionRaw?:string,
    @Query('from') fromRaw?:string,@Query('to') toRaw?:string) {
    const page=Math.max(1,Math.min(100000,Number.parseInt(pageRaw||'1',10)||1));
    const pageSize=Math.max(5,Math.min(100,Number.parseInt(sizeRaw||'25',10)||25));
    const q=(qRaw||'').trim();
    if(q.length>100)throw new BadRequestException('Từ khóa tìm kiếm quá dài');
    if(actionRaw&&!/^[A-Z_]{3,80}$/.test(actionRaw))throw new BadRequestException('Loại hoạt động không hợp lệ');
    const from=parseDay(fromRaw),to=parseDay(toRaw,true);
    if(from&&to&&from>to)throw new BadRequestException('Khoảng ngày không hợp lệ');
    const pattern=`%${q.replace(/[\\%_]/g,'\\$&')}%`;
    const conditions=[eq(activityLogs.actorId,req.user.id)];
    if(q)conditions.push(or(ilike(activityLogs.action,pattern),ilike(files.displayLabel,pattern))!);
    if(actionRaw)conditions.push(eq(activityLogs.action,actionRaw));
    if(from)conditions.push(gte(activityLogs.createdAt,from));
    if(to)conditions.push(lte(activityLogs.createdAt,to));
    const filter=and(...conditions);
    const [items,totals]=await Promise.all([
      this.svc.db.select({id:activityLogs.id,action:activityLogs.action,
        resourceType:activityLogs.resourceType,resourceId:activityLogs.resourceId,
        details:activityLogs.details,createdAt:activityLogs.createdAt,fileName:files.displayLabel})
        .from(activityLogs).leftJoin(files,eq(activityLogs.resourceId,files.id))
        .where(filter).orderBy(desc(activityLogs.createdAt),desc(activityLogs.id))
        .limit(pageSize).offset((page-1)*pageSize),
      this.svc.db.select({total:count()}).from(activityLogs)
        .leftJoin(files,eq(activityLogs.resourceId,files.id)).where(filter)
    ]);
    return {items,total:totals[0]?.total??0,page,pageSize};
  }
}

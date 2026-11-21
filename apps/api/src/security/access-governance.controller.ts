import { BadRequestException,Body,Controller,Delete,Get,NotFoundException,Param,ParseUUIDPipe,Patch,Req,UseGuards } from '@nestjs/common';
import { and,desc,eq,inArray,isNull,sql } from 'drizzle-orm';
import { z } from 'zod';
import { DbService } from '../db/db.service';
import { AuthGuard } from '../auth/auth.guard';
import { activityLogs,fileShares,files,users,workspaces,workspaceMembers } from '../db/schema';
import { readInput } from '../common/helpers';
import { parseGovernanceTimestamp } from './governance-date.utils';
import { hasActiveGrantExpiration, readTimestamp } from '../common/runtime-safety';

const LIMIT_FILES=80;
const LIMIT_GRANTS=350;
const MS_DAY=86_400_000;
/** Owner-only sharing reviews and descriptive graph. No ciphertext or content is read. */
@Controller('governance') @UseGuards(AuthGuard)
export class AccessGovernanceController {
 constructor(private readonly svc:DbService){}
 private async snapshot(ownerId:string){
  const owned=await this.svc.db.select({id:files.id,label:files.displayLabel,createdAt:files.createdAt})
   .from(files).where(and(eq(files.ownerId,ownerId),eq(files.status,'ACTIVE'),isNull(files.deletedAt)))
   .orderBy(desc(files.createdAt)).limit(LIMIT_FILES+1);
  const limitedFiles=owned.slice(0,LIMIT_FILES);
  if(!limitedFiles.length)return {owned:[],grants:[],downloads:[],fileTruncated:false,grantTruncated:false};
  const grants=await this.svc.db.select({id:fileShares.id,fileId:fileShares.fileId,recipientId:fileShares.sharedWith,
    permission:fileShares.permission,createdAt:fileShares.createdAt,expiresAt:fileShares.expiresAt,
    taskDeadlineAt:fileShares.taskDeadlineAt,revokedAt:fileShares.revokedAt,
    displayName:users.displayName,email:users.email,status:users.status})
   .from(fileShares).innerJoin(users,eq(users.id,fileShares.sharedWith))
   .where(and(inArray(fileShares.fileId,limitedFiles.map(f=>f.id)),isNull(fileShares.revokedAt)))
   .orderBy(desc(fileShares.createdAt)).limit(LIMIT_GRANTS+1);
  const relevant=grants.slice(0,LIMIT_GRANTS);
  const downloads=await this.svc.db.select({actorId:activityLogs.actorId,fileId:activityLogs.resourceId,at:sql<Date | string | null>`max(${activityLogs.createdAt})`})
   .from(activityLogs).where(and(eq(activityLogs.action,'FILE_DOWNLOAD'),
    inArray(activityLogs.resourceId,limitedFiles.map(f=>f.id))))
   .groupBy(activityLogs.actorId,activityLogs.resourceId);
  return {owned:limitedFiles,grants:relevant,downloads,fileTruncated:owned.length>LIMIT_FILES,grantTruncated:grants.length>LIMIT_GRANTS};
 }
 @Get('review') async review(@Req()req:any){
  const snap=await this.snapshot(req.user.id);const now=Date.now();
  const last=new Map<string,Date>();
  for(const log of snap.downloads){
   // Raw SQL aggregate MAX(timestamp) does not use Drizzle's timestamp mapper.
   // node-postgres can return an ISO/string even though sql<Date> claims a Date.
   const at=parseGovernanceTimestamp(log.at);
   if(!at)continue;
   const key=`${log.fileId}:${log.actorId}`;
   if(!last.has(key))last.set(key,at);
  }
  const count=new Map<string,number>();for(const grant of snap.grants){if(hasActiveGrantExpiration(grant.expiresAt,now))count.set(grant.fileId,(count.get(grant.fileId)||0)+1);}
  const labels=new Map(snap.owned.map(f=>[f.id,f.label]));
  const review=snap.grants.map(g=>{
   const recent=last.get(`${g.fileId}:${g.recipientId}`);
   // Downloads prior to this grant do not justify keeping the new grant.
   const grantedAt=readTimestamp(g.createdAt)??now;
   const lastAccess=recent&&recent.getTime()>=grantedAt?recent:null;
   const sharedDays=Math.max(0,Math.floor((now-grantedAt)/MS_DAY));
   const idleDays=Math.max(0,Math.floor((now-(readTimestamp(lastAccess)??grantedAt))/MS_DAY));
   const active=hasActiveGrantExpiration(g.expiresAt,now);
   const reasons:string[]=[];let score=0;
   if(g.status!=='ACTIVE'){score=98;reasons.push('Tài khoản người nhận không còn hoạt động');}
   if(g.taskDeadlineAt&&(readTimestamp(g.taskDeadlineAt)??Number.POSITIVE_INFINITY)<now){score=Math.max(score,90);reasons.push('Đã qua hạn công việc do chủ sở hữu khai báo');}
   if(!g.expiresAt && sharedDays>=30){score=Math.max(score,62);reasons.push('Quyền chia sẻ trên 30 ngày nhưng không có thời hạn tự hết hiệu lực');}
   if(idleDays>=60){score=Math.max(score,78);reasons.push(`Không ghi nhận tải mới trong ${idleDays} ngày`);}
   else if(idleDays>=30){score=Math.max(score,48);reasons.push(`Không ghi nhận tải mới trong ${idleDays} ngày`);}
   if((count.get(g.fileId)||0)>=8){score=Math.max(score,40);reasons.push('Tài liệu đang được chia sẻ cho nhiều người');}
   // Expired grants do not allow access, show them separately for housekeeping.
   if(!active){score=0;reasons.push('Quyền đã tự hết hạn; không còn tải được tệp');}
   return {id:g.id,fileId:g.fileId,fileLabel:labels.get(g.fileId)||'Tệp',recipientId:g.recipientId,
    recipientName:g.displayName,recipientEmail:g.email,permission:g.permission,createdAt:g.createdAt,
    expiresAt:g.expiresAt,taskDeadlineAt:g.taskDeadlineAt,lastDownloadedAt:lastAccess,
    active,score,reasons,sharedDays,idleDays};
  }).sort((a,b)=>Number(b.active)-Number(a.active)||b.score-a.score);
  return {items:review,filesReviewed:snap.owned.length,activeGrants:review.filter(x=>x.active).length,
   suggestions:review.filter(x=>x.active&&x.score>=40).length,
   truncated:snap.fileTruncated||snap.grantTruncated,
   note:'Gợi ý sử dụng nhật ký tải ciphertext, không suy đoán rằng người nhận đã đọc tài liệu; không có dữ liệu truy cập trước khi bật ghi nhật ký.'};
 }
 @Patch('grants/:id/deadline') async deadline(@Req()req:any,@Param('id',new ParseUUIDPipe())id:string,@Body()body:any){
  const input=readInput(z.object({taskDeadlineAt:z.iso.datetime().nullable()}),body);
  const owned=await this.svc.db.select({id:fileShares.id}).from(fileShares)
   .innerJoin(files,eq(files.id,fileShares.fileId))
   .where(and(eq(fileShares.id,id),eq(files.ownerId,req.user.id),isNull(fileShares.revokedAt),eq(files.status,'ACTIVE'))).limit(1);
  if(!owned.length)throw new NotFoundException('Quyền này không thuộc sở hữu của bạn');
  const deadline=input.taskDeadlineAt?new Date(input.taskDeadlineAt):null;
  if(deadline && (Number.isNaN(deadline.getTime())||deadline.getTime()<Date.now()-365*MS_DAY))throw new BadRequestException('Ngày công việc không hợp lệ');
  await this.svc.db.transaction(async tx=>{
   await tx.update(fileShares).set({taskDeadlineAt:deadline}).where(eq(fileShares.id,id));
   await tx.insert(activityLogs).values({actorId:req.user.id,action:'GRANT_TASK_DEADLINE',resourceType:'file',
    details:{grantId:id,taskDeadlineAt:deadline?.toISOString()||null}});
  });
  return {ok:true};
 }
 @Delete('grants/:id') async revoke(@Req()req:any,@Param('id',new ParseUUIDPipe())id:string){
  const [grant]=await this.svc.db.select({id:fileShares.id,fileId:fileShares.fileId,recipientId:fileShares.sharedWith})
   .from(fileShares).innerJoin(files,eq(files.id,fileShares.fileId))
   .where(and(eq(fileShares.id,id),eq(files.ownerId,req.user.id),isNull(fileShares.revokedAt))).limit(1);
  if(!grant)throw new NotFoundException('Quyền không tồn tại hoặc đã thu hồi');
  await this.svc.db.transaction(async tx=>{
   await tx.update(fileShares).set({revokedAt:new Date()}).where(eq(fileShares.id,id));
   await tx.insert(activityLogs).values({actorId:req.user.id,action:'FILE_SHARE_REVOKE_REVIEW',resourceType:'file',resourceId:grant.fileId,
    details:{recipientId:grant.recipientId}});
  });return {ok:true};
 }
 @Get('graph') async graph(@Req()req:any){
  const ownerId=req.user.id,snap=await this.snapshot(ownerId),now=Date.now();
  const live=snap.grants.filter(g=>!g.revokedAt&&(hasActiveGrantExpiration(g.expiresAt,now)));
  const reachable=new Set(live.map(g=>g.recipientId));
  const groups=await this.svc.db.select({id:workspaces.id,name:workspaces.name,userId:workspaceMembers.userId})
   .from(workspaces).leftJoin(workspaceMembers,eq(workspaceMembers.workspaceId,workspaces.id))
   .where(eq(workspaces.ownerId,ownerId)).limit(200);
  const nodes=[{id:`user:${ownerId}`,label:'Tôi (chủ sở hữu)',kind:'owner',score:0},
   ...snap.owned.map(f=>({id:`file:${f.id}`,label:f.label,kind:'file',score:Math.min(100,(live.filter(g=>g.fileId===f.id).length)*13)})),
   ...[...new Map(live.map(g=>[g.recipientId,g])).values()].map(g=>({id:`user:${g.recipientId}`,label:g.displayName,kind:'person',score:Math.min(100,live.filter(s=>s.recipientId===g.recipientId).length*15)})),
   ...[...new Map(groups.map(g=>[g.id,g])).values()].map(g=>({id:`group:${g.id}`,label:g.name,kind:'group',score:0}))];
  const edges=[...snap.owned.map(f=>({from:`user:${ownerId}`,to:`file:${f.id}`,kind:'owner'})),
   ...live.map(g=>({from:`file:${g.fileId}`,to:`user:${g.recipientId}`,kind:'grant'})),
   ...groups.filter(g=>g.userId&&(reachable.has(g.userId)||g.userId===ownerId)).map(g=>({from:`user:${g.userId}`,to:`group:${g.id}`,kind:'membership'}))];
  return {nodes,edges,truncated:snap.fileTruncated||snap.grantTruncated||groups.length===200,
   note:'Cạnh nhóm chỉ thể hiện quan hệ thành viên được ghi nhận, KHÔNG có nghĩa nhóm tự động được cấp quyền tệp. Chỉ các cạnh cấp quyền mới tạo quyền truy cập thực tế.'};
 }
}

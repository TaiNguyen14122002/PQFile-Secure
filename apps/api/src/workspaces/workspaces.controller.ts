import { Body, ConflictException, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { DbService } from '../db/db.service';
import { AuthGuard } from '../auth/auth.guard';
import { activityLogs, workspaces, workspaceMembers, users } from '../db/schema';
import { readInput } from '../common/helpers';

const groupName = z.object({name:z.string().trim().min(2).max(120)});
const memberInput = z.object({email:z.email().max(255),role:z.enum(['ADMIN','EDITOR','UPLOADER','VIEWER'])});
const memberRole = z.object({role:z.enum(['ADMIN','EDITOR','UPLOADER','VIEWER'])});

@Controller('workspaces')
@UseGuards(AuthGuard)
export class WorkspacesController {
  constructor(private readonly svc:DbService) {}

  @Get()
  async list(@Req() req:any) {
    return this.svc.db.select({id:workspaces.id,name:workspaces.name,role:workspaceMembers.role,createdAt:workspaces.createdAt})
      .from(workspaceMembers).innerJoin(workspaces,eq(workspaces.id,workspaceMembers.workspaceId))
      .where(eq(workspaceMembers.userId,req.user.id));
  }

  @Post()
  async create(@Req() req:any,@Body() raw:any) {
    const {name}=readInput(groupName,raw);
    return this.svc.db.transaction(async tx=>{
      const [group]=await tx.insert(workspaces).values({name,ownerId:req.user.id}).returning();
      await tx.insert(workspaceMembers).values({workspaceId:group.id,userId:req.user.id,role:'OWNER'});
      await tx.insert(activityLogs).values({actorId:req.user.id,action:'WORKSPACE_CREATE',resourceType:'workspace',resourceId:group.id,details:{name}});
      return group;
    });
  }

  @Patch(':id')
  async rename(@Req() req:any,@Param('id',new ParseUUIDPipe()) id:string,@Body() raw:any) {
    const {name}=readInput(groupName,raw);
    const group=await this.assertOwner(req.user.id,id);
    await this.svc.db.transaction(async tx=>{
      await tx.update(workspaces).set({name}).where(eq(workspaces.id,group.id));
      await tx.insert(activityLogs).values({actorId:req.user.id,action:'WORKSPACE_RENAME',resourceType:'workspace',resourceId:id,details:{name}});
    });
    return {ok:true};
  }

  @Delete(':id')
  async deleteGroup(@Req() req:any,@Param('id',new ParseUUIDPipe()) id:string) {
    await this.assertOwner(req.user.id,id);
    // Membership rows are deleted by FK cascade; no ciphertext or user accounts are touched.
    await this.svc.db.transaction(async tx=>{
      await tx.delete(workspaces).where(eq(workspaces.id,id));
      await tx.insert(activityLogs).values({actorId:req.user.id,action:'WORKSPACE_DELETE',resourceType:'workspace',resourceId:id});
    });
    return {ok:true};
  }

  @Get(':id/members')
  async members(@Req() req:any,@Param('id',new ParseUUIDPipe()) id:string) {
    await this.assertMember(req.user.id,id);
    return this.svc.db.select({id:users.id,email:users.email,displayName:users.displayName,role:workspaceMembers.role})
      .from(workspaceMembers).innerJoin(users,eq(users.id,workspaceMembers.userId))
      .where(eq(workspaceMembers.workspaceId,id));
  }

  @Post(':id/members')
  async invite(@Req() req:any,@Param('id',new ParseUUIDPipe()) id:string,@Body() raw:any) {
    const actor=await this.assertMember(req.user.id,id);
    if(!['OWNER','ADMIN'].includes(actor.role))throw new ForbiddenException('Bạn không có quyền thêm thành viên');
    const data=readInput(memberInput,raw);
    if(actor.role==='ADMIN'&&data.role==='ADMIN')throw new ForbiddenException('Chỉ chủ nhóm được cấp quyền quản trị');
    const email=data.email.toLowerCase().trim();
    const [person]=await this.svc.db.select().from(users).where(eq(users.email,email));
    if(!person||person.status!=='ACTIVE')throw new NotFoundException('Không tìm thấy tài khoản đang hoạt động');
    const existing=await this.findMember(person.id,id);
    if(existing)throw new ConflictException('Người dùng đã tham gia nhóm');
    await this.svc.db.transaction(async tx=>{
      await tx.insert(workspaceMembers).values({workspaceId:id,userId:person.id,role:data.role});
      await tx.insert(activityLogs).values({actorId:req.user.id,action:'WORKSPACE_MEMBER_ADD',resourceType:'workspace',resourceId:id,details:{memberId:person.id,role:data.role}});
    });
    return {ok:true};
  }

  @Patch(':id/members/:userId')
  async changeRole(@Req() req:any,@Param('id',new ParseUUIDPipe()) id:string,@Param('userId',new ParseUUIDPipe()) uid:string,@Body() raw:any) {
    const {role}=readInput(memberRole,raw);
    const actor=await this.assertMember(req.user.id,id);
    if(!['OWNER','ADMIN'].includes(actor.role))throw new ForbiddenException('Không có quyền thay đổi vai trò');
    const target=await this.assertMember(uid,id);
    if(target.role==='OWNER'||actor.role==='ADMIN'&&(target.role==='ADMIN'||role==='ADMIN'))
      throw new ForbiddenException('Không được thay đổi vai trò này');
    if(target.role===role)return {ok:true};
    await this.svc.db.transaction(async tx=>{
      await tx.update(workspaceMembers).set({role}).where(and(eq(workspaceMembers.workspaceId,id),eq(workspaceMembers.userId,uid)));
      await tx.insert(activityLogs).values({actorId:req.user.id,action:'WORKSPACE_MEMBER_ROLE',resourceType:'workspace',resourceId:id,details:{memberId:uid,from:target.role,to:role}});
    });
    return {ok:true};
  }

  @Delete(':id/members/:userId')
  async removeMember(@Req() req:any,@Param('id',new ParseUUIDPipe()) id:string,@Param('userId',new ParseUUIDPipe()) uid:string) {
    const actor=await this.assertMember(req.user.id,id);
    const target=await this.assertMember(uid,id);
    if(target.role==='OWNER')throw new ForbiddenException('Chủ nhóm không thể rời hoặc bị xóa khỏi nhóm');
    if(uid!==req.user.id&&!['OWNER','ADMIN'].includes(actor.role))throw new ForbiddenException('Không có quyền xóa thành viên');
    if(actor.role==='ADMIN'&&target.role==='ADMIN'&&uid!==req.user.id)throw new ForbiddenException('Không thể xóa quản trị viên khác');
    await this.svc.db.transaction(async tx=>{
      await tx.delete(workspaceMembers).where(and(eq(workspaceMembers.workspaceId,id),eq(workspaceMembers.userId,uid)));
      await tx.insert(activityLogs).values({actorId:req.user.id,action:uid===req.user.id?'WORKSPACE_LEAVE':'WORKSPACE_MEMBER_REMOVE',resourceType:'workspace',resourceId:id,details:{memberId:uid}});
    });
    return {ok:true};
  }

  private async findMember(userId:string,id:string) {
    const [m]=await this.svc.db.select().from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId,id),eq(workspaceMembers.userId,userId))).limit(1);
    return m||null;
  }
  private async assertMember(userId:string,id:string) {
    const member=await this.findMember(userId,id);
    if(!member)throw new ForbiddenException('Bạn không thuộc nhóm này');
    return member;
  }
  private async assertOwner(userId:string,id:string) {
    const [group]=await this.svc.db.select().from(workspaces).where(eq(workspaces.id,id)).limit(1);
    if(!group)throw new NotFoundException('Nhóm không tồn tại');
    if(group.ownerId!==userId)throw new ForbiddenException('Chỉ chủ nhóm được thực hiện thao tác này');
    return group;
  }
}

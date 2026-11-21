/** Pure, deterministic plans for ONE isolated showcase identity. No DB or network calls. */
import { createHash } from 'node:crypto';
import { buildPlan, PEOPLE_EMAILS } from './realistic-scenarios.mjs';
export const DATASET_SHOWCASE='pqfile-showcase-account-2026-v1';
export const SHOWCASE_EMAIL='demo.showcase@pqfile.local';
export const SHOWCASE_NAME='Demo toàn diện PQFile Secure';
export const SHOWCASE_COUNTS={files:120,owned:96,incoming:24,trash:12,workspaces:6,security:36};
export const idFor=(text)=>{const h=createHash('sha256').update(`${DATASET_SHOWCASE}:${text}`).digest('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;};
export function buildShowcasePlan(reference=new Date()){
  const nowMs = new Date(reference).getTime();
  if(!Number.isFinite(nowMs))throw new Error('Ngày tham chiếu không hợp lệ');
  const source=buildPlan(reference).documents;
  const files=source.slice(0,SHOWCASE_COUNTS.files).map((base,i)=>{
    const ownedByShowcase=i<SHOWCASE_COUNTS.owned;
    const peerIndex=1+(i%4);
    const displayName=`DEMO ${base.title} - HS${String(i+1).padStart(4,'0')}.${base.extension}`;
    return {...base,id:idFor(`file:${i}`),dataset:DATASET_SHOWCASE,recordCode:`DEMO-${String(i+1).padStart(5,'0')}`,
      index:i+1,fileName:displayName,title:`${base.title} (bộ trình diễn)`,
      ownerIndex:ownedByShowcase?0:peerIndex,peerIndex,trashed:ownedByShowcase&&i>=84,
      email:'phongban@demo.example',author:ownedByShowcase?SHOWCASE_NAME:base.author,
      scenario:i%9===0?'Quyền chia sẻ cần thu hồi':i%11===0?'Nghi vấn tải xuống bất thường':base.scenario};
  });
  const grants=[];
  for(let i=0;i<files.length;i++){
    const file=files[i];
    if(file.trashed)continue;
    const recipientIndex=i<96?(1+(i%4)):0;
    // 42 outgoing shares from the showcase account, 24 incoming grants.
    if(i<96 && (i%2!==0))continue;
    const sharedAt=new Date(new Date(file.createdAt).getTime()+3600000).toISOString();
    const eligibleOld = new Date(sharedAt).getTime() < nowMs-15*86400000;
    const expired=(i%11===0)&&eligibleOld;
    const revoked=(i%17===0)&&eligibleOld;
    const expiresAt=expired?new Date(nowMs-7*86400000).toISOString():
      (i%5===0?new Date(nowMs+30*86400000).toISOString():null);
    const taskDeadlineAt=(i%6===0)?new Date(nowMs-10*86400000).toISOString():
      (i%4===0?new Date(nowMs+14*86400000).toISOString():null);
    grants.push({id:idFor(`share:${i}`),fileId:file.id,ownerIndex:file.ownerIndex,recipientIndex,
      expiresAt,revokedAt:revoked?new Date(nowMs-5*86400000).toISOString():null,
      taskDeadlineAt,createdAt:sharedAt});
  }
  const groups=['Ban điều hành dự án demo','Nhóm phân tích AI','Kiểm thử bảo mật','Quản trị tài liệu','Nghiên cứu hậu lượng tử','Đánh giá triển khai'];
  const workspaces=groups.map((name,i)=>({id:idFor(`workspace:${i}`),name,createdAt:files[i].createdAt,
    members:[0,1+(i%4),1+((i+1)%4),1+((i+2)%4)]}));
  const activities=[];
  for(let i=0;i<files.length;i++){
    const file=files[i];activities.push({id:idFor(`audit:upload:${i}`),actorIndex:file.ownerIndex,
      action:'FILE_ENCRYPT_UPLOAD',fileId:file.id,createdAt:file.createdAt});
    if(i<84 && i%2===0)activities.push({id:idFor(`audit:preview:${i}`),actorIndex:0,
      action:'FILE_PREVIEW',fileId:file.id,createdAt:new Date(new Date(file.createdAt).getTime()+2*3600000).toISOString()});
  }
  for(const [i,share] of grants.entries()){
    activities.push({id:idFor(`audit:share:${i}`),actorIndex:share.ownerIndex,action:'FILE_SHARE',fileId:share.fileId,
      createdAt:share.createdAt});
    if(i%3===0 && !share.revokedAt && (!share.expiresAt || new Date(share.expiresAt)>new Date()))
      activities.push({id:idFor(`audit:download:${i}`),actorIndex:share.recipientIndex,action:'FILE_DOWNLOAD',
        fileId:share.fileId,createdAt:new Date(new Date(share.createdAt).getTime()+4*3600000).toISOString()});
  }
  for(const [i,workspace] of workspaces.entries())activities.push({id:idFor(`audit:workspace:${i}`),actorIndex:0,
    action:'WORKSPACE_CREATE',fileId:workspace.id,createdAt:workspace.createdAt,resourceType:'workspace'});
  const security=Array.from({length:SHOWCASE_COUNTS.security},(_,i)=>{
    const scenarios=[['UNFAMILIAR_BROWSER',48,'Trình duyệt chưa được ghi nhận (mô phỏng)'],
      ['DOWNLOAD_BURST',83,'Tần suất tải tệp tăng đột biến (mô phỏng)'],
      ['DENIED_BURST',91,'Liên tiếp truy cập không đủ quyền (mô phỏng)'],
      ['DOWNLOAD_OBSERVED',0,'Quan sát truy cập tệp thông thường (mô phỏng)']];
    const [eventType,riskScore,reason]=scenarios[i%4];
    return {id:idFor(`security:${i}`),eventType,riskScore,reason,createdAt:new Date(nowMs-(i*2+1)*86400000).toISOString(),
      acknowledgedAt:i%7===0?new Date(nowMs-(i*2)*86400000).toISOString():null,
      deviceTag:createHash('sha256').update(`${DATASET_SHOWCASE}:device:${i%8}`).digest('hex').slice(0,40)};
  });
  return {dataset:DATASET_SHOWCASE,email:SHOWCASE_EMAIL,people:PEOPLE_EMAILS,files,grants,workspaces,activities,security};
}

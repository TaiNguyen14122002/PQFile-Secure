import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, DATASET_V2, PEOPLE_EMAILS, syntheticId, linesForDocument } from '../../apps/api/scripts/realistic-scenarios.mjs';
import { generateFile } from '../../apps/api/scripts/realistic-file-builder.mjs';
const plan=buildPlan(new Date('2026-11-21T00:00:00Z'));
const now=Date.parse('2026-11-21T00:00:00Z');

test('số liệu thống nhất và ngày không ở tương lai',()=>{
  assert.equal(plan.dataset,DATASET_V2);
  assert.equal(plan.documents.length,144);
  assert.equal(plan.shares.length,176);
  assert.equal(plan.activities.length,1115);
  assert.equal(plan.security.length,180);
  for(const doc of plan.documents)assert.ok(Date.parse(doc.createdAt)<=now);
});
test('định danh duy nhất và thuật toán sinh ổn định',()=>{
  const ids=[...plan.documents,...plan.shares,...plan.activities,...plan.security].map(x=>x.id);
  assert.equal(new Set(ids).size,ids.length);
  assert.equal(syntheticId('file:0'),plan.documents[0].id);
  assert.deepEqual(buildPlan(new Date('2026-11-21T23:00Z')),plan);
});
test('quan hệ chia sẻ không chứa chính chủ và không nhân bản người nhận',()=>{
  const docs=new Map(plan.documents.map(d=>[d.id,d]));
  const unique=new Set();
  for(const share of plan.shares){
    const doc=docs.get(share.fileId);assert.ok(doc);
    assert.equal(share.ownerIndex,doc.ownerIndex);
    assert.notEqual(share.ownerIndex,share.recipientIndex);
    const pair=`${share.fileId}:${share.recipientIndex}`;
    assert.ok(!unique.has(pair));unique.add(pair);
    assert.ok(Date.parse(share.createdAt)>=Date.parse(doc.createdAt));
    if(share.expiresAt)assert.ok(Date.parse(share.expiresAt)>Date.parse(share.createdAt));
    if(share.revokedAt)assert.ok(Date.parse(share.revokedAt)>Date.parse(share.createdAt));
  }
});
test('nhật ký tải hợp lệ về người nhận và thời hạn được cấp',()=>{
  const docs=new Map(plan.documents.map(d=>[d.id,d]));
  const grants=new Map(plan.shares.map(s=>[`${s.fileId}:${s.recipientIndex}`,s]));
  let found=0;
  for(const log of plan.activities.filter(a=>a.action==='FILE_DOWNLOAD')){
    found++;
    const doc=docs.get(log.fileId);assert.ok(doc);
    const share=grants.get(`${log.fileId}:${log.actorIndex}`);assert.ok(share);
    const time=Date.parse(log.createdAt);
    assert.ok(time>=Date.parse(share.createdAt));
    if(share.revokedAt)assert.ok(time<Date.parse(share.revokedAt));
    if(share.expiresAt)assert.ok(time<Date.parse(share.expiresAt));
  }
  assert.ok(found>=60);
});
test('sự kiện bảo mật chỉ dùng dữ liệu giả lập, điểm 0–100',()=>{
  assert.equal(PEOPLE_EMAILS.length,12);
  for(const e of plan.security){
    assert.ok(e.riskScore>=0&&e.riskScore<=100);
    assert.match(e.deviceTag,/^[a-f0-9]{40}$/);
    assert.ok(e.userIndex>=0&&e.userIndex<12);
  }
});
test('tệp hợp lệ về header định dạng và có nội dung nghiệp vụ',()=>{
  const signature={pdf:'%PDF-',docx:'PK',xlsx:'PK',png:'\x89PNG',zip:'PK'};
  for(const extension of ['pdf','docx','xlsx','txt','csv','json','png','zip']){
    const doc=plan.documents.find(d=>d.extension===extension);
    const data=generateFile(doc);
    assert.ok(data.byteLength>400,extension);
    if(signature[extension])assert.equal(data.subarray(0,signature[extension].length).toString('latin1'),signature[extension],extension);
    if(extension==='json')assert.equal(JSON.parse(data.toString('utf8')).synthetic,true);
    if(extension==='txt')assert.ok(data.toString('utf8').includes('BỘ DỮ LIỆU TỔNG HỢP'));
  }
  assert.ok(linesForDocument(plan.documents[0]).some(x=>x.includes('Hạn xử lý')));
});

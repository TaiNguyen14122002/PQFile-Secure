#!/usr/bin/env node
/** Offline preview only. Does not connect to PostgreSQL or upload anything. */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildPlan, PEOPLE_EMAILS, PEOPLE_NAMES, DATASET_V2 } from '../apps/api/scripts/realistic-scenarios.mjs';
import { generateFile } from '../apps/api/scripts/realistic-file-builder.mjs';

const output=path.resolve(process.argv[2]||'synthetic-preview');
const rawDate=process.argv[3];
if(rawDate && !/^\d{4}-\d{2}-\d{2}$/.test(rawDate))throw new Error('Ngày phải ở dạng YYYY-MM-DD');
const reference=rawDate ? new Date(`${rawDate}T00:00:00.000Z`) : new Date();
if(Number.isNaN(reference.getTime())||rawDate && reference.toISOString().slice(0,10)!==rawDate)throw new Error('Ngày không hợp lệ');
const plan=buildPlan(reference);
const fields={
  tai_khoan:['email','display_name','kind'],
  tai_lieu:['id','recordCode','fileName','owner_email','extension','category','classification','department','approval','createdAt','taskDeadlineAt','scenario'],
  chia_se:['id','fileId','owner_email','recipient_email','createdAt','expiresAt','taskDeadlineAt','revokedAt'],
  nhat_ky:['id','actor_email','fileId','action','resourceType','createdAt'],
  su_kien_an_ninh:['id','user_email','eventType','riskScore','reason','createdAt','acknowledgedAt']
};
const csvValue=value=>{
  const text=String(value??'');
  // Protect spreadsheet viewers even when future test data is user-provided.
  const safe=/^[\s]*[=+@\-\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"','""')}"`;
};
const writeCsv=async(file,rows,cols)=>{
  const content='\ufeff'+[cols.join(','),...rows.map(row=>cols.map(k=>csvValue(row[k])).join(','))].join('\r\n')+'\r\n';
  await writeFile(path.join(output,`${file}.csv`),content,'utf8');
};
await mkdir(path.join(output,'tep_mau'),{recursive:true});
await writeCsv('tai_khoan',PEOPLE_EMAILS.map((email,i)=>({email,display_name:PEOPLE_NAMES[i],kind:'SYNTHETIC'})),fields.tai_khoan);
await writeCsv('tai_lieu',plan.documents.map(d=>({...d,owner_email:PEOPLE_EMAILS[d.ownerIndex]})),fields.tai_lieu);
await writeCsv('chia_se',plan.shares.map(s=>({...s,owner_email:PEOPLE_EMAILS[s.ownerIndex],recipient_email:PEOPLE_EMAILS[s.recipientIndex]})),fields.chia_se);
await writeCsv('nhat_ky',plan.activities.map(a=>({...a,actor_email:PEOPLE_EMAILS[a.actorIndex]})),fields.nhat_ky);
await writeCsv('su_kien_an_ninh',plan.security.map(e=>({...e,user_email:PEOPLE_EMAILS[e.userIndex]})),fields.su_kien_an_ninh);
for(const extension of ['pdf','docx','xlsx','txt','csv','json','png','zip']){
  const doc=plan.documents.find(doc=>doc.extension===extension);
  await writeFile(path.join(output,'tep_mau',`ho_so_gia_lap.${extension}`),generateFile(doc));
}
const manifest={dataset:DATASET_V2,data_type:'synthetic',referenceDate:plan.referenceDate,
  counts:{users:PEOPLE_EMAILS.length,documents:plan.documents.length,shares:plan.shares.length,
    activities:plan.activities.length,securityEvents:plan.security.length,exampleFiles:8},
  tables:['tai_khoan.csv','tai_lieu.csv','chia_se.csv','nhat_ky.csv','su_kien_an_ninh.csv'],
  note:'Tệp CSV là bản xem trước dữ liệu tổng hợp; chạy seed-realistic-macos.sh mới ghi vào PostgreSQL + lưu ciphertext trong object storage. Không phải dữ liệu khách hàng thật.'};
await writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n','utf8');
console.info(`Đã xuất ${plan.documents.length} hồ sơ mô phỏng vào ${output}`);

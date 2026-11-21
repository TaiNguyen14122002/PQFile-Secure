/**
 * Add one fully functional showcase account (real ML-KEM/AES-GCM ciphertext, real
 * vault/key backups, personal Dashboard/Files/Workspaces/Governance/Security data).
 * Strictly for dedicated, disposable research deployments. No mock API and no
 * passwords in stdout. Existing datasets and their credentials are untouched.
 */
import { createHash } from 'node:crypto';
import pg from 'pg';
import argon2 from 'argon2';
import { S3Client, HeadBucketCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { encryptFile, lockVault, makeKeys, sha256, unlockVault } from '@pqfile/crypto-core';
import type { VaultKeys, PublicRecipient } from '@pqfile/crypto-core';
import { buildShowcasePlan, DATASET_SHOWCASE, SHOWCASE_EMAIL, SHOWCASE_NAME, idFor } from './demo-showcase-plan.mjs';
import { generateFile } from './realistic-file-builder.mjs';

const loginPass=process.env.DEMO_SHOWCASE_PASSWORD||'';
const vaultPass=process.env.DEMO_SHOWCASE_VAULT_PASSWORD||'';
const sourceVaultPass=process.env.DEMO_VAULT_PASSWORD||'';
const db=new pg.Client({host:process.env.DB_HOST||'localhost',port:Number(process.env.DB_PORT||5432),
  database:process.env.DB_NAME||'pqfile',user:process.env.DB_USER||'pqfile',password:process.env.DB_PASSWORD});
const store=new S3Client({endpoint:process.env.S3_ENDPOINT||'http://storage:9000',
  region:process.env.S3_REGION||'us-east-1',forcePathStyle:true,credentials:{
    accessKeyId:process.env.S3_ACCESS_KEY||'',secretAccessKey:process.env.S3_SECRET_KEY||''}});
const bucket=process.env.S3_BUCKET||'pqfile-ciphertext';
const hexSha=(data:Uint8Array|string)=>createHash('sha256').update(data).digest('hex');
type Identity={id:string;kemId:string;keys:VaultKeys};
function requireConsent(){
  if(process.env.DEMO_SHOWCASE_ENABLED!=='yes'||process.env.DEMO_DATASET_CONFIRM!=='SHOWCASE_ONLY')
    throw new Error('Chỉ sử dụng khi DEMO_SHOWCASE_ENABLED=yes và DEMO_DATASET_CONFIRM=SHOWCASE_ONLY.');
  if(loginPass.length<14||vaultPass.length<14||sourceVaultPass.length<14 ||loginPass===vaultPass)
    throw new Error('Thiếu mật khẩu đăng nhập/kho khóa riêng và mật khẩu kho khóa nguồn V1.');
  if(!process.env.DB_PASSWORD||!process.env.S3_ACCESS_KEY||!process.env.S3_SECRET_KEY)
    throw new Error('Thiếu cấu hình kết nối PostgreSQL hoặc kho ciphertext.');
}
async function createShowcaseUser():Promise<Identity>{
  const id=idFor('user:showcase');
  const {rows:found}=await db.query<{id:string;role:string;status:string;password_hash:string}>('SELECT id,role,status,password_hash FROM users WHERE email=$1',[SHOWCASE_EMAIL]);
  if(found.length&&found[0].id!==id)throw new Error(`Email ${SHOWCASE_EMAIL} đã thuộc tài khoản khác; không thay đổi.`);
  if(found.length && found[0].status!=='ACTIVE')throw new Error('Tài khoản demo hiện bị khóa; không tự kích hoạt lại.');
  if(found.length && !(await argon2.verify(found[0].password_hash,loginPass)))
    throw new Error('Mật khẩu Keychain không khớp tài khoản showcase đã tồn tại; không ghi đè mật khẩu.');
  if(!found.length){
    const passwordHash=await argon2.hash(loginPass,{type:argon2.argon2id});
    await db.query(`INSERT INTO users(id,email,display_name,password_hash,role,status)
      VALUES($1,$2,$3,$4,'USER','ACTIVE')`,[id,SHOWCASE_EMAIL,SHOWCASE_NAME,passwordHash]);
  }
  const vaultId=idFor('user:showcase:vault'),kemId=idFor('user:showcase:kem'),dsaId=idFor('user:showcase:dsa');
  const {rows:backups}=await db.query<{encrypted_blob:string}>('SELECT encrypted_blob FROM key_backups WHERE user_id=$1 ORDER BY created_at LIMIT 1',[id]);
  const keys:VaultKeys=backups.length ? await unlockVault(backups[0].encrypted_blob,vaultPass) : await makeKeys('ML-KEM-768');
  if(!backups.length){
    const encrypted=await lockVault(keys,vaultPass);
    await db.query('INSERT INTO key_backups(id,user_id,encrypted_blob,format_version) VALUES($1,$2,$3,1)',[vaultId,id,encrypted]);
  }
  const pub=[['KEM','ML-KEM-768',kemId,keys.kemPublic],['DSA','ML-DSA-65',dsaId,keys.dsaPublic]] as const;
  for(const [purpose,algorithm,keyId,publicKey] of pub){
    const {rows:existing}=await db.query<{public_key:string}>(
      'SELECT public_key FROM user_keys WHERE user_id=$1 AND purpose=$2 AND status=\'ACTIVE\'',[id,purpose]);
    if(existing.length && !existing.some(row=>row.public_key===publicKey))
      throw new Error(`Khóa ${purpose} của tài khoản demo không khớp vault; không ghi dữ liệu.`);
    await db.query(`INSERT INTO user_keys(id,user_id,purpose,algorithm,public_key,fingerprint,status)
      VALUES($1,$2,$3,$4,$5,$6,'ACTIVE') ON CONFLICT(id) DO NOTHING`,
      [keyId,id,purpose,algorithm,publicKey,hexSha(Buffer.from(publicKey,'base64'))]);
  }
  return {id,kemId,keys};
}
async function sourceIdentity(email:string):Promise<Identity>{
  const {rows:user}=await db.query<{id:string}>('SELECT id FROM users WHERE email=$1 AND status=\'ACTIVE\'',[email]);
  if(user.length!==1)throw new Error(`Thiếu tài khoản nghiên cứu nguồn ${email}. Cần nạp V1 trước.`);
  const {rows:backup}=await db.query<{encrypted_blob:string}>(
    'SELECT encrypted_blob FROM key_backups WHERE user_id=$1 ORDER BY created_at LIMIT 1',[user[0].id]);
  if(backup.length!==1)throw new Error(`Thiếu kho khóa nghiên cứu nguồn: ${email}`);
  const keys=await unlockVault(backup[0].encrypted_blob,sourceVaultPass);
  const {rows:publicKeys}=await db.query<{id:string;public_key:string}>(
    "SELECT id,public_key FROM user_keys WHERE user_id=$1 AND purpose='KEM' AND algorithm='ML-KEM-768' AND status='ACTIVE'",[user[0].id]);
  const matching=publicKeys.find(row=>row.public_key===keys.kemPublic);
  if(!matching)throw new Error(`Kho khóa ML-KEM nghiên cứu không khớp: ${email}`);
  return {id:user[0].id,kemId:matching.id,keys};
}
const recipient=(identity:Identity):PublicRecipient=>({userId:identity.id,keyId:identity.kemId,
  algorithm:'ML-KEM-768',publicKey:identity.keys.kemPublic});
async function main(){
  requireConsent();
  await db.connect();
  const {rows:base}=await db.query('SELECT dataset_id FROM research_seed_runs WHERE dataset_id=$1',['pqfile-research-2026-v1']);
  if(!base.length)throw new Error('Bộ dữ liệu nền V1 chưa được nạp; không tạo dữ liệu trình diễn một phần.');
  const {rows:completed}=await db.query('SELECT dataset_id FROM research_seed_runs WHERE dataset_id=$1',[DATASET_SHOWCASE]);
  if(completed.length){console.log(`[showcase] Đã nạp ${DATASET_SHOWCASE}; không tạo lại.`);return;}
  await store.send(new HeadBucketCommand({Bucket:bucket}));
  const plan=buildShowcasePlan();
  const users:Identity[]=[];
  try{
    const sourceAccounts:Identity[]=[];
    for(let i=1;i<=4;i++)sourceAccounts.push(await sourceIdentity(plan.people[i]));
    users.push(await createShowcaseUser(),...sourceAccounts);
    const byFile=new Map<string,typeof plan.grants>();
    for(const grant of plan.grants){const list=byFile.get(grant.fileId)||[];list.push(grant);byFile.set(grant.fileId,list);}
    let created=0,skipped=0;
    console.log(`[showcase] Bắt đầu nạp ${plan.files.length} tệp mã hóa, ${plan.grants.length} quyền chia sẻ.`);
    for(const [index,doc] of plan.files.entries()){
      const {rows:existing}=await db.query('SELECT id FROM files WHERE id=$1',[doc.id]);
      if(existing.length){skipped++;continue;}
      const owner=users[doc.ownerIndex];
      const permissions=byFile.get(doc.id)||[];
      const selected=[...new Set([doc.ownerIndex,...permissions.map(s=>s.recipientIndex)])];
      const encrypted=await encryptFile(new File([generateFile(doc)],doc.fileName,{type:'application/octet-stream'}),
        owner.keys,selected.map(i=>recipient(users[i])),doc.id);
      const objectKey=`research/${DATASET_SHOWCASE}/${doc.id}.bin`;
      await store.send(new PutObjectCommand({Bucket:bucket,Key:objectKey,
        Body:Buffer.from(encrypted.ciphertext),ContentType:'application/octet-stream',
        Metadata:{sha256:await sha256(encrypted.ciphertext),synthetic:'true'}}));
      const manifest=encrypted.metadata;
      await db.query('BEGIN');
      try{
        await db.query(`INSERT INTO files(id,owner_id,display_label,object_key,source_type,cipher_size,iv,
          manifest,signature,signer_public_key,status,created_at,deleted_at)
          VALUES($1,$2,$3,$4,'RESEARCH',$5,$6,$7,$8,$9,$10,$11,$12)`,
          [doc.id,owner.id,doc.fileName,objectKey,encrypted.ciphertext.length,manifest.iv,
          JSON.stringify(manifest.manifest),manifest.signature,manifest.signerPublicKey,
          doc.trashed?'TRASH':'ACTIVE',new Date(doc.createdAt),doc.trashed?new Date():null]);
        for(const envelope of manifest.envelopes){
          await db.query(`INSERT INTO file_recipients(id,file_id,user_id,recipient_key_id,kem_ciphertext,wrap_iv,wrapped_key,created_at)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(file_id,user_id) DO NOTHING`,
            [idFor(`recipient:${doc.id}:${envelope.userId}`),doc.id,envelope.userId,envelope.keyId,
              envelope.kemCiphertext,envelope.wrapIv,envelope.wrappedKey,new Date(doc.createdAt)]);
        }
        for(const grant of permissions){
          await db.query(`INSERT INTO file_shares(id,file_id,shared_by,shared_with,permission,expires_at,task_deadline_at,
            revoked_at,created_at) VALUES($1,$2,$3,$4,'FILE_DOWNLOAD',$5,$6,$7,$8)
            ON CONFLICT(file_id,shared_with) DO NOTHING`,
            [grant.id,doc.id,owner.id,users[grant.recipientIndex].id,
              grant.expiresAt?new Date(grant.expiresAt):null,
              grant.taskDeadlineAt?new Date(grant.taskDeadlineAt):null,
              grant.revokedAt?new Date(grant.revokedAt):null,new Date(grant.createdAt)]);
        }
        await db.query('COMMIT');created++;
      }catch(error){await db.query('ROLLBACK').catch(()=>{});throw error;}
      if((index+1)%20===0)console.log(`[showcase] ${index+1}/${plan.files.length} tệp đã xử lý`);
    }
    for(const group of plan.workspaces){
      await db.query(`INSERT INTO workspaces(id,name,owner_id,created_at) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING`,
        [group.id,group.name,users[0].id,new Date(group.createdAt)]);
      for(const index of group.members){
        await db.query(`INSERT INTO workspace_members(workspace_id,user_id,role,created_at)
          VALUES($1,$2,$3,$4) ON CONFLICT(workspace_id,user_id) DO NOTHING`,
          [group.id,users[index].id,index===0?'OWNER':index%2?'EDITOR':'VIEWER',new Date(group.createdAt)]);
      }
    }
    for(const log of plan.activities){
      await db.query(`INSERT INTO activity_logs(id,actor_id,action,resource_type,resource_id,details,created_at)
        VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING`,
        [log.id,users[log.actorIndex].id,log.action,log.resourceType||'file',log.fileId,
          JSON.stringify({syntheticDataset:DATASET_SHOWCASE,source:'showcase',simulated:true}),new Date(log.createdAt)]);
    }
    for(const event of plan.security){
      await db.query(`INSERT INTO security_events(id,user_id,event_type,risk_score,device_tag,reason,acknowledged_at,created_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO NOTHING`,
        [event.id,users[0].id,event.eventType,event.riskScore,event.deviceTag,event.reason,
          event.acknowledgedAt?new Date(event.acknowledgedAt):null,new Date(event.createdAt)]);
    }
    await db.query(`INSERT INTO research_seed_runs(dataset_id,file_count,share_count)
      VALUES($1,$2,$3) ON CONFLICT(dataset_id) DO NOTHING`,
      [DATASET_SHOWCASE,plan.files.length,plan.grants.length]);
    console.log(`[showcase] Hoàn tất: ${created} tệp mới, ${skipped} đã có; ${plan.grants.length} lượt chia sẻ, `+
      `${plan.workspaces.length} nhóm, ${plan.activities.length} bản ghi hoạt động, ${plan.security.length} sự kiện.`);
    console.log(`[showcase] Đăng nhập: ${SHOWCASE_EMAIL}. Hai mật khẩu ở macOS Keychain (không in ra).`);
  }finally{
    for(const identity of users){identity.keys.kemSecret='';identity.keys.dsaSecret='';}
  }
}
try{await main();}
catch(error){console.error('[showcase] ERROR:',error instanceof Error?error.message:String(error));process.exitCode=1;}
finally{await db.end().catch(()=>{});store.destroy();}

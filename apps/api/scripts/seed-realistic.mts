/**
 * Opt-in V2 synthetic research dataset for PQFile Secure.
 * Requires existing V1 seed and unlocks only synthetic users' encrypted key backups.
 * Every document is a REAL encrypted file stored in the S3 bucket; no fake API interceptor.
 * Prevents writes unless DEMO_REALISTIC_ENABLED=yes + DEMO_DATASET_CONFIRM=RESEARCH_ONLY.
 * It must only run against a disposable/local dedicated research environment.
 */
import pg from 'pg';
import { S3Client, HeadBucketCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { encryptFile, sha256, unlockVault } from '@pqfile/crypto-core';
import type { PublicRecipient, VaultKeys } from '@pqfile/crypto-core';
import { DATASET_V2, PEOPLE_EMAILS, buildPlan, syntheticId } from './realistic-scenarios.mjs';
import { generateFile } from './realistic-file-builder.mjs';

const BASE_DATASET = 'pqfile-research-2026-v1';
const requireSeed=()=>{
  if(process.env.DEMO_REALISTIC_ENABLED!=='yes'||process.env.DEMO_DATASET_CONFIRM!=='RESEARCH_ONLY')
    throw new Error('Chỉ nạp vào môi trường nghiên cứu: DEMO_REALISTIC_ENABLED=yes, DEMO_DATASET_CONFIRM=RESEARCH_ONLY');
  if((process.env.DEMO_VAULT_PASSWORD||'').length<14)throw new Error('Cần DEMO_VAULT_PASSWORD >=14 ký tự của bộ dữ liệu gốc.');
  if(!process.env.DB_PASSWORD||!process.env.S3_ACCESS_KEY||!process.env.S3_SECRET_KEY)
    throw new Error('Thiếu DB_PASSWORD hoặc S3_ACCESS_KEY/S3_SECRET_KEY.');
};
const database = new pg.Client({host:process.env.DB_HOST||'localhost',port:Number(process.env.DB_PORT||5432),
  database:process.env.DB_NAME||'pqfile',user:process.env.DB_USER||'pqfile',password:process.env.DB_PASSWORD});
const store=new S3Client({endpoint:process.env.S3_ENDPOINT||'http://storage:9000',region:process.env.S3_REGION||'us-east-1',
  forcePathStyle:true,credentials:{accessKeyId:process.env.S3_ACCESS_KEY||'',secretAccessKey:process.env.S3_SECRET_KEY||''}});
const bucket=process.env.S3_BUCKET||'pqfile-ciphertext';

type DemoIdentity={id:string;kemId:string;keys:VaultKeys};
async function identities():Promise<DemoIdentity[]> {
  const output:DemoIdentity[]=[];
  for(const email of PEOPLE_EMAILS){
    const {rows:found}=await database.query<{id:string;status:string}>(
      'SELECT id,status FROM users WHERE email=$1 LIMIT 1',[email]);
    if(found.length!==1||found[0].status!=='ACTIVE')throw new Error(`Không tìm thấy tài khoản seed gốc đang hoạt động: ${email}`);
    const userId=found[0].id;
    const {rows:backups}=await database.query<{encrypted_blob:string}>(
      'SELECT encrypted_blob FROM key_backups WHERE user_id=$1 ORDER BY created_at ASC LIMIT 1',[userId]);
    if(backups.length!==1)throw new Error(`Tài khoản seed thiếu kho khóa: ${email}`);
    const keys=await unlockVault(backups[0].encrypted_blob,process.env.DEMO_VAULT_PASSWORD!);
    const {rows:publicKeys}=await database.query<{id:string;public_key:string}>(
      "SELECT id,public_key FROM user_keys WHERE user_id=$1 AND purpose='KEM' AND algorithm='ML-KEM-768' AND status='ACTIVE'",[userId]);
    const match=publicKeys.find(row=>row.public_key===keys.kemPublic);
    if(!match)throw new Error(`Khóa ML-KEM không khớp bản sao lưu: ${email}`);
    // The recipient and signer keys are the same ones that the simulated account will unlock in the browser.
    output.push({id:userId,kemId:match.id,keys});
  }
  return output;
}

async function writeDataset() {
  requireSeed();
  await database.connect();
  const {rows:base}=await database.query('SELECT dataset_id FROM research_seed_runs WHERE dataset_id=$1',[BASE_DATASET]);
  if(!base.length)throw new Error('Cần nạp bộ dữ liệu nền trước: bash scripts/seed-research-macos.sh');
  const {rows:done}=await database.query('SELECT dataset_id FROM research_seed_runs WHERE dataset_id=$1',[DATASET_V2]);
  if(done.length){console.log(`[realistic seed] ${DATASET_V2} đã được hoàn tất; không nạp trùng.`);return;}
  // Do not create a new bucket accidentally: the expected research object storage must already exist.
  await store.send(new HeadBucketCommand({Bucket:bucket}));
  const accounts=await identities();
  const plan=buildPlan();
  console.log(`[realistic seed] ${plan.documents.length} tài liệu, ${plan.shares.length} quyền, ${plan.activities.length} nhật ký, ${plan.security.length} sự kiện an ninh.`);
  console.log(`[realistic seed] Ngày tham chiếu (UTC): ${plan.referenceDate}, mã bộ dữ liệu: ${DATASET_V2}`);
  const fileShareMap=new Map<string,typeof plan.shares>();
  for(const share of plan.shares){const old=fileShareMap.get(share.fileId)||[];old.push(share);fileShareMap.set(share.fileId,old);}
  let written=0,existing=0;
  try{
    for(const [index,doc] of plan.documents.entries()){
      const {rows:found}=await database.query('SELECT id FROM files WHERE id=$1',[doc.id]);
      if(found.length){existing++;continue;}
      const owner=accounts[doc.ownerIndex];
      const grants=fileShareMap.get(doc.id)||[];
      const selected=new Set([doc.ownerIndex,...grants.map(s=>s.recipientIndex)]);
      const participants:PublicRecipient[]=[...selected].map(who=>({userId:accounts[who].id,
        keyId:accounts[who].kemId,algorithm:'ML-KEM-768',publicKey:accounts[who].keys.kemPublic}));
      const raw=generateFile(doc);
      const binary=new File([raw],doc.fileName,{type:'application/octet-stream'});
      const encrypted=await encryptFile(binary,owner.keys,participants,doc.id);
      const objectKey=`research/${DATASET_V2}/${doc.id}.bin`;
      // S3 object is created first; DB rows become visible only when the SQL transaction succeeds.
      await store.send(new PutObjectCommand({Bucket:bucket,Key:objectKey,
        Body:Buffer.from(encrypted.ciphertext),ContentType:'application/octet-stream',
        Metadata:{sha256:await sha256(encrypted.ciphertext),synthetic:'true'}}));
      await database.query('BEGIN');
      try{
        const meta=encrypted.metadata;
        await database.query(`INSERT INTO files(id,owner_id,display_label,object_key,source_type,cipher_size,iv,manifest,
          signature,signer_public_key,status,created_at) VALUES($1,$2,$3,$4,'RESEARCH',$5,$6,$7,$8,$9,'ACTIVE',$10)`,
          [doc.id,owner.id,doc.fileName,objectKey,encrypted.ciphertext.length,meta.iv,JSON.stringify(meta.manifest),
            meta.signature,meta.signerPublicKey,new Date(doc.createdAt)]);
        for(const envelope of meta.envelopes){
          await database.query(`INSERT INTO file_recipients(id,file_id,user_id,recipient_key_id,kem_ciphertext,wrap_iv,wrapped_key,created_at)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(file_id,user_id) DO NOTHING`,
            [syntheticId(`envelope:${doc.id}:${envelope.userId}`),
             doc.id,envelope.userId,envelope.keyId,envelope.kemCiphertext,envelope.wrapIv,envelope.wrappedKey,new Date(doc.createdAt)]);
        }
        for(const s of grants){
          await database.query(`INSERT INTO file_shares(id,file_id,shared_by,shared_with,permission,expires_at,task_deadline_at,revoked_at,created_at)
            VALUES($1,$2,$3,$4,'FILE_DOWNLOAD',$5,$6,$7,$8) ON CONFLICT(file_id,shared_with) DO NOTHING`,
            [s.id,s.fileId,owner.id,accounts[s.recipientIndex].id,s.expiresAt?new Date(s.expiresAt):null,
              s.taskDeadlineAt?new Date(s.taskDeadlineAt):null,s.revokedAt?new Date(s.revokedAt):null,new Date(s.createdAt)]);
        }
        await database.query('COMMIT');written++;
      }catch(error){await database.query('ROLLBACK').catch(()=>{});throw error;}
      if((index+1)%24===0)console.log(`[realistic seed] ${index+1}/${plan.documents.length} tệp (${written} tạo mới, ${existing} đã tồn tại)`);
    }
    // Idempotent audit records: repeat runs never duplicate a synthetic audit or security event.
    for(const log of plan.activities){
      await database.query(`INSERT INTO activity_logs(id,actor_id,action,resource_type,resource_id,details,created_at)
        VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING`,
        [log.id,accounts[log.actorIndex].id,log.action,log.resourceType,log.fileId,
          JSON.stringify(log.details),new Date(log.createdAt)]);
    }
    for(const event of plan.security){
      await database.query(`INSERT INTO security_events(id,user_id,event_type,risk_score,device_tag,reason,acknowledged_at,created_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO NOTHING`,
        [event.id,accounts[event.userIndex].id,event.eventType,event.riskScore,event.deviceTag,event.reason,
          event.acknowledgedAt?new Date(event.acknowledgedAt):null,new Date(event.createdAt)]);
    }
    await database.query('INSERT INTO research_seed_runs(dataset_id,file_count,share_count) VALUES($1,$2,$3) ON CONFLICT(dataset_id) DO NOTHING',
      [DATASET_V2,plan.documents.length,plan.shares.length]);
    console.log(`[realistic seed] Completed: ${written} created / ${existing} existing, ${plan.shares.length} grants, ${plan.activities.length} activities, ${plan.security.length} events.`);
    console.log('[realistic seed] Mọi hồ sơ đều được gắn nguồn RESEARCH, hoàn toàn giả lập.');
  } finally {
    for(const account of accounts){account.keys.kemSecret='';account.keys.dsaSecret='';}
  }
}
try{await writeDataset();}
catch(error){console.error('[realistic seed] ERROR:',error instanceof Error?error.message:String(error));process.exitCode=1;}
finally{await database.end().catch(()=>{});store.destroy();}

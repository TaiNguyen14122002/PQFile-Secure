/**
 * Opt-in RESEARCH dataset: actual, decryptable ciphertext in S3 + relational rows in PostgreSQL.
 * No mock interception. Generated files are genuine synthetic documents and use the SAME
 * cryptographic envelope format (ML-KEM-768, AES-256-GCM, ML-DSA-65) as browser uploads.
 * This script is for isolated research instances only; never seed production accounts.
 * Required: DEMO_SEED_ENABLED=yes, DEMO_PASSWORD, DEMO_VAULT_PASSWORD.
 */
import { createHash } from 'node:crypto';
import { deflateSync, deflateRawSync } from 'node:zlib';
import pg from 'pg';
import argon2 from 'argon2';
import { S3Client, HeadBucketCommand, CreateBucketCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { encryptFile, lockVault, makeKeys, sha256, unlockVault } from '@pqfile/crypto-core';
import type { PublicRecipient, VaultKeys } from '@pqfile/crypto-core';

const DATASET = 'pqfile-research-2026-v1';
const ACTIVE = 1248;
const TRASH = 42;
const TOTAL = ACTIVE + TRASH;
const PEOPLE = ['Nguyễn Minh Anh','Phạm Thanh Trung','Lê Văn Nam','Phan Thị Mai',
  'Nguyễn Đức Duy','Ngô Hạnh','Trần Minh Quân','Hoàng Thị Lan','Võ Thanh Bình',
  'Đỗ Hải Yến','Bùi Thanh Tâm','Nguyễn Hoài An'];
const TEAMS = ['Nghiên cứu hậu lượng tử','Kiểm thử an toàn','Tài liệu và hồ sơ','Phát triển giao diện',
  'Thiết kế API','Đánh giá hiệu năng','Kiểm soát truy cập','Vận hành hạ tầng','Phân tích dữ liệu',
  'Quản lý tiến độ','Nghiệm thu hệ thống','Hỗ trợ và đào tạo'];
const SUBJECTS = ['Báo cáo kết quả 9 tháng','Kế hoạch triển khai nhiệm vụ','Danh sách thành viên',
  'Tổng hợp ngân sách','Biên bản họp nhóm','Phân tích hiệu năng ML-KEM',
  'Quy trình xác minh chữ ký','Tổng kết nghiên cứu','Kế hoạch bảo vệ dữ liệu',
  'Bảng tiến độ thực hiện','Thông báo nghiệp vụ','Tài liệu kỹ thuật hệ thống',
  'Đánh giá tính toàn vẹn','Hồ sơ kiểm thử','Bản tổng hợp ý kiến'];
const extensions = ['pdf','docx','xlsx','png','txt','csv','json','pdf','docx','xlsx','zip','pdf'];
const hour = 3600000;
const start = Date.UTC(2026,4,12,8);
const db = new pg.Client({
  host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'pqfile', password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'pqfile'
});
const store = new S3Client({endpoint:process.env.S3_ENDPOINT || 'http://storage:9000',
  region:process.env.S3_REGION || 'us-east-1',forcePathStyle:true,credentials:{
    accessKeyId:process.env.S3_ACCESS_KEY || '',secretAccessKey:process.env.S3_SECRET_KEY || ''
  }});
const bucket = process.env.S3_BUCKET || 'pqfile-ciphertext';
const uuid = (text:string) => { const h=createHash('sha256').update(`${DATASET}:${text}`).digest('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`; };
const digest = (value:Uint8Array | string) => createHash('sha256').update(value).digest('hex');
const xml = (str:string) => str.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const enc = (str:string) => Buffer.from(str,'utf8');
const names = PEOPLE.map((displayName,index)=>({id:uuid(`user:${index}`), displayName,
  email:index===0?'demo.admin@pqfile.local':`demo.person${String(index).padStart(2,'0')}@pqfile.local`}));

// Minimal standards-compliant binary file generators. Extensions reflect REAL file formats.
const crcTable = Array.from({length:256},(_,i)=>{
  let c=i;for(let j=0;j<8;j++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;
});
function crc32(data:Buffer){let c=0xffffffff;for(const byte of data)c=crcTable[(c^byte)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function zip(entries:{name:string;data:Buffer}[]):Buffer{
  let offset=0;const locals:Buffer[]=[],centrals:Buffer[]=[];
  for(const {name,data} of entries){
    const n=enc(name),compressed=deflateRawSync(data),crc=crc32(data);
    const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50,0);header.writeUInt16LE(20,4);
    header.writeUInt16LE(8,8);header.writeUInt32LE(crc,14);header.writeUInt32LE(compressed.length,18);
    header.writeUInt32LE(data.length,22);header.writeUInt16LE(n.length,26);
    locals.push(header,n,compressed);
    const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);
    central.writeUInt16LE(20,6);central.writeUInt16LE(8,10);central.writeUInt32LE(crc,16);
    central.writeUInt32LE(compressed.length,20);central.writeUInt32LE(data.length,24);
    central.writeUInt16LE(n.length,28);central.writeUInt32LE(offset,42);centrals.push(central,n);
    offset+=header.length+n.length+compressed.length;
  }
  const cd=Buffer.concat(centrals),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);
  end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);
  end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...locals,cd,end]);
}
function makePdf(title:string,number:number):Buffer{
  // ASCII content stream; PDF fonts available in all readers.
  const text=title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7E]/g,'').replace(/[()\\]/g,' ').slice(0,90);
  const stream=`BT /F1 21 Tf 50 755 Td (PQFILE SECURE RESEARCH DOCUMENT) Tj /F1 13 Tf 0 -48 Td (${text}) Tj 0 -30 Td (Record ${number} - Synthetic non-sensitive research data) Tj ET`;
  const objs=[
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
  ];
  let result='%PDF-1.4\n';const offsets=[0];
  for(let i=0;i<objs.length;i++){offsets.push(Buffer.byteLength(result));result+=`${i+1} 0 obj\n${objs[i]}\nendobj\n`;}
  const xref=Buffer.byteLength(result);result+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`;
  for(const offset of offsets.slice(1))result+=`${String(offset).padStart(10,'0')} 00000 n \n`;
  result+=`trailer\n<< /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return enc(result);
}
function makeDocx(title:string,number:number):Buffer{
  const content=`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${xml(title)}</w:t></w:r></w:p><w:p><w:r><w:t>Bộ dữ liệu nghiên cứu mô phỏng - bản ghi số ${number}. Không chứa thông tin cá nhân thật.</w:t></w:r></w:p><w:sectPr/></w:body></w:document>`;
  return zip([
    {name:'[Content_Types].xml',data:enc('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')},
    {name:'_rels/.rels',data:enc('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')},
    {name:'word/document.xml',data:enc(content)}
  ]);
}
function makeXlsx(title:string,number:number):Buffer{
  const row=(i:number)=>`<row r="${i}"><c r="A${i}" t="inlineStr"><is><t>${i===1?xml(title):`Nghien cuu ${i-1}`}</t></is></c><c r="B${i}"><v>${i===1?number:i*137}</v></c><c r="C${i}"><v>${(i*19)%100}</v></c></row>`;
  return zip([
    {name:'[Content_Types].xml',data:enc('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>')},
    {name:'_rels/.rels',data:enc('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')},
    {name:'xl/workbook.xml',data:enc('<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Bao cao" sheetId="1" r:id="rId1"/></sheets></workbook>')},
    {name:'xl/_rels/workbook.xml.rels',data:enc('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>')},
    {name:'xl/worksheets/sheet1.xml',data:enc(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${Array.from({length:30},(_,i)=>row(i+1)).join('')}</sheetData></worksheet>`)}
  ]);
}
function makePng(number:number):Buffer{
  const width=360,height=170;const scan=Buffer.alloc((width*4+1)*height);
  for(let y=0;y<height;y++){const base=y*(width*4+1);for(let x=0;x<width;x++){
    const p=base+1+x*4,bar=(x>32&&x<330&&y>95&&y<135);
    scan[p]=bar?10:Math.min(255,25+x/2);scan[p+1]=bar?112:Math.min(255,120+y/2);
    scan[p+2]=bar?242:245;scan[p+3]=255;
  }}
  const chunk=(type:string,data:Buffer)=>{const a=enc(type),size=Buffer.alloc(4),crc=Buffer.alloc(4);
    size.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([a,data])));return Buffer.concat([size,a,data,crc]);};
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),
    chunk('tEXt',enc(`Description\0PQFile synthetic image ${number}`)),chunk('IDAT',deflateSync(scan)),chunk('IEND',Buffer.alloc(0))]);
}
function sampleFile(title:string,index:number,ext:string):Buffer{
  const text=`${title}\nPQFile Secure – dữ liệu nghiên cứu số ${index}.\nNội dung do chương trình tạo, không sử dụng hồ sơ thật.\nPhương pháp: bảo vệ tài liệu bằng mật mã hậu lượng tử.\n`;
  switch(ext){
    case 'pdf':return makePdf(title,index);
    case 'docx':return makeDocx(title,index);
    case 'xlsx':return makeXlsx(title,index);
    case 'png':return makePng(index);
    case 'csv':return enc(`STT,Hang muc,Gia tri\n${Array.from({length:30},(_,i)=>`${i+1},Du lieu ${index}-${i+1},${index*17+i}`).join('\n')}\n`);
    case 'json':return enc(JSON.stringify({research:true,title,record:index,metrics:Array.from({length:20},(_,i)=>({month:i+1,value:(index+i)*31%211}))},null,2));
    case 'zip':return zip([{name:'README.txt',data:enc(text)},{name:'metadata.json',data:enc(JSON.stringify({dataset:DATASET,record:index}))}]);
    default:return enc(text.repeat(3));
  }
}
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));

async function main(){
  if(process.env.DEMO_SEED_ENABLED!=='yes')throw new Error('Set DEMO_SEED_ENABLED=yes only on an isolated research database.');
  const loginPassword=process.env.DEMO_PASSWORD||'',vaultPassword=process.env.DEMO_VAULT_PASSWORD||'';
  if(loginPassword.length<14||vaultPassword.length<14)throw new Error('DEMO_PASSWORD and DEMO_VAULT_PASSWORD must be 14+ characters.');
  if(loginPassword===vaultPassword)throw new Error('Login password and vault passphrase must be different.');
  await db.connect();
  const {rows:exists}=await db.query('SELECT dataset_id FROM research_seed_runs WHERE dataset_id=$1',[DATASET]);
  if(exists.length){console.info(`[seed] ${DATASET} was already completed; leaving all later user edits intact.`);return;}
  try{await store.send(new HeadBucketCommand({Bucket:bucket}));}
  catch{await store.send(new CreateBucketCommand({Bucket:bucket}));}
  const identity:{id:string;email:string;displayName:string;keys:VaultKeys;kemKeyId:string}[]=[];
  console.info(`[seed] Preparing ${PEOPLE.length} research identities + encrypted ML-KEM/ML-DSA vaults...`);
  for(const [index,person] of names.entries()){
    const existing=await db.query('SELECT id FROM users WHERE email=$1',[person.email]);
    if(existing.rows.length&&existing.rows[0].id!==person.id)throw new Error(`Email collision: ${person.email}; aborting to protect unrelated user.`);
    if(!existing.rows.length){
      const passwordHash=await argon2.hash(loginPassword,{type:argon2.argon2id});
      await db.query('INSERT INTO users(id,email,display_name,password_hash,role,status) VALUES($1,$2,$3,$4,$5,$6)',
        [person.id,person.email,person.displayName,passwordHash,'USER','ACTIVE']);
    }
    const backupId=uuid(`vault:${index}`),kemId=uuid(`kem:${index}`),dsaId=uuid(`dsa:${index}`);
    const {rows:b}=await db.query('SELECT encrypted_blob FROM key_backups WHERE id=$1',[backupId]);
    const keys=b.length?await unlockVault(b[0].encrypted_blob,vaultPassword):await makeKeys('ML-KEM-768');
    if(!b.length){
      const backup=await lockVault(keys,vaultPassword);
      await db.query('INSERT INTO key_backups(id,user_id,encrypted_blob,format_version) VALUES($1,$2,$3,1)',[backupId,person.id,backup]);
    }
    await db.query(`INSERT INTO user_keys(id,user_id,purpose,algorithm,public_key,fingerprint,status)
      VALUES($1,$2,'KEM','ML-KEM-768',$3,$4,'ACTIVE') ON CONFLICT(id) DO NOTHING`,
      [kemId,person.id,keys.kemPublic,digest(Buffer.from(keys.kemPublic,'base64'))]);
    await db.query(`INSERT INTO user_keys(id,user_id,purpose,algorithm,public_key,fingerprint,status)
      VALUES($1,$2,'DSA','ML-DSA-65',$3,$4,'ACTIVE') ON CONFLICT(id) DO NOTHING`,
      [dsaId,person.id,keys.dsaPublic,digest(Buffer.from(keys.dsaPublic,'base64'))]);
    identity.push({...person,keys,kemKeyId:kemId});
  }
  const publicRecipient=(who:number):PublicRecipient=>({userId:identity[who].id,
    keyId:identity[who].kemKeyId,algorithm:'ML-KEM-768',publicKey:identity[who].keys.kemPublic});
  console.info(`[seed] Creating ${TOTAL} genuine encrypted sample files...`);
  let outgoing=0,incoming=0,uploaded=0,skipped=0;
  for(let i=0;i<TOTAL;i++){
    const id=uuid(`file:${i}`);
    const owner=i%7===0?1+((i*3)%11):0;
    const deleted=i>=ACTIVE;
    const shareWith=deleted?-1:(owner===0?((i%4===0&&outgoing<200)?1+(i%11):-1):(incoming<167?0:-1));
    if(shareWith>=0){if(owner===0)outgoing++;else incoming++;}
    const {rows:already}=await db.query('SELECT id FROM files WHERE id=$1',[id]);
    if(already.length){skipped++;continue;}
    const ext=extensions[(i*7+Math.floor(i/8))%extensions.length];
    const title=SUBJECTS[(i*5+Math.floor(i/13))%SUBJECTS.length];
    const fileName=`${title} ${String(i+1).padStart(4,'0')}.${ext}`;
    const sample=sampleFile(title,i+1,ext);
    const webFile=new File([sample],fileName,{type:'application/octet-stream'});
    const participants=[publicRecipient(owner)];if(shareWith>=0)participants.push(publicRecipient(shareWith));
    const protectedFile=await encryptFile(webFile,identity[owner].keys,participants,id);
    const key=`research/${DATASET}/${id}.bin`;
    await store.send(new PutObjectCommand({Bucket:bucket,Key:key,
      Body:Buffer.from(protectedFile.ciphertext),ContentType:'application/octet-stream',
      Metadata:{sha256:await sha256(protectedFile.ciphertext)}}));
    const creation=new Date(start + (i*31%185)*24*hour + (i%12)*hour);
    const deletedAt=deleted?new Date(creation.getTime()+3*24*hour):null;
    await db.query('BEGIN');
    try{
      const m=protectedFile.metadata;
      await db.query(`INSERT INTO files(id,owner_id,display_label,object_key,source_type,cipher_size,iv,manifest,
        signature,signer_public_key,status,created_at,deleted_at) VALUES($1,$2,$3,$4,'RESEARCH',$5,$6,$7,$8,$9,$10,$11,$12)`,
        [id,identity[owner].id,fileName,key,protectedFile.ciphertext.length,m.iv,JSON.stringify(m.manifest),
          m.signature,m.signerPublicKey,deleted?'TRASH':'ACTIVE',creation,deletedAt]);
      for(const envelope of m.envelopes){
        await db.query(`INSERT INTO file_recipients(id,file_id,user_id,recipient_key_id,kem_ciphertext,wrap_iv,wrapped_key,created_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(file_id,user_id) DO NOTHING`,
          [uuid(`recipient:${i}:${envelope.userId}`),id,envelope.userId,envelope.keyId,
            envelope.kemCiphertext,envelope.wrapIv,envelope.wrappedKey,creation]);
      }
      if(shareWith>=0){
        await db.query(`INSERT INTO file_shares(id,file_id,shared_by,shared_with,permission,created_at)
          VALUES($1,$2,$3,$4,'FILE_DOWNLOAD',$5) ON CONFLICT(file_id,shared_with) DO NOTHING`,
          [uuid(`share:${i}`),id,identity[owner].id,identity[shareWith].id,new Date(creation.getTime()+hour)]);
      }
      await db.query('COMMIT');uploaded++;
    }catch(error){await db.query('ROLLBACK');throw error;}
    if((i+1)%100===0)console.info(`[seed] ${i+1}/${TOTAL} (${uploaded} new, ${skipped} existing)`);
  }
  for(let i=0;i<TEAMS.length;i++){
    const teamId=uuid(`team:${i}`),created=new Date(start+(i*13)*24*hour);
    await db.query(`INSERT INTO workspaces(id,name,owner_id,created_at) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING`,
      [teamId,TEAMS[i],names[0].id,created]);
    for(let j=0;j<PEOPLE.length;j++){
      if(j>0&&(i+j)%4===0)continue;
      await db.query(`INSERT INTO workspace_members(workspace_id,user_id,role,created_at) VALUES($1,$2,$3,$4)
        ON CONFLICT(workspace_id,user_id) DO NOTHING`,[teamId,names[j].id,j===0?'OWNER':j%5===0?'ADMIN':j%3===0?'EDITOR':'VIEWER',created]);
    }
  }
  const actions=['FILE_ENCRYPT_UPLOAD','FILE_SHARE','FILE_RENAME','FILE_RESTORE','FILE_TRASH'];
  for(let i=0;i<720;i++){
    const fileIndex=(i*19)%TOTAL,owner=fileIndex%7===0?1+((fileIndex*3)%11):0;
    await db.query(`INSERT INTO activity_logs(id,actor_id,action,resource_type,resource_id,details,created_at)
      VALUES($1,$2,$3,'file',$4,$5,$6) ON CONFLICT(id) DO NOTHING`,[
        uuid(`activity:${i}`),identity[owner].id,actions[i%actions.length],uuid(`file:${fileIndex}`),
        JSON.stringify({researchDataset:DATASET}),new Date(start+(i*6)*hour)
      ]);
  }
  await db.query(`INSERT INTO research_seed_runs(dataset_id,file_count,share_count)
    VALUES($1,$2,$3) ON CONFLICT(dataset_id) DO NOTHING`,[DATASET,TOTAL,outgoing+incoming]);
  console.info(`[seed] Completed: ${TOTAL} ciphertexts, ${outgoing+incoming} shares (${outgoing} outbound / ${incoming} inbound), 12 workspaces, 720 activities.`);
  console.info(`[seed] Demo login: ${names[0].email}; password = DEMO_PASSWORD (not printed).`);
  console.info(`[seed] Unlock vault using DEMO_VAULT_PASSWORD (not printed).`);
  for(const user of identity){ // Remove key material from reachable in-memory references where possible.
    user.keys.kemSecret='';user.keys.dsaSecret='';
  }
}

try{await main();}
catch(error){console.error('[seed] ERROR:',error instanceof Error?error.message:String(error));process.exitCode=1;}
finally{await db.end().catch(()=>{});store.destroy();}

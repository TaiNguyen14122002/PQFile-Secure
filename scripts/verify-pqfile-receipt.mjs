#!/usr/bin/env node
/** Independent offline receipt verifier. Does not contact any server.
 * Usage: node scripts/verify-pqfile-receipt.mjs receipt.json [file.ciphertext]
 * Caution: identity and trusted timestamp NOT established by this tool.
 */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const enc=s=>Buffer.from(s,'utf8');
const unb64=s=>{if(typeof s!=='string'||!/^[a-zA-Z0-9+/]+={0,2}$/.test(s))throw new Error('Base64 không hợp lệ');return Buffer.from(s,'base64');};
const signableManifest=m=>{
  const required=['version','fileId','cipherHash','cipherBytes','iv','algorithm','createdAt'];
  if(!m||Object.keys(m).length!==required.length||required.some(key=>!Object.hasOwn(m,key))||
    m.version!==1||typeof m.fileId!=='string'||typeof m.cipherHash!=='string'||!Number.isSafeInteger(m.cipherBytes)||m.cipherBytes<16||
    typeof m.iv!=='string'||m.algorithm!=='AES-256-GCM'||typeof m.createdAt!=='string')throw new Error('Manifest v1 không hợp lệ');
  return {version:m.version,fileId:m.fileId,cipherHash:m.cipherHash,cipherBytes:m.cipherBytes,iv:m.iv,algorithm:m.algorithm,createdAt:m.createdAt};
};
async function main(){
 if(process.argv.includes('--help')||process.argv.length<3){console.log('Sử dụng: node scripts/verify-pqfile-receipt.mjs <receipt.json> [ciphertext.bin]');return;}
 const receipt=JSON.parse(await readFile(process.argv[2],'utf8'));
 if(receipt.schema!=='pqfile-integrity-v1'||receipt.fileId!==receipt.manifest?.fileId)throw new Error('Phiếu không hợp lệ');
 const owner=unb64(receipt.ownerPublicKey),manifest=signableManifest(receipt.manifest);
 if(owner.length!==1952||hash(owner)!==receipt.signerFingerprint)throw new Error('Fingerprint khóa ký không hợp lệ');
 if(!ml_dsa65.verify(unb64(receipt.originalSignature),enc(JSON.stringify(manifest)),owner))throw new Error('Chữ ký manifest KHÔNG hợp lệ');
 const body={schema:receipt.schema,fileId:receipt.fileId,manifest,
   originalSignature:receipt.originalSignature,ownerPublicKey:receipt.ownerPublicKey,
   signerFingerprint:receipt.signerFingerprint,issuedAt:receipt.issuedAt};
 if(!ml_dsa65.verify(unb64(receipt.receiptSignature),enc(JSON.stringify(body)),owner))throw new Error('Chữ ký phiếu KHÔNG hợp lệ');
 let ciphertextStatus='KHÔNG kiểm tra (chưa cung cấp ciphertext)';
 if(process.argv[3]){
  const ct=await readFile(process.argv[3]);
  if(ct.length!==manifest.cipherBytes||hash(ct)!==manifest.cipherHash)throw new Error('Hash ciphertext KHÔNG khớp');
  ciphertextStatus='SHA-256 ciphertext khớp';
 }
 console.log('HỢP LỆ: hai chữ ký ML-DSA qua xác minh; '+ciphertextStatus);
 console.log('Fingerprint:',receipt.signerFingerprint);
 console.log('LƯU Ý: không chứng minh danh tính pháp lý, độ tin cậy khóa hoặc dấu thời gian từ bên thứ ba.');
}
main().catch(e=>{console.error('KHÔNG HỢP LỆ:',e.message||String(e));process.exitCode=1;});

/** Client-only PQ cryptography experiments and portable evidence.
 * These experiments are independent of PQFile v1 production ciphertext.
 * Do not persist shared secrets or private keys in browser storage.
 */
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import { b64, ub64, sha256, manifestSigningBytes } from '@pqfile/crypto-core';
import type { CryptoManifest, VaultKeys } from '@pqfile/crypto-core';
const te = new TextEncoder();
const utf=(s:string)=>te.encode(s);
const buffer=(v:Uint8Array):ArrayBuffer=>new Uint8Array(v).buffer;
const bytes=(v:ArrayBuffer)=>new Uint8Array(v);
const equal=(a:Uint8Array,b:Uint8Array)=>a.length===b.length && a.every((v,i)=>v===b[i]);
function packParts(parts:Uint8Array[]):Uint8Array {
  const out=new Uint8Array(parts.reduce((n,p)=>n+4+p.length,0));let offset=0;
  for(const p of parts){new DataView(out.buffer).setUint32(offset,p.length,false);offset+=4;out.set(p,offset);offset+=p.length;}
  return out;
}
async function aes(raw:Uint8Array){return crypto.subtle.importKey('raw',buffer(raw),'AES-GCM',false,['encrypt','decrypt']);}
async function hybridKdf(mode:ExperimentMode,parts:Uint8Array[],salt:Uint8Array):Promise<Uint8Array>{
  const ikm=packParts(parts);
  const key=await crypto.subtle.importKey('raw',buffer(ikm),'HKDF',false,['deriveBits']);
  const derived=bytes(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt:buffer(salt),info:utf(`PQFILE:EXPERIMENT:CEK-WRAP:${mode}:V1`)},key,256));
  ikm.fill(0);return derived;
}
async function x25519():Promise<{shared:Uint8Array,confirmation:Uint8Array,publicBytes:number}> {
  const recipient=await crypto.subtle.generateKey('X25519',true,['deriveBits']) as CryptoKeyPair;
  const ephemeral=await crypto.subtle.generateKey('X25519',true,['deriveBits']) as CryptoKeyPair;
  const sender=bytes(await crypto.subtle.deriveBits({name:'X25519',public:recipient.publicKey},ephemeral.privateKey,256));
  const recipientResult=bytes(await crypto.subtle.deriveBits({name:'X25519',public:ephemeral.publicKey},recipient.privateKey,256));
  if(!equal(sender,recipientResult))throw new Error('X25519: bí mật thiết lập khóa không khớp');
  const epk=await crypto.subtle.exportKey('raw',ephemeral.publicKey);
  return {shared:sender,confirmation:recipientResult,publicBytes:epk.byteLength};
}
export type ExperimentMode='X25519'|'ML-KEM-768'|'X25519+ML-KEM-768';
export type ExperimentResult={mode:ExperimentMode,elapsedMs:number,cipherBytes:number,handshakeBytes:number,plaintextBytes:number,verified:boolean,heapDeltaBytes?:number};
/** Real AES-GCM encryption/decryption of sample data (not production upload format). */
export async function runExperiment(data:Uint8Array,mode:ExperimentMode):Promise<ExperimentResult>{
  if(data.length>1048576)throw new Error('Giới hạn mẫu thử 1 MiB');
  // Non-standard JS heap telemetry is available only in some desktop Chromium builds.
  // It is an approximate diagnostic, not total CPU/RAM usage.
  const heapBefore=(performance as Performance & {memory?:{usedJSHeapSize?:number}}).memory?.usedJSHeapSize;
  const start=performance.now();
  const sendParts:Uint8Array[]=[],receiveParts:Uint8Array[]=[];
  let handshakeBytes=0;
  if(mode!=='X25519'){
    const receiver=ml_kem768.keygen();const packet=ml_kem768.encapsulate(receiver.publicKey);
    const recovered=ml_kem768.decapsulate(packet.cipherText,receiver.secretKey);
    if(!equal(packet.sharedSecret,recovered))throw new Error('ML-KEM: khóa không khớp');
    sendParts.push(packet.sharedSecret);receiveParts.push(recovered);
    handshakeBytes+=packet.cipherText.byteLength;
  }
  if(mode!=='ML-KEM-768'){
    const x=await x25519();sendParts.push(x.shared);receiveParts.push(x.confirmation);handshakeBytes+=x.publicBytes;
  }
  const salt=crypto.getRandomValues(new Uint8Array(32)),iv=crypto.getRandomValues(new Uint8Array(12));
  const derived=await hybridKdf(mode,sendParts,salt);
  const sealed=bytes(await crypto.subtle.encrypt({name:'AES-GCM',iv:buffer(iv),additionalData:utf(`PQFILE:EXPERIMENT:${mode}`)},await aes(derived),buffer(data)));
  const decryptedKey=await hybridKdf(mode,receiveParts,salt);
  const opened=bytes(await crypto.subtle.decrypt({name:'AES-GCM',iv:buffer(iv),additionalData:utf(`PQFILE:EXPERIMENT:${mode}`)},await aes(decryptedKey),buffer(sealed)));
  const verified=equal(opened,data);
  [...sendParts,...receiveParts,derived,decryptedKey,opened].forEach(v=>v.fill(0));
  if(!verified)throw new Error('Thử nghiệm giải mã thất bại');
  const heapAfter=(performance as Performance & {memory?:{usedJSHeapSize?:number}}).memory?.usedJSHeapSize;
  return {mode,elapsedMs:Math.round((performance.now()-start)*100)/100,cipherBytes:sealed.length,handshakeBytes:handshakeBytes+salt.length+iv.length,plaintextBytes:data.length,verified,
    ...(typeof heapBefore==='number'&&typeof heapAfter==='number'?{heapDeltaBytes:heapAfter-heapBefore}:{})};
}

// Shamir over GF(2^8) using AES irreducible polynomial, 0x11B.
const gfMul=(a:number,b:number)=>{let v=0;while(b){if(b&1)v^=a;a=(a<<1)^((a&128)?0x11b:0);b>>=1;}return v;};
const gfPow=(a:number,n:number)=>{let result=1;while(n){if(n&1)result=gfMul(result,a);a=gfMul(a,a);n>>=1;}return result;};
const gfDiv=(a:number,b:number)=>{if(b===0)throw new Error('Điểm Shamir trùng nhau');return gfMul(a,gfPow(b,254));};
export function splitSecret(secret:Uint8Array,threshold:number,total:number):{x:number,y:Uint8Array}[]{
  if(threshold<2||threshold>total||total>255||secret.length!==32)throw new Error('Ngưỡng chia bí mật không hợp lệ');
  const coefficients=crypto.getRandomValues(new Uint8Array(secret.length*(threshold-1)));
  const shares=Array.from({length:total},(_,i)=>({x:i+1,y:new Uint8Array(secret.length)}));
  for(let byte=0;byte<secret.length;byte++)for(const s of shares){let value=secret[byte],xp=1;
    for(let c=0;c<threshold-1;c++){xp=gfMul(xp,s.x);value^=gfMul(coefficients[byte*(threshold-1)+c],xp);}s.y[byte]=value;
  }
  coefficients.fill(0);return shares;
}
export function combineSecret(shares:{x:number,y:Uint8Array}[],threshold:number):Uint8Array{
  if(shares.length<threshold||threshold<2||new Set(shares.map(s=>s.x)).size!==shares.length||
    shares.some(s=>s.x<1||s.x>255||s.y.length!==32))throw new Error('Các mảnh khôi phục không hợp lệ hoặc bị trùng');
  const selected=shares.slice(0,threshold),secret=new Uint8Array(32);
  for(let i=0;i<threshold;i++){
    let factor=1;
    for(let j=0;j<threshold;j++)if(i!==j)factor=gfMul(factor,gfDiv(selected[j].x,selected[j].x^selected[i].x));
    for(let byte=0;byte<32;byte++)secret[byte]^=gfMul(selected[i].y[byte],factor);
  }
  return secret;
}
export type RecoveryPayload={v:1,groupId:string,threshold:number,total:number,iv:string,ciphertext:string,createdAt:string};
export type RecoveryShare={v:1,groupId:string,x:number,threshold:number,y:string,checksum:string};
function shareBody(s:Omit<RecoveryShare,'checksum'>){return `${s.v}|${s.groupId}|${s.x}|${s.threshold}|${s.y}`;}
export async function encodeShare(s:Omit<RecoveryShare,'checksum'>){return 'PQSH1.'+b64(utf(JSON.stringify({...s,checksum:await sha256(utf(shareBody(s)))})));}
export async function decodeShare(input:string):Promise<RecoveryShare>{
  if(!input.startsWith('PQSH1.')||input.length>1000)throw new Error('Mảnh khôi phục không đúng định dạng');
  const s=JSON.parse(new TextDecoder().decode(ub64(input.slice(6)))) as RecoveryShare;
  if(s.v!==1||typeof s.groupId!=='string'||s.groupId.length>80||!Number.isInteger(s.x)||s.x<1||s.x>255||
    !Number.isInteger(s.threshold)||s.threshold<2||s.threshold>5||!s.y||ub64(s.y).length!==32||
    s.checksum!==await sha256(utf(shareBody(s))))throw new Error('Mảnh khôi phục sai định dạng hoặc checksum');
  return s;
}
export async function createRecovery(keys:VaultKeys,threshold=3,total=5):Promise<{payload:RecoveryPayload,shares:string[]}>{
  const groupId=crypto.randomUUID(),secret=crypto.getRandomValues(new Uint8Array(32));
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const ciphertext=bytes(await crypto.subtle.encrypt({name:'AES-GCM',iv:buffer(iv),additionalData:utf('PQFILE:RECOVERY:V1:'+groupId)},await aes(secret),utf(JSON.stringify(keys))));
  const points=splitSecret(secret,threshold,total);secret.fill(0);
  const shares=await Promise.all(points.map(s=>encodeShare({v:1,groupId,x:s.x,threshold,y:b64(s.y)})));
  points.forEach(s=>s.y.fill(0));
  return {payload:{v:1,groupId,threshold,total,iv:b64(iv),ciphertext:b64(ciphertext),createdAt:new Date().toISOString()},shares};
}
export async function recoverVault(payload:RecoveryPayload,input:string[]):Promise<VaultKeys>{
  if(payload.v!==1||payload.threshold<2||payload.threshold>5||payload.total>5)throw new Error('Kế hoạch khôi phục không hợp lệ');
  const parsed=await Promise.all(input.map(decodeShare));
  if(parsed.some(s=>s.groupId!==payload.groupId||s.threshold!==payload.threshold))throw new Error('Các mảnh thuộc kế hoạch khác nhau');
  const secret=combineSecret(parsed.map(s=>({x:s.x,y:ub64(s.y)})),payload.threshold);
  try{
    const decrypted=bytes(await crypto.subtle.decrypt({name:'AES-GCM',iv:buffer(ub64(payload.iv)),additionalData:utf('PQFILE:RECOVERY:V1:'+payload.groupId)},await aes(secret),buffer(ub64(payload.ciphertext))));
    const keys=JSON.parse(new TextDecoder().decode(decrypted)) as VaultKeys;
    decrypted.fill(0);
    if(!keys.kemSecret||!keys.kemPublic||!keys.dsaSecret||!keys.dsaPublic)throw new Error('Bộ khóa không hợp lệ');
    return keys;
  }catch{throw new Error('Không đủ mảnh hợp lệ hoặc bản mã khôi phục không khớp');}
  finally{secret.fill(0);}
}
export type IntegrityReceipt={schema:'pqfile-integrity-v1',fileId:string,manifest:CryptoManifest,
  originalSignature:string,ownerPublicKey:string,signerFingerprint:string,issuedAt:string,
  receiptSignature:string};
export function receiptBytes(r:Omit<IntegrityReceipt,'receiptSignature'>|IntegrityReceipt):Uint8Array{
  return utf(JSON.stringify({schema:r.schema,fileId:r.fileId,manifest:JSON.parse(new TextDecoder().decode(manifestSigningBytes(r.manifest))),
    originalSignature:r.originalSignature,ownerPublicKey:r.ownerPublicKey,signerFingerprint:r.signerFingerprint,issuedAt:r.issuedAt}));
}
export async function makeReceipt(meta:{id:string,manifest:CryptoManifest,signature:string,signerPublicKey:string},keys:VaultKeys):Promise<IntegrityReceipt>{
  if(meta.signerPublicKey!==keys.dsaPublic)throw new Error('Tệp không được ký bằng khóa hiện đang mở');
  if(meta.manifest.fileId!==meta.id)throw new Error('Định danh manifest không khớp');
  if(!ml_dsa65.verify(ub64(meta.signature),manifestSigningBytes(meta.manifest),ub64(meta.signerPublicKey)))throw new Error('Chữ ký gốc của tệp không hợp lệ');
  const unsigned={schema:'pqfile-integrity-v1' as const,fileId:meta.id,manifest:meta.manifest,
    originalSignature:meta.signature,ownerPublicKey:meta.signerPublicKey,signerFingerprint:await sha256(ub64(meta.signerPublicKey)),issuedAt:new Date().toISOString()};
  return {...unsigned,receiptSignature:b64(ml_dsa65.sign(receiptBytes(unsigned),ub64(keys.dsaSecret)))};
}
export async function verifyReceipt(r:IntegrityReceipt,ciphertext?:Uint8Array):Promise<{valid:boolean,reason:string,hashChecked:boolean}>{
  try{
    if(r.schema!=='pqfile-integrity-v1'||r.fileId!==r.manifest.fileId||r.signerFingerprint!==await sha256(ub64(r.ownerPublicKey)))throw new Error('Dữ liệu chứng nhận không nhất quán');
    if(!ml_dsa65.verify(ub64(r.originalSignature),manifestSigningBytes(r.manifest),ub64(r.ownerPublicKey)))throw new Error('Chữ ký manifest gốc sai');
    if(!ml_dsa65.verify(ub64(r.receiptSignature),receiptBytes(r),ub64(r.ownerPublicKey)))throw new Error('Chữ ký phiếu xác minh sai');
    if(ciphertext && (ciphertext.length!==r.manifest.cipherBytes||await sha256(ciphertext)!==r.manifest.cipherHash))throw new Error('Ciphertext không khớp với phiếu xác minh');
    return {valid:true,reason:'Chữ ký và dữ liệu chứng nhận nhất quán'+(ciphertext?' · ciphertext khớp SHA-256':''),hashChecked:!!ciphertext};
  }catch(e:any){return {valid:false,reason:e?.message||'Xác minh thất bại',hashChecked:!!ciphertext};}
}
/** Authenticated key-management command, bound to its exact operation and fields. */
export async function signPqcAction(operation:string,parts:string[],keys:VaultKeys):Promise<string>{
  const message=JSON.stringify(['PQFILE:PQC:AUTH:V1',operation,...parts]);
  return b64(ml_dsa65.sign(utf(message),ub64(keys.dsaSecret)));
}
export async function shaText(text:string):Promise<string>{return sha256(utf(text));}

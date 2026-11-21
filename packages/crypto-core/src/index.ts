/** PQFile Secure single-record crypto implementation for files up to 20 MiB.
 * No plaintext or private keys are sent to the server. WebCrypto runs in the browser.
 * NOTE: format v1 MVP, not the planned record-stream .pqf specification.
 */
import { ml_kem512,ml_kem768,ml_kem1024 } from '@noble/post-quantum/ml-kem.js';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import { argon2id } from 'hash-wasm';
const enc=new TextEncoder();
const dec=new TextDecoder('utf-8',{fatal:true});
export type KemAlgorithm='ML-KEM-512'|'ML-KEM-768'|'ML-KEM-1024';
export type VaultKeys={kemAlgorithm:KemAlgorithm,kemPublic:string,kemSecret:string,dsaPublic:string,dsaSecret:string,pendingKem?:{keyId:string,algorithm:KemAlgorithm,publicKey:string,secretKey:string},x25519Public?:string,x25519Private?:string};
export type PublicRecipient={userId:string,keyId:string,algorithm:KemAlgorithm,publicKey:string,x25519Public?:string,x25519KeyId?:string};
export type RecipientEnvelope={userId:string,keyId:string,kemCiphertext:string,wrapIv:string,wrappedKey:string,hybridEphemeralPublic?:string|null,hybridSalt?:string|null};
export type CryptoManifest={version:1,fileId:string,cipherHash:string,cipherBytes:number,iv:string,algorithm:'AES-256-GCM',createdAt:string};
export type EncryptedFile={metadata:{id:string,displayLabel:string,iv:string,manifest:CryptoManifest,signature:string,signerPublicKey:string,envelopes:RecipientEnvelope[]},ciphertext:Uint8Array};
/**
 * The v1 wire format signs JSON.stringify(manifest) in this EXACT field order.
 * PostgreSQL jsonb does not preserve insertion order, so never sign/verify a
 * manifest object in its storage/response order.
 * Keep this order for backwards compatibility with previously uploaded files.
 */
export function manifestSigningBytes(manifest:CryptoManifest):Uint8Array {
  const expected=['version','fileId','cipherHash','cipherBytes','iv','algorithm','createdAt'];
  if(!manifest||typeof manifest!=='object'||Object.keys(manifest).length!==expected.length||
     expected.some(k=>!Object.prototype.hasOwnProperty.call(manifest,k))||
     manifest.version!==1||typeof manifest.fileId!=='string'||
     typeof manifest.cipherHash!=='string'||
     !Number.isSafeInteger(manifest.cipherBytes)||manifest.cipherBytes<16||
     typeof manifest.iv!=='string'||manifest.algorithm!=='AES-256-GCM'||
     typeof manifest.createdAt!=='string'){
    throw new Error('Manifest chữ ký không hợp lệ hoặc không được hỗ trợ');
  }
  return enc.encode(JSON.stringify({
    version:manifest.version,
    fileId:manifest.fileId,
    cipherHash:manifest.cipherHash,
    cipherBytes:manifest.cipherBytes,
    iv:manifest.iv,
    algorithm:manifest.algorithm,
    createdAt:manifest.createdAt
  }));
}
export const b64=(buf:Uint8Array):string=>{let str='';for(let i=0;i<buf.length;i+=0x8000)str+=String.fromCharCode(...buf.subarray(i,i+0x8000));return btoa(str);};
export const ub64=(s:string):Uint8Array=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const bytes=(x:Uint8Array):ArrayBuffer=>new Uint8Array(x).buffer;
const kem=(alg:KemAlgorithm)=>alg==='ML-KEM-512'?ml_kem512:alg==='ML-KEM-1024'?ml_kem1024:ml_kem768;
export const sha256=async(a:Uint8Array):Promise<string>=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes(a)))).map(x=>x.toString(16).padStart(2,'0')).join('');
export async function makeX25519Key():Promise<{publicKey:string,privateKey:string}>{
  const pair=await crypto.subtle.generateKey('X25519',true,['deriveBits']) as CryptoKeyPair;
  const publicKey=new Uint8Array(await crypto.subtle.exportKey('raw',pair.publicKey));
  const privateKey=new Uint8Array(await crypto.subtle.exportKey('pkcs8',pair.privateKey));
  return {publicKey:b64(publicKey),privateKey:b64(privateKey)};
}
export function makeKemKey(alg:KemAlgorithm='ML-KEM-768'):{algorithm:KemAlgorithm,publicKey:string,secretKey:string}{ const pair=kem(alg).keygen();return {algorithm:alg,publicKey:b64(pair.publicKey),secretKey:b64(pair.secretKey)}; }
export async function makeKeys(alg:KemAlgorithm='ML-KEM-768'):Promise<VaultKeys>{
  const k=kem(alg).keygen(),s=ml_dsa65.keygen(),x=await makeX25519Key();
  return {kemAlgorithm:alg,kemPublic:b64(k.publicKey),kemSecret:b64(k.secretKey),dsaPublic:b64(s.publicKey),dsaSecret:b64(s.secretKey),x25519Public:x.publicKey,x25519Private:x.privateKey};
}
async function keyFromPassword(password:string,salt:Uint8Array):Promise<CryptoKey>{
  if(password.length<12)throw new Error('Mật khẩu kho khóa phải dài ít nhất 12 ký tự');
  const raw=await argon2id({password,salt,parallelism:1,iterations:3,memorySize:32768,hashLength:32,outputType:'binary'});
  return crypto.subtle.importKey('raw',bytes(raw as Uint8Array),{name:'AES-GCM'},false,['encrypt','decrypt']);
}
export async function lockVault(keys:VaultKeys,password:string):Promise<string>{
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await keyFromPassword(password,salt);
  const payload=await crypto.subtle.encrypt({name:'AES-GCM',iv:bytes(iv),additionalData:enc.encode('pqfile:vault:v1')},key,enc.encode(JSON.stringify(keys)));
  return JSON.stringify({v:1,kdf:'Argon2id',memoryKiB:32768,iterations:3,salt:b64(salt),iv:b64(iv),ciphertext:b64(new Uint8Array(payload))});
}
export async function unlockVault(backup:string,password:string):Promise<VaultKeys>{
  try{
    const d=JSON.parse(backup);
    if(d.v!==1||d.kdf!=='Argon2id'||d.memoryKiB!==32768||d.iterations!==3)throw new Error('unsupported');
    const key=await keyFromPassword(password,ub64(d.salt));
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(ub64(d.iv)),additionalData:enc.encode('pqfile:vault:v1')},key,bytes(ub64(d.ciphertext)));
    const keys=JSON.parse(dec.decode(plain));
    if(!keys.kemSecret||!keys.dsaSecret)throw new Error('invalid');
    return keys;
  }catch{throw new Error('Không thể mở kho khóa: mật khẩu sai hoặc dữ liệu sao lưu không hợp lệ');}
}
async function aesKey(raw:Uint8Array):Promise<CryptoKey>{return crypto.subtle.importKey('raw',bytes(raw),'AES-GCM',false,['encrypt','decrypt']);}
async function deriveWrapKey(shared:Uint8Array,id:string):Promise<CryptoKey>{
  const input=await crypto.subtle.importKey('raw',bytes(shared),'HKDF',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:enc.encode(id),info:enc.encode('PQFILE:WRAP-CEK:V1')},input,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function deriveHybridKey(ml:Uint8Array,x:Uint8Array,id:string,salt:Uint8Array):Promise<CryptoKey>{
  const ikm=new Uint8Array(4+ml.length+4+x.length);
  const view=new DataView(ikm.buffer);view.setUint32(0,ml.length,false);ikm.set(ml,4);
  view.setUint32(4+ml.length,x.length,false);ikm.set(x,8+ml.length);
  const base=await crypto.subtle.importKey('raw',bytes(ikm),'HKDF',false,['deriveKey']);ikm.fill(0);
  return crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:bytes(salt),info:enc.encode(`PQFILE:HYBRID:MLKEM-X25519:WRAP-CEK:V1:${id}`)},
    base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function wrapCek(cek:Uint8Array,id:string,recipient:PublicRecipient,mode:'PQC'|'HYBRID'='PQC'):Promise<RecipientEnvelope>{
  const {cipherText,sharedSecret}=kem(recipient.algorithm).encapsulate(ub64(recipient.publicKey));
  let hybridEphemeralPublic:string|undefined,hybridSalt:string|undefined,ecdh:Uint8Array|null=null;
  try{
    let key:CryptoKey;
    if(mode==='HYBRID'){
      if(!recipient.x25519Public||!recipient.x25519KeyId)throw new Error('Người nhận chưa có khóa X25519 đang hoạt động');
      const ephemeral=await crypto.subtle.generateKey('X25519',true,['deriveBits']) as CryptoKeyPair;
      const target=await crypto.subtle.importKey('raw',bytes(ub64(recipient.x25519Public)),'X25519',false,[]);
      ecdh=new Uint8Array(await crypto.subtle.deriveBits({name:'X25519',public:target},ephemeral.privateKey,256));
      hybridEphemeralPublic=b64(new Uint8Array(await crypto.subtle.exportKey('raw',ephemeral.publicKey)));
      const salt=crypto.getRandomValues(new Uint8Array(32));hybridSalt=b64(salt);
      key=await deriveHybridKey(sharedSecret,ecdh,id,salt);
    }else key=await deriveWrapKey(sharedSecret,id);
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const aad=mode==='HYBRID'?`PQFILE:ENVELOPE:${id}:${recipient.userId}:HYBRID`:`PQFILE:ENVELOPE:${id}:${recipient.userId}`;
    const wrapped=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:bytes(iv),additionalData:enc.encode(aad)},key,bytes(cek)));
    return {userId:recipient.userId,keyId:recipient.keyId,kemCiphertext:b64(cipherText),wrapIv:b64(iv),wrappedKey:b64(wrapped),
      ...(mode==='HYBRID'?{hybridEphemeralPublic,hybridSalt}:{})};
  }finally{sharedSecret.fill(0);ecdh?.fill(0);}
}
export async function unwrapCek(id:string,envelope:RecipientEnvelope,keys:VaultKeys):Promise<Uint8Array>{
  const pending=keys.pendingKem && keys.pendingKem.keyId===envelope.keyId ? keys.pendingKem : null;
  const secret=kem(pending?.algorithm||keys.kemAlgorithm).decapsulate(ub64(envelope.kemCiphertext),ub64(pending?.secretKey||keys.kemSecret));
  let ecdh:Uint8Array|null=null;
  try{
    let key:CryptoKey;
    const hybrid=Boolean(envelope.hybridEphemeralPublic&&envelope.hybridSalt);
    if(hybrid){
      if(!keys.x25519Private)throw new Error('Kho khóa hiện tại không có khóa X25519 để giải mã tệp lai');
      const privateKey=await crypto.subtle.importKey('pkcs8',bytes(ub64(keys.x25519Private)),'X25519',false,['deriveBits']);
      const peer=await crypto.subtle.importKey('raw',bytes(ub64(envelope.hybridEphemeralPublic!)),'X25519',false,[]);
      ecdh=new Uint8Array(await crypto.subtle.deriveBits({name:'X25519',public:peer},privateKey,256));
      key=await deriveHybridKey(secret,ecdh,id,ub64(envelope.hybridSalt!));
    }else if(envelope.hybridEphemeralPublic||envelope.hybridSalt)throw new Error('Envelope lai thiếu thành phần X25519');
    else key=await deriveWrapKey(secret,id);
    const aad=hybrid?`PQFILE:ENVELOPE:${id}:${envelope.userId}:HYBRID`:`PQFILE:ENVELOPE:${id}:${envelope.userId}`;
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(ub64(envelope.wrapIv)),additionalData:enc.encode(aad)},key,bytes(ub64(envelope.wrappedKey)));
    return new Uint8Array(plain);
  }finally{secret.fill(0);ecdh?.fill(0);}
}
export async function encryptFile(file:File,keys:VaultKeys,recipients:PublicRecipient[],id=crypto.randomUUID(),wrapMode:'PQC'|'HYBRID'='PQC'):Promise<EncryptedFile>{
  if(file.size>20*1024*1024)throw new Error('Phiên bản thử nghiệm giới hạn tệp 20 MiB');
  if(!recipients.length)throw new Error('Chưa chọn người nhận');
  const name=enc.encode(file.name);
  if(name.byteLength>1024)throw new Error('Tên tệp quá dài');
  const original=new Uint8Array(await file.arrayBuffer());
  const plain=new Uint8Array(4+name.byteLength+original.byteLength);
  new DataView(plain.buffer).setUint32(0,name.byteLength,true);
  plain.set(name,4);plain.set(original,4+name.byteLength);
  const cek=crypto.getRandomValues(new Uint8Array(32)),iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await aesKey(cek);
  const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:bytes(iv),additionalData:enc.encode(`PQFILE:CONTENT:${id}`)},key,bytes(plain)));
  const wrapped=await Promise.all(recipients.map(r=>wrapCek(cek,id,r,wrapMode)));
  const manifest:CryptoManifest={version:1,fileId:id,cipherHash:await sha256(ciphertext),cipherBytes:ciphertext.length,iv:b64(iv),algorithm:'AES-256-GCM',createdAt:new Date().toISOString()};
  const signature=ml_dsa65.sign(manifestSigningBytes(manifest),ub64(keys.dsaSecret));
  cek.fill(0);plain.fill(0);original.fill(0);
  return {ciphertext,metadata:{id,displayLabel:`Tệp bảo vệ ${id.slice(0,8)}`,iv:b64(iv),manifest,signature:b64(signature),signerPublicKey:keys.dsaPublic,envelopes:wrapped}};
}
export async function decryptFile(ciphertext:Uint8Array,meta:{id:string,iv:string,manifest:CryptoManifest,signature:string,signerPublicKey:string,envelope:RecipientEnvelope},keys:VaultKeys):Promise<{name:string,blob:Blob}>{
  if(meta.manifest.fileId!==meta.id||meta.manifest.iv!==meta.iv||meta.manifest.cipherBytes!==ciphertext.byteLength||meta.manifest.cipherHash!==await sha256(ciphertext))throw new Error('Ciphertext bị thay đổi hoặc thiếu dữ liệu');
  if(!ml_dsa65.verify(ub64(meta.signature),manifestSigningBytes(meta.manifest),ub64(meta.signerPublicKey)))throw new Error('Chữ ký ML-DSA không hợp lệ');
  if(!meta.envelope)throw new Error('Không có recipient envelope');
  const cek=await unwrapCek(meta.id,meta.envelope,keys);
  try{
    const key=await aesKey(cek);
    const plain=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(ub64(meta.iv)),additionalData:enc.encode(`PQFILE:CONTENT:${meta.id}`)},key,bytes(ciphertext)));
    if(plain.length<4)throw new Error('Tệp giải mã sai định dạng');
    const nameLen=new DataView(plain.buffer,plain.byteOffset,plain.byteLength).getUint32(0,true);
    if(nameLen>1024||4+nameLen>plain.length)throw new Error('Header tệp không hợp lệ');
    const name=dec.decode(plain.subarray(4,4+nameLen)).replaceAll(/[\\/\0]/g,'_');
    const contents=plain.slice(4+nameLen);
    plain.fill(0);
    return {name,blob:new Blob([bytes(contents)],{type:'application/octet-stream'})};
  }finally{cek.fill(0);}
}

/** Empirical ML-KEM keygen, encapsulation, decapsulation times (single warm-up + 3 iterations).
 * Does NOT change or inspect the user's private key. Not a hardware benchmark standard.
 */
export async function benchmarkKems():Promise<{algorithm:KemAlgorithm,keygenMs:number,encapsMs:number,decapsMs:number}[]>{
 const output:{algorithm:KemAlgorithm,keygenMs:number,encapsMs:number,decapsMs:number}[]=[];
 for(const algorithm of ['ML-KEM-512','ML-KEM-768','ML-KEM-1024'] as KemAlgorithm[]){
  const engine=kem(algorithm);const stats={keygenMs:0,encapsMs:0,decapsMs:0};
  for(let i=0;i<4;i++){
   let start=performance.now();const pair=engine.keygen();const k=performance.now()-start;
   start=performance.now();const encrypted=engine.encapsulate(pair.publicKey);const en=performance.now()-start;
   start=performance.now();const secret=engine.decapsulate(encrypted.cipherText,pair.secretKey);const de=performance.now()-start;
   if(!encrypted.sharedSecret.every((b,j)=>b===secret[j]))throw new Error('ML-KEM benchmark: decapsulation mismatch');
   encrypted.sharedSecret.fill(0);secret.fill(0);
   if(i){stats.keygenMs+=k/3;stats.encapsMs+=en/3;stats.decapsMs+=de/3;}
  }
  output.push({algorithm,...Object.fromEntries(Object.entries(stats).map(([k,v])=>[k,Math.round(v*100)/100]))} as typeof output[number]);
 }
 return output;
}

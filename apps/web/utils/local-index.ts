/** Browser IndexedDB storage with AES-GCM encryption at rest.
 * AES key derived via HKDF from the already-unlocked KEM secret, domain-separated.
 * No plaintext document/index is stored in localStorage, cookies, or backend.
 * Users of a shared device should clear their browser data when appropriate.
 */
import { ub64 } from '@pqfile/crypto-core';
import type { VaultKeys } from '@pqfile/crypto-core';
import type { IndexedDocument } from './local-intelligence';
const DB_NAME='pqfile-local-index-v1';const TABLE='entries';
type EncryptedRow={key:string;owner:string;iv:number[];cipher:number[]};
function connect():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open(DB_NAME,1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(TABLE))req.result.createObjectStore(TABLE,{keyPath:'key'});};
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('Không mở được IndexedDB'));
 });
}
async function keyFor(vault:VaultKeys,owner:string):Promise<CryptoKey>{
 const secret=ub64(vault.kemSecret);
 try{
  const seed=await crypto.subtle.importKey('raw',new Uint8Array(secret).buffer,'HKDF',false,['deriveKey']);
  return await crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:new TextEncoder().encode(owner),info:new TextEncoder().encode('PQFILE:LOCAL-SEARCH-INDEX:AES-GCM:V1')},seed,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
 }finally{secret.fill(0);}
}
function operation(db:IDBDatabase,method:'getAll'|'put'|'delete',value?:any):Promise<any>{
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(TABLE,method==='getAll'?'readonly':'readwrite');
  const q=method==='getAll'?tx.objectStore(TABLE).getAll():method==='put'?tx.objectStore(TABLE).put(value):tx.objectStore(TABLE).delete(value);
  let result:any;
  q.onsuccess=()=>{result=q.result;};q.onerror=()=>reject(q.error||new Error('Lỗi IndexedDB'));
  tx.oncomplete=()=>{db.close();resolve(result);};tx.onabort=()=>{db.close();reject(tx.error||new Error('Ghi IndexedDB thất bại'));};
 });
}
export async function saveLocalIndex(owner:string,vault:VaultKeys,doc:IndexedDocument){
 const key=await keyFor(vault,owner),iv=crypto.getRandomValues(new Uint8Array(12));
 const itemKey=`${owner}:${doc.id}`;
 const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(itemKey)},key,new TextEncoder().encode(JSON.stringify(doc)));
 const db=await connect();await operation(db,'put',{key:itemKey,owner,iv:Array.from(iv),cipher:Array.from(new Uint8Array(cipher))} satisfies EncryptedRow);
}
export async function loadLocalIndex(owner:string,vault:VaultKeys):Promise<IndexedDocument[]>{
 const db=await connect(),rows=await operation(db,'getAll') as EncryptedRow[],key=await keyFor(vault,owner);
 const output:IndexedDocument[]=[];
 for(const row of rows.filter(r=>r.owner===owner)){
  try{
   const decoded=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(row.iv),additionalData:new TextEncoder().encode(row.key)},key,new Uint8Array(row.cipher));
   const doc=JSON.parse(new TextDecoder().decode(decoded)) as IndexedDocument;
   if(row.key===`${owner}:${doc.id}`)output.push(doc);
  }catch{ /* Ignore index records encrypted with an older/different vault. */ }
 }
 return output;
}
export async function removeLocalIndex(owner:string,id:string){const db=await connect();await operation(db,'delete',`${owner}:${id}`);}

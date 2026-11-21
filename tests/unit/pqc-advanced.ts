/** Execute after npm install: npx tsx tests/unit/pqc-advanced.ts */
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { makeKeys,wrapCek,unwrapCek,encryptFile,decryptFile } from '@pqfile/crypto-core';
import { splitSecret,combineSecret,createRecovery,recoverVault,runExperiment,makeReceipt,verifyReceipt } from '../../apps/web/utils/pqc-advanced';
Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});
const vault=await makeKeys('ML-KEM-768');
const secret=webcrypto.getRandomValues(new Uint8Array(32));
const pieces=splitSecret(secret,3,5);
for(const indices of [[0,1,2],[0,2,4],[1,3,4],[2,3,4]])
 assert.deepEqual(combineSecret(indices.map(i=>pieces[i]),3),secret);
assert.throws(()=>combineSecret([pieces[0],pieces[0],pieces[1]],3),/trùng/);
const recovery=await createRecovery(vault);
const restored=await recoverVault(recovery.payload,[recovery.shares[1],recovery.shares[2],recovery.shares[4]]);
assert.equal(restored.kemSecret,vault.kemSecret);
await assert.rejects(()=>recoverVault(recovery.payload,[recovery.shares[0],recovery.shares[0],recovery.shares[1]]));
const src=new TextEncoder().encode('PQFile hybrid test content');
for(const mode of ['X25519','ML-KEM-768','X25519+ML-KEM-768'] as const){
 const result=await runExperiment(src,mode);assert.equal(result.verified,true);
}
const userId=webcrypto.randomUUID(),keyId=webcrypto.randomUUID();
const recipient={userId,keyId,algorithm:'ML-KEM-768' as const,publicKey:vault.kemPublic,
  x25519Public:vault.x25519Public,x25519KeyId:webcrypto.randomUUID()};
const cek=webcrypto.getRandomValues(new Uint8Array(32));
for(const mode of ['PQC','HYBRID'] as const){
 const env=await wrapCek(cek,userId,recipient,mode);
 assert.deepEqual(await unwrapCek(userId,env,vault),cek);
}
const file=new File(['Demo plaintext content'],'file-demo.txt');
const encrypted=await encryptFile(file,vault,[recipient],webcrypto.randomUUID(),'HYBRID');
const meta=encrypted.metadata;
const opened=await decryptFile(encrypted.ciphertext,{id:meta.id,iv:meta.iv,manifest:meta.manifest,
  signature:meta.signature,signerPublicKey:meta.signerPublicKey,envelope:meta.envelopes[0]},vault);
assert.equal(await opened.blob.text(),'Demo plaintext content');
const receipt=await makeReceipt({id:meta.id,manifest:meta.manifest,signature:meta.signature,signerPublicKey:meta.signerPublicKey},vault);
assert.equal((await verifyReceipt(receipt,encrypted.ciphertext)).valid,true);
const corrupted={...receipt,manifest:{...receipt.manifest,cipherBytes:receipt.manifest.cipherBytes+1}};
assert.equal((await verifyReceipt(corrupted)).valid,false);
console.log('PASS: Shamir / 3+ modes / hybrid envelope / file / ML-DSA receipt');

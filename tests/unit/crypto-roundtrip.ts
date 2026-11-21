/** Integration of ML-KEM + HKDF + AES-GCM + ML-DSA + encrypted Argon2id vault. */
import assert from 'node:assert/strict';
import {makeKeys,lockVault,unlockVault,encryptFile,decryptFile,sha256,ub64} from '@pqfile/crypto-core';
for(const algorithm of ['ML-KEM-512','ML-KEM-768','ML-KEM-1024'] as const){
  const keys=await makeKeys(algorithm),uid=crypto.randomUUID(),fileId=crypto.randomUUID();
  const password='SampleTestPassphrase01234!';
  const backup=await lockVault(keys,password);
  const recovered=await unlockVault(backup,password);
  assert.deepEqual(recovered,keys);
  await assert.rejects(()=>unlockVault(backup,'WrongPasswordThatIsLongEnough!'));
  const data=new File(['Hello Post-Quantum — Xin chào'],'example.txt',{type:'text/plain'});
  const encrypted=await encryptFile(data,keys,[{userId:uid,keyId:crypto.randomUUID(),algorithm,publicKey:keys.kemPublic}],fileId);
  assert.notEqual(new TextDecoder().decode(encrypted.ciphertext),'Hello Post-Quantum — Xin chào');
  const output=await decryptFile(encrypted.ciphertext,{...encrypted.metadata,envelope:encrypted.metadata.envelopes[0]},recovered);
  assert.equal(output.name,'example.txt');
  assert.equal(await output.blob.text(),'Hello Post-Quantum — Xin chào');
  // PostgreSQL jsonb reorders object fields. Old signatures must still verify
  // because the signed v1 representation uses a fixed, historical key order.
  const reorderedManifest=Object.fromEntries(
    Object.entries(encrypted.metadata.manifest).sort(([a],[b])=>a.localeCompare(b))
  ) as typeof encrypted.metadata.manifest;
  assert.notEqual(JSON.stringify(reorderedManifest),JSON.stringify(encrypted.metadata.manifest));
  const afterJsonb=await decryptFile(encrypted.ciphertext,{
    ...encrypted.metadata,manifest:reorderedManifest,
    envelope:encrypted.metadata.envelopes[0]
  },recovered);
  assert.equal(await afterJsonb.blob.text(),'Hello Post-Quantum — Xin chào');
  // Do not "fix" the error by skipping signature verification: tampered
  // signed fields and additional unsigned fields must remain rejected.
  const modifiedManifest={...reorderedManifest,createdAt:'2000-01-01T00:00:00.000Z'};
  await assert.rejects(()=>decryptFile(encrypted.ciphertext,{
    ...encrypted.metadata,manifest:modifiedManifest,
    envelope:encrypted.metadata.envelopes[0]
  },recovered),/Chữ ký ML-DSA không hợp lệ/);
  const extraManifest={...reorderedManifest,untrusted:'text'};
  await assert.rejects(()=>decryptFile(encrypted.ciphertext,{
    ...encrypted.metadata,manifest:extraManifest as any,
    envelope:encrypted.metadata.envelopes[0]
  },recovered),/Manifest chữ ký không hợp lệ/);
  const tampered=Uint8Array.from(encrypted.ciphertext);tampered[0]^=1;
  await assert.rejects(()=>decryptFile(tampered,{...encrypted.metadata,envelope:encrypted.metadata.envelopes[0]},recovered));
  const damaged={...encrypted.metadata,signature:encrypted.metadata.signature.slice(0,-4)+'AAAA'};
  await assert.rejects(()=>decryptFile(encrypted.ciphertext,{...damaged,envelope:encrypted.metadata.envelopes[0]},recovered));
  console.log(`PASS ${algorithm}: keygen, vault, encrypt/decrypt, integrity and signature`);
}

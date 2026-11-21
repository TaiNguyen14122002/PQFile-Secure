<script setup lang="ts">
import { ShieldCheck,FlaskConical,RefreshCw,UsersRound,ShieldAlert,FileBadge,KeyRound,LockKeyhole,Download,Copy,Play,Search,CheckCircle2,AlertTriangle,UploadCloud,ArrowRightLeft } from 'lucide-vue-next';
import { makeKemKey,makeX25519Key, lockVault, unlockVault, wrapCek, unwrapCek, b64, ub64, sha256 } from '@pqfile/crypto-core';
import type { VaultKeys, PublicRecipient, KemAlgorithm, RecipientEnvelope, CryptoManifest } from '@pqfile/crypto-core';
import { getUnlockedVault,setUnlockedVault } from '~/utils/vault-session';
import QRCode from 'qrcode';
import { runExperiment,createRecovery,recoverVault,makeReceipt,verifyReceipt,signPqcAction,shaText } from '~/utils/pqc-advanced';
import type { ExperimentMode,ExperimentResult,RecoveryPayload,IntegrityReceipt } from '~/utils/pqc-advanced';

const {user}=useAuth();
const route=useRoute();
const tab=ref<'hybrid'|'rotation'|'recovery'|'trust'|'receipt'>('hybrid');
const sections=[
 {key:'hybrid',title:'Mã hóa lai',icon:FlaskConical},
 {key:'rotation',title:'Xoay vòng khóa',icon:RefreshCw},
 {key:'recovery',title:'Khôi phục 3/5',icon:UsersRound},
 {key:'trust',title:'Khóa tin cậy',icon:ShieldCheck},
 {key:'receipt',title:'Phiếu toàn vẹn',icon:FileBadge}
] as const;
const processing=ref(false),error=ref(''),success=ref(''),loading=ref(true);
const keyList=ref<any[]>([]),library=ref<any[]>([]),rotation=ref<any|null>(null),recovery=ref<{encryptedPayload:RecoveryPayload}|null>(null),trusted=ref<any[]>([]),backup=ref('');
const unlocked=ref(false);
const ownX=computed(()=>keyList.value.find(k=>k.purpose==='X25519'&&k.status==='ACTIVE'));
const ownKem=computed(()=>keyList.value.find(k=>k.purpose==='KEM'&&k.status==='ACTIVE'));
const ownDsa=computed(()=>keyList.value.find(k=>k.purpose==='DSA'&&k.status==='ACTIVE'));
const ownedFiles=computed(()=>library.value.filter(f=>f.ownerId===user.value?.id));
const alert=(e:any)=>{error.value=e?.message||'Thao tác không thành công';success.value='';};
const info=(s:string)=>{success.value=s;error.value='';};
const clear=()=>{error.value='';success.value='';};
const setTab=(next:typeof tab.value)=>{tab.value=next;clear();};
async function refresh(){
 loading.value=true;
 try{
  const [k,b,l,r,rec,t]=await Promise.all([
    requestApi<any[]>('/keys'),requestApi<any>('/keys/backup'),requestApi<any>('/files/library'),
    requestApi<any>('/pqc/rotation/plan'),requestApi<any>('/pqc/recovery'),requestApi<any[]>('/pqc/trust')
  ]);
  keyList.value=k;backup.value=b?.encryptedBlob||'';library.value=l.items||[];
  rotation.value=r;recovery.value=rec?.configured && rec?.encryptedPayload ? rec : null;trusted.value=t;unlocked.value=!!getUnlockedVault();
 }catch(e){alert(e);}finally{loading.value=false;}
}
onMounted(()=>{if(typeof route.query.tab==='string'&&sections.some(s=>s.key===route.query.tab))tab.value=route.query.tab as typeof tab.value;void refresh();});
async function safeCopy(value:string){try{await navigator.clipboard.writeText(value);info('Đã sao chép. Chỉ chia sẻ thông qua kênh an toàn.');}catch{alert(new Error('Trình duyệt chặn sao chép, hãy tải tệp thay thế.'));}}
function exportJson(obj:unknown,filename:string){const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});const a=document.createElement('a');const url=URL.createObjectURL(blob);a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function exportText(value:string,filename:string,type='text/plain'){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([value],{type}));a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
const prettyDate=(s:string)=>new Date(s).toLocaleString('vi-VN');

// Hybrid experimental cryptography: actual roundtrip, no production file mutation.
const sample=ref('Dữ liệu thực nghiệm PQFile Secure — nội dung mẫu không gửi lên máy chủ.'),sampleFile=ref<File|null>(null);
const benchmarks=ref<(ExperimentResult & {averageMs:number})[]>([]);
const hybridPassword=ref('');
async function benchmark(){
 processing.value=true;clear();benchmarks.value=[];
 try{
  const text=sampleFile.value?new Uint8Array(await sampleFile.value.arrayBuffer()):new TextEncoder().encode(sample.value);
  if(!text.length||text.length>1048576)throw new Error('Mẫu dữ liệu cần từ 1 byte tới 1 MiB');
  for(const mode of ['X25519','ML-KEM-768','X25519+ML-KEM-768'] as ExperimentMode[]){
   const readings:ExperimentResult[]=[];
   for(let i=0;i<4;i++){const r=await runExperiment(text,mode);if(i)readings.push(r);}
   const r=readings[0];benchmarks.value.push({...r,averageMs:Math.round(readings.reduce((n,v)=>n+v.elapsedMs,0)/readings.length*100)/100});
  }
  info('Ba chế độ đã mã hóa, giải mã và đối chiếu thành công trên trình duyệt. Các số đo là kết quả của thiết bị hiện tại.');
 }catch(e){alert(e);}finally{processing.value=false;}
}
async function enableHybridKey(){
 processing.value=true;clear();
 try{
  if(ownX.value)throw new Error('Kho khóa đã có X25519 đang hoạt động');
  if(rotation.value?.pending)throw new Error('Hãy hoàn tất xoay vòng KEM trước khi bổ sung X25519');
  const old=await unlockVault(backup.value,hybridPassword.value);
  if(old.kemPublic!==ownKem.value?.publicKey||old.dsaPublic!==ownDsa.value?.publicKey)throw new Error('Bản sao lưu không khớp khóa đang hoạt động');
  const x=old.x25519Public&&old.x25519Private?{publicKey:old.x25519Public,privateKey:old.x25519Private}:await makeX25519Key();
  const updated:VaultKeys={...old,x25519Public:x.publicKey,x25519Private:x.privateKey};
  const encrypted=await lockVault(updated,hybridPassword.value);
  const fingerprint=await sha256(ub64(x.publicKey));
  const proof=await signPqcAction('hybrid.enable',[x.publicKey,fingerprint,await shaText(encrypted)],old);
  await requestApi('/pqc/hybrid/enable',{method:'POST',body:JSON.stringify({publicKey:x.publicKey,fingerprint,backup:encrypted,proof})});
  setUnlockedVault(updated);hybridPassword.value='';await refresh();
  info('Đã kích hoạt X25519. Kế hoạch 3/5 cũ đã được vô hiệu hóa để tránh mất khóa X25519; hãy tạo lại kế hoạch khôi phục và sao lưu vault.');
 }catch(e){alert(e);}finally{processing.value=false;}
}
function exportBenchmark(){const csv=['mode,average_ms,handshake_bytes,cipher_bytes,plaintext_bytes,js_heap_delta_bytes,verified',
 ...benchmarks.value.map(r=>[r.mode,r.averageMs,r.handshakeBytes,r.cipherBytes,r.plaintextBytes,r.heapDeltaBytes??'',r.verified].join(','))].join('\n');exportText(csv,'pqfile-hybrid-experiment.csv','text/csv');}

// Rotation: staged server transaction, client verifies every new envelope.
const rotationPassword=ref(''),rotationAlgorithm=ref<KemAlgorithm>('ML-KEM-768');
const rotatedCount=ref(0),rotationTotal=ref(0),rotationRunning=ref(false),stopRotation=ref(false);
async function checkPassword():Promise<VaultKeys>{
 if(!backup.value||!rotationPassword.value)throw new Error('Nhập mật khẩu kho khóa trước khi thực hiện');
 const keys=await unlockVault(backup.value,rotationPassword.value);
 if(keys.kemPublic!==rotation.value?.active?.publicKey||keys.dsaPublic!==ownDsa.value?.publicKey)
   throw new Error('Kho khóa đang nhập không khớp khóa hoạt động trên máy chủ');
 return keys;
}
async function startRotation(){
 processing.value=true;clear();
 try{
  const old=await checkPassword();if(rotation.value?.pending)throw new Error('Đang có lần xoay khóa chưa hoàn tất');
  const next=makeKemKey(rotationAlgorithm.value),id=crypto.randomUUID();
  const staged:VaultKeys={...old,pendingKem:{keyId:id,algorithm:next.algorithm,publicKey:next.publicKey,secretKey:next.secretKey}};
  const encrypted=await lockVault(staged,rotationPassword.value);
  const fingerprint=await sha256(ub64(next.publicKey));
  const proof=await signPqcAction('rotation.start',[id,rotation.value.active.id,next.algorithm,fingerprint,await shaText(encrypted)],old);
  await requestApi('/pqc/rotation/start',{method:'POST',body:JSON.stringify({keyId:id,oldKeyId:rotation.value.active.id,algorithm:next.algorithm,
    publicKey:next.publicKey,fingerprint,backup:encrypted,proof})});
  setUnlockedVault(staged);await refresh();info('Đã tạo khóa đang chờ và sao lưu cả khóa cũ/mới. Hãy tái bọc từng tài liệu rồi hoàn tất.');
 }catch(e){alert(e);}finally{processing.value=false;}
}
async function rewrapAll(){
 const keys=getUnlockedVault();const plan=rotation.value;
 if(!keys?.pendingKem||keys.pendingKem.keyId!==plan?.pending?.id){alert(new Error('Mở lại kho khóa có chứa khóa đang chờ trong mục Kho khóa mật mã.'));return;}
 rotationRunning.value=true;stopRotation.value=false;clear();rotatedCount.value=0;
 const pending=plan.pending;const unfinished=plan.items.filter((i:any)=>i.recipientKeyId===plan.active.id);
 rotationTotal.value=unfinished.length;
 try{
  // Batches are committed atomically; each CEK must decrypt to the same value after rewrapping.
  // Limit each request to 15 files to avoid API rate limits during research datasets.
  for(let offset=0;offset<unfinished.length;offset+=15){
   if(stopRotation.value)break;
   const group=unfinished.slice(offset,offset+15),items:any[]=[];
   for(const item of group){
    let cek:Uint8Array|null=null;
    try{
     const oldEnv:RecipientEnvelope={userId:user.value!.id,keyId:item.recipientKeyId,
       kemCiphertext:item.kemCiphertext,wrapIv:item.wrapIv,wrappedKey:item.wrappedKey,
       hybridEphemeralPublic:item.hybridEphemeralPublic,hybridSalt:item.hybridSalt};
     cek=await unwrapCek(item.fileId,oldEnv,keys);
     const hybrid=!!item.hybridEphemeralPublic;
     const xKey=keyList.value.find(k=>k.purpose==='X25519'&&k.status==='ACTIVE');
     if(hybrid&&(!xKey||!keys.x25519Private))throw new Error('Thiếu khóa X25519 để giữ nguyên chính sách lai');
     const nextEnv=await wrapCek(cek,item.fileId,{userId:user.value!.id,keyId:pending.id,algorithm:pending.algorithm,publicKey:pending.publicKey,
       x25519Public:xKey?.publicKey,x25519KeyId:xKey?.id} as PublicRecipient,hybrid?'HYBRID':'PQC');
     const check=await unwrapCek(item.fileId,nextEnv,keys);
     const equal=check.length===cek.length&&check.every((v,j)=>v===cek![j]);check.fill(0);
     if(!equal)throw new Error('Kiểm tra CEK tái bọc không khớp');
     items.push({fileId:item.fileId,oldKeyId:plan.active.id,newKeyId:pending.id,
       kemCiphertext:nextEnv.kemCiphertext,wrapIv:nextEnv.wrapIv,wrappedKey:nextEnv.wrappedKey,
       ...(nextEnv.hybridEphemeralPublic?{hybridEphemeralPublic:nextEnv.hybridEphemeralPublic,hybridSalt:nextEnv.hybridSalt}:{})});
    }finally{cek?.fill(0);}
   }
   const proof=await signPqcAction('rotation.batch',[await shaText(JSON.stringify(items))],keys);
   await requestApi('/pqc/rotation/rewrap-batch',{method:'POST',body:JSON.stringify({items,proof})});
   rotatedCount.value+=items.length;
  }
  await refresh();info(stopRotation.value?'Đã dừng an toàn sau lô hiện tại; bạn có thể tiếp tục.':'Đã tái bọc và kiểm tra xong các envelope. Không thay đổi ciphertext tệp.');
 }catch(e){alert(e);await refresh();}finally{rotationRunning.value=false;}
}
async function finishRotation(){
 processing.value=true;clear();
 try{
  const staged=await checkPassword();const pending=staged.pendingKem;
  if(!pending||pending.keyId!==rotation.value?.pending?.id||rotation.value.remaining>0)throw new Error('Còn envelope cũ hoặc chưa có khóa mới trong kho khóa');
  const next:VaultKeys={kemAlgorithm:pending.algorithm,kemPublic:pending.publicKey,kemSecret:pending.secretKey,dsaPublic:staged.dsaPublic,dsaSecret:staged.dsaSecret,
    x25519Public:staged.x25519Public,x25519Private:staged.x25519Private};
  const encrypted=await lockVault(next,rotationPassword.value);
  const proof=await signPqcAction('rotation.finalize',[rotation.value.active.id,pending.keyId,await shaText(encrypted)],staged);
  await requestApi('/pqc/rotation/finalize',{method:'POST',body:JSON.stringify({oldKeyId:rotation.value.active.id,newKeyId:pending.keyId,backup:encrypted,proof})});
  setUnlockedVault(next);rotationPassword.value='';await refresh();info('Đã kích hoạt khóa KEM mới, khóa cũ RETIRED. Hãy tạo lại kế hoạch khôi phục 3/5 vì bản cũ đã được vô hiệu hóa.');
 }catch(e){alert(e);}finally{processing.value=false;}
}
async function cancelRotation(){
 processing.value=true;clear();
 try{
  const staged=await checkPassword();if(!staged.pendingKem||rotation.value?.migrated>0)throw new Error('Đã tái bọc một phần, không thể hủy; vui lòng tiếp tục hoàn tất');
  const old:VaultKeys={kemAlgorithm:staged.kemAlgorithm,kemPublic:staged.kemPublic,kemSecret:staged.kemSecret,dsaPublic:staged.dsaPublic,dsaSecret:staged.dsaSecret,
    x25519Public:staged.x25519Public,x25519Private:staged.x25519Private};
  const encrypted=await lockVault(old,rotationPassword.value);
  const proof=await signPqcAction('rotation.cancel',[staged.pendingKem.keyId,await shaText(encrypted)],staged);
  await requestApi('/pqc/rotation/cancel',{method:'POST',body:JSON.stringify({pendingKeyId:staged.pendingKem.keyId,backup:encrypted,proof})});
  setUnlockedVault(old);await refresh();info('Đã hủy giai đoạn chờ, khóa hoạt động cũ vẫn giữ nguyên.');
 }catch(e){alert(e);}finally{processing.value=false;}
}

// Recovery: shares only in browser RAM until explicitly copied/downloaded.
const recoveryShares=ref<string[]>([]),recoveryInput=ref(''),recoveryPassword=ref(''),recoveryPasswordConfirm=ref(''),restoredVault=ref<VaultKeys|null>(null);
async function createRecoveryPlan(){
 processing.value=true;clear();recoveryShares.value=[];
 try{
  const keys=getUnlockedVault();if(!keys)throw new Error('Mở kho khóa trước khi phân chia bí mật');
  if(!window.confirm('Tạo bộ mảnh 3/5 MỚI sẽ thay thế kế hoạch khôi phục hiện tại. Bạn đã chuẩn bị 5 người giữ mảnh độc lập?'))return;
  const result=await createRecovery(keys,3,5);
  const proof=await signPqcAction('recovery.create',[result.payload.groupId,await shaText(JSON.stringify(result.payload))],keys);
  await requestApi('/pqc/recovery',{method:'POST',body:JSON.stringify({...result.payload,proof})});
  recoveryShares.value=result.shares;await refresh();info('Đã lưu bản mã khôi phục. Hãy phân phối riêng từng mảnh cho 5 người. Các mảnh chỉ hiển thị trong phiên này.');
 }catch(e){alert(e);}finally{processing.value=false;}
}
async function tryRecover(){processing.value=true;clear();restoredVault.value=null;
 try{
  const payload=recovery.value?.encryptedPayload;
  if(!payload)throw new Error('Chưa có kế hoạch khôi phục');
  const vault=await recoverVault(payload,recoveryInput.value.trim().split(/\s+/).filter(Boolean));
  if(vault.kemPublic!==ownKem.value?.publicKey||vault.dsaPublic!==ownDsa.value?.publicKey)throw new Error('Bộ khóa khôi phục không khớp danh tính khóa đang hoạt động');
  restoredVault.value=vault;info('Đã khôi phục bộ khóa trong RAM. Bạn có thể đặt mật khẩu kho khóa mới.');
 }catch(e){alert(e);}finally{processing.value=false;}
}
async function restoreEncryptedBackup(){processing.value=true;clear();
 try{
  if(!restoredVault.value)throw new Error('Cần ghép thành công đủ mảnh trước');
  if(recoveryPassword.value.length<14||recoveryPassword.value!==recoveryPasswordConfirm.value)throw new Error('Mật khẩu mới phải ít nhất 14 ký tự và nhập khớp');
  if(!window.confirm('Thay bản sao lưu kho khóa đã mã hóa trên máy chủ bằng mật khẩu mới?'))return;
  const v=restoredVault.value,encrypted=await lockVault(v,recoveryPassword.value);
  const kemFingerprint=await sha256(ub64(v.kemPublic)),dsaFingerprint=await sha256(ub64(v.dsaPublic));
  const proof=await signPqcAction('recovery.restore',[await shaText(encrypted),kemFingerprint,dsaFingerprint],v);
  await requestApi('/pqc/recovery/restore-backup',{method:'POST',body:JSON.stringify({backup:encrypted,kemFingerprint,dsaFingerprint,proof})});
  setUnlockedVault(v);restoredVault.value=null;recoveryPassword.value='';recoveryPasswordConfirm.value='';recoveryInput.value='';
  await refresh();info('Đã lưu kho khóa mã hóa lại và mở khóa trong RAM.');
 }catch(e){alert(e);}finally{processing.value=false;}
}

// Recipient trust: verified fingerprints must be confirmed out-of-band.
const recipientQr=ref('');
const trustSearch=ref(''),trustResults=ref<any[]>([]),trustSelected=ref<any|null>(null),trustDetail=ref<any|null>(null),trustConfirm=ref(false);
async function findRecipient(){processing.value=true;clear();trustDetail.value=null;trustSelected.value=null;trustConfirm.value=false;
 try{if(trustSearch.value.trim().length<3)throw new Error('Nhập ít nhất 3 ký tự email');trustResults.value=await requestApi(`/users/search?q=${encodeURIComponent(trustSearch.value.trim())}`);}
 catch(e){alert(e);}finally{processing.value=false;}}
async function chooseRecipient(r:any){processing.value=true;clear();trustSelected.value=r;trustConfirm.value=false;recipientQr.value='';
 try{trustDetail.value=await requestApi(`/pqc/trust/${encodeURIComponent(r.id)}`);
  if(trustDetail.value?.current)recipientQr.value=await QRCode.toDataURL(JSON.stringify({v:1,recipientId:r.id,email:r.email,kemFingerprint:trustDetail.value.current.fingerprint,xFingerprint:trustDetail.value.currentX?.fingerprint||null}),{width:240,margin:2,errorCorrectionLevel:'M'});}catch(e){alert(e);}finally{processing.value=false;}}
async function pinRecipient(){processing.value=true;clear();
 try{
  if(!trustSelected.value||!trustDetail.value?.current||!trustConfirm.value)throw new Error('Hãy xác minh fingerprint qua kênh độc lập và xác nhận');
  const k=trustDetail.value.current;
  const vx=getUnlockedVault();if(!vx)throw new Error('Mở kho khóa để ký xác nhận fingerprint người nhận');
  const xid=trustDetail.value.currentX?.id||'',xfp=trustDetail.value.currentX?.fingerprint||'';
  const proof=await signPqcAction('trust.pin',[trustSelected.value.id,k.id,k.fingerprint,xid,xfp],vx);
  await requestApi('/pqc/trust/pin',{method:'POST',body:JSON.stringify({recipientId:trustSelected.value.id,keyId:k.id,fingerprint:k.fingerprint,xKeyId:xid||undefined,xFingerprint:xfp||undefined,confirmed:true,proof})});
  await refresh();trustDetail.value=await requestApi(`/pqc/trust/${trustSelected.value.id}`);trustConfirm.value=false;
  info('Đã ghim fingerprint của người nhận. API sẽ từ chối chia sẻ nếu fingerprint/khóa bị thay đổi.');
 }catch(e){alert(e);}finally{processing.value=false;}}

// Independent portable ML-DSA receipt.
const receiptFileId=ref(''),lastReceipt=ref<IntegrityReceipt|null>(null),importedReceipt=ref<IntegrityReceipt|null>(null),receiptResult=ref<{valid:boolean,reason:string,hashChecked:boolean}|null>(null),cipherCheckFile=ref<File|null>(null);
async function issueReceipt(){processing.value=true;clear();lastReceipt.value=null;
 try{
  const keys=getUnlockedVault();if(!keys)throw new Error('Mở kho khóa trước khi ký chứng nhận');
  if(!receiptFileId.value||!ownedFiles.value.some(f=>f.id===receiptFileId.value))throw new Error('Hãy chọn tài liệu do bạn sở hữu');
  const metadata=await requestApi<any>(`/files/${encodeURIComponent(receiptFileId.value)}`);
  lastReceipt.value=await makeReceipt(metadata,keys);info('Đã tạo chứng nhận ký ML-DSA trên thiết bị. Không gửi bản rõ tài liệu lên máy chủ.');
 }catch(e){alert(e);}finally{processing.value=false;}}
async function importReceipt(file:File|undefined){clear();receiptResult.value=null;importedReceipt.value=null;
 try{if(!file||file.size>100000)throw new Error('Tệp chứng nhận phải nhỏ hơn 100 KB');importedReceipt.value=JSON.parse(await file.text()) as IntegrityReceipt;info('Đã nạp phiếu xác minh. Nhấn Xác minh độc lập.');}
 catch(e){alert(e);}}
async function verifyImported(){processing.value=true;clear();
 try{if(!importedReceipt.value)throw new Error('Chọn một phiếu .json trước');
  const ciphertext=cipherCheckFile.value?new Uint8Array(await cipherCheckFile.value.arrayBuffer()):undefined;
  receiptResult.value=await verifyReceipt(importedReceipt.value,ciphertext);
  if(receiptResult.value.valid)info(receiptResult.value.reason);else alert(new Error(receiptResult.value.reason));
 }catch(e){alert(e);}finally{processing.value=false;}}
</script>

<template>
 <main class="pq-advanced pq-library-pattern pq-space-optimized" aria-label="Phòng mật mã hậu lượng tử nâng cao">
  <header class="pq-advanced-heading">
   <div class="pq-advanced-heading-icon"><ShieldCheck :size="28"/></div>
   <div class="min-w-0 flex-1"><p class="pq-advanced-eyebrow">TRUNG TÂM MẬT MÃ • THỰC NGHIỆM & QUẢN TRỊ</p><h1>Mật mã hậu lượng tử nâng cao</h1>
    <p>ML-KEM · X25519 · ML-DSA · Vòng đời khóa · Khôi phục theo ngưỡng</p></div>
   <NuxtLink to="/keys" class="pq-advanced-outline"><KeyRound :size="17"/> Mở kho khóa</NuxtLink>
  </header>
  <div class="pq-advanced-metrics">
   <div class="pq-advanced-metric"><small>Trạng thái kho khóa</small><strong>{{unlocked?'Đang mở':'Đang khóa'}}</strong></div>
   <div class="pq-advanced-metric"><small>ML-KEM đang sử dụng</small><strong>{{ownKem?.algorithm||'Chưa có'}}</strong></div>
   <div class="pq-advanced-metric"><small>Tệp sở hữu</small><strong>{{ownedFiles.length}}</strong></div>
   <div class="pq-advanced-metric"><small>Khóa người nhận đã ghim</small><strong>{{trusted.filter(x=>x.status==='TRUSTED').length}} / {{trusted.length}}</strong></div>
  </div>
  <nav class="pq-advanced-tabs" aria-label="Các chức năng hậu lượng tử">
   <button v-for="section in sections" :key="section.key" type="button" :class="{'is-active':tab===section.key}" :aria-current="tab===section.key?'page':undefined" @click="setTab(section.key)">
    <component :is="section.icon" :size="17"/><span>{{section.title}}</span>
   </button>
  </nav>
  <div v-if="error" class="pq-advanced-message is-error" role="alert"><ShieldAlert :size="18"/>{{error}}</div>
  <div v-if="success" class="pq-advanced-message is-success" role="status"><CheckCircle2 :size="18"/>{{success}}</div>
  <div v-if="loading" class="pq-advanced-panel" role="status">Đang tải trạng thái khóa và tài liệu…</div>

  <div v-if="!loading && tab==='hybrid'" class="pq-advanced-columns">
   <section class="pq-advanced-panel"><div class="pq-advanced-section-title"><FlaskConical/><div><h2>Thực nghiệm thiết lập khóa lai</h2><p>Mã hóa/giải mã thực tế trong trình duyệt, không ghi tệp vào kho production</p></div></div>
    <label class="pq-advanced-label" for="hybrid-content">Dữ liệu mẫu thử</label>
    <textarea id="hybrid-content" v-model="sample" :disabled="!!sampleFile" class="pq-advanced-field" rows="4" placeholder="Nội dung mẫu thực nghiệm"/>
    <label class="pq-advanced-label" for="hybrid-file">Hoặc chọn tệp cục bộ (tối đa 1 MiB)</label>
    <input id="hybrid-file" type="file" class="pq-advanced-field" @change="sampleFile=($event.target as HTMLInputElement).files?.[0]||null"/>
    <div class="pq-advanced-actions"><button class="pq-advanced-primary" :disabled="processing" @click="benchmark"><Play :size="18"/>{{processing?'Đang thực nghiệm…':'Chạy so sánh 3 chế độ'}}</button><button v-if="benchmarks.length" class="pq-advanced-outline" @click="exportBenchmark"><Download :size="17"/>Xuất CSV</button></div>
    <div class="pq-advanced-note" v-if="!ownX">
     <strong>Kích hoạt X25519 cho kho khóa hiện tại</strong><p>Tệp cũ vẫn giải mã như trước. Khóa mới được lưu trong bản sao kho khóa mã hóa trên thiết bị.</p>
     <label class="pq-advanced-label" for="hybrid-password">Mật khẩu kho khóa</label><input id="hybrid-password" v-model="hybridPassword" type="password" autocomplete="current-password" class="pq-advanced-field"/>
     <button class="pq-advanced-outline" :disabled="processing||!hybridPassword||!ownKem" @click="enableHybridKey"><KeyRound :size="17"/>Kích hoạt khóa X25519</button>
    </div>
    <div v-else class="pq-advanced-note">Khóa X25519: <strong>Đã kích hoạt</strong>. Bạn có thể chọn chế độ lai trong trang <NuxtLink to="/upload" class="font-bold underline">Tải lên & mã hóa</NuxtLink>.</div>
    <div v-if="benchmarks.length" class="pq-advanced-table-wrap"><table><thead><tr><th>Chế độ</th><th>Trung bình 3 lần</th><th>Handshake</th><th>AES-GCM</th><th>Δ heap JS*</th><th>Kết quả</th></tr></thead><tbody><tr v-for="r in benchmarks" :key="r.mode"><td class="font-semibold">{{r.mode}}</td><td>{{r.averageMs}} ms</td><td>{{r.handshakeBytes}} B</td><td>{{r.cipherBytes}} B</td><td>{{r.heapDeltaBytes===undefined?'Không có':`${Math.round(r.heapDeltaBytes/1024)} KiB`}}</td><td>{{r.verified?'Đạt':'Lỗi'}}</td></tr></tbody></table></div>
   </section>
   <aside class="pq-advanced-panel"><h3>Thiết kế bộ kết hợp khóa</h3>
    <p>ML-KEM-768 tạo bí mật hậu lượng tử; X25519 trao đổi bí mật truyền thống. Hai đầu vào được đóng khung độ dài, dẫn xuất qua HKDF-SHA-256 với salt và nhãn miền riêng, sau đó dùng AES-256-GCM bảo vệ dữ liệu mẫu.</p>
    <p>Đây là <strong>phòng thí nghiệm</strong>, không phải định dạng `.pqf` sản xuất, giao thức TLS hay mô-đun đã được NIST chứng nhận.</p>
    <p>Không gửi bản rõ, khóa bí mật hoặc kết quả thử nghiệm đến API. Kết quả phụ thuộc thiết bị, trình duyệt và kích thước dữ liệu; chỉ dùng để so sánh tương đối. *Độ thay đổi heap JS là phép đo xấp xỉ, chỉ có trên một số trình duyệt Chromium, không đại diện tổng RAM hay CPU.</p>
   </aside>
  </div>

  <div v-else-if="!loading && tab==='rotation'" class="pq-advanced-columns">
   <section class="pq-advanced-panel"><div class="pq-advanced-section-title"><RefreshCw/><div><h2>Xoay vòng khóa & tái bọc CEK</h2><p>Không mã hóa lại toàn bộ ciphertext của tài liệu</p></div></div>
    <div class="pq-advanced-inline-stats"><div><small>Khóa hiện tại</small><strong>{{rotation?.active?.algorithm||'Không có'}}</strong></div><div><small>Chưa tái bọc</small><strong>{{rotation?.remaining||0}}</strong></div><div><small>Đã chuyển</small><strong>{{rotation?.migrated||0}}</strong></div></div>
    <label class="pq-advanced-label" for="rotation-pass">Mật khẩu kho khóa (không gửi lên máy chủ)</label><input id="rotation-pass" v-model="rotationPassword" type="password" autocomplete="current-password" class="pq-advanced-field"/>
    <template v-if="!rotation?.pending"><label class="pq-advanced-label" for="rotation-alg">Bộ tham số mới</label><select id="rotation-alg" v-model="rotationAlgorithm" class="pq-advanced-field"><option>ML-KEM-512</option><option>ML-KEM-768</option><option>ML-KEM-1024</option></select>
     <button class="pq-advanced-primary" :disabled="processing||!rotation?.active||!rotationPassword" @click="startRotation"><KeyRound :size="17"/>Bắt đầu xoay khóa an toàn</button></template>
    <template v-else><div class="pq-advanced-note"><strong>Đang chờ hoàn tất: {{rotation.pending.algorithm}}</strong><p>Khóa cũ tiếp tục hoạt động cho tới khi không còn envelope sử dụng nó. Có thể tiếp tục sau khi đăng nhập lại.</p></div>
     <div v-if="rotationRunning" role="status">Đã kiểm tra và chuyển {{rotatedCount}} / {{rotationTotal}} envelope.</div>
     <div class="pq-advanced-actions"><button class="pq-advanced-primary" :disabled="rotationRunning||processing||!unlocked||!rotation?.remaining" @click="rewrapAll"><ArrowRightLeft :size="17"/>Tái bọc và xác minh</button><button v-if="rotationRunning" class="pq-advanced-outline" @click="stopRotation=true">Dừng sau tệp hiện tại</button>
      <button class="pq-advanced-outline" :disabled="rotationRunning||processing||rotation?.remaining>0||!rotationPassword" @click="finishRotation">Hoàn tất & ngừng khóa cũ</button><button v-if="!rotation?.migrated" class="pq-advanced-outline" :disabled="rotationRunning||processing||!rotationPassword" @click="cancelRotation">Hủy giai đoạn chờ</button></div>
    </template>
   </section>
   <aside class="pq-advanced-panel"><h3>Quy trình bảo vệ dữ liệu</h3><ol class="pq-advanced-steps"><li>Tạo KEM mới và lưu bản sao kho khóa chứa cả khóa cũ/mới ở trạng thái được mã hóa.</li><li>Giải bọc CEK trên thiết bị; tái bọc bằng KEM mới và giải thử để đối chiếu.</li><li>Thay envelope tương ứng trên máy chủ; giữ nguyên ciphertext và chữ ký tài liệu.</li><li>Chỉ kết thúc khi không còn envelope dùng khóa cũ.</li></ol>
    <p class="pq-advanced-warning">Không thực hiện trong nhiều tab song song. Sao lưu kho khóa trước khi xoay. Việc xoay khóa không thu hồi được bản sao tệp đã bị người khác tải từ trước.</p></aside>
  </div>

  <div v-else-if="!loading && tab==='recovery'" class="pq-advanced-columns">
   <section class="pq-advanced-panel"><div class="pq-advanced-section-title"><UsersRound/><div><h2>Khôi phục bí mật theo ngưỡng</h2><p>Shamir 3 trên 5 • bí mật chỉ xử lý trên thiết bị</p></div></div>
    <div class="pq-advanced-note">Kế hoạch hiện tại: <strong>{{recovery?'Đã thiết lập 3/5':'Chưa thiết lập'}}</strong>. Máy chủ lưu bản mã AES-GCM, không lưu các mảnh riêng lẻ.</div>
    <button class="pq-advanced-primary" :disabled="processing||!unlocked" @click="createRecoveryPlan">Tạo 5 mảnh khôi phục độc lập</button>
    <div v-if="recoveryShares.length" class="pq-advanced-shares"><div v-for="(share,i) in recoveryShares" :key="i" class="pq-advanced-share"><strong>Người giữ mảnh {{i+1}}</strong><div class="pq-advanced-actions"><button class="pq-advanced-outline" @click="safeCopy(share)"><Copy :size="15"/>Sao chép</button><button class="pq-advanced-outline" @click="exportText(share,`pqfile-recovery-share-${i+1}.txt`)"><Download :size="15"/>Tải riêng</button></div></div></div>
    <div class="pq-advanced-divider"/><h3>Khôi phục với 3 mảnh hợp lệ</h3>
    <label class="pq-advanced-label" for="shares-input">Dán từng mảnh trên một dòng (ít nhất 3)</label><textarea id="shares-input" v-model="recoveryInput" class="pq-advanced-field" rows="4" autocomplete="off" placeholder="PQSH1.…"/>
    <button class="pq-advanced-outline" :disabled="processing||!recoveryInput.trim()" @click="tryRecover">Ghép và kiểm tra khóa</button>
    <template v-if="restoredVault"><label class="pq-advanced-label" for="new-vault-password">Mật khẩu mới (ít nhất 14 ký tự)</label><input id="new-vault-password" v-model="recoveryPassword" type="password" autocomplete="new-password" class="pq-advanced-field"/><label class="pq-advanced-label" for="confirm-vault-password">Xác nhận mật khẩu mới</label><input id="confirm-vault-password" v-model="recoveryPasswordConfirm" type="password" autocomplete="new-password" class="pq-advanced-field"/><button class="pq-advanced-primary" :disabled="processing" @click="restoreEncryptedBackup">Lưu kho khóa đã mã hóa lại</button></template>
   </section>
   <aside class="pq-advanced-panel"><h3>Nguyên tắc cấp phát mảnh</h3><p>Gửi mỗi mảnh cho một người được ủy quyền qua kênh độc lập. Không lưu cả 5 mảnh trong cùng thư mục hoặc gửi cùng một email.</p>
    <p>Đây là phục hồi <strong>khóa mật mã</strong> sau khi đã xác thực tài khoản, không thay thế quy trình khôi phục đăng nhập hoặc xác minh danh tính người giữ mảnh.</p>
    <p class="pq-advanced-warning">Nếu không còn đủ 3 mảnh và quên mật khẩu kho khóa, máy chủ không thể tái tạo bí mật. Mất thiết bị trước khi phân phát mảnh cũng có thể gây mất khóa vĩnh viễn.</p>
   </aside>
  </div>

  <div v-else-if="!loading && tab==='trust'" class="pq-advanced-columns">
   <section class="pq-advanced-panel"><div class="pq-advanced-section-title"><ShieldCheck/><div><h2>Danh bạ khóa tin cậy</h2><p>Ghim fingerprint sau khi đối chiếu trực tiếp với người nhận</p></div></div>
    <label class="pq-advanced-label" for="trust-email">Tìm email người nhận</label><div class="pq-advanced-actions"><input id="trust-email" v-model="trustSearch" class="pq-advanced-field !m-0" placeholder="nguoinhan@example.com" @keydown.enter="findRecipient"/><button class="pq-advanced-outline" :disabled="processing" @click="findRecipient"><Search :size="17"/>Tìm</button></div>
    <div v-for="r in trustResults" :key="r.id" class="pq-advanced-person"><span>{{r.displayName}}<small>{{r.email}}</small></span><button class="pq-advanced-outline" @click="chooseRecipient(r)">Kiểm tra khóa</button></div>
    <div v-if="trustDetail" class="pq-advanced-trust"><strong>{{trustDetail.recipient.displayName}} · {{trustDetail.status}}</strong>
     <p v-if="trustDetail.current">{{trustDetail.current.algorithm}} · {{trustDetail.current.id}}</p>
     <p v-if="trustDetail.currentX"><strong>Khóa X25519:</strong> {{trustDetail.currentX.fingerprint}}</p>
     <img v-if="recipientQr" :src="recipientQr" alt="Mã QR fingerprint công khai của người nhận để đối chiếu ngoài băng" class="pq-advanced-qr"/>
     <div v-if="trustDetail.current" class="pq-advanced-fingerprint">{{trustDetail.current.fingerprint}} <button @click="safeCopy(trustDetail.current.fingerprint)"><Copy :size="15"/></button></div>
     <p v-if="trustDetail.status==='KEY_CHANGED'" class="pq-advanced-warning">Khóa đã thay đổi. Không chia sẻ trước khi xác minh lại fingerprint ngoài băng.</p>
     <label class="pq-advanced-confirm"><input v-model="trustConfirm" type="checkbox"/> Tôi đã đối chiếu cả fingerprint ML-KEM và X25519 (nếu có) qua kênh đáng tin cậy, không chỉ dựa trên thông tin của máy chủ.</label>
     <button class="pq-advanced-primary" :disabled="processing||!trustConfirm||!trustDetail.current" @click="pinRecipient">Ghim khóa đã xác minh</button>
     <p>Nhật ký chuỗi băm máy chủ: {{trustDetail.chainOk?'Liên kết nhất quán':'Phát hiện sai lệch'}} · {{trustDetail.history.length}} sự kiện. Chưa neo độc lập bên ngoài máy chủ.</p>
    </div>
   </section>
   <aside class="pq-advanced-panel"><h3>Người nhận đã ghim</h3><div v-if="!trusted.length" class="pq-advanced-empty">Chưa có khóa người nhận nào được xác minh.</div>
    <div v-for="p in trusted" :key="p.recipientId" class="pq-advanced-person"><div class="min-w-0"><strong>{{p.displayName}}</strong><small>{{p.email}}</small><small class="pq-advanced-digest">{{p.fingerprint.slice(0,28)}}…</small></div><span :class="p.status==='TRUSTED'?'pq-advanced-ok':'pq-advanced-bad'">{{p.status==='TRUSTED'?'Tin cậy':'Cần xác minh lại'}}</span></div>
    <p class="pq-advanced-warning">Từ phiên bản này, API từ chối các lượt chia sẻ <em>mới</em> đến khóa chưa được ghim. Các quyền đã cấp trước đây không bị hủy tự động.</p>
   </aside>
  </div>

  <div v-else-if="!loading && tab==='receipt'" class="pq-advanced-columns">
   <section class="pq-advanced-panel"><div class="pq-advanced-section-title"><FileBadge/><div><h2>Chứng nhận toàn vẹn ML-DSA</h2><p>Ký phiếu JSON độc lập, không cần gửi nội dung tài liệu</p></div></div>
    <label class="pq-advanced-label" for="receipt-file">Tệp thuộc sở hữu cần cấp phiếu</label>
    <select id="receipt-file" v-model="receiptFileId" class="pq-advanced-field"><option value="">Chọn tài liệu</option><option v-for="f in ownedFiles" :key="f.id" :value="f.id">{{f.displayLabel}} · {{f.id.slice(0,8)}}</option></select>
    <button class="pq-advanced-primary" :disabled="processing||!receiptFileId||!unlocked" @click="issueReceipt"><FileBadge :size="17"/>Ký phiếu toàn vẹn</button>
    <div v-if="lastReceipt" class="pq-advanced-note"><strong>{{lastReceipt.fileId}}</strong><p>SHA-256 ciphertext: {{lastReceipt.manifest.cipherHash}}</p><p>Ngày ký theo đồng hồ thiết bị: {{prettyDate(lastReceipt.issuedAt)}}</p><button class="pq-advanced-outline" @click="exportJson(lastReceipt,`pqfile-receipt-${lastReceipt.fileId.slice(0,8)}.json`)"><Download :size="17"/>Tải phiếu JSON có chữ ký</button></div>
    <div class="pq-advanced-divider"/><h3>Xác minh phiếu độc lập ngay trên trình duyệt</h3>
    <label class="pq-advanced-label" for="verify-receipt">Tệp chứng nhận `.json`</label><input id="verify-receipt" type="file" accept=".json,application/json" class="pq-advanced-field" @change="importReceipt(($event.target as HTMLInputElement).files?.[0])"/>
    <label class="pq-advanced-label" for="cipher-verify">Tùy chọn: ciphertext gốc để đối chiếu SHA-256</label><input id="cipher-verify" type="file" class="pq-advanced-field" @change="cipherCheckFile=($event.target as HTMLInputElement).files?.[0]||null"/>
    <button class="pq-advanced-outline" :disabled="processing||!importedReceipt" @click="verifyImported">Xác minh hai chữ ký & băm</button>
    <p v-if="receiptResult" :class="receiptResult.valid?'pq-advanced-ok':'pq-advanced-bad'" role="status">{{receiptResult.reason}}</p>
   </section>
   <aside class="pq-advanced-panel"><h3>Những gì phiếu xác minh chứng minh</h3><p>Chữ ký ML-DSA của manifest và của phiếu, định danh tệp, thuật toán AES-256-GCM, băm SHA-256 ciphertext và khóa công khai của người ký.</p>
    <p>Phiếu <strong>không</strong> chứng minh danh tính pháp lý hay thời điểm do cơ quan dấu thời gian tin cậy cấp; cần đối chiếu fingerprint với nguồn xác minh độc lập.</p><p>Nếu không cung cấp ciphertext, trình xác minh chỉ kiểm tra các chữ ký và giá trị băm ghi trong phiếu, <strong>không</strong> xác nhận dữ liệu một tệp bên ngoài.</p>
   </aside>
  </div>
 </main>
</template>

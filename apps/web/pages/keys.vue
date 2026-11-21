<script setup lang="ts">
import { KeyRound,ShieldCheck,LockKeyhole,UnlockKeyhole,Download,AlertTriangle,CheckCircle2,LoaderCircle,Fingerprint,Upload,Info,Copy } from 'lucide-vue-next';
import {makeKeys,lockVault,unlockVault,sha256,ub64} from '@pqfile/crypto-core';
import type {KemAlgorithm} from '@pqfile/crypto-core';
import {getUnlockedVault,setUnlockedVault} from '~/utils/vault-session';
const keys=ref<any[]>([]),backup=ref(''),password=ref(''),confirm=ref(''),algorithm=ref<KemAlgorithm>('ML-KEM-768');
const importPicker=ref<HTMLInputElement|null>(null),imported=ref(false);
const processing=ref(false),error=ref(''),success=ref(''),isOpen=ref(false);
const registered=computed(()=>keys.value.some(k=>k.purpose==='KEM'&&k.status==='ACTIVE'));
const completeKeyset=computed(()=>keys.value.some(k=>k.purpose==='DSA'&&k.status==='ACTIVE')&&registered.value);
const load=async()=>{keys.value=await requestApi<any[]>('/keys');const b=await requestApi<any>('/keys/backup');if(!imported.value)backup.value=b?.encryptedBlob||'';isOpen.value=!!getUnlockedVault();};
async function checkVault(vault:Awaited<ReturnType<typeof makeKeys>>){const kem=keys.value.find(k=>k.purpose==='KEM'&&k.status==='ACTIVE');const dsa=keys.value.find(k=>k.purpose==='DSA'&&k.status==='ACTIVE');if(!kem||!dsa||vault.kemPublic!==kem.publicKey||vault.dsaPublic!==dsa.publicKey||vault.kemAlgorithm!==kem.algorithm)throw new Error('Bản sao lưu không khớp với khóa công khai đã đăng ký của tài khoản này.');}
onMounted(()=>load().catch(e=>error.value=e.message));
async function generate(){
 if(password.value.length<12){error.value='Mật khẩu bảo vệ cần tối thiểu 12 ký tự';return;}
 if(password.value!==confirm.value){error.value='Hai mật khẩu không khớp';return;}
 processing.value=true;error.value='';success.value='';
 try{
   const vault=await makeKeys(algorithm.value);
   const protectedBackup=await lockVault(vault,password.value);
   const payload={kemAlgorithm:algorithm.value,kemPublic:vault.kemPublic,kemFingerprint:await sha256(ub64(vault.kemPublic)),dsaPublic:vault.dsaPublic,dsaFingerprint:await sha256(ub64(vault.dsaPublic)),backup:protectedBackup,
     ...(vault.x25519Public?{x25519Public:vault.x25519Public,x25519Fingerprint:await sha256(ub64(vault.x25519Public))}:{})};
   await requestApi('/keys',{method:'POST',body:JSON.stringify(payload)});
   backup.value=protectedBackup;setUnlockedVault(vault);isOpen.value=true;
   password.value='';confirm.value='';success.value='Đã tạo cặp khóa ML-KEM và ML-DSA trên thiết bị. Kho khóa đã được mã hóa bằng Argon2id.';
   await load();
 }catch(e:any){error.value=e.message||'Không thể tạo khóa';}
 finally{processing.value=false;}
}
async function unlock(){processing.value=true;error.value='';success.value='';try{const vault=await unlockVault(backup.value,password.value);await checkVault(vault);setUnlockedVault(vault);isOpen.value=true;password.value='';success.value='Kho khóa đã mở trong bộ nhớ phiên này.';}catch(e:any){error.value=e.message;}finally{processing.value=false;}}
function lock(){setUnlockedVault(null);isOpen.value=false;success.value='Kho khóa đã khóa trên thiết bị.';}
async function useServerBackup(){imported.value=false;setUnlockedVault(null);isOpen.value=false;password.value='';await load().catch(e=>error.value=e.message);success.value='Đã chuyển về bản sao lưu trên máy chủ.';}
async function importBackup(file:File|undefined){
 if(!file)return;error.value='';success.value='';
 try{if(file.size>200000)throw new Error('Tệp sao lưu vượt quá 200 KB.');const text=await file.text();const data=JSON.parse(text);if(data.v!==1||data.kdf!=='Argon2id'||typeof data.ciphertext!=='string')throw new Error('Định dạng bản sao lưu không hợp lệ.');if(!registered.value)throw new Error('Tài khoản chưa đăng ký khóa công khai, không thể kiểm tra tính tương thích của bản sao lưu.');backup.value=text;imported.value=true;setUnlockedVault(null);isOpen.value=false;success.value='Đã nạp bản sao lưu từ thiết bị. Nhập mật khẩu để xác minh và mở kho khóa.';}catch(e:any){error.value=e.message||'Không thể nhập tệp sao lưu';}
}
async function copyFingerprint(value:string){try{await navigator.clipboard.writeText(value);success.value='Đã sao chép fingerprint khóa công khai.';error.value='';}catch{error.value='Trình duyệt không cho phép sao chép. Hãy chọn và sao chép thủ công.';}}
function exportBackup(){const blob=new Blob([backup.value],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='pqfile-key-vault.enc.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
</script>
<template>
 <div class="pq-container pq-refined-page pq-library-pattern pq-space-optimized pq-refined-keys max-w-6xl space-y-5 py-7 sm:py-9">
  <PageHeading eyebrow="BẢO VỆ KHÓA CÁ NHÂN" title="Khóa mật mã" description="Sinh và mở khóa tại trình duyệt; máy chủ chỉ lưu khóa công khai và bản sao lưu đã mã hóa."><template #icon><KeyRound :size="34" /></template><template #actions><NuxtLink to="/upload"><Upload :size="18"/> Tải lên & mã hóa</NuxtLink></template></PageHeading>
  <div class="grid pq-keys-columns gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)]">
   <section class="soft-card min-w-0 p-4 sm:p-6">
    <h2 class="mb-4 flex items-center gap-2 text-xl font-extrabold"><ShieldCheck class="text-blue-600"/>{{registered?'Kho khóa của tôi':'Khởi tạo kho khóa'}}</h2>
    <div v-if="!registered" class="space-y-4">
      <div><label class="form-label" for="alg">Bộ tham số ML-KEM</label><select id="alg" v-model="algorithm" class="pq-field"><option>ML-KEM-512</option><option>ML-KEM-768</option><option>ML-KEM-1024</option></select></div>
      <div><label for="pass" class="form-label">Mật khẩu bảo vệ kho khóa (tối thiểu 12 ký tự)</label><input id="pass" v-model="password" type="password" class="pq-field" autocomplete="new-password" placeholder="Tạo mật khẩu mạnh" /></div>
      <div><label for="confirm" class="form-label">Nhập lại mật khẩu bảo vệ kho khóa</label><input id="confirm" v-model="confirm" type="password" class="pq-field" autocomplete="new-password" /></div>
      <button class="primary-button w-full" :disabled="processing" @click="generate"><LoaderCircle v-if="processing" class="animate-spin"/><KeyRound v-else/>{{processing?'Đang tạo khóa...':'Tạo và bảo vệ bộ khóa'}}</button>
    </div>
    <div v-else class="space-y-4">
     <div v-if="!completeKeyset" role="alert" class="pq-alert pq-alert-error">Tài khoản thiếu khóa chữ ký ML-DSA đang hoạt động. Hãy kiểm tra dữ liệu khóa trước khi sử dụng chức năng chia sẻ và giải mã.</div>
     <div class="flex items-center gap-3 rounded-xl border px-4 py-4" :class="isOpen?'border-emerald-300 bg-emerald-50':'border-amber-300 bg-amber-50'"><UnlockKeyhole v-if="isOpen" class="text-emerald-700"/><LockKeyhole v-else class="text-amber-700"/><div><strong>{{isOpen?'Kho khóa đang mở':'Kho khóa đang khóa'}}</strong><p class="text-xs text-slate-500">{{isOpen?'Chỉ giữ khóa bí mật trong RAM của tab.':'Nhập mật khẩu để giải mã bản sao lưu trên thiết bị.'}}</p></div></div>
     <template v-if="!isOpen"><label for="unlock-pass" class="form-label">Mật khẩu kho khóa</label><input id="unlock-pass" v-model="password" type="password" class="pq-field" autocomplete="current-password" @keydown.enter="unlock"/><button class="primary-button w-full" :disabled="processing||!password" @click="unlock"><UnlockKeyhole :size="20"/>{{processing?'Đang mở khóa...':'Mở kho khóa'}}</button></template>
     <button v-else class="w-full rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 font-bold text-amber-800" @click="lock">Khóa kho khóa ngay</button>
     <button class="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 font-semibold text-blue-700" :disabled="!backup" @click="exportBackup"><Download :size="20"/> Tải bản sao lưu khóa đã mã hóa</button>
     <button class="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-3 font-semibold text-blue-700" @click="importPicker?.click()"><Upload :size="19"/> Nhập bản sao lưu từ thiết bị</button>
     <input ref="importPicker" type="file" accept=".json,application/json" class="hidden" @change="importBackup(($event.target as HTMLInputElement).files?.[0]);($event.target as HTMLInputElement).value=''"/>
     <p v-if="imported" class="text-xs font-semibold text-blue-700"><Info :size="14" class="inline"/> Đang dùng bản sao lưu vừa nhập từ thiết bị; chưa ghi đè bản sao trên máy chủ. <button class="ml-1 underline" @click="useServerBackup">Dùng bản sao trên máy chủ</button></p>
     <NuxtLink to="/upload" class="block text-center text-sm font-semibold text-blue-600 underline">Đến trang tải lên và bảo vệ tệp</NuxtLink>
     <NuxtLink to="/pqc" class="mt-2 block text-center text-sm font-semibold text-blue-700 underline">Xoay khóa · Khôi phục 3/5 · Khóa tin cậy</NuxtLink>
    </div>
    <div v-if="error" class="pq-alert pq-alert-error mt-4">{{error}}</div><div v-if="success" class="pq-alert pq-alert-success mt-4">{{success}}</div>
   </section>
   <section class="soft-card min-w-0 p-4 sm:p-6">
    <h2 class="mb-4 flex gap-2 text-xl font-extrabold"><Fingerprint class="text-blue-600"/>Khóa công khai và fingerprint</h2>
    <p v-if="!keys.length" class="text-sm text-slate-500">Chưa có khóa công khai trên hệ thống.</p>
    <div v-for="k in keys" :key="k.id" class="mb-3 rounded-xl border border-blue-100 bg-blue-50/60 p-4"><div class="flex justify-between gap-2"><strong>{{k.algorithm}}</strong><span class="text-xs font-bold text-emerald-700">{{k.status}}</span></div><div class="mt-2 flex items-start gap-2 rounded-lg bg-white p-2"><p class="min-w-0 flex-1 break-all font-mono text-[11px] text-[#3f5887]">{{k.fingerprint}}</p><button class="pq-icon-button !min-h-8 !px-2" type="button" :aria-label="'Sao chép fingerprint '+k.algorithm" title="Sao chép fingerprint" @click="copyFingerprint(k.fingerprint)"><Copy :size="15"/></button></div><p class="mt-1 text-xs text-slate-500">{{k.purpose==='KEM'?'Dùng để nhận khóa nội dung đã được bọc':'Dùng để xác minh chữ ký của tệp'}}</p></div>
    <div class="mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle class="shrink-0" :size="22"/><span><strong>Rất quan trọng:</strong> Nếu mất mật khẩu kho khóa và bản sao khóa, bạn có thể mất khả năng giải mã tệp. Máy chủ không thể khôi phục khóa bí mật dạng rõ.</span></div>
   </section>
  </div>
 </div>
</template>

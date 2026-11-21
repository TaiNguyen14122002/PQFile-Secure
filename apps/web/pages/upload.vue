<script setup lang="ts">
import { UploadCloud,FileText,FolderOpen,LockKeyhole,KeyRound,ShieldCheck,Users,Settings,CheckCircle2,AlertCircle,Trash2,LoaderCircle,Search,FileCheck2,ShieldAlert,AlertTriangle,EyeOff,BrainCircuit,Gauge } from 'lucide-vue-next';
import { encryptFile,benchmarkKems } from '@pqfile/crypto-core';
import type { KemAlgorithm, PublicRecipient } from '@pqfile/crypto-core';
import { getUnlockedVault } from '~/utils/vault-session';
import { analyzeFile, CLASSIFICATIONS, cryptoRecommendation, canRedact, redactedCopy, shareRisk } from '~/utils/security-analysis';
import {assessFile} from '~/utils/file-safety';
import type {SafetyResult} from '~/utils/file-safety';
import type {DocumentScan, Classification} from '~/utils/security-analysis';
const {user}=useAuth();
const picker=ref<HTMLInputElement|null>(null);
const hovering=ref(false),selected=ref<File[]>([]),busy=ref(false),error=ref(''),success=ref(''),progress=ref(''),keyError=ref(''),doneCount=ref(0);
const wrapMode=ref<'PQC'|'HYBRID'>('PQC');
const kem=ref<KemAlgorithm>('ML-KEM-768'),cipher='AES-256-GCM',signature='ML-DSA-65';
const totalCount=ref(0);
const percent=computed(()=>totalCount.value?Math.round(doneCount.value/totalCount.value*100):0);
const recipientMode=ref('self'),searchEmail=ref(''),searchBusy=ref(false),found=ref<any[]>([]),chosen=ref<any|null>(null);
const existingKeys=ref<any[]>([]);
const hasKey=computed(()=>existingKeys.value.some(k=>k.purpose==='KEM'));
const locked=computed(()=>!getUnlockedVault());
const selectedSize=computed(()=>selected.value.reduce((n,f)=>n+f.size,0));
const sizeLabel=(n:number)=>n<1024?`${n} B`:n<1048576?`${(n/1024).toFixed(1)} KB`:`${(n/1048576).toFixed(1)} MB`;
const loadKeys=async()=>{try{existingKeys.value=await requestApi<any[]>('/keys');keyError.value='';const active=existingKeys.value.find(k=>k.purpose==='KEM'&&k.status==='ACTIVE');if(active)kem.value=active.algorithm;}catch(e:any){keyError.value=e?.message||'Không thể tải thông tin khóa';}};
const scans=ref<Record<string,DocumentScan>>({});
const scanning=ref<Record<string,boolean>>({});
const safetyScans=ref<Record<string,SafetyResult>>({});
const safetyBusy=ref<Record<string,boolean>>({});
const acknowledgedWarnings=ref<Record<string,boolean>>({});
const classifications=ref<Record<string,Classification>>({});
const redact=ref<Record<string,boolean>>({});
const expiryDays=ref('7'),shareConfirmed=ref(false),securitySummary=ref({unread:0,critical:0});
const benchmarking=ref(false),benchmarks=ref<{algorithm:string,keygenMs:number,encapsMs:number,decapsMs:number}[]>([]);
const fileKey=(f:File)=>`${f.name}:${f.size}:${f.lastModified}`;
const fileScan=(f:File)=>scans.value[fileKey(f)];
const fileClass=(f:File):Classification|null=>classifications.value[fileKey(f)]||fileScan(f)?.suggestion||null;
const fileRiskClass=(f:File):Classification=>{
 const manual=fileClass(f),suggested=fileScan(f)?.suggestion||'Nội bộ';
 return CLASSIFICATIONS[Math.max(CLASSIFICATIONS.indexOf(manual||'Nội bộ'),CLASSIFICATIONS.indexOf(suggested))];
};
const memoryGb=()=>typeof navigator==='undefined'?undefined:(navigator as Navigator & {deviceMemory?:number}).deviceMemory;
const recommend=(f:File)=>cryptoRecommendation(fileRiskClass(f),f.size,memoryGb());
const shareRiskFor=(f:File)=>shareRisk({classification:fileRiskClass(f),recipients:1,
 days:expiryDays.value==='none'?null:Number(expiryDays.value),alerts:securitySummary.value.unread,
 scanStatus:fileScan(f)?.status||'unsupported',isNewRecipient:true});
const requiresReview=computed(()=>recipientMode.value==='someone'&&selected.value.some(f=>{
 const sc=fileScan(f);return !sc||sc.status!=='complete'||shareRiskFor(f).score>=55;
}));
watch([selected,recipientMode,expiryDays,chosen],()=>{shareConfirmed.value=false;});
watch(classifications,()=>{shareConfirmed.value=false;},{deep:true});
watch(scans,()=>{shareConfirmed.value=false;},{deep:true});
onMounted(async()=>{await loadKeys();try{securitySummary.value=await requestApi('/security/summary');}catch{ /* do not block local scanning */ }});
async function scanFile(f:File){
 const key=fileKey(f);scanning.value[key]=true;safetyBusy.value[key]=true;
 try{safetyScans.value[key]=await assessFile(f);}finally{safetyBusy.value[key]=false;}
 try{scans.value[key]=await analyzeFile(f);
  if(scans.value[key].status==='complete')classifications.value[key]=scans.value[key].suggestion;}catch{scans.value[key]=await analyzeFile(new File([], 'khong-ho-tro.bin'));}
 finally{scanning.value[key]=false;}
}
async function compareKems(){benchmarking.value=true;error.value='';
 try{benchmarks.value=await benchmarkKems();}catch(e:any){error.value=e?.message||'Không chạy được benchmark';}
 finally{benchmarking.value=false;}}

function attach(files:FileList|null){
 if(!files || busy.value)return;
 error.value='';success.value='';
 const incoming=Array.from(files);
 const oversized=incoming.filter(f=>f.size>20*1024*1024);
 const valid=incoming.filter(f=>f.size<=20*1024*1024);
 const unique=valid.filter(f=>!selected.value.some(a=>a.name===f.name&&a.size===f.size&&a.lastModified===f.lastModified));
 const free=10-selected.value.length;
 const added=unique.slice(0,Math.max(0,free));
 selected.value=[...selected.value,...added];
 for(const f of added)void scanFile(f);
 const notices=[];
 if(oversized.length)notices.push(`${oversized.length} tệp vượt giới hạn 20 MiB`);
 if(unique.length>free)notices.push('tối đa 10 tệp mỗi lượt');
 if(valid.length!==unique.length)notices.push('đã bỏ qua các tệp trùng');
 if(notices.length)error.value=`Không thêm tất cả tệp: ${notices.join('; ')}.`;
}
function drop(e:DragEvent){hovering.value=false;attach(e.dataTransfer?.files||null)}
async function searchRecipients(){
 searchBusy.value=true;error.value='';
 try{found.value=await requestApi<any[]>(`/users/search?q=${encodeURIComponent(searchEmail.value)}`);if(!found.value.length)error.value='Không tìm thấy tài khoản có khóa công khai tương ứng.';}
 catch(e:any){error.value=e.message}finally{searchBusy.value=false;}
}
async function upload(){
 if(!user.value||!selected.value.length)return;
 const keys=getUnlockedVault();
 if(!keys){error.value='Kho khóa chưa mở. Hãy vào Khóa mật mã và mở bằng mật khẩu bảo vệ.';return;}
 const ownKey=existingKeys.value.find(k=>k.purpose==='KEM'&&k.algorithm===kem.value&&k.publicKey===keys.kemPublic);
 if(!ownKey){error.value='Cấu hình ML-KEM không khớp với khóa cá nhân. Hãy chọn đúng bộ tham số đã tạo.';return;}
 if(recipientMode.value==='someone'&&!chosen.value){error.value='Hãy tìm và chọn người nhận trước khi mã hóa.';return;}
 for(const f of selected.value){
   const sc=fileScan(f);
   if(!sc||scanning.value[fileKey(f)]){error.value=`Tệp ${f.name} chưa phân tích xong.`;return;}
   if(sc.status!=='complete'&&!classifications.value[fileKey(f)]){
     error.value=`Hãy chọn mức bảo mật thủ công cho ${f.name} vì chưa quét đầy đủ nội dung.`;return;
   }
 }
 if(wrapMode.value==='HYBRID'){
   if(!existingKeys.value.some(k=>k.purpose==='X25519'&&k.status==='ACTIVE')||!keys.x25519Private)
     {error.value='Kho khóa của bạn chưa có X25519 đang hoạt động. Vào Mật mã nâng cao để kích hoạt.';return;}
   if(recipientMode.value==='someone'&&(!chosen.value?.key.x25519Public||!chosen.value?.key.x25519KeyId))
     {error.value='Người nhận chưa có khóa X25519, không thể dùng chế độ lai.';return;}
 }
 if(recipientMode.value==='someone'&&requiresReview.value&&!shareConfirmed.value){error.value='Hãy đọc cảnh báo và xác nhận đã kiểm tra rủi ro chia sẻ.';return;}
 busy.value=true;error.value='';success.value='';doneCount.value=0;let done=0;const queue=[...selected.value];totalCount.value=queue.length;
 try{
   for(const f of queue){
     progress.value=`Đang mã hóa ${f.name} (${done+1}/${queue.length}) trên thiết bị...`;
     const ownX=existingKeys.value.find(k=>k.purpose==='X25519'&&k.status==='ACTIVE');
     const to:PublicRecipient[]=[{userId:user.value.id,keyId:ownKey.id,algorithm:ownKey.algorithm,publicKey:ownKey.publicKey,x25519Public:ownX?.publicKey,x25519KeyId:ownX?.id}];
     if(recipientMode.value==='someone'&&chosen.value){to.push({userId:chosen.value.id,keyId:chosen.value.key.id,algorithm:chosen.value.key.algorithm,publicKey:chosen.value.key.publicKey,x25519Public:chosen.value.key.x25519Public,x25519KeyId:chosen.value.key.x25519KeyId});}
     const sc=fileScan(f);
     const prepared=redact.value[fileKey(f)]&&sc?redactedCopy(f,sc):f;
     const encrypted=await encryptFile(prepared,keys,to,crypto.randomUUID(),wrapMode.value);
     if(recipientMode.value==='someone'&&expiryDays.value!=='none'){
       (encrypted.metadata as typeof encrypted.metadata & {initialShareExpiresAt?:string}).initialShareExpiresAt=
         new Date(Date.now()+Number(expiryDays.value)*86_400_000).toISOString();
     }
     const fd=new FormData();fd.append('ciphertext',new Blob([encrypted.ciphertext.buffer as ArrayBuffer],{type:'application/octet-stream'}),'ciphertext.bin');fd.append('metadata',JSON.stringify(encrypted.metadata));
     progress.value=`Đang tải ciphertext lên máy chủ (${done+1}/${queue.length})...`;
     await requestApi('/files',{method:'POST',body:fd});done++;doneCount.value=done;selected.value=selected.value.filter(item=>item!==f);
   }
   success.value=`Đã mã hóa và lưu ${done} tệp. Máy chủ chỉ nhận ciphertext.`;
 }catch(e:any){error.value=`Đã lưu ${done}/${queue.length} tệp. Tệp chưa hoàn thành vẫn được giữ trong danh sách để thử lại. ${e?.message||'Có lỗi xảy ra'}`;}
 finally{busy.value=false;progress.value='';}
}
</script>
<template>
  <div class="pq-refined-page pq-library-pattern pq-space-optimized pq-refined-upload">
    <HeroBanner />
    <div class="pq-upload-layout mx-auto -mt-1 grid max-w-[1680px] items-start gap-3 px-3 pb-10 pt-2 sm:px-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(350px,1fr)] xl:gap-4 xl:px-6">
      <section class="soft-card min-w-0 p-4 sm:p-6">
        <div class="mb-3 flex items-center gap-4 border-b border-[#d4e6f9] pb-3"><UploadCloud :size="39" class="shrink-0 text-[#057bfd]" stroke-width="2.1" /><h2 class="text-[23px] font-[800] tracking-tight sm:text-[27px]">Tải lên và bảo vệ tệp tin</h2></div>
        <div class="pq-upload-dropzone relative grid min-h-[335px] place-items-center rounded-[24px] border-[2px] border-dashed border-[#087ffd] bg-gradient-to-b from-[#e0f1ff]/90 to-[#eaf7ff]/95 px-5 py-6 text-center transition" :class="hovering?'ring-4 ring-blue-300 bg-[#d5eeff]':' '" tabindex="0" role="button" aria-label="Kéo thả hoặc chọn tệp" :aria-disabled="busy" @click="picker?.click()" @keydown.enter="picker?.click()" @keydown.space.prevent="picker?.click()" @dragenter.prevent="hovering=true" @dragover.prevent="hovering=true" @dragleave.prevent="hovering=false" @drop.prevent.stop="drop">
          <div>
            <UploadCloud class="pq-upload-cloud mx-auto mb-1 text-[#0785ff]" :size="110" stroke-width="1.8" />
            <p class="text-[25px] font-[850] leading-tight tracking-[-.5px] sm:text-[28px]">Kéo thả tệp tin vào đây</p>
            <p class="mt-2 text-[17px]">hoặc nhấn để chọn tệp từ thiết bị</p>
            <button class="primary-button pq-upload-picker mt-4 min-w-56 !py-2.5 text-[19px]" type="button" @click.stop="picker?.click()"><FolderOpen :size="23" /> Chọn tệp</button>
            <p class="mt-4 text-[14px] text-[#324773] sm:text-[16px]">Hỗ trợ nhiều tệp · PDF, DOCX, XLSX, PNG, ZIP và các định dạng khác</p>
            <p class="mt-1 text-xs text-[#456b9c]">Giới hạn bản MVP: 10 tệp/lượt, 20 MiB/tệp</p>
          </div>
          <input ref="picker" class="hidden" type="file" multiple :disabled="busy" @change="attach(($event.target as HTMLInputElement).files);($event.target as HTMLInputElement).value=''" />
        </div>
        <div class="mt-4 rounded-[18px] border border-[#dce9f9] bg-gradient-to-b from-[#f9fbff] to-[#f0f7ff] px-5 py-3.5 shadow-inner">
          <div class="flex flex-wrap items-center gap-4"><div class="flex items-center gap-3"><FileText :size="29" class="text-[#087eff]" /><span class="whitespace-nowrap text-[18px] font-[800]">Tệp đã chọn</span></div><span class="hidden h-7 border-l-2 border-[#b8cae7] sm:block" /><span v-if="!selected.length" class="text-[15px] italic text-[#50638b]">Chưa có tệp nào được chọn</span><span v-else class="text-[14px] font-semibold text-[#256ca5]">{{selected.length}} tệp · {{sizeLabel(selectedSize)}}</span></div>
          <ul v-if="selected.length" class="mt-3 space-y-2"><li v-for="(f,i) in selected" :key="i" class="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm"><FileCheck2 :size="18" class="shrink-0 text-blue-600"/><span class="min-w-0 flex-1 truncate">{{f.name}}</span><span class="text-xs text-slate-500">{{sizeLabel(f.size)}}</span><button class="rounded p-1 text-rose-500 hover:bg-rose-50" :disabled="busy" :aria-label="'Bỏ '+f.name" @click="selected.splice(i,1)"><Trash2 :size="17" /></button></li></ul>
        </div>
        <section v-if="selected.length" class="mt-4 rounded-2xl border border-blue-200 bg-white p-4" aria-label="Phân loại và rà soát dữ liệu cá nhân">
          <h3 class="flex items-center gap-2 font-extrabold text-blue-900"><BrainCircuit :size="21"/> Phân loại bảo mật &amp; kiểm tra thông tin cá nhân</h3>
          <p class="mt-1 text-xs text-slate-600">Mô hình Naive Bayes nhỏ kết hợp quy tắc, chạy cục bộ trên thiết bị. Kết quả chỉ mang tính gợi ý; nội dung không gửi về máy chủ.</p>
          <div v-for="f in selected" :key="fileKey(f)" class="mt-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-sm">
            <div class="flex flex-wrap items-center justify-between gap-2"><strong class="max-w-full break-all">{{f.name}}</strong><span v-if="scanning[fileKey(f)]" class="text-blue-700">Đang quét…</span><span v-else-if="fileScan(f)" class="rounded-full bg-white px-2 py-1 text-xs font-bold text-blue-900">{{fileScan(f).status==='complete'?'Đã quét':'Chưa quét đủ'}}</span></div>
            <template v-if="fileScan(f)">
              <p class="mt-2 text-xs text-slate-700">{{fileScan(f).note}}</p>
              <div class="mt-2 flex flex-wrap items-center gap-2"><label :for="'class-'+fileKey(f)" class="font-semibold">Mức bảo mật:</label>
                <select :id="'class-'+fileKey(f)" v-model="classifications[fileKey(f)]" class="pq-field !w-auto !max-w-full !py-1.5" :aria-label="'Mức bảo mật '+f.name">
                  <option v-if="fileScan(f).status!=='complete'" :value="undefined" disabled>-- Chọn thủ công --</option>
                  <option v-for="level in CLASSIFICATIONS" :key="level" :value="level">{{level}}</option>
                </select>
                <span class="text-xs text-blue-800">Gợi ý: {{fileScan(f).suggestion}} · điểm mô hình chưa hiệu chuẩn {{fileScan(f).confidence}}%</span>
              </div>
              <p v-if="CLASSIFICATIONS.indexOf(fileClass(f)||'Nội bộ')<CLASSIFICATIONS.indexOf(fileScan(f).suggestion)" class="mt-1 font-semibold text-rose-700">Mức bạn chọn thấp hơn cảnh báo của bộ quét. Điểm rủi ro và đề xuất mã hóa vẫn dùng mức cao hơn.</p>
              <p class="mt-2 text-xs text-slate-700">{{recommend(f).note}}</p>
              <p v-if="recommend(f).kem!==kem" class="mt-1 font-bold text-amber-800"><AlertTriangle :size="15" class="inline"/> Cấu hình hiện chọn: {{kem}}, khác mức đề xuất {{recommend(f).kem}}. {{recommend(f).warning}}</p>
              <div v-if="safetyScans[fileKey(f)]" class="mt-3 rounded-xl border p-3" :class="safetyScans[fileKey(f)].status==='blocked'?'border-rose-300 bg-rose-50':safetyScans[fileKey(f)].status==='clear'?'border-emerald-200 bg-emerald-50':'border-amber-300 bg-amber-50'">
                <p class="font-extrabold"><ShieldAlert :size="16" class="inline"/> Kiểm tra tệp nguy hiểm: {{safetyScans[fileKey(f)].status==='blocked'?'CHẶN TẢI LÊN':safetyScans[fileKey(f)].status==='clear'?'Không thấy chỉ dấu tĩnh':'Cần kiểm tra thủ công'}}</p>
                <p class="mt-1 text-xs">Chữ ký: {{safetyScans[fileKey(f)].detected}} · Đã đọc {{sizeLabel(safetyScans[fileKey(f)].bytesChecked)}} đầu tệp.</p>
                <ul class="mt-1 list-disc pl-5 text-xs"><li v-for="(reason,j) in safetyScans[fileKey(f)].reasons" :key="j">{{reason}}</li></ul>
                <label v-if="safetyScans[fileKey(f)].status==='warning'||safetyScans[fileKey(f)].status==='unverified'" class="mt-2 flex items-start gap-2 text-xs font-semibold"><input v-model="acknowledgedWarnings[fileKey(f)]" type="checkbox"/> Tôi đã tự kiểm tra tệp và muốn tiếp tục. Công cụ này không thay thế antivirus.</label>
              </div>
              <p v-if="fileScan(f).pii.length" class="mt-2 text-rose-800"><ShieldAlert :size="15" class="inline"/> Phát hiện {{fileScan(f).pii.length}} vị trí có thể chứa thông tin cá nhân.</p>
              <ul v-if="fileScan(f).pii.length" class="mt-1 flex flex-wrap gap-1.5"><li v-for="(hit,j) in fileScan(f).pii.slice(0,7)" :key="j" class="rounded-md bg-white px-2 py-1 text-xs text-rose-800">{{hit.kind}}: {{hit.masked}}</li></ul>
              <p v-if="fileScan(f).pii.length>7" class="mt-1 text-xs text-slate-600">Và {{fileScan(f).pii.length-7}} vị trí khác, không hiển thị dữ liệu gốc.</p>
              <label v-if="canRedact(f.name,fileScan(f))" class="mt-2 flex items-center gap-2 font-semibold text-blue-900"><input v-model="redact[fileKey(f)]" type="checkbox" :disabled="busy"/><EyeOff :size="17"/> Che thông tin phát hiện trên BẢN SAO khi mã hóa (không sửa tệp gốc)</label>
              <p v-else-if="fileScan(f).pii.length" class="mt-2 text-xs text-amber-800">Định dạng này chưa hỗ trợ tạo bản sao đã che an toàn. Hãy che dữ liệu trong ứng dụng soạn thảo trước khi chia sẻ.</p>
            </template>
          </div>
        </section>
        <div v-if="error" role="alert" class="pq-alert pq-alert-error mt-3 flex items-start gap-2"><AlertCircle :size="19" class="shrink-0" />{{error}}</div>
        <div v-if="success" role="status" class="pq-alert pq-alert-success mt-3 flex items-start gap-2"><CheckCircle2 :size="19" class="shrink-0" />{{success}} <NuxtLink to="/files?tab=all" class="font-bold underline">Xem tệp vừa tải lên</NuxtLink></div>
      </section>
      <section class="soft-card min-w-0 p-4 sm:p-6">
        <div class="mb-3 flex items-center gap-4 border-b border-[#d4e6f9] pb-3"><Settings :size="35" class="text-[#087eff]" /><h2 class="text-[23px] font-[800] tracking-tight sm:text-[26px]">Thiết lập bảo vệ</h2></div>
        <div class="space-y-2.5">
          <div class="flex flex-wrap items-center gap-2 rounded-[16px] border border-blue-100 bg-[#f9fbfe] px-3.5 py-2.5 shadow-sm"><KeyRound class="shrink-0 text-[#087eff]" :size="26" /><label for="kem" class="min-w-36 flex-1 text-[15px] font-[800]">Bảo vệ khóa:</label><select id="kem" v-model="kem" class="pq-field pq-upload-parameter flex-1"><option>ML-KEM-512</option><option>ML-KEM-768</option><option>ML-KEM-1024</option></select></div>
          <div class="rounded-[16px] border border-blue-100 bg-[#f9fbfe] px-3.5 py-3 text-sm"><label for="wrap-mode" class="mb-1 block font-extrabold text-blue-900">Chế độ thiết lập khóa</label><select id="wrap-mode" v-model="wrapMode" class="pq-field"><option value="PQC">ML-KEM (tương thích dữ liệu cũ)</option><option value="HYBRID">Lai ML-KEM + X25519 + HKDF</option></select><p class="mt-1 text-xs text-slate-600">Chế độ lai cần X25519 ở kho khóa của bạn và mọi người nhận. Bảo vệ CEK trên thiết bị; không thay đổi AES-GCM của tệp.</p><NuxtLink to="/pqc?tab=hybrid" class="text-xs font-bold text-blue-700 underline">Cấu hình khóa X25519 và thử nghiệm</NuxtLink></div>
          <div class="flex flex-wrap items-center gap-2 rounded-[16px] border border-blue-100 bg-[#f9fbfe] px-3.5 py-2.5 shadow-sm"><LockKeyhole class="shrink-0 text-[#087eff]" :size="26" /><label class="min-w-36 flex-1 text-[15px] font-[800]">Mã hóa nội dung:</label><span class="pq-field pq-upload-parameter !flex flex-1 items-center font-semibold">{{cipher}}</span></div>
          <div class="flex flex-wrap items-center gap-2 rounded-[16px] border border-blue-100 bg-[#f9fbfe] px-3.5 py-2.5 shadow-sm"><ShieldCheck class="shrink-0 text-[#087eff]" :size="26" /><label class="min-w-36 flex-1 text-[15px] font-[800]">Chữ ký số:</label><span class="pq-field pq-upload-parameter !flex flex-1 items-center font-semibold">{{signature}}</span></div>
          <div class="flex flex-wrap items-center gap-2 rounded-[16px] border border-blue-100 bg-[#f9fbfe] px-3.5 py-2.5 shadow-sm"><Users class="shrink-0 text-[#087eff]" :size="26" /><label for="recip" class="min-w-36 flex-1 text-[15px] font-[800]">Người nhận:</label><select id="recip" v-model="recipientMode" class="pq-field pq-upload-parameter flex-1"><option value="self">Chỉ tôi</option><option value="someone">Tôi và người nhận</option></select></div>
          <div v-if="recipientMode==='someone'" class="rounded-2xl border border-blue-100 bg-blue-50 p-3"><label class="form-label">Tìm tài khoản theo email</label><div class="flex gap-2"><input v-model="searchEmail" class="pq-field flex-1" placeholder="email@domain.com" @keydown.enter="searchRecipients"/><button class="rounded-xl bg-blue-600 px-3 text-white" :disabled="searchBusy||searchEmail.length<3" @click="searchRecipients"><Search :size="18"/></button></div><div v-for="p in found" :key="p.id" class="mt-2"><button class="w-full rounded-xl border px-3 py-2 text-left text-sm" :class="chosen?.id===p.id?'border-blue-600 bg-blue-100':'border-blue-100 bg-white'" @click="chosen=p"><strong>{{p.displayName}}</strong> · {{p.email}}<span class="block text-xs text-slate-500">{{p.key.algorithm}} · {{p.key.fingerprint.slice(0,16)}}…</span></button></div><p class="mt-2 text-xs text-slate-500">Để tạo quyền chia sẻ mới, hãy xác minh và ghim fingerprint trong Mật mã nâng cao → Khóa tin cậy trước.</p>
            <NuxtLink to="/pqc?tab=trust" class="mt-2 block text-xs font-bold text-blue-700 underline">Xác minh khóa người nhận trước khi mã hóa</NuxtLink>
            <label class="mt-3 block text-sm font-bold">Thời hạn chia sẻ<select v-model="expiryDays" class="pq-field mt-1"><option value="1">1 ngày</option><option value="7">7 ngày (khuyến nghị)</option><option value="30">30 ngày</option><option value="none">Không giới hạn (rủi ro cao)</option></select></label>
          </div>
          <section v-if="recipientMode==='someone'&&selected.length" class="rounded-2xl border border-amber-200 bg-amber-50 p-3" aria-label="Đánh giá rủi ro chia sẻ">
            <h3 class="flex items-center gap-2 font-extrabold text-amber-900"><ShieldAlert :size="19"/> Kiểm tra trước khi cấp quyền</h3>
            <p class="mt-1 text-xs text-amber-900">Đánh giá theo mức bảo mật, người nhận, thời hạn và cảnh báo truy cập. Máy chủ không nhận kết quả quét nội dung.</p>
            <div v-for="f in selected.filter(f=>fileScan(f))" :key="fileKey(f)" class="mt-2 rounded-xl bg-white p-2 text-sm"><div class="flex items-center justify-between gap-2"><span class="max-w-[70%] break-all font-bold">{{f.name}}</span><strong :class="shareRiskFor(f).score>=55?'text-rose-700':'text-blue-700'">{{shareRiskFor(f).level}} · {{shareRiskFor(f).score}}/100</strong></div><p class="mt-1 text-xs text-slate-700">{{shareRiskFor(f).reasons.join('; ')||'Chưa phát hiện yếu tố rủi ro tăng thêm'}}.</p></div>
            <label v-if="requiresReview" class="mt-3 flex items-start gap-2 text-sm font-semibold text-amber-900"><input v-model="shareConfirmed" type="checkbox" class="mt-1"/> Tôi đã kiểm tra nội dung, danh tính người nhận và chấp nhận rủi ro trước khi chia sẻ.</label>
          </section>
        </div>
        <div v-if="keyError" class="pq-alert pq-alert-error mt-4 text-sm">Không tải được thông tin khóa: {{keyError}} <button class="font-bold underline" @click="loadKeys">Thử lại</button></div>
        <div v-else-if="!hasKey" class="pq-alert mt-4 text-sm">Tài khoản chưa có bộ khóa mật mã. <NuxtLink to="/keys" class="font-bold underline">Tạo khóa trước</NuxtLink>.</div>
        <div v-else-if="locked" class="pq-alert mt-4 text-sm">Kho khóa đang khóa. <NuxtLink to="/keys" class="font-bold underline">Mở kho khóa</NuxtLink> trước khi thao tác.</div>
        <button class="mt-5 flex w-full items-center justify-center gap-3 rounded-[16px] bg-gradient-to-r from-[#096aff] to-[#0789ff] px-5 py-4 text-[17px] font-[800] text-white shadow-lg shadow-blue-200 disabled:from-[#a4b7d0] disabled:to-[#b4c4db]" :disabled="busy||!selected.length||!hasKey||locked||!!keyError||selected.some(f=>scanning[fileKey(f)]||safetyBusy[fileKey(f)]||!fileScan(f)||safetyScans[fileKey(f)]?.status==='blocked'||!safetyScans[fileKey(f)]||(safetyScans[fileKey(f)]?.status!=='clear'&&!acknowledgedWarnings[fileKey(f)]))" @click="upload"><LoaderCircle v-if="busy" :size="22" class="animate-spin"/><LockKeyhole v-else :size="22"/>{{busy?'Đang bảo vệ tệp...':'Mã hóa và tải lên'}}</button>
        <div v-if="busy||doneCount" class="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3" role="status" aria-live="polite">
          <div class="mb-2 flex justify-between gap-2 text-xs font-bold text-blue-800"><span>{{busy?'Đang mã hóa và tải lên':'Lượt mã hóa gần nhất'}}</span><span>{{doneCount}}/{{totalCount}} tệp · {{percent}}%</span></div>
          <div class="h-2 overflow-hidden rounded-full bg-blue-100"><div class="h-full rounded-full bg-gradient-to-r from-blue-600 to-sky-400 transition-all" :style="{width:percent+'%'}"/></div>
          <p v-if="progress" class="mt-2 text-xs text-[#225d9c]">{{progress}}</p>
        </div>
        <div class="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-3 text-sm">
          <div class="flex flex-wrap items-center justify-between gap-2"><span class="flex items-center gap-2 font-bold text-blue-900"><Gauge :size="19"/> So sánh hiệu năng ML-KEM trên thiết bị</span><button class="pq-icon-button" type="button" :disabled="benchmarking||busy" @click="compareKems">{{benchmarking?'Đang đo…':'Chạy đo thử'}}</button></div>
          <p class="mt-1 text-xs text-slate-600">Đo thật thời gian tạo khóa, đóng gói và mở khóa (trung bình 3 vòng, ms). Không thay đổi kho khóa hiện tại.</p>
          <div v-if="benchmarks.length" class="pq-responsive-scroll mt-2 overflow-x-auto" tabindex="0" aria-label="Bảng so sánh hiệu năng ML-KEM, cuộn ngang nếu cần"><table class="w-full min-w-[420px] text-left text-xs"><thead><tr><th>Thuật toán</th><th>Sinh khóa</th><th>Đóng gói</th><th>Mở khóa</th></tr></thead><tbody><tr v-for="b in benchmarks" :key="b.algorithm"><td class="py-1 font-bold">{{b.algorithm}}</td><td>{{b.keygenMs}} ms</td><td>{{b.encapsMs}} ms</td><td>{{b.decapsMs}} ms</td></tr></tbody></table></div>
        </div>
        <div class="mt-5 flex items-center gap-3 rounded-[18px] bg-[#def7ee] px-4 py-4 text-[13px] font-medium text-[#143d52]"><LockKeyhole :size="28" class="shrink-0 text-green-700"/>Tệp được mã hóa trên thiết bị trước khi tải lên.</div>
      </section>
    </div>
  </div>
</template>

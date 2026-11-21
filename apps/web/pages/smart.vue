<script setup lang="ts">
import {BrainCircuit,Search,LockKeyhole,RefreshCw,FileText,Trash2,ShieldCheck,AlertTriangle,Lightbulb,LoaderCircle} from 'lucide-vue-next';
import { decryptFile } from '@pqfile/crypto-core';
import { getUnlockedVault } from '~/utils/vault-session';
import { analyzeFile } from '~/utils/security-analysis';
import {insightFromText,searchDocuments} from '~/utils/local-intelligence';
import type {IndexedDocument,Insight} from '~/utils/local-intelligence';
import {loadLocalIndex,removeLocalIndex,saveLocalIndex} from '~/utils/local-index';
import {summarizeWithBrowserAI} from '~/utils/browser-ai';
type FileRow={id:string;displayLabel:string;ownerId:string};type Library={items:FileRow[]};
const {user}=useAuth();
const entries=ref<IndexedDocument[]>([]),library=ref<FileRow[]>([]),query=ref(''),busy=ref(''),error=ref(''),message=ref(''),ready=ref(false);
const unlocked=ref(!!getUnlockedVault());
const allowed=computed(()=>new Set(library.value.map(f=>f.id)));
const queryValidated=ref(''),queryAcl=ref<Set<string>>(new Set()),checkingAccess=ref(false);
const results=computed(()=>searchDocuments(entries.value,query.value,queryValidated.value===query.value?queryAcl.value:new Set()));
let queryTimer:ReturnType<typeof setTimeout>|undefined;
let queryNonce=0;
async function validateSearchAcl(value:string){
 const nonce=++queryNonce;
 checkingAccess.value=true;
 try{
  const response=await requestApi<Library>('/files/library');
  if(nonce!==queryNonce||value!==query.value)return;
  library.value=response.items;
  queryAcl.value=new Set(response.items.map(f=>f.id));queryValidated.value=value;
 }catch(e:any){if(nonce===queryNonce)error.value='Không xác minh được quyền hiện tại; tạm ẩn kết quả tìm kiếm: '+(e.message||'Lỗi API');}
 finally{if(nonce===queryNonce)checkingAccess.value=false;}
}
watch(query,(value)=>{
 queryValidated.value='';queryAcl.value=new Set();queryNonce++;checkingAccess.value=!!value.trim();
 if(queryTimer)clearTimeout(queryTimer);
 if(value.trim())queryTimer=setTimeout(()=>void validateSearchAcl(value),350);
});
onBeforeUnmount(()=>{if(queryTimer)clearTimeout(queryTimer);queryNonce++;});
const indexedIds=computed(()=>new Set(entries.value.map(e=>e.id)));
const selectedId=ref(''),insight=ref<Insight|null>(null);
const aiResult=ref(''),aiError=ref(''),aiBusy=ref(false);
const indexedCount=computed(()=>entries.value.filter(e=>allowed.value.has(e.id)).length);
const fileQuery=ref(''),fileScope=ref('all'),filePage=ref(1),filePageSize=10;
const batchRunning=ref(false),batchProgress=ref({done:0,total:0,failed:0}),cancelBatch=ref(false);
const skippedFiles=ref<string[]>([]);
const filteredFiles=computed(()=>library.value.filter(f=>(!fileQuery.value.trim()||f.displayLabel.toLocaleLowerCase('vi').includes(fileQuery.value.trim().toLocaleLowerCase('vi')))&&
 (fileScope.value==='all'||(fileScope.value==='indexed'?indexedIds.value.has(f.id):!indexedIds.value.has(f.id)))));
const filePages=computed(()=>Math.max(1,Math.ceil(filteredFiles.value.length/filePageSize)));
const pagedFiles=computed(()=>filteredFiles.value.slice((filePage.value-1)*filePageSize,filePage.value*filePageSize));
watch([fileQuery,fileScope],()=>{filePage.value=1;});
async function refresh(){
 unlocked.value=!!getUnlockedVault();
 if(!user.value)return;
 busy.value='refresh';error.value='';message.value='';
 try{
  const response=await requestApi<Library>('/files/library');library.value=response.items;
  const vault=getUnlockedVault();if(!vault){entries.value=[];ready.value=false;return;}
  entries.value=await loadLocalIndex(user.value.id,vault);ready.value=true;
  if(selectedId.value&&!response.items.some(f=>f.id===selectedId.value)){insight.value=null;selectedId.value='';aiResult.value='';}
  if(query.value.trim())void validateSearchAcl(query.value);
 }catch(e:any){error.value=e.message||'Không thể mở chỉ mục';}
 finally{busy.value='';}
}
onMounted(refresh);
watch(()=>user.value?.id,()=>{entries.value=[];ready.value=false;insight.value=null;void refresh();});
async function decode(f:FileRow):Promise<{name:string;blob:Blob}>{
 const vault=getUnlockedVault();if(!vault)throw new Error('Hãy mở kho khóa ở mục Khóa mật mã.');
 const full=await requestApi<any>(`/files/${encodeURIComponent(f.id)}`);
 if(!full.envelope)throw new Error('Không có khóa giải mã hợp lệ');
 const res=await fetch(`/api/files/${encodeURIComponent(f.id)}/blob`,{credentials:'include',cache:'no-store'});
 if(!res.ok)throw new Error('Quyền đã bị thu hồi, hết hạn hoặc tệp không thể tải.');
 return decryptFile(new Uint8Array(await res.arrayBuffer()),full,vault);
}
async function indexOne(f:FileRow):Promise<boolean>{
 if(!user.value)return false;const vault=getUnlockedVault();if(!vault){error.value='Hãy mở kho khóa trước.';return false;}
 busy.value=f.id;error.value='';message.value='';
 try{
  // Server checks the recipient permission again before each encrypted blob read.
  const source=await decode(f),file=new File([source.blob],source.name);
  const scan=await analyzeFile(file);
  if(!scan.localText?.trim())throw new Error(`${scan.note} Không lập chỉ mục từ nội dung không đọc được.`);
  const doc:IndexedDocument={id:f.id,label:source.name,body:scan.localText.slice(0,180_000),addedAt:new Date().toISOString(),status:scan.status};
  await saveLocalIndex(user.value.id,vault,doc);
  entries.value=entries.value.filter(d=>d.id!==f.id).concat(doc);
  message.value=`Đã lập chỉ mục mã hóa cục bộ cho “${source.name}”. ${scan.status==='complete'?'':'Chỉ đọc được một phần nội dung.'}`;
  return true;
 }catch(e:any){error.value=e.message||'Lập chỉ mục thất bại';return false;}
 finally{busy.value='';}
}
async function indexBatch(){
 if(batchRunning.value)return;
 const queue=library.value.filter(d=>!indexedIds.value.has(d.id)&&!skippedFiles.value.includes(d.id)).slice(0,20);
 if(!queue.length){message.value=skippedFiles.value.length?'Các tệp chưa lập chỉ mục còn lại đã gặp lỗi. Chọn “Thử lại tệp lỗi” để kiểm tra lại.':'Tất cả tệp phù hợp đã có chỉ mục.';return;}
 batchRunning.value=true;cancelBatch.value=false;batchProgress.value={done:0,total:queue.length,failed:0};
 error.value='';message.value='';
 try{for(const f of queue){if(cancelBatch.value)break;const ok=await indexOne(f);
   if(!ok){skippedFiles.value=[...skippedFiles.value,f.id];batchProgress.value={...batchProgress.value,failed:batchProgress.value.failed+1};}
   else batchProgress.value={...batchProgress.value,done:batchProgress.value.done+1};
 }}finally{batchRunning.value=false;const {done,failed}=batchProgress.value;
  message.value=cancelBatch.value?`Đã dừng: ${done} thành công, ${failed} không đọc được.`:
   `Đợt lập chỉ mục hoàn tất: ${done} thành công, ${failed} gặp lỗi. Chỉ số thành công được lưu mã hóa trên thiết bị.`;
  if(failed)error.value=`${failed} tệp không thể lập chỉ mục (không hỗ trợ, hết quyền hoặc lỗi đọc). Chọn thử lại khi đã xử lý nguyên nhân.`;
 }
}
async function remove(id:string){
 if(!user.value||!confirm('Xóa chỉ mục cục bộ của tài liệu này trên trình duyệt hiện tại? Tệp gốc không bị xóa.'))return;
 try{await removeLocalIndex(user.value.id,id);entries.value=entries.value.filter(x=>x.id!==id);message.value='Đã xóa chỉ mục trên trình duyệt này.';insight.value=null;}
 catch(e:any){error.value=e.message||'Không thể xóa chỉ mục';}
}
async function summarize(doc:IndexedDocument){
  try{const latest=await requestApi<Library>('/files/library');library.value=latest.items;
   if(!latest.items.some(f=>f.id===doc.id))throw new Error('Bạn không còn quyền truy cập tài liệu này.');
   selectedId.value=doc.id;aiResult.value='';aiError.value='';insight.value=insightFromText(doc.body,doc.status!=='complete');
  }catch(e:any){insight.value=null;error.value=e?.message||'Không thể xác minh quyền trước khi tóm tắt.';}
}
async function summarizeAI(){
 const doc=entries.value.find(d=>d.id===selectedId.value);if(!doc||!allowed.value.has(doc.id))return;
 aiBusy.value=true;aiResult.value='';aiError.value='';
 try{aiResult.value=await summarizeWithBrowserAI(doc.body);}catch(e:any){aiError.value=e.message||'AI cục bộ chưa khả dụng';}
 finally{aiBusy.value=false;}
}
const missing=computed(()=>library.value.filter(f=>!indexedIds.value.has(f.id)));
const retryable=computed(()=>missing.value.filter(f=>!skippedFiles.value.includes(f.id)));
onBeforeUnmount(()=>{cancelBatch.value=true;});
</script>
<template>
 <div class="pq-container pq-refined-page pq-library-pattern pq-space-optimized pq-refined-smart pq-ops-page space-y-5 py-7 sm:py-9">
  <PageHeading eyebrow="PHÂN TÍCH RIÊNG TƯ" title="Tìm kiếm và tóm tắt tài liệu cục bộ" description="Chỉ mục AES-GCM nằm trên trình duyệt. Mở kho khóa để tìm theo từ khóa mở rộng và xem tóm tắt trích xuất; không gửi bản rõ cho AI bên ngoài.">
   <template #icon><BrainCircuit :size="32"/></template>
   <template #actions><button type="button" :disabled="!!busy" @click="refresh"><RefreshCw :size="17"/> Làm mới quyền</button></template>
  </PageHeading>
  <div v-if="error" class="pq-alert pq-alert-error" role="alert">{{error}}</div><div v-if="message" class="pq-alert pq-alert-success" role="status">{{message}}</div>
  <div v-if="!unlocked" class="soft-card p-6"><div class="flex gap-3"><LockKeyhole :size="28" class="text-amber-700"/><div><h2 class="text-xl font-extrabold">Kho khóa đang đóng</h2><p class="mt-1 text-sm text-slate-600">Chỉ mục không thể giải mã trước khi mở kho. Không lưu khóa giải mã vào IndexedDB.</p><NuxtLink class="primary-button mt-3 inline-flex" to="/keys">Mở kho khóa</NuxtLink></div></div></div>
  <template v-else>
   <div class="grid gap-3 sm:grid-cols-3"><div class="soft-card p-5"><p class="text-sm font-bold text-slate-600">Tệp hiện được cấp quyền</p><p class="mt-2 text-3xl font-black text-blue-800">{{library.length}}</p></div><div class="soft-card p-5"><p class="text-sm font-bold text-slate-600">Đã lập chỉ mục trên thiết bị</p><p class="mt-2 text-3xl font-black text-blue-800">{{indexedCount}}</p></div><div class="soft-card p-5"><p class="text-sm font-bold text-slate-600">Chưa lập chỉ mục</p><p class="mt-2 text-3xl font-black text-blue-800">{{missing.length}}</p></div></div>
   <div class="pq-smart-content-grid">
    <div class="pq-smart-main-column">
   <section class="soft-card pq-ops-panel p-4 sm:p-6"><h2 class="mb-3 text-xl font-extrabold">Tra cứu nội dung liên quan</h2>
    <div class="flex gap-2"><div class="relative min-w-0 flex-1"><Search :size="18" class="absolute left-3 top-3.5 text-blue-600"/><input v-model="query" type="search" class="pq-field w-full !pl-10" placeholder="VD: hạn chót báo cáo tài chính, kế hoạch nhóm…" :disabled="!ready"/></div></div>
    <p class="mt-2 text-xs text-slate-600">Xếp hạng TF-IDF rút gọn và mở rộng một số từ đồng nghĩa tiếng Việt (chưa phải embedding hoặc mô hình AI ngữ nghĩa lớn). Kết quả chỉ bao gồm quyền truy cập đang được API xác nhận.</p>
    <div v-if="query.trim()" class="mt-4 space-y-3"><p v-if="checkingAccess" class="text-sm text-blue-700">Đang xác minh quyền truy cập hiện tại trước khi tìm kiếm…</p><p v-else class="text-sm font-semibold">{{results.length}} tài liệu có nội dung khớp</p>
     <article v-for="r in results" :key="r.id" class="rounded-xl border border-blue-100 bg-blue-50/60 p-3"><div class="flex flex-wrap items-center justify-between gap-2"><strong class="break-words text-blue-950">{{r.label}}</strong><span class="rounded-full bg-white px-2 py-1 text-xs font-bold text-blue-700">Độ liên quan {{r.score}}</span></div><p v-for="(snippet,i) in r.snippets" :key="i" class="mt-1 break-words text-xs text-slate-700">{{snippet}}</p><button class="pq-icon-button mt-2" @click="summarize(entries.find(e=>e.id===r.id)!)"><Lightbulb :size="17"/> Tóm tắt</button></article>
     <p v-if="!checkingAccess&&queryValidated===query&&!results.length" class="text-sm text-slate-500">Chưa tìm thấy kết quả trong các tệp đã lập chỉ mục và còn quyền.</p>
    </div>
   </section>
   <section v-if="insight" class="soft-card pq-ops-panel p-4 sm:p-6"><h2 class="text-xl font-extrabold"><Lightbulb :size="20" class="inline text-blue-700"/> Tóm tắt cục bộ</h2><p class="mt-1 text-xs text-slate-500">{{insight.note}}</p>
    <div class="mt-3 flex flex-wrap items-center gap-2"><button class="pq-icon-button" :disabled="aiBusy" @click="summarizeAI"><BrainCircuit :size="17"/> {{aiBusy?'Đang chạy mô hình trên thiết bị…':'Thử AI sinh tóm tắt cục bộ (chỉ tiếng Anh)'}}</button></div>
    <p v-if="aiError" class="mt-2 text-xs text-amber-800">{{aiError}}</p>
    <div v-if="aiResult" class="mt-3 rounded-xl bg-white p-3"><h3 class="font-bold">Tóm tắt do AI trên thiết bị sinh</h3><p class="mt-2 whitespace-pre-wrap text-sm">{{aiResult}}</p><p class="mt-1 text-xs text-slate-500">Kết quả sinh ngôn ngữ có thể không chính xác, cần đối chiếu bản gốc.</p></div>
    <h3 class="mt-3 font-bold">Những câu trọng tâm</h3><ul class="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-700"><li v-for="(s,i) in insight.summary" :key="i">{{s}}</li></ul>
    <h3 class="mt-4 font-bold">Nội dung có dấu hiệu cần thực hiện</h3><ul class="mt-2 list-disc space-y-2 pl-5 text-sm"><li v-for="(s,i) in insight.actions" :key="i">{{s}}</li><li v-if="!insight.actions.length">Chưa trích xuất được hành động cụ thể</li></ul>
    <p class="mt-3 text-sm"><strong>Ngày xuất hiện trong tài liệu:</strong> {{insight.deadlines.join(', ')||'Không xác định (chưa kiểm chứng đây là hạn chót)'}}</p>
    <p class="mt-2 text-xs text-amber-800">Cần đối chiếu tài liệu gốc, nhất là ngày tháng và trách nhiệm pháp lý. Đây là kết quả trích xuất, không phải suy luận đáng tin cậy về nội dung.</p>
   </section>
    </div>
   <section class="soft-card pq-ops-panel pq-smart-index-panel p-4 sm:p-6"><div class="pq-ops-panel-head"><div><h2>Xây dựng chỉ mục đã mã hóa</h2><p>Tạo chỉ mục trên trình duyệt từ những tệp bạn còn quyền đọc.</p></div><div class="pq-ops-actions"><button v-if="batchRunning" type="button" class="pq-icon-button" @click="cancelBatch=true">Dừng sau tệp hiện tại</button><button v-if="skippedFiles.length" type="button" class="pq-icon-button" :disabled="batchRunning" @click="skippedFiles=[];error=''">Thử lại {{skippedFiles.length}} tệp lỗi</button><button class="pq-icon-button pq-smart-index-all" :disabled="!!busy||batchRunning||!retryable.length" @click="indexBatch">{{batchRunning?'Đang lập chỉ mục...':'Lập chỉ mục 20 tệp tiếp theo'}}</button></div></div>
    <p v-if="batchRunning||batchProgress.total" class="pq-ops-progress" role="status">Đã lập chỉ mục {{batchProgress.done}} / {{batchProgress.total}} tệp; {{batchProgress.failed}} tệp gặp lỗi.</p>
    <div class="pq-ops-smart-filters"><input v-model="fileQuery" type="search" class="pq-field" placeholder="Lọc tệp theo tên..." aria-label="Lọc tệp lập chỉ mục"/><select v-model="fileScope" class="pq-field" aria-label="Trạng thái chỉ mục"><option value="all">Tất cả</option><option value="indexed">Đã lập chỉ mục</option><option value="missing">Chưa lập chỉ mục</option></select></div>
    <p class="mt-2 text-sm text-slate-600">Chỉ lập chỉ mục sau khi giải mã hợp lệ trên thiết bị. TXT, CSV, Markdown, lớp văn bản PDF và phần văn bản DOCX được hỗ trợ; ảnh và tệp không trích xuất được sẽ báo lỗi thay vì lưu chỉ mục giả.</p>
    <div v-if="!library.length" class="pq-empty">Chưa có tài liệu được cấp quyền.</div>
    <div v-else-if="!filteredFiles.length" class="pq-empty">Không có tài liệu phù hợp với bộ lọc.</div>
    <ul v-else class="mt-4 divide-y divide-blue-100 pq-ops-smart-list" tabindex="0" aria-label="Danh sách tệp lập chỉ mục có thể cuộn"><li v-for="f in pagedFiles" :key="f.id" class="pq-smart-file-entry flex flex-wrap items-center gap-2 py-3 text-sm"><FileText :size="20" class="text-blue-600"/><span class="min-w-0 flex-1 break-all font-semibold">{{f.displayLabel}}</span><span v-if="indexedIds.has(f.id)" class="text-xs font-bold text-emerald-700"><ShieldCheck :size="14" class="inline"/> Đã tạo</span><button class="pq-icon-button" :disabled="!!busy||batchRunning" @click="indexOne(f)"><LoaderCircle v-if="busy===f.id" :size="15" class="animate-spin"/><Search v-else :size="15"/> {{indexedIds.has(f.id)?'Cập nhật':'Lập chỉ mục'}}</button><button v-if="indexedIds.has(f.id)" class="pq-icon-button" :disabled="!!busy||batchRunning" @click="summarize(entries.find(e=>e.id===f.id)!)"><Lightbulb :size="15"/> Tóm tắt</button><button v-if="indexedIds.has(f.id)" class="pq-icon-button !text-rose-700" :disabled="!!busy||batchRunning" @click="remove(f.id)"><Trash2 :size="15"/> Xóa</button></li></ul>
    <div class="pq-ops-pagination"><span>{{filteredFiles.length}} tệp phù hợp · Trang {{filePage}}/{{filePages}}</span><div><button type="button" class="pq-icon-button" :disabled="filePage<=1" @click="filePage--">Trước</button><button type="button" class="pq-icon-button" :disabled="filePage>=filePages" @click="filePage++">Sau</button></div></div>
   </section>
   </div>
  </template>
  <div class="flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><AlertTriangle :size="20" class="shrink-0"/><p>Việc thu hồi quyền không thu hồi được nội dung từng tải về. Một chỉ mục đã tạo trên thiết bị khác cũng không thể xóa từ xa. Dữ liệu tìm kiếm chỉ hiển thị khi API trả về quyền hiện tại, nhưng người dùng có thể vẫn giữ bản sao độc lập.</p></div>
 </div>
</template>

<script setup lang="ts">
import {ShieldCheck,ShieldAlert,RefreshCw,Network,Clock3,Trash2,AlertTriangle,CalendarClock,Info} from 'lucide-vue-next';
type Review={id:string;fileId:string;fileLabel:string;recipientId:string;recipientName:string;recipientEmail:string;
 active:boolean;score:number;reasons:string[];createdAt:string;lastDownloadedAt:string|null;expiresAt:string|null;taskDeadlineAt:string|null;sharedDays:number;idleDays:number};
type ReviewResponse={items:Review[];filesReviewed:number;activeGrants:number;suggestions:number;truncated:boolean;note:string};
type Node={id:string;label:string;kind:string;score:number};type Edge={from:string;to:string;kind:string};
type Graph={nodes:Node[];edges:Edge[];truncated:boolean;note:string};
const section=ref<'review'|'graph'>('review'),report=ref<ReviewResponse|null>(null),graph=ref<Graph|null>(null),loading=ref(false),busy=ref(''),error=ref(''),success=ref(''),onlySuggested=ref(true);
const dueInputs=ref<Record<string,string>>({});const focusNode=ref<string|null>(null);
const search=ref(''),grantState=ref('active'),riskFilter=ref('all'),sortBy=ref('risk');
const page=ref(1),pageSize=12;
const displayList=computed(()=>{const q=search.value.trim().toLocaleLowerCase('vi');return (report.value?.items||[]).filter(x=>
 (grantState.value==='all'||(grantState.value==='active'?x.active:!x.active))&&
 (!onlySuggested.value||x.active&&x.score>=40)&&
 (riskFilter.value==='all'||(riskFilter.value==='critical'?x.score>=80:riskFilter.value==='elevated'?x.score>=40&&x.score<80:x.score<40))&&
 (!q||`${x.fileLabel} ${x.recipientName} ${x.recipientEmail}`.toLocaleLowerCase('vi').includes(q))
 ).sort((a,b)=>sortBy.value==='age'?b.sharedDays-a.sharedDays:sortBy.value==='name'?a.fileLabel.localeCompare(b.fileLabel,'vi'):b.score-a.score);});
const pages=computed(()=>Math.max(1,Math.ceil(displayList.value.length/pageSize)));
const visibleGrants=computed(()=>displayList.value.slice((page.value-1)*pageSize,page.value*pageSize));
watch(grantState,value=>{if(value==='expired')onlySuggested.value=false;});
watch([search,grantState,riskFilter,sortBy,onlySuggested],()=>{page.value=1;});
function changePage(p:number){if(p<1||p>pages.value)return;page.value=p;}
function csvValue(value:unknown){const raw=String(value??'');const safe=/^[\s]*[=+@-]/.test(raw)?`'${raw}`:raw;return `"${safe.replace(/"/g,'""')}"`;}
function exportReview(){if(!displayList.value.length)return;
 const rows=[['Tệp','Người nhận','Email','Trạng thái','Điểm rà soát','Lý do','Ngày chia sẻ','Hạn quyền','Hạn công việc'],...displayList.value.map(x=>[x.fileLabel,x.recipientName,x.recipientEmail,x.active?'Đang hiệu lực':'Hết hạn',x.score,x.reasons.join('; '),x.createdAt,x.expiresAt||'',x.taskDeadlineAt||''])];
 const blob=new Blob(['\uFEFF'+rows.map(r=>r.map(csvValue).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download='pqfile-ra-soat-quyen.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
}
const graphNodes=computed(()=>graph.value?.nodes.slice(0,110)||[]);
const graphIds=computed(()=>new Set(graphNodes.value.map(n=>n.id)));
const graphEdges=computed(()=>graph.value?.edges.filter(e=>graphIds.value.has(e.from)&&graphIds.value.has(e.to))||[]);
const graphHeight=computed(()=>Math.max(580,...['owner','file','person','group'].map(k=>graphNodes.value.filter(n=>n.kind===k).length*52+70)));
const coords=computed(()=>{
 const out:Record<string,{x:number;y:number}>={};const lanes:{kind:string;x:number}[]=[{kind:'owner',x:100},{kind:'file',x:365},{kind:'person',x:680},{kind:'group',x:990}];
 for(const {kind,x} of lanes){const relevant=graphNodes.value.filter(n=>n.kind===kind);relevant.forEach((n,i)=>out[n.id]={x,y:(i+1)*graphHeight.value/(relevant.length+1)});}
 return out;
});
const focus=computed(()=>graphNodes.value.find(n=>n.id===focusNode.value)||null);
const date=(v:string|null)=>v?new Date(v).toLocaleDateString('vi-VN'):'Chưa có';
const niceDateInput=(v:string|null)=>v?new Date(v).toISOString().slice(0,10):'';
async function load(){loading.value=true;error.value='';try{
 const [a,b]=await Promise.all([requestApi<ReviewResponse>('/governance/review'),requestApi<Graph>('/governance/graph')]);report.value=a;graph.value=b;
 dueInputs.value=Object.fromEntries(a.items.map(x=>[x.id,niceDateInput(x.taskDeadlineAt)]));
}catch(e:any){error.value=e.message||'Không tải được dữ liệu';}finally{loading.value=false;}}
onMounted(load);
async function updateDeadline(item:Review){
 busy.value=item.id;error.value='';success.value='';
 try{const raw=dueInputs.value[item.id];await requestApi(`/governance/grants/${item.id}/deadline`,{method:'PATCH',body:JSON.stringify({taskDeadlineAt:raw?new Date(raw+'T23:59:59').toISOString():null})});await load();success.value='Đã lưu hạn công việc. Hạn này chỉ dùng để đề xuất; muốn hết quyền tự động phải thiết lập ngày hết hạn chia sẻ.';}
 catch(e:any){error.value=e.message||'Không thể lưu hạn';}finally{busy.value='';}
}
async function revoke(item:Review){
 if(!confirm(`Thu hồi quyền tải tệp “${item.fileLabel}” của ${item.recipientEmail}? Những bản sao đã tải trước đó không thể bị xóa từ xa.`))return;
 busy.value=item.id;error.value='';success.value='';
 try{await requestApi(`/governance/grants/${item.id}`,{method:'DELETE'});await load();success.value='Đã thu hồi quyền tải nội dung mới trên máy chủ.';}
 catch(e:any){error.value=e.message||'Không thể thu hồi';}finally{busy.value='';}
}
const graphScale=ref(1);
const zoomGraph=(step:number)=>{graphScale.value=Math.max(.6,Math.min(1.4,Math.round((graphScale.value+step)*100)/100));};
const badge=(n:number)=>n>=80?'bg-rose-100 text-rose-800':n>=60?'bg-amber-100 text-amber-800':'bg-blue-100 text-blue-800';
</script>
<template>
 <div class="pq-container pq-refined-page pq-library-pattern pq-space-optimized pq-refined-governance pq-ops-page space-y-5 py-7 sm:py-9">
  <PageHeading eyebrow="KIỂM SOÁT CHIA SẺ" title="Quản trị quyền và bản đồ rủi ro" description="Rà soát quyền cũ, thời hạn công việc, quan hệ người nhận – tệp – nhóm. Không truy cập nội dung tệp đã mã hóa.">
   <template #icon><Network :size="32"/></template>
   <template #actions><button type="button" :disabled="loading" @click="load"><RefreshCw :size="17" :class="{'animate-spin':loading}"/> Làm mới</button></template>
  </PageHeading>
  <div v-if="error" role="alert" class="pq-alert pq-alert-error">{{error}}</div>
  <div v-if="success" role="status" class="pq-alert pq-alert-success">{{success}}</div>
  <div class="grid gap-3 sm:grid-cols-3">
   <div class="soft-card p-5"><p class="text-sm font-bold text-slate-600">Quyền đang hiệu lực</p><p class="mt-2 text-3xl font-black text-blue-800">{{report?.activeGrants??'—'}}</p></div>
   <div class="soft-card p-5"><p class="text-sm font-bold text-slate-600">Đề xuất xem xét</p><p class="mt-2 text-3xl font-black text-amber-700">{{report?.suggestions??'—'}}</p></div>
   <div class="soft-card p-5"><p class="text-sm font-bold text-slate-600">Tệp đã đánh giá</p><p class="mt-2 text-3xl font-black text-blue-800">{{report?.filesReviewed??'—'}}</p></div>
  </div>
  <div class="flex flex-wrap gap-2" role="tablist" aria-label="Chế độ giám sát">
   <button role="tab" :aria-selected="section==='review'" class="pq-icon-button" :class="section==='review'?'!bg-blue-600 !text-white':''" @click="section='review'"><ShieldAlert :size="17"/> Đề xuất thu hồi</button>
   <button role="tab" :aria-selected="section==='graph'" class="pq-icon-button" :class="section==='graph'?'!bg-blue-600 !text-white':''" @click="section='graph'"><Network :size="17"/> Bản đồ quan hệ</button>
  </div>
  <section v-if="section==='review'" class="soft-card pq-ops-panel p-4 sm:p-6">
   <div class="pq-ops-panel-head"><div><h2>Danh sách quyền cần rà soát</h2><p>Điểm rủi ro từ quy tắc, không phải kết luận về rò rỉ dữ liệu.</p></div><button type="button" class="pq-icon-button" :disabled="!displayList.length" @click="exportReview">Xuất danh sách CSV</button></div>
   <div class="pq-ops-filter-grid pq-ops-filters-four">
    <label><span class="form-label">Tìm tệp / người nhận</span><input v-model="search" class="pq-field" type="search" placeholder="Tên tệp, email..." maxlength="100"/></label>
    <label><span class="form-label">Trạng thái quyền</span><select v-model="grantState" class="pq-field"><option value="active">Đang hiệu lực</option><option value="expired">Đã hết hạn</option><option value="all">Tất cả</option></select></label>
    <label><span class="form-label">Mức rà soát</span><select v-model="riskFilter" class="pq-field"><option value="all">Tất cả mức</option><option value="critical">Nghiêm trọng (80–100)</option><option value="elevated">Cần xem xét (40–79)</option><option value="low">Thấp (&lt;40)</option></select></label>
    <label><span class="form-label">Sắp xếp</span><select v-model="sortBy" class="pq-field"><option value="risk">Điểm cao trước</option><option value="age">Thời gian chia sẻ</option><option value="name">Tên tài liệu A–Z</option></select></label>
   </div>
   <label class="pq-ops-toggle mt-3"><input v-model="onlySuggested" type="checkbox"/> Chỉ hiển thị quyền được đề xuất thu hồi (điểm từ 40)</label>
   <p class="mb-4 text-sm text-slate-600">Chỉ dựa trên nhật ký tải ciphertext và tuổi quyền chia sẻ. Không ghi nhận các lượt đọc sau khi đã giải mã trên thiết bị. Mức điểm là quy tắc thử nghiệm, không phải xác suất rò rỉ.</p>
   <p v-if="loading" role="status">Đang tải đánh giá...</p>
   <p v-else-if="!displayList.length" class="pq-empty">Không có quyền nào phù hợp bộ lọc.</p>
   <div v-else class="pq-compact-grants" tabindex="0" role="region" aria-label="Danh sách quyền truy cập có thể cuộn">
    <article v-for="item in visibleGrants" :key="item.id" class="pq-ops-grant rounded-2xl border border-blue-100 bg-[#f8fbff] p-4">
     <div class="flex flex-wrap items-start justify-between gap-2"><div class="min-w-0"><strong class="block break-words text-blue-950">{{item.fileLabel}}</strong><p class="mt-1 break-all text-sm text-slate-700">{{item.recipientName}} · {{item.recipientEmail}}</p></div><span class="rounded-full px-3 py-1 text-xs font-black" :class="badge(item.score)">Điểm rà soát {{item.score}}/100</span></div>
     <div class="mt-3 flex flex-wrap gap-3 text-xs text-slate-600"><span>Đã chia sẻ: {{item.sharedDays}} ngày</span><span>Tải lần cuối: {{date(item.lastDownloadedAt)}}</span><span>Hết quyền: {{date(item.expiresAt)}}</span></div>
     <ul class="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-900"><li v-for="(reason,i) in item.reasons" :key="i">{{reason}}</li><li v-if="!item.reasons.length">Chưa có cảnh báo theo ngưỡng</li></ul>
     <div v-if="item.active" class="mt-3 flex flex-wrap items-end gap-2"><label class="text-xs font-bold text-blue-900"><CalendarClock :size="15" class="inline"/> Hạn công việc (tùy chọn)<input v-model="dueInputs[item.id]" type="date" class="pq-field mt-1 block"/></label>
      <button class="pq-icon-button" :disabled="busy===item.id" @click="updateDeadline(item)">Lưu hạn</button>
      <button class="pq-icon-button !border-rose-200 !text-rose-700" :disabled="!!busy" @click="revoke(item)"><Trash2 :size="16"/> Thu hồi quyền</button></div>
    </article>
   </div>
   <div class="pq-ops-pagination"><span>{{displayList.length}} quyền phù hợp · Trang {{page}}/{{pages}}</span><div><button type="button" class="pq-icon-button" :disabled="page<=1" @click="changePage(page-1)">Trước</button><button type="button" class="pq-icon-button" :disabled="page>=pages" @click="changePage(page+1)">Sau</button></div></div>
  </section>
  <section v-else class="soft-card pq-ops-panel p-4 sm:p-6">
   <div class="mb-2 flex flex-wrap items-center justify-between gap-3"><h2 class="text-xl font-extrabold">Sơ đồ quyền truy cập đang hiệu lực</h2><div class="flex items-center gap-2" aria-label="Điều chỉnh tỷ lệ sơ đồ"><button type="button" class="pq-icon-button" aria-label="Thu nhỏ sơ đồ" :disabled="graphScale<=.6" @click="zoomGraph(-.2)">−</button><span class="min-w-12 text-center text-xs font-bold">{{Math.round(graphScale*100)}}%</span><button type="button" class="pq-icon-button" aria-label="Phóng to sơ đồ" :disabled="graphScale>=1.4" @click="zoomGraph(.2)">+</button><button type="button" class="pq-icon-button" @click="graphScale=1">100%</button></div></div>
   <p class="mb-4 text-sm text-slate-600">Các cột lần lượt: chủ sở hữu, tài liệu, người nhận và nhóm. Đường nét liền biểu thị quyền tải tệp; đường nét đứt thể hiện thành viên nhóm, không cấp quyền tự động. Chọn nút để xem chi tiết.</p>
   <p v-if="loading">Đang vẽ sơ đồ...</p>
   <div v-else-if="!graphNodes.length" class="pq-empty">Chưa có dữ liệu chia sẻ.</div>
   <div v-else class="pq-graph-viewport overflow-auto rounded-xl border border-blue-100 bg-slate-50" style="max-height:min(660px,72dvh)" tabindex="0" aria-label="Vùng sơ đồ có thể cuộn ngang và dọc">
    <svg class="pq-graph-svg" role="img" aria-label="Sơ đồ mạng quan hệ tệp người dùng nhóm" width="1100" :height="graphHeight" :style="{width:`${1100*graphScale}px`,height:`${graphHeight*graphScale}px`}" :viewBox="`0 0 1100 ${graphHeight}`">
     <g v-for="(e,i) in graphEdges" :key="i"><line :x1="coords[e.from]?.x" :y1="coords[e.from]?.y" :x2="coords[e.to]?.x" :y2="coords[e.to]?.y" :stroke="e.kind==='membership'?'#a78bfa':e.kind==='owner'?'#38bdf8':'#f59e0b'" :stroke-width="focusNode&&(focusNode===e.from||focusNode===e.to)?3:1.5" :stroke-dasharray="e.kind==='membership'?'6 5':undefined" opacity=".65"/></g>
     <g v-for="n in graphNodes" :key="n.id" tabindex="0" role="button" :aria-label="`${n.kind}: ${n.label}`" style="cursor:pointer" @click="focusNode=n.id" @keydown.enter="focusNode=n.id" @keydown.space.prevent="focusNode=n.id">
      <circle :cx="coords[n.id]?.x" :cy="coords[n.id]?.y" :r="focusNode===n.id?19:13" :fill="n.kind==='owner'?'#0284c7':n.kind==='file'?'#2563eb':n.kind==='person'?'#d97706':'#7c3aed'" :stroke="focusNode===n.id?'#111827':'#fff'" :stroke-width="focusNode===n.id?3:2"/>
      <text :x="coords[n.id]?.x" :y="(coords[n.id]?.y||0)-20" text-anchor="middle" font-size="11" fill="#334155">{{n.label.length>23?n.label.slice(0,21)+'…':n.label}}</text>
     </g>
    </svg>
   </div>
   <p class="mt-2 text-xs text-slate-500">Trên màn hình nhỏ, vuốt ngang/dọc để xem các nút ngoài khung. Có thể dùng nút ± để điều chỉnh kích thước.</p>
   <p v-if="focus" class="mt-3 rounded-xl bg-blue-50 p-3 text-sm"><strong>{{focus.label}}</strong> · {{focus.kind==='file'?'Tệp':focus.kind==='person'?'Người nhận':focus.kind==='group'?'Nhóm (ngữ cảnh)':'Chủ sở hữu'}} · Điểm tập trung {{focus.score}}/100</p>
   <p class="mt-3 text-xs text-slate-600">{{graph?.note}}</p>
  </section>
  <div v-if="report?.truncated||graph?.truncated" class="pq-alert"><AlertTriangle :size="16" class="inline"/> Dữ liệu đã được giới hạn để bảo vệ hiệu năng. Bản đồ có thể chỉ hiển thị tối đa 110 nút trong tập dữ liệu trả về; đây không phải toàn bộ quyền của hệ thống.</div>
  <div class="flex gap-2 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950"><Info :size="20" class="shrink-0"/><p>Thu hồi hoặc hết hạn chỉ chặn lần tải mới. Người nhận có thể vẫn giữ bản rõ/khóa nội dung từng tải trước đây. Hạn công việc dùng để nhắc rà soát, KHÔNG tự thu hồi; trường hết hạn chia sẻ mới quyết định quyền thực tế.</p></div>
 </div>
</template>

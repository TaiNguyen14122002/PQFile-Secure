<script setup lang="ts">
import { Clock3, FileLock2, Share2, Search, RefreshCw, RotateCcw, Trash2, Pencil,
  ChevronLeft, ChevronRight, Download, CalendarRange, ListFilter, UsersRound, LoaderCircle,
  FileUp, ShieldCheck, X } from 'lucide-vue-next';

type LogItem={id:string;action:string;resourceType:string;resourceId?:string|null;
  fileName?:string|null;details?:Record<string,unknown>|null;createdAt:string};
type PagedLog={items:LogItem[];total:number;page:number;pageSize:number};
const actionChoices=[
  {value:'',label:'Mọi hoạt động'},
  {value:'FILE_ENCRYPT_UPLOAD',label:'Tải lên & mã hóa'},
  {value:'FILE_SHARE',label:'Chia sẻ tệp'},
  {value:'FILE_DOWNLOAD',label:'Tải tệp mã hóa'},
  {value:'FILE_SHARE_REVOKE',label:'Thu hồi chia sẻ'},
  {value:'FILE_RENAME',label:'Đổi tên tệp'},
  {value:'FILE_TRASH',label:'Chuyển vào thùng rác'},
  {value:'FILE_RESTORE',label:'Khôi phục tệp'},
  {value:'FILE_DELETE_PERMANENT',label:'Xóa vĩnh viễn'},
  {value:'WORKSPACE_CREATE',label:'Tạo nhóm'},
  {value:'WORKSPACE_RENAME',label:'Đổi tên nhóm'},
  {value:'WORKSPACE_DELETE',label:'Xóa nhóm'},
  {value:'WORKSPACE_MEMBER_ADD',label:'Thêm thành viên'},
  {value:'WORKSPACE_MEMBER_ROLE',label:'Phân quyền thành viên'},
  {value:'WORKSPACE_MEMBER_REMOVE',label:'Xóa thành viên'},
  {value:'WORKSPACE_LEAVE',label:'Rời nhóm'},
  {value:'GRANT_TASK_DEADLINE',label:'Cập nhật hạn công việc'},
  {value:'SECURITY_ALERT_ACK',label:'Đã xem xét cảnh báo'},
  {value:'SECURITY_ALERT_ACK_ALL',label:'Xem xét tất cả cảnh báo'},
  {value:'FILE_SHARE_REVOKE_REVIEW',label:'Thu hồi theo rà soát'},
];
const names=Object.fromEntries(actionChoices.slice(1).map(x=>[x.value,x.label])) as Record<string,string>;
const items=ref<LogItem[]>([]),total=ref(0),page=ref(1),pageSize=20;
const loading=ref(true),error=ref(''),success=ref(''),search=ref(''),action=ref(''),period=ref('all');
const dateFrom=ref(''),dateTo=ref(''),exporting=ref(false);
const totalPages=computed(()=>Math.max(1,Math.ceil(total.value/pageSize)));
const startIndex=computed(()=>total.value?(page.value-1)*pageSize+1:0);
const endIndex=computed(()=>Math.min(page.value*pageSize,total.value));
const time=(iso:string)=>new Date(iso).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
const related=(r:LogItem)=>r.fileName||(typeof r.details?.name==='string'?r.details.name:null);
const isShare=(a:string)=>a.includes('SHARE');
const isGroup=(a:string)=>a.startsWith('WORKSPACE_');
const isSecurity=(a:string)=>a.startsWith('SECURITY_');
const isDelete=(a:string)=>a.includes('TRASH')||a.includes('DELETE')||a.includes('REMOVE');
let requestId=0;
let delay:ReturnType<typeof setTimeout>|null=null;

function filterParams(targetPage=page.value,size=pageSize){
  const qs=new URLSearchParams({page:String(targetPage),size:String(size)});
  const q=search.value.trim();if(q)qs.set('q',q);
  if(action.value)qs.set('action',action.value);
  if(period.value==='custom'){
    if(dateFrom.value)qs.set('from',dateFrom.value);
    if(dateTo.value)qs.set('to',dateTo.value);
  }else if(period.value!=='all')qs.set('from',new Date(Date.now()-Number(period.value)*86_400_000).toISOString().slice(0,10));
  return qs;
}
async function load(){
  const id=++requestId;loading.value=true;
  if(period.value==='custom'&&dateFrom.value&&dateTo.value&&dateFrom.value>dateTo.value){
    error.value='Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.';loading.value=false;items.value=[];return;
  }
  const qs=filterParams();
  try{
    const result=await requestApi<PagedLog>(`/activity/paged?${qs}`);
    if(id!==requestId)return;
    items.value=result.items;total.value=result.total;error.value='';
    if(page.value>Math.max(1,Math.ceil(result.total/pageSize))) {page.value=1;void load();}
  }catch(e:any){if(id===requestId){error.value=e?.message||'Không thể tải nhật ký hoạt động.';items.value=[];}}
  finally{if(id===requestId)loading.value=false;}
}
function filterNow(){page.value=1;void load();}
watch([action,period,dateFrom,dateTo],filterNow);
watch(search,()=>{if(delay)clearTimeout(delay);delay=setTimeout(filterNow,350);});
function turnPage(p:number){if(p<1||p>totalPages.value||loading.value)return;page.value=p;void load();}
function clearFilters(){search.value='';action.value='';period.value='all';dateFrom.value='';dateTo.value='';filterNow();}
function csvValue(v:unknown){const raw=String(v??'');const safe=/^[\s]*[=+@-]/.test(raw)?`'${raw}`:raw;return `"${safe.replace(/"/g,'""')}"`;}
async function exportFiltered(){
 if(exporting.value||!total.value)return;
 if(total.value>1000&&!confirm(`Có ${total.value} bản ghi phù hợp. File CSV chỉ xuất 1.000 bản ghi mới nhất theo bộ lọc. Tiếp tục?`))return;
 exporting.value=true;error.value='';success.value='';
 try{
  const all:LogItem[]=[];const countToExport=Math.min(total.value,1000);
  const snapshot=filterParams(1,100);
  for(let p=1;all.length<countToExport;p++){
   snapshot.set('page',String(p));
   const batch=await requestApi<PagedLog>(`/activity/paged?${snapshot}`);
   all.push(...batch.items);
   if(batch.items.length<100)break;
  }
  writeCsv(all.slice(0,countToExport),`pqfile-nhat-ky-${new Date().toISOString().slice(0,10)}.csv`);
  success.value=`Đã chuẩn bị CSV với ${Math.min(all.length,countToExport)} bản ghi; bộ lọc và phân quyền vẫn được áp dụng.`;
 }catch(e:any){error.value=e?.message||'Không thể xuất nhật ký';}finally{exporting.value=false;}
}
function writeCsv(records:LogItem[],filename:string){
 const lines=[['Thời gian','Hoạt động','Tệp/Nhóm','Mã đối tượng'],
   ...records.map(r=>[time(r.createdAt),names[r.action]||r.action,related(r)||'',r.resourceId||''])];
 const csv='\uFEFF'+lines.map(line=>line.map(csvValue).join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download=filename;
 document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
}
function exportCurrentPage(){
  if(!items.value.length)return;
  writeCsv(items.value,`pqfile-nhat-ky-trang-${page.value}.csv`);
}
onMounted(load);
onBeforeUnmount(()=>{requestId++;if(delay)clearTimeout(delay);});
</script>

<template>
  <div class="pq-container pq-refined-page pq-library-pattern pq-space-optimized pq-refined-activity pq-ops-page space-y-5 py-7 sm:py-9">
    <PageHeading eyebrow="NHẬT KÝ TÀI KHOẢN" title="Lịch sử hoạt động"
      description="Tra cứu những thao tác của tài khoản bạn, với tìm kiếm và phân trang trên cơ sở dữ liệu.">
      <template #icon><Clock3 :size="34" /></template>
      <template #actions>
        <button type="button" :disabled="loading" @click="load"><RefreshCw :size="17" :class="loading?'animate-spin':''" /> Làm mới</button>
        <button type="button" :disabled="loading||!items.length" @click="exportCurrentPage"><Download :size="17"/> Xuất trang</button><button type="button" :disabled="loading||exporting||!total" @click="exportFiltered"><Download :size="17"/> {{exporting?'Đang xuất...':'Xuất theo bộ lọc'}}</button>
      </template>
    </PageHeading>
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <div class="pq-kpi-mini"><strong>{{total.toLocaleString('vi-VN')}}</strong><span>Hoạt động phù hợp bộ lọc</span></div>
      <div class="pq-kpi-mini"><strong>{{totalPages}}</strong><span>Trang kết quả</span></div>
      <div class="pq-kpi-mini col-span-2 sm:col-span-1"><strong>{{items.length}}</strong><span>Bản ghi trang hiện tại</span></div>
    </div>
<div v-if="success" class="pq-alert pq-alert-success" role="status">{{success}}</div>
    <section class="soft-card pq-ops-panel p-4 sm:p-6" aria-label="Bộ lọc lịch sử">
      <div class="pq-section-head"><h2 class="flex items-center gap-2"><ListFilter :size="21" class="text-blue-600"/> Tìm kiếm và lọc</h2>
        <button v-if="search||action||period!=='all'" class="pq-icon-button" @click="clearFilters"><X :size="16"/> Xóa lọc</button>
      </div>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.5fr)_minmax(150px,1fr)_minmax(140px,.75fr)]">
        <label class="relative block"><span class="form-label">Tên tệp hoặc mã thao tác</span><Search :size="17" class="absolute bottom-3 left-3 text-slate-400"/><input v-model="search" class="pq-field !pl-10" maxlength="100" placeholder="Ví dụ: báo cáo, FILE_SHARE..."/></label>
        <label><span class="form-label">Loại hoạt động</span><select v-model="action" class="pq-field"><option v-for="opt in actionChoices" :key="opt.value" :value="opt.value">{{opt.label}}</option></select></label>
        <label><span class="form-label">Thời gian</span><select v-model="period" class="pq-field"><option value="all">Tất cả thời gian</option><option value="7">7 ngày gần đây</option><option value="30">30 ngày gần đây</option><option value="90">90 ngày gần đây</option><option value="custom">Khoảng tùy chọn</option></select></label>
      </div>
      <div v-if="period==='custom'" class="pq-ops-date-range"><label><span class="form-label">Từ ngày</span><input v-model="dateFrom" type="date" class="pq-field"/></label><label><span class="form-label">Đến ngày</span><input v-model="dateTo" type="date" class="pq-field"/></label></div>
      <div v-if="error" class="pq-alert pq-alert-error mt-4" role="alert">{{error}} <button class="font-bold underline" @click="load">Thử lại</button></div>
      <div v-if="loading" class="space-y-4 py-7" role="status"><div v-for="i in 5" :key="i" class="pq-skeleton h-12 w-full"/><p class="text-center text-sm text-blue-700"><LoaderCircle :size="16" class="inline animate-spin"/> Đang lấy dữ liệu...</p></div>
      <div v-else-if="!items.length" class="pq-empty"><Clock3 :size="45" class="text-blue-300"/><h3>Không tìm thấy hoạt động</h3><p>Chưa có nhật ký hoặc bộ lọc hiện tại không khớp. Hãy thử khoảng thời gian khác.</p></div>
      <ol v-else class="pq-compact-activity-list mt-5" tabindex="0" aria-label="Danh sách hoạt động, cuộn để xem thêm">
        <li v-for="r in items" :key="r.id" class="pq-list-entry pq-activity-entry pq-ops-activity-record">
          <div class="grid h-11 w-11 shrink-0 place-items-center rounded-xl" :class="isSecurity(r.action)?'bg-amber-50 text-amber-700':isDelete(r.action)?'bg-rose-50 text-rose-600':isGroup(r.action)?'bg-amber-50 text-amber-600':isShare(r.action)?'bg-violet-50 text-violet-600':'bg-blue-50 text-blue-700'">
            <ShieldCheck v-if="isSecurity(r.action)" :size="21"/><UsersRound v-else-if="isGroup(r.action)" :size="21"/><Share2 v-else-if="isShare(r.action)" :size="21"/><Trash2 v-else-if="isDelete(r.action)" :size="21"/><Pencil v-else-if="r.action==='FILE_RENAME'" :size="21"/><RotateCcw v-else-if="r.action==='FILE_RESTORE'" :size="21"/><FileUp v-else :size="21"/>
          </div>
          <div class="min-w-0 flex-1"><p class="font-extrabold text-[#17326b]">{{names[r.action]||r.action}} <span v-if="r.details?.researchDataset" class="pq-research-tag ml-1">Dữ liệu nghiên cứu</span></p><p v-if="related(r)" class="mt-1 truncate text-sm text-[#42618e]" :title="related(r)||''">{{related(r)}}</p><p class="mt-1 text-xs text-[#7186a7]">{{r.resourceType==='workspace'?'Nhóm làm việc':r.resourceType==='security'?'An ninh':'Tệp tin'}} · {{r.resourceId||'—'}}</p></div>
          <time class="pq-activity-time shrink-0 text-right text-xs font-semibold text-[#55749c]" :datetime="r.createdAt">{{time(r.createdAt)}}</time>
        </li>
      </ol>
      <div class="pq-activity-pagination mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-blue-100 pt-4 text-sm text-[#47648a]">
        <span>Hiển thị {{startIndex}}–{{endIndex}} / {{total}} · Trang {{page}}/{{totalPages}}</span>
        <div class="flex gap-2"><button class="pq-icon-button" :disabled="page<=1||loading" aria-label="Trang trước" @click="turnPage(page-1)"><ChevronLeft :size="18"/></button><button class="pq-icon-button" :disabled="page>=totalPages||loading" aria-label="Trang sau" @click="turnPage(page+1)"><ChevronRight :size="18"/></button></div>
      </div>
      <p class="mt-2 text-xs text-[#6782a4]">“Xuất trang” chỉ xuất trang đang xem. “Xuất theo bộ lọc” lấy tối đa 1.000 bản ghi mới nhất từ API theo bộ lọc hiện tại; không gồm hoạt động của tài khoản khác.</p>
    </section>
  </div>
</template>

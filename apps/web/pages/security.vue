<script setup lang="ts">
import {ShieldAlert,ShieldCheck,RefreshCw,CheckCheck,Clock3,AlertTriangle,Info,Search,
  ChevronLeft,ChevronRight,FilterX,Eye,EyeOff,Shield,Activity,LoaderCircle} from 'lucide-vue-next';
type Alert={id:string;eventType:string;riskScore:number;reason:string;createdAt:string;acknowledgedAt:string|null};
type Paged={items:Alert[];total:number;page:number;pageSize:number;summary:{unread:number;critical:number}};
const alerts=ref<Alert[]>([]),loading=ref(true),error=ref(''),success=ref(''),working=ref('');
const summary=ref({unread:0,critical:0}),total=ref(0),page=ref(1),pageSize=12;
const status=ref('unread'),severity=ref('all'),search=ref(''),period=ref('all');
const labels:Record<string,string>={UNFAMILIAR_BROWSER:'Trình duyệt chưa từng ghi nhận',DOWNLOAD_BURST:'Tải tệp liên tiếp',DENIED_BURST:'Nhiều lần truy cập bị từ chối'};
const pages=computed(()=>Math.max(1,Math.ceil(total.value/pageSize)));
const date=(v:string)=>new Date(v).toLocaleString('vi-VN',{dateStyle:'short',timeStyle:'short'});
const level=(score:number)=>score>=80?'Nghiêm trọng':score>=60?'Cao':'Trung bình';
let seq=0;let searchTimer:ReturnType<typeof setTimeout>|undefined;
async function load(){
 const thisRun=++seq;loading.value=true;error.value='';
 const params=new URLSearchParams({page:String(page.value),size:String(pageSize),status:status.value,severity:severity.value});
 if(search.value.trim())params.set('q',search.value.trim());
 if(period.value!=='all')params.set('from',new Date(Date.now()-Number(period.value)*86_400_000).toISOString().slice(0,10));
 try{const result=await requestApi<Paged>(`/security/alerts/paged?${params}`);
  if(thisRun!==seq)return;
  alerts.value=result.items;total.value=result.total;summary.value=result.summary;
  if(page.value>pages.value){page.value=pages.value;void load();}
 }catch(e:any){if(thisRun===seq){alerts.value=[];error.value=e?.message||'Không thể tải sự kiện an ninh.';}}
 finally{if(thisRun===seq)loading.value=false;}
}
function resetPage(){page.value=1;void load();}
watch([status,severity,period],resetPage);
watch(search,()=>{if(searchTimer)clearTimeout(searchTimer);searchTimer=setTimeout(resetPage,350);});
function changePage(next:number){if(next<1||next>pages.value||loading.value)return;page.value=next;void load();}
function clearFilters(){search.value='';status.value='unread';severity.value='all';period.value='all';resetPage();}
async function acknowledge(item:Alert){
 if(working.value)return;
 working.value=item.id;error.value='';success.value='';
 try{await requestApi(`/security/alerts/${item.id}/ack`,{method:'PATCH',body:'{}'});
  success.value='Đã ghi nhận việc xem xét cảnh báo.';await load();
 }catch(e:any){error.value=e?.message||'Không thể cập nhật cảnh báo';}
 finally{working.value='';}
}
async function acknowledgeAll(){
 if(!summary.value.unread||working.value||!confirm(`Đánh dấu đã xem xét toàn bộ ${summary.value.unread} cảnh báo chưa xử lý của bạn? Thao tác này không xóa nhật ký.`))return;
 working.value='all';error.value='';success.value='';
 try{const result=await requestApi<{updated:number}>('/security/alerts/acknowledge-all',{method:'PATCH',body:'{}'});
  success.value=`Đã đánh dấu ${result.updated} cảnh báo. Nhật ký vẫn được lưu lại.`;await load();
 }catch(e:any){error.value=e?.message||'Không thể cập nhật các cảnh báo';}
 finally{working.value='';}
}
onMounted(load);
onBeforeUnmount(()=>{seq++;if(searchTimer)clearTimeout(searchTimer);});
</script>
<template>
 <div class="pq-container pq-refined-page pq-library-pattern pq-space-optimized pq-refined-security pq-ops-page space-y-5 py-7 sm:py-9">
  <PageHeading eyebrow="GIÁM SÁT THEO THỜI GIAN" title="Trung tâm giám sát an ninh"
   description="Theo dõi dấu hiệu truy cập bất thường từ nhật ký tài khoản. Nội dung tệp được mã hóa không bị gửi cho bộ giám sát.">
   <template #icon><ShieldAlert :size="34"/></template>
   <template #actions><button type="button" :disabled="loading" @click="load"><RefreshCw :size="17" :class="loading?'animate-spin':''"/> Cập nhật</button></template>
  </PageHeading>
  <div class="pq-ops-stats">
   <article class="pq-ops-stat"><div class="pq-ops-stat-icon"><EyeOff :size="23"/></div><p>Chưa xem xét</p><strong>{{summary.unread}}</strong><small>Cần xác minh nguyên nhân</small></article>
   <article class="pq-ops-stat pq-ops-stat-warn"><div class="pq-ops-stat-icon"><AlertTriangle :size="23"/></div><p>Nghiêm trọng chưa xử lý</p><strong>{{summary.critical}}</strong><small>Điểm rủi ro từ 80 trở lên</small></article>
   <article class="pq-ops-stat"><div class="pq-ops-stat-icon"><Activity :size="23"/></div><p>Kết quả theo bộ lọc</p><strong>{{total}}</strong><small>Phân trang từ máy chủ</small></article>
  </div>
  <div v-if="error" class="pq-alert pq-alert-error" role="alert">{{error}} <button type="button" class="font-bold underline" @click="load">Thử lại</button></div>
  <div v-if="success" class="pq-alert pq-alert-success" role="status">{{success}}</div>
  <section class="soft-card pq-ops-panel">
   <div class="pq-ops-panel-head"><div><h2>Danh sách cảnh báo</h2><p>Lọc theo tình trạng, mức nguy cơ và nội dung cảnh báo.</p></div>
    <button class="pq-icon-button" type="button" :disabled="working!==''||loading||!summary.unread" @click="acknowledgeAll"><CheckCheck :size="17"/> Đánh dấu tất cả đã xem xét</button>
   </div>
   <div class="pq-ops-filter-grid pq-ops-filters-four">
    <label class="pq-ops-search"><span class="form-label">Tìm kiếm</span><span class="pq-ops-search-inner"><Search :size="18"/><input v-model="search" class="pq-field" maxlength="100" type="search" placeholder="Dấu hiệu, loại hành vi..."/></span></label>
    <label><span class="form-label">Trạng thái</span><select v-model="status" class="pq-field"><option value="unread">Chưa xem xét</option><option value="reviewed">Đã xem xét</option><option value="all">Tất cả</option></select></label>
    <label><span class="form-label">Mức nguy cơ</span><select v-model="severity" class="pq-field"><option value="all">Tất cả mức</option><option value="critical">Nghiêm trọng (80–100)</option><option value="high">Cao (60–79)</option><option value="medium">Trung bình (40–59)</option></select></label>
    <label><span class="form-label">Thời gian</span><select v-model="period" class="pq-field"><option value="all">Toàn bộ</option><option value="7">7 ngày</option><option value="30">30 ngày</option><option value="90">90 ngày</option></select></label>
   </div>
   <div class="pq-ops-toolbar"><span>{{total}} cảnh báo phù hợp</span><button type="button" class="pq-ops-text-action" @click="clearFilters"><FilterX :size="16"/> Đặt lại bộ lọc</button></div>
   <div v-if="loading" class="pq-ops-loading" role="status"><LoaderCircle :size="22" class="animate-spin"/> Đang truy xuất sự kiện...</div>
   <div v-else-if="!alerts.length" class="pq-empty"><ShieldCheck :size="40" class="text-emerald-600"/><h3>Không có cảnh báo phù hợp</h3><p>Thử thay đổi bộ lọc hoặc chọn “Tất cả” để xem sự kiện đã xử lý.</p></div>
   <ol v-else class="pq-ops-list pq-compact-security-list" tabindex="0" aria-label="Các cảnh báo an ninh, cuộn để xem thêm">
    <li v-for="item in alerts" :key="item.id" class="pq-ops-record pq-ops-incident" :class="item.riskScore>=80?'pq-ops-incident-critical':''">
     <div class="pq-ops-record-icon"><AlertTriangle v-if="item.riskScore>=80" :size="21"/><Shield v-else :size="21"/></div>
     <div class="pq-ops-record-body"><div class="pq-ops-record-title"><strong>{{labels[item.eventType]||item.eventType}}</strong><span class="pq-ops-risk" :class="item.riskScore>=80?'pq-ops-risk-critical':item.riskScore>=60?'pq-ops-risk-high':''">{{level(item.riskScore)}} · {{item.riskScore}}/100</span></div>
      <p>{{item.reason}}</p><time :datetime="item.createdAt"><Clock3 :size="14"/> {{date(item.createdAt)}}</time>
     </div>
     <button v-if="!item.acknowledgedAt" class="pq-icon-button pq-ops-record-button" type="button" :disabled="!!working" @click="acknowledge(item)"><CheckCheck :size="16"/> {{working===item.id?'Đang lưu...':'Đã xem xét'}}</button>
     <span v-else class="pq-ops-reviewed"><CheckCheck :size="16"/> Đã xem xét</span>
    </li>
   </ol>
   <div class="pq-ops-pagination"><span>Trang {{page}}/{{pages}} · {{total}} cảnh báo</span><div><button type="button" class="pq-icon-button" aria-label="Trang trước" :disabled="loading||page<=1" @click="changePage(page-1)"><ChevronLeft :size="18"/></button><button type="button" class="pq-icon-button" aria-label="Trang sau" :disabled="loading||page>=pages" @click="changePage(page+1)"><ChevronRight :size="18"/></button></div></div>
  </section>
  <div class="pq-ops-info"><Info :size="20"/><p>Đây là phát hiện dựa trên quy tắc/ngưỡng (không phải mô hình ML đã huấn luyện). “Đã xem xét” chỉ ghi nhận trạng thái; không khóa tài khoản hoặc thu hồi quyền. Nếu cần xử lý quyền chia sẻ, hãy vào <NuxtLink to="/governance">Quản trị quyền</NuxtLink>. Chuỗi User-Agent không bảo đảm nhận diện thiết bị.</p></div>
 </div>
</template>

<script setup lang="ts">
import {
  Folder,FolderOpen,FolderHeart,UsersRound,Share2,FileText,FileArchive,FileSpreadsheet,
  Presentation,Image as ImageIcon,File,Search,CalendarDays,SlidersHorizontal,ChevronDown,
  Eye,Download,MoreHorizontal,ChevronLeft,ChevronRight,Plus,Minus,Maximize2,Info,X,
  LoaderCircle,Trash2,RotateCcw,Pencil,LockKeyhole,
  ShieldCheck,UploadCloud,RefreshCw,ShieldAlert,AlertTriangle,EyeOff,BrainCircuit
} from 'lucide-vue-next';
import { decryptFile,unwrapCek,wrapCek } from '@pqfile/crypto-core';
import { nextTick } from 'vue';
import { getUnlockedVault } from '~/utils/vault-session';
import {analyzeFile, CLASSIFICATIONS, canRedact, redactedCopy, shareRisk} from '~/utils/security-analysis';
import type {DocumentScan,Classification} from '~/utils/security-analysis';
import {insightFromFile} from '~/utils/local-intelligence';
import type {Insight} from '~/utils/local-intelligence';
import {prepareLocalPreview,isPreviewBlocked} from '~/utils/local-preview';
import type {LocalPreview} from '~/utils/local-preview';

type LibraryTab='all'|'received'|'sent'|'trash';
type FileItem={
  id:string;ownerId:string;displayLabel:string;cipherSize:number;createdAt:string;
  deletedAt?:string|null;sharedAt?:string|null;expiresAt?:string|null;
  ownerName?:string|null;ownerEmail?:string|null;permission?:string|null;
  recipientCount?:number;envelope?:any;iv?:string;manifest?:any;
  signature?:string;signerPublicKey?:string;sourceType?:string;
};
type LibraryResponse={items:FileItem[];counts:{all:number;received:number;sent:number}};
type Grant={email:string;displayName:string;sharedWith:string;revokedAt?:string|null;expiresAt?:string|null};
type Recipient={id:string;email:string;displayName:string;key:{id:string;algorithm:any;publicKey:string;fingerprint:string;x25519Public?:string|null;x25519KeyId?:string|null}};
type PreviewData=LocalPreview & {id:string};

const {user}=useAuth();
const route=useRoute();
const library=ref<FileItem[]>([]),trash=ref<FileItem[]>([]);
const counts=ref({all:0,received:0,sent:0});
const loading=ref(true),error=ref(''),success=ref(''),working=ref('');
const tab=ref<LibraryTab>('all');
const search=ref(''),dateFilter=ref('all'),typeFilter=ref('all'),sortBy=ref('newest');
const page=ref(1),pageSize=5,selectedId=ref<string|null>(null),menuId=ref<string|null>(null);
const detailsTab=ref<'preview'|'info'>('preview');
const mobileDetailsOpen=ref(false);
const filterExpanded=ref(false);
const fileListScroll=ref<HTMLElement|null>(null);
const preview=ref<PreviewData|null>(null),previewBusy=ref(''),previewPage=ref(1),zoom=ref(100);
const previewSheetIndex=ref(0),markdownMode=ref<'reader'|'source'>('reader');
const previewInsight=ref<Insight|null>(null),insightBusy=ref(false);
const modal=ref<'rename'|'share'|null>(null),editing=ref<FileItem|null>(null),editLabel=ref('');
const recipientEmail=ref(''),foundRecipients=ref<Recipient[]>([]),chosenRecipient=ref<Recipient|null>(null);
const shareExpiry=ref(''),shareGrants=ref<Grant[]>([]),shareLoading=ref(false);
const shareScanFileName=ref('');
const shareScan=ref<DocumentScan|null>(null),shareScanBusy=ref(false),shareClass=ref<Classification|null>(null);
const shareChecked=ref(false),shareScanError=ref(''),securitySummary=ref({unread:0,critical:0});
const activeGrants=computed(()=>shareGrants.value.filter(grantIsActive).length);
const effectiveShareClass=computed<Classification>(()=>{
 const manual=shareClass.value||'Nội bộ',suggested=shareScan.value?.suggestion||'Nội bộ';
 return CLASSIFICATIONS[Math.max(CLASSIFICATIONS.indexOf(manual),CLASSIFICATIONS.indexOf(suggested))];
});
const shareRiskValue=computed(()=>shareRisk({classification:effectiveShareClass.value,
 recipients:activeGrants.value+1,days:shareExpiry.value?Math.max(0,Math.ceil((new Date(shareExpiry.value).getTime()-Date.now())/86_400_000)):null,
 alerts:securitySummary.value.unread,scanStatus:shareScan.value?.status||'unsupported',isNewRecipient:true}));
const shareMustReview=computed(()=>shareScan.value?.status!=='complete'||shareRiskValue.value.score>=55);
watch([shareExpiry,chosenRecipient,shareClass],()=>{shareChecked.value=false;});
function defaultExpiry(){const time=new Date(Date.now()+7*86_400_000);const local=new Date(time.getTime()-time.getTimezoneOffset()*60_000);return local.toISOString().slice(0,16);}

let previewNonce=0;
let shareScanNonce=0;

const fileType=(f:FileItem)=>{
  const name=f.displayLabel.toLowerCase().trim(),ext=name.split('.').pop()||'';
  if(ext==='pdf')return 'pdf';
  if(['md','mdown','markdown'].includes(ext))return 'markdown';
  if(['doc','docx','odt','rtf'].includes(ext))return 'doc';
  if(['xls','xlsx','csv','ods'].includes(ext))return 'sheet';
  if(['ppt','pptx','odp'].includes(ext))return 'slides';
  if(['jpg','jpeg','png','gif','webp','bmp','svg'].includes(ext))return 'image';
  if(['zip','rar','7z','tar','gz'].includes(ext))return 'archive';
  return 'other';
};
const fileTypeName=(f:FileItem)=>({pdf:'PDF',doc:'DOC',sheet:'XLS',slides:'PPT',image:'IMG',archive:'ZIP',markdown:'MD',other:'FILE'} as Record<string,string>)[fileType(f)]||'FILE';
const fileIcon=(f:FileItem)=>( {pdf:FileText,doc:FileText,sheet:FileSpreadsheet,slides:Presentation,image:ImageIcon,archive:FileArchive,markdown:FileText,other:File} as Record<string,typeof File> )[fileType(f)]||File;
const isMine=(f:FileItem)=>f.ownerId===user.value?.id;
const formatSize=(v:number)=>v<1024?`${v} B`:v<1048576?`${(v/1024).toFixed(1)} KB`:`${(v/1048576).toFixed(1)} MB`;
const formatDate=(v?:string|null)=>v?new Date(v).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
const recordDate=(f:FileItem)=>f.deletedAt&&tab.value==='trash'?f.deletedAt:(f.sharedAt||f.createdAt);
const permissionName=(f:FileItem)=>tab.value==='trash'?'Đã xóa':isMine(f)?'Chủ sở hữu':f.permission==='FILE_DOWNLOAD'?'Có thể tải xuống':'Quyền truy cập tệp';
const viewTitle=computed(()=>({all:'Thư viện tệp mã hóa',received:'Được chia sẻ với tôi',sent:'Tôi đã chia sẻ',trash:'Thùng rác'} as Record<LibraryTab,string>)[tab.value]);
const viewSubtitle=computed(()=>({all:'Tất cả các tệp bạn sở hữu hoặc được cấp quyền truy cập.',received:'Các tệp tin mà người khác đã chia sẻ cho bạn.',sent:'Những tệp mã hóa bạn đã chia sẻ cho người khác.',trash:'Các tệp đã xóa mà bạn có thể khôi phục.'} as Record<LibraryTab,string>)[tab.value]);
const filtered=computed(()=>{
  const source=tab.value==='trash'?trash.value:library.value.filter(f=>tab.value==='all'||(tab.value==='received'?!isMine(f):isMine(f)&&(f.recipientCount||0)>0));
  const q=search.value.trim().toLocaleLowerCase('vi');
  const now=Date.now(),maxAge=({week:7,month:30,quarter:90} as Record<string,number>)[dateFilter.value];
  const results=source.filter(f=>{
    if(q&&!`${f.displayLabel} ${f.ownerName||''} ${f.ownerEmail||''}`.toLocaleLowerCase('vi').includes(q))return false;
    if(typeFilter.value!=='all'&&fileType(f)!==typeFilter.value)return false;
    if(maxAge&&(now-new Date(recordDate(f)).getTime())>maxAge*86_400_000)return false;
    return true;
  });
  return results.sort((a,b)=>{
    if(sortBy.value==='name')return a.displayLabel.localeCompare(b.displayLabel,'vi');
    if(sortBy.value==='size')return b.cipherSize-a.cipherSize;
    const diff=new Date(recordDate(b)).getTime()-new Date(recordDate(a)).getTime();
    return sortBy.value==='oldest'?-diff:diff;
  });
});
const maxPage=computed(()=>Math.max(1,Math.ceil(filtered.value.length/pageSize)));
const pageNumbers=computed(()=>Array.from({length:maxPage.value},(_,i)=>i+1).filter(n=>maxPage.value<=5||n===1||n===maxPage.value||Math.abs(n-page.value)<=1));
const paged=computed(()=>filtered.value.slice((page.value-1)*pageSize,page.value*pageSize));
const selected=computed(()=>[...library.value,...trash.value].find(f=>f.id===selectedId.value)||null);
const firstIndex=computed(()=>filtered.value.length?(page.value-1)*pageSize+1:0);
const lastIndex=computed(()=>Math.min(page.value*pageSize,filtered.value.length));
const pdfSrc=computed(()=>preview.value?.kind==='pdf'?`${preview.value.url}#page=${previewPage.value}&zoom=${zoom.value}`:'');
watch([tab,search,dateFilter,typeFilter,sortBy],()=>{page.value=1;menuId.value=null;fileListScroll.value?.scrollTo({top:0});});
watch(page,()=>{menuId.value=null;fileListScroll.value?.scrollTo({top:0});});
watch(tab,()=>{mobileDetailsOpen.value=false;});
watch(mobileDetailsOpen,(open)=>{
  if(typeof document!=='undefined')document.body.classList.toggle('pq-file-drawer-open',open);
});
watch(maxPage,(n:number)=>{if(page.value>n)page.value=n;});
watch(paged,(rows:FileItem[])=>{if(!rows.some(f=>f.id===selectedId.value)){selectedId.value=rows[0]?.id||null;closePreview();}}, {immediate:true});
watch(selectedId,(v:string|null,prev:string|null)=>{if(v!==prev)closePreview();detailsTab.value='preview';});

function notifyFailure(e:any){error.value=e?.message||'Không thể hoàn tất thao tác.';success.value='';}
function resetNotice(){error.value='';success.value='';}
async function load(){
  loading.value=true;
  try{
    const [response,bin]=await Promise.all([requestApi<LibraryResponse>('/files/library'),requestApi<FileItem[]>('/files/trash')]);
    library.value=response.items;counts.value=response.counts;trash.value=bin;
    error.value='';
  }catch(e:any){notifyFailure(e);}finally{loading.value=false;}
}
watch(()=>route.query.tab,requested=>{
  if(typeof requested==='string'&&['all','received','sent','trash'].includes(requested))
    selectTab(requested as LibraryTab, false);
},{immediate:true});
onMounted(()=>{document.body.classList.add('pq-files-workspace-fixed');void load();});
function choose(f:FileItem){menuId.value=null;selectedId.value=f.id;}
function isCompactFileLayout(){return typeof window!=='undefined'&&window.matchMedia('(max-width:1430px)').matches;}
function openDetailsDrawer(){
  if(!isCompactFileLayout())return;
  mobileDetailsOpen.value=true;
  // Focus the close control for keyboard and screen-reader navigation.
  void nextTick(()=>document.querySelector<HTMLButtonElement>('.preview-panel .preview-close')?.focus());
}
async function chooseMobile(f:FileItem){choose(f);await nextTick();detailsTab.value='info';openDetailsDrawer();}
function closeDetails(){mobileDetailsOpen.value=false;selectedId.value=null;closePreview();}
function closePreview(){previewInsight.value=null;previewNonce++;if(preview.value?.url)URL.revokeObjectURL(preview.value.url);preview.value=null;previewBusy.value='';previewPage.value=1;zoom.value=100;previewSheetIndex.value=0;markdownMode.value='reader';}
onBeforeUnmount(()=>{closePreview();if(typeof document!=='undefined'){document.body.classList.remove('pq-file-drawer-open');document.body.classList.remove('pq-files-workspace-fixed');}});
async function decrypt(f:FileItem){
  const vault=getUnlockedVault();if(!vault)throw new Error('Hãy mở kho khóa trong mục Khóa mật mã trước khi xem hoặc tải tệp.');
  // The list endpoint only returns summaries. Read the complete, access-checked
  // manifest and recipient envelope for this single file, on demand.
  const full=await requestApi<FileItem>(`/files/${encodeURIComponent(f.id)}`);
  if(!full.envelope)throw new Error('Tài khoản chưa có khóa nội dung hợp lệ của tệp.');
  const res=await fetch(`/api/files/${encodeURIComponent(f.id)}/blob`,{credentials:'include',cache:'no-store'});
  if(!res.ok)throw new Error('Không thể truy cập tệp: quyền đã hết hạn, bị thu hồi hoặc máy chủ gặp lỗi.');
  const ciphertext=new Uint8Array(await res.arrayBuffer());
  return decryptFile(ciphertext,full as any,vault);
}
async function openPreview(f:FileItem){
  resetNotice();choose(f);detailsTab.value='preview';openDetailsDrawer();
  // Flush selection watchers before starting a new decrypt job, otherwise
  // their cleanup can invalidate the preview nonce after decrypt starts.
  await nextTick();
  if(selectedId.value!==f.id)return;
  if(tab.value==='trash'){error.value='Khôi phục tệp trước khi xem trước.';return;}
  closePreview();
  if(isPreviewBlocked(f.displayLabel)){
    error.value='Tệp nén hoặc thư mục không hỗ trợ xem trước; bạn vẫn có thể tải về.';return;
  }
  const nonce=++previewNonce;
  previewBusy.value=f.id;
  try{
    // Decrypt verifies the signed manifest and ciphertext before any renderer runs.
    const result=await decrypt(f);
    if(nonce!==previewNonce)return;
    const content=await prepareLocalPreview(result.name,result.blob);
    if(nonce!==previewNonce){if(content.url)URL.revokeObjectURL(content.url);return;}
    preview.value={...content,id:f.id};
    success.value=content.kind==='binary'||content.kind==='blocked'
      ?'Đã kiểm tra chữ ký và giải mã; định dạng này chưa có bộ đọc nội dung an toàn.'
      :'Đã xác minh chữ ký và giải mã cục bộ để xem trước. Không gửi nội dung bản rõ lên máy chủ.';
  }catch(e:any){if(nonce===previewNonce)notifyFailure(e);}
  finally{if(nonce===previewNonce)previewBusy.value='';}
}
async function summarizePreview(f:FileItem){
 if(insightBusy.value)return;
 const nonce=previewNonce;insightBusy.value=true;
 try{
  const decrypted=await decrypt(f);
  if(nonce!==previewNonce||selectedId.value!==f.id)return;
  const result=await insightFromFile(new File([decrypted.blob],decrypted.name));
  if(nonce===previewNonce)previewInsight.value=result;
 }catch(e:any){if(nonce===previewNonce)notifyFailure(e);}
 finally{insightBusy.value=false;}
}
async function download(f:FileItem){
  resetNotice();working.value=f.id;
  try{
    const result=await decrypt(f);
    const url=URL.createObjectURL(result.blob);
    const link=document.createElement('a');link.href=url;link.download=result.name||'tep-da-giai-ma';
    document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),15_000);
    success.value='Đã xác minh chữ ký và tải tệp sau khi giải mã trên thiết bị.';
  }catch(e:any){notifyFailure(e);}finally{working.value='';}
}
function fullscreen(){
  const el=document.getElementById('pq-file-viewer');
  if(el&&'requestFullscreen' in el)el.requestFullscreen().catch(()=>{error.value='Trình duyệt không hỗ trợ chế độ toàn màn hình.';});
}
function adjustZoom(diff:number){zoom.value=Math.max(50,Math.min(200,zoom.value+diff));}
function selectTab(t:LibraryTab, updateUrl=true){
  if(tab.value!==t){
    tab.value=t;
    mobileDetailsOpen.value=false;
    closePreview();
    selectedId.value=null;
  }
  // Keep the route in sync so the sidebar can always reopen the full encrypted library.
  if(updateUrl&&route.query.tab!==t){
    void navigateTo({path:'/files',query:{...route.query,tab:t}},{replace:true});
  }
}
async function trashFile(f:FileItem){
  if(!confirm(`Chuyển “${f.displayLabel}” vào thùng rác?`))return;
  working.value=f.id;resetNotice();
  try{await requestApi(`/files/${f.id}`,{method:'DELETE'});await load();success.value='Đã chuyển tệp vào thùng rác.';}catch(e:any){notifyFailure(e);}finally{working.value='';}
}
async function restore(f:FileItem){working.value=f.id;resetNotice();try{await requestApi(`/files/${f.id}/restore`,{method:'POST'});await load();success.value='Đã khôi phục tệp.';}catch(e:any){notifyFailure(e);}finally{working.value='';}}
async function erase(f:FileItem){
  if(!confirm(`Xóa vĩnh viễn “${f.displayLabel}”? Không thể hoàn tác.`))return;
  working.value=f.id;resetNotice();try{await requestApi(`/files/${f.id}/permanent`,{method:'DELETE'});await load();success.value='Đã xóa vĩnh viễn dữ liệu mã hóa.';}catch(e:any){notifyFailure(e);}finally{working.value='';}
}
function openRename(f:FileItem){mobileDetailsOpen.value=false;editing.value=f;editLabel.value=f.displayLabel;modal.value='rename';menuId.value=null;resetNotice();}
async function rename(){
  if(!editing.value||!editLabel.value.trim())return;
  working.value=editing.value.id;resetNotice();
  try{await requestApi(`/files/${editing.value.id}/label`,{method:'PATCH',body:JSON.stringify({label:editLabel.value.trim()})});modal.value=null;editing.value=null;await load();success.value='Đã đổi nhãn hiển thị tệp.';}catch(e:any){notifyFailure(e);}finally{working.value='';}
}
async function openShare(f:FileItem){
  const shareNonce=++shareScanNonce;
  mobileDetailsOpen.value=false;editing.value=f;modal.value='share';menuId.value=null;resetNotice();
  recipientEmail.value='';foundRecipients.value=[];chosenRecipient.value=null;shareExpiry.value=defaultExpiry();shareLoading.value=true;shareScan.value=null;shareScanFileName.value='';shareScanBusy.value=true;shareClass.value=null;shareChecked.value=false;shareScanError.value='';
  try{shareGrants.value=await requestApi<Grant[]>(`/files/${f.id}/shares`);}catch(e:any){notifyFailure(e);}finally{shareLoading.value=false;}
  try{securitySummary.value=await requestApi('/security/summary');}catch{ /* local risk remains available */ }
  try{
    const result=await decrypt(f);
    if(shareNonce!==shareScanNonce||editing.value?.id!==f.id||modal.value!=='share')return;
    const scan=await analyzeFile(new File([result.blob],result.name));
    if(shareNonce!==shareScanNonce||editing.value?.id!==f.id||modal.value!=='share')return;
    shareScan.value=scan;shareScanFileName.value=result.name;
    if(scan.status==='complete')shareClass.value=scan.suggestion;
  }catch(e:any){if(shareNonce===shareScanNonce)shareScanError.value=e?.message||'Không giải mã được để phân loại';}
  finally{if(shareNonce===shareScanNonce)shareScanBusy.value=false;}
}
async function findRecipient(){
  if(recipientEmail.value.trim().length<3)return;
  chosenRecipient.value=null;resetNotice();
  try{foundRecipients.value=await requestApi<Recipient[]>(`/users/search?q=${encodeURIComponent(recipientEmail.value.trim())}`);if(!foundRecipients.value.length)error.value='Không tìm thấy người dùng có khóa công khai phù hợp.';}catch(e:any){notifyFailure(e);}
}
async function createShare(){
  if(!editing.value||!chosenRecipient.value)return;
  if(shareScanBusy.value){error.value='Đang phân tích tệp. Hãy thử lại sau khi hoàn thành.';return;}
  if(!shareClass.value){error.value='Hãy chọn mức bảo mật thủ công nếu tệp không quét được.';return;}
  if(shareMustReview.value&&!shareChecked.value){error.value='Hãy xác nhận đã xem xét cảnh báo rủi ro trước khi chia sẻ.';return;}
  const f=editing.value,person=chosenRecipient.value,vault=getUnlockedVault();
  if(!vault){error.value='Hãy mở kho khóa để cấp quyền chia sẻ.';return;}
  if(shareExpiry.value&&new Date(shareExpiry.value).getTime()<=Date.now()){error.value='Ngày hết hạn phải nằm trong tương lai.';return;}
  working.value=f.id;resetNotice();let cek:Uint8Array|null=null;
  try{
    const full=await requestApi<FileItem>(`/files/${encodeURIComponent(f.id)}`);
    if(!full.envelope)throw new Error('Không có khóa nội dung của tệp.');
    cek=await unwrapCek(f.id,full.envelope,vault);
    const hybrid=!!full.envelope?.hybridEphemeralPublic;
    if(hybrid&&!person.key.x25519Public)throw new Error('Tệp được mã hóa lai: người nhận phải kích hoạt X25519 trước khi chia sẻ.');
    const envelope=await wrapCek(cek,f.id,{userId:person.id,keyId:person.key.id,algorithm:person.key.algorithm,publicKey:person.key.publicKey,
      x25519Public:person.key.x25519Public,x25519KeyId:person.key.x25519KeyId},hybrid?'HYBRID':'PQC');
    await requestApi(`/files/${f.id}/shares`,{method:'POST',body:JSON.stringify({recipientId:person.id,envelope,...(shareExpiry.value?{expiresAt:new Date(shareExpiry.value).toISOString()}:{})})});
    shareGrants.value=await requestApi<Grant[]>(`/files/${f.id}/shares`);
    chosenRecipient.value=null;recipientEmail.value='';foundRecipients.value=[];shareExpiry.value=defaultExpiry();shareChecked.value=false;
    await load();success.value=`Đã chia sẻ tệp với ${person.email}.`;
  }catch(e:any){notifyFailure(e);}finally{cek?.fill(0);working.value='';}
}
async function revokeShare(g:Grant){
  if(!editing.value||!confirm(`Thu hồi quyền truy cập của ${g.email}?`))return;
  working.value=g.sharedWith;resetNotice();
  try{await requestApi(`/files/${editing.value.id}/shares/${g.sharedWith}`,{method:'DELETE'});shareGrants.value=await requestApi<Grant[]>(`/files/${editing.value.id}/shares`);await load();success.value='Đã thu hồi quyền truy cập trên máy chủ.';}catch(e:any){notifyFailure(e);}finally{working.value='';}
}
async function downloadRedacted(){
 const f=editing.value;if(!f||!shareScan.value||!canRedact(shareScanFileName.value,shareScan.value))return;
 // Read original extension from the signed, decrypted file. Never alter a stored ciphertext.
 working.value=f.id;
 try{
  const result=await decrypt(f);const source=new File([result.blob],result.name);
  const updatedScan=await analyzeFile(source);
  const copy=redactedCopy(source,updatedScan);
  const url=URL.createObjectURL(copy);const link=document.createElement('a');link.href=url;link.download=copy.name;
  document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10_000);
  success.value='Đã lưu bản sao che dữ liệu trên máy; hãy tải lên bản sao này để chia sẻ thay tệp gốc.';
 }catch(e:any){notifyFailure(e);}finally{working.value='';}
}
const grantIsActive=(g:Grant)=>!g.revokedAt&&(!g.expiresAt||new Date(g.expiresAt).getTime()>Date.now());
</script>

<template>
  <div class="file-portal text-[#091b64]" @keydown.esc="menuId=null;mobileDetailsOpen && closeDetails()">
    <section class="share-hero" aria-label="Thư viện tệp tin">
      <div class="hero-photo" aria-hidden="true"></div>
      <div class="hero-wave" aria-hidden="true"></div>
      <div class="hero-inner">
        <div class="hero-icon"><FolderHeart :size="53" stroke-width="1.7"/></div>
        <div class="hero-copy min-w-0"><span class="hero-eyebrow">THƯ VIỆN BẢO MẬT</span><h1>{{viewTitle}}</h1><p>{{viewSubtitle}}</p></div>
        <NuxtLink to="/upload" class="hero-upload-action" aria-label="Tải lên và mã hóa tệp mới">
          <UploadCloud :size="21" aria-hidden="true" />
          <span>Tải lên &amp; mã hóa tệp</span>
        </NuxtLink>
      </div>
    </section>

    <div class="portal-layout">
      <section class="portal-left" aria-label="Danh sách tệp">
        <div class="library-tabs" role="tablist" aria-label="Phân loại tệp">
          <button role="tab" :aria-selected="tab==='all'" :class="{'tab-active':tab==='all'}" @click="selectTab('all')"><Folder :size="21"/>Tất cả ({{counts.all}})</button>
          <button role="tab" :aria-selected="tab==='received'" :class="{'tab-active':tab==='received'}" @click="selectTab('received')"><UsersRound :size="22"/>Được chia sẻ với tôi ({{counts.received}})</button>
          <button role="tab" :aria-selected="tab==='sent'" :class="{'tab-active':tab==='sent'}" @click="selectTab('sent')"><Share2 :size="22"/>Tôi đã chia sẻ ({{counts.sent}})</button>
          <button class="trash-tab" role="tab" :aria-selected="tab==='trash'" :class="{'tab-active':tab==='trash'}" title="Thùng rác" @click="selectTab('trash')"><Trash2 :size="18"/><span>Thùng rác ({{trash.length}})</span></button>
        </div>

        <div class="library-card">
          <div class="library-section-heading"><div><h2>Danh sách tài liệu</h2><p>{{filtered.length}} tệp phù hợp · Chọn tệp để xem thông tin hoặc xem trước an toàn</p></div><ShieldCheck :size="19" aria-label="Dữ liệu được bảo vệ" /></div>
          <div class="filter-bar" :class="{'filter-expanded':filterExpanded}">
            <label class="filter-search"><Search :size="22"/><input v-model="search" placeholder="Tìm theo tên tệp, người chia sẻ..." aria-label="Tìm kiếm tệp"/></label>
            <button type="button" class="filter-toggle" :aria-expanded="filterExpanded" aria-controls="pq-file-extra-filters" @click="filterExpanded=!filterExpanded"><SlidersHorizontal :size="16"/> Bộ lọc <ChevronDown :size="14" :class="{'filter-toggle-open':filterExpanded}"/></button>
            <div id="pq-file-extra-filters" class="filter-extra">
            <label class="filter-select"><CalendarDays :size="19"/><select v-model="dateFilter" aria-label="Lọc theo thời gian"><option value="all">Tất cả thời gian</option><option value="week">7 ngày gần đây</option><option value="month">30 ngày gần đây</option><option value="quarter">90 ngày gần đây</option></select><ChevronDown :size="17"/></label>
            <label class="filter-select"><File :size="19"/><select v-model="typeFilter" aria-label="Lọc theo loại tệp"><option value="all">Tất cả loại tệp</option><option value="pdf">PDF</option><option value="doc">Word</option><option value="sheet">Excel</option><option value="slides">PowerPoint</option><option value="image">Hình ảnh</option><option value="archive">Tệp nén</option><option value="markdown">Markdown</option><option value="other">Khác</option></select><ChevronDown :size="17"/></label>
            <label class="filter-select sort-select"><SlidersHorizontal :size="19"/><select v-model="sortBy" aria-label="Sắp xếp"><option value="newest">Mới nhất</option><option value="oldest">Cũ nhất</option><option value="name">Tên A–Z</option><option value="size">Kích thước</option></select><ChevronDown :size="17"/></label>
            </div>
            <button class="refresh-control" title="Làm mới" aria-label="Làm mới danh sách tệp" :disabled="loading" @click="load"><RefreshCw :size="19" :class="{'animate-spin':loading}"/></button>
          </div>
          <div v-if="error" class="pq-alert pq-alert-error mx-5 mt-4" role="alert">{{error}}</div>
          <div v-if="success" class="pq-alert pq-alert-success mx-5 mt-4" role="status">{{success}}</div>

          <div ref="fileListScroll" class="file-list-scroll" role="region" aria-label="Danh sách tài liệu cuộn độc lập" tabindex="0" @scroll.passive="menuId=null">
          <div v-if="loading" class="loading-state"><LoaderCircle :size="34" class="animate-spin text-blue-500"/><p>Đang tải danh sách tệp...</p></div>
          <div v-else-if="!filtered.length" class="empty-library"><FolderOpen :size="58" class="text-[#75aef1]"/><h2>Không có tệp phù hợp</h2><p>{{search||typeFilter!=='all'||dateFilter!=='all'?'Hãy thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.':tab==='received'?'Bạn chưa nhận được tệp chia sẻ nào.':tab==='sent'?'Bạn chưa chia sẻ tệp nào.':tab==='trash'?'Thùng rác đang trống.':'Hãy tải lên và mã hóa tệp đầu tiên của bạn.'}}</p><button v-if="search||typeFilter!=='all'||dateFilter!=='all'" class="pq-icon-button" @click="search='';typeFilter='all';dateFilter='all'">Xóa bộ lọc</button><NuxtLink v-if="tab==='all'&&!search" to="/upload" class="primary-button mt-4 !py-2.5"><UploadCloud :size="18"/>Tải lên &amp; mã hóa tệp</NuxtLink></div>
          <template v-else>
            <div class="file-table-wrap">
              <table class="file-table"><thead><tr><th>Tên tệp tin</th><th>{{tab==='sent'?'Người nhận':tab==='trash'?'Trạng thái':'Người chia sẻ'}}</th><th>{{tab==='trash'?'Thời gian xóa':tab==='received'?'Thời gian chia sẻ':'Thời gian tạo'}}</th><th>Quyền truy cập</th><th class="action-heading">Thao tác</th></tr></thead>
                <tbody><tr v-for="f in paged" :key="f.id" :class="{'file-row-selected':selectedId===f.id}" @click="choose(f)">
                  <td><div class="file-info"><div class="type-icon" :class="'type-'+fileType(f)"><component :is="fileIcon(f)" :size="24"/><span>{{fileTypeName(f)}}</span></div><div class="file-name"><button class="file-name-button" :title="f.displayLabel" :aria-label="'Chọn tệp '+f.displayLabel" @click.stop="choose(f)">{{f.displayLabel}}</button><small>{{formatSize(f.cipherSize)}} <span v-if="f.sourceType==='RESEARCH'" class="pq-research-tag">Dữ liệu nghiên cứu</span></small></div></div></td>
                  <td><div class="person-info"><span class="person-avatar" :class="isMine(f)?'avatar-blue':'avatar-purple'">{{tab==='sent'?'↗':isMine(f)?'T':(f.ownerName||f.ownerEmail||'?').split(' ').map(x=>x[0]).slice(-2).join('').toUpperCase()}}</span><span class="person-name" :title="f.ownerName||f.ownerEmail||''">{{tab==='sent'?`${f.recipientCount||0} người nhận`:isMine(f)?'Tôi':f.ownerName||f.ownerEmail||'Người chia sẻ'}}</span></div></td>
                  <td class="time-cell">{{formatDate(recordDate(f))}}</td>
                  <td><span class="permission-chip" :class="isMine(f)?'owner-chip':'download-chip'"><Eye v-if="!isMine(f)" :size="16"/><ShieldCheck v-else :size="16"/>{{permissionName(f)}}</span></td>
                  <td class="actions-cell"><div class="row-actions">
                    <template v-if="tab!=='trash'"><button title="Xem trước (giải mã cục bộ)" :disabled="!!working||!!previewBusy||isPreviewBlocked(f.displayLabel)" @click.stop="openPreview(f)"><LoaderCircle v-if="previewBusy===f.id" :size="19" class="animate-spin"/><Eye v-else :size="19"/></button><button title="Giải mã và tải xuống" :disabled="!!working||!!previewBusy" @click.stop="download(f)"><LoaderCircle v-if="working===f.id" :size="19" class="animate-spin"/><Download v-else :size="19"/></button></template>
                    <template v-else><button title="Khôi phục" :disabled="!!working" @click.stop="restore(f)"><RotateCcw :size="19"/></button><button title="Xóa vĩnh viễn" :disabled="!!working" @click.stop="erase(f)"><Trash2 :size="19"/></button></template>
                    <div v-if="tab!=='trash'&&isMine(f)" class="more-wrap"><button title="Thao tác khác" :aria-expanded="menuId===f.id" @click.stop="menuId=menuId===f.id?null:f.id"><MoreHorizontal :size="22"/></button><div v-if="menuId===f.id" class="more-menu" @click.stop><button @click="openRename(f)"><Pencil :size="16"/>Đổi nhãn</button><button @click="openShare(f)"><Share2 :size="16"/>Quản lý chia sẻ</button><button class="danger-menu" @click="menuId=null;trashFile(f)"><Trash2 :size="16"/>Chuyển vào thùng rác</button></div></div>
                  </div></td>
                </tr></tbody>
              </table>
            </div>
            <div class="file-mobile-list" aria-label="Danh sách tệp dạng thẻ">
              <article v-for="f in paged" :key="f.id" class="file-mobile-card" :class="{'file-mobile-card--selected':selectedId===f.id,'file-mobile-card--menu':menuId===f.id}">
                <div class="file-mobile-main">
                  <div class="type-icon shrink-0" :class="'type-'+fileType(f)"><component :is="fileIcon(f)" :size="23"/><span>{{fileTypeName(f)}}</span></div>
                  <div class="min-w-0 flex-1">
                    <button type="button" class="file-mobile-title" :title="f.displayLabel" @click="chooseMobile(f)">{{f.displayLabel}}</button>
                    <div class="file-mobile-meta">{{formatSize(f.cipherSize)}} <span v-if="f.sourceType==='RESEARCH'" class="pq-research-tag">Dữ liệu nghiên cứu</span></div>
                  </div>
                  <span class="permission-chip shrink-0" :class="isMine(f)?'owner-chip':'download-chip'">{{permissionName(f)}}</span>
                </div>
                <div class="file-mobile-details">
                  <span>{{tab==='sent'?`${f.recipientCount||0} người nhận`:isMine(f)?'Tệp của tôi':f.ownerName||f.ownerEmail||'Người chia sẻ'}}</span>
                  <time>{{formatDate(recordDate(f))}}</time>
                </div>
                <div class="file-mobile-actions" aria-label="Thao tác trên tệp">
                  <button type="button" class="file-mobile-select" @click="chooseMobile(f)"><Info :size="17"/> Thông tin</button>
                  <template v-if="tab!=='trash'">
                    <button type="button" class="file-mobile-preview" :aria-label="'Xem trước '+f.displayLabel" :disabled="!!working||!!previewBusy||isPreviewBlocked(f.displayLabel)" @click="openPreview(f)"><LoaderCircle v-if="previewBusy===f.id" :size="17" class="animate-spin"/><Eye v-else :size="17"/> Xem trước</button>
                    <button type="button" :aria-label="'Tải '+f.displayLabel" :disabled="!!working||!!previewBusy" @click="download(f)"><LoaderCircle v-if="working===f.id" :size="17" class="animate-spin"/><Download v-else :size="17"/> Tải về</button>
                  </template>
                  <template v-else>
                    <button type="button" :disabled="!!working" @click="restore(f)"><RotateCcw :size="17"/> Khôi phục</button>
                    <button type="button" :disabled="!!working" @click="erase(f)"><Trash2 :size="17"/> Xóa hẳn</button>
                  </template>
                  <div v-if="tab!=='trash'&&isMine(f)" class="more-wrap">
                    <button type="button" :aria-expanded="menuId===f.id" :aria-label="'Thao tác khác với '+f.displayLabel" @click="menuId=menuId===f.id?null:f.id"><MoreHorizontal :size="20"/> Khác</button>
                    <div v-if="menuId===f.id" class="more-menu" @click.stop><button @click="openRename(f)"><Pencil :size="16"/> Đổi nhãn</button><button @click="openShare(f)"><Share2 :size="16"/> Quản lý chia sẻ</button><button class="danger-menu" @click="menuId=null;trashFile(f)"><Trash2 :size="16"/> Chuyển vào thùng rác</button></div>
                  </div>
                </div>
              </article>
            </div>
          </template>
          </div>
          <div v-if="!loading&&filtered.length" class="table-footer"><p>Hiển thị <strong>{{firstIndex}} – {{lastIndex}}</strong> trong số <strong>{{filtered.length}}</strong> tệp</p><div class="pagination"><button :disabled="page===1" aria-label="Trang trước" @click="page--"><ChevronLeft :size="22"/></button><button v-for="n in pageNumbers" :key="n" :class="{'current-page':page===n}" :aria-label="`Trang ${n}`" :aria-current="page===n?'page':undefined" @click="page=n">{{n}}</button><button :disabled="page===maxPage" aria-label="Trang sau" @click="page++"><ChevronRight :size="22"/></button></div></div>
        </div>
      </section>

      <button v-if="mobileDetailsOpen" type="button" class="preview-backdrop" aria-label="Đóng bảng xem trước" @click="closeDetails"></button>
      <aside class="preview-panel" :class="{'is-mobile-open':mobileDetailsOpen}" :role="mobileDetailsOpen ? 'dialog' : 'complementary'" :aria-modal="mobileDetailsOpen ? 'true' : undefined" aria-label="Chi tiết và xem trước tệp">
        <template v-if="selected">
          <div class="preview-heading"><div class="type-icon preview-file-icon" :class="'type-'+fileType(selected)"><component :is="fileIcon(selected)" :size="27"/><span>{{fileTypeName(selected)}}</span></div><div class="min-w-0 flex-1"><h2 :title="selected.displayLabel">{{selected.displayLabel}}</h2><p>{{tab==='sent'?`Đã chia sẻ với ${selected.recipientCount||0} người`:isMine(selected)?'Tệp của bạn':`Được chia sẻ bởi ${selected.ownerName||selected.ownerEmail||'người dùng khác'}`}} <LockKeyhole :size="13" class="inline text-blue-600"/></p></div><button class="preview-close" title="Đóng chi tiết" aria-label="Đóng chi tiết tệp" @click="closeDetails"><X :size="23"/></button></div>
          <div v-if="error" class="pq-alert pq-alert-error preview-inline-alert" role="alert">{{error}}</div>
          <div v-else-if="success&&preview" class="pq-alert pq-alert-success preview-inline-alert" role="status">{{success}}</div>
          <div v-if="tab!=='trash'" class="preview-ai-control"><button class="pq-icon-button" :disabled="insightBusy||!!previewBusy" @click="summarizePreview(selected!)"><BrainCircuit :size="16"/> {{insightBusy?'Đang trích xuất…':'Tóm tắt thông minh trên thiết bị'}}</button></div>
          <section v-if="previewInsight" class="mb-3 max-h-72 overflow-auto rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs"><h3 class="font-extrabold text-blue-950">Nội dung chính (trích xuất tự động)</h3><p class="mt-1 text-slate-600">{{previewInsight.note}}</p><ul class="mt-2 list-disc space-y-1 pl-4"><li v-for="(sentence,i) in previewInsight.summary" :key="i">{{sentence}}</li></ul><p class="mt-2 font-bold">Nội dung cần làm:</p><ul class="mt-1 list-disc pl-4"><li v-for="(a,i) in previewInsight.actions" :key="i">{{a}}</li><li v-if="!previewInsight.actions.length">Không xác định</li></ul><p class="mt-2 font-bold">Ngày được nhắc đến: {{previewInsight.deadlines.join(', ')||'Không thấy'}}</p></section>
          <div class="preview-tabs"><button :class="{'preview-active':detailsTab==='preview'}" @click="detailsTab='preview'"><Eye :size="19"/>Xem trước</button><button :class="{'preview-active':detailsTab==='info'}" @click="detailsTab='info'"><Info :size="19"/>Thông tin</button></div>
          <div v-show="detailsTab==='preview'" id="pq-file-viewer" class="document-viewer">
            <div class="viewer-toolbar"><div class="viewer-pages"><button title="Trang trước" :disabled="!preview||preview.kind!=='pdf'||previewPage<=1" @click="previewPage--"><ChevronLeft :size="18"/></button><span>{{preview?.kind==='pdf'?`Trang ${previewPage}`:'Xem trước'}}</span><button title="Trang sau (PDF, nếu còn)" :disabled="!preview||preview.kind!=='pdf'" @click="previewPage++"><ChevronRight :size="18"/></button></div><div class="viewer-zoom"><button title="Thu nhỏ" :disabled="!preview||zoom<=50||!['image','text','markdown','document','slides'].includes(preview.kind)" @click="adjustZoom(-10)"><Minus :size="17"/></button><span>{{zoom}}%</span><button title="Phóng to" :disabled="!preview||zoom>=200||!['image','text','markdown','document','slides'].includes(preview.kind)" @click="adjustZoom(10)"><Plus :size="17"/></button></div><button title="Toàn màn hình" :disabled="!preview" @click="fullscreen"><Maximize2 :size="20"/></button></div>
            <div v-if="previewBusy===selected.id" class="viewer-placeholder"><LoaderCircle :size="34" class="animate-spin text-blue-500"/><p>Đang xác minh và giải mã trên thiết bị...</p></div>
            <template v-else-if="preview&&preview.id===selected.id">
              <iframe v-if="preview.kind==='pdf'" :key="pdfSrc" :src="pdfSrc" :title="`Xem PDF ${preview.name}`" class="pdf-frame"/>
              <div v-else-if="preview.kind==='image'" class="viewer-image-wrap"><img :src="preview.url" :alt="preview.name" :style="{transform:`scale(${zoom/100})`}"/></div>
              <div v-else-if="preview.kind==='audio'" class="viewer-media-wrap"><FileText :size="48"/><h3>Nghe tệp âm thanh</h3><audio :src="preview.url" controls preload="metadata" controlsList="nodownload"/><p>{{preview.note}}</p></div>
              <div v-else-if="preview.kind==='video'" class="viewer-media-wrap"><video :src="preview.url" controls playsinline preload="metadata" controlsList="nodownload"/><p>{{preview.note}}</p></div>
              <div v-else-if="preview.kind==='markdown'" class="viewer-reader-body">
                <div class="reader-mode-tabs" role="group" aria-label="Chế độ xem Markdown"><button :class="{'selected':markdownMode==='reader'}" @click="markdownMode='reader'">Chế độ đọc</button><button :class="{'selected':markdownMode==='source'}" @click="markdownMode='source'">Mã nguồn Markdown</button></div>
                <div v-if="markdownMode==='reader'" class="reader-markdown" :style="{fontSize:`${Math.round(15*zoom/100)}px`}" v-html="preview.html"></div>
                <pre v-else class="reader-source" :style="{fontSize:`${Math.round(13*zoom/100)}px`}">{{preview.text}}</pre>
                <p v-if="preview.note" class="reader-caption">{{preview.note}}</p>
              </div>
              <div v-else-if="preview.kind==='document'" class="viewer-reader-body"><article class="reader-document" :style="{fontSize:`${Math.round(15*zoom/100)}px`}" v-html="preview.html"></article><p class="reader-caption">{{preview.note}}</p></div>
              <div v-else-if="preview.kind==='spreadsheet'" class="viewer-sheet-body"><div class="reader-sheet-tabs"><button v-for="(sheet,i) in preview.sheets||[]" :key="i" :class="{'selected':previewSheetIndex===i}" @click="previewSheetIndex=i">{{sheet.name}}</button></div><div class="reader-table-scroll"><table class="reader-data-grid"><tbody><tr v-for="(row,i) in preview.sheets?.[previewSheetIndex]?.rows||[]" :key="i"><th scope="row">{{i+1}}</th><td v-for="(cell,j) in row" :key="j">{{cell}}</td></tr></tbody></table></div><p class="reader-caption">{{preview.note}}</p></div>
              <div v-else-if="preview.kind==='slides'" class="viewer-slide-body"><article v-for="(slide,i) in preview.slides||[]" :key="i" class="reader-slide" :style="{fontSize:`${Math.round(15*zoom/100)}px`}"><span>Trang chiếu {{i+1}}</span><h3>{{slide.title}}</h3><ul><li v-for="(line,j) in slide.lines" :key="j">{{line}}</li></ul></article><p class="reader-caption">{{preview.note}}</p></div>
              <div v-else-if="preview.kind==='text'" class="viewer-text-wrap"><pre :style="{fontSize:`${Math.round(13*zoom/100)}px`}">{{preview.text}}</pre><p class="reader-caption">{{preview.note}}</p></div>
              <div v-else class="viewer-placeholder"><FileText :size="56" class="text-blue-300"/><h3>{{preview.kind==='blocked'?'Không xem trước tệp nén/thư mục':'Không thể đọc nội dung định dạng này'}}</h3><p>{{preview.note}}</p><p>Bạn có thể tải xuống sau khi giải mã và mở bằng ứng dụng phù hợp.</p></div>
            </template>
            <div v-else class="viewer-placeholder"><LockKeyhole :size="60" class="text-blue-300"/><h3>Bản xem trước được bảo vệ</h3><p>Chọn “Xem trước” để xác minh chữ ký, giải mã tệp trên trình duyệt và hiển thị nội dung. Không gửi bản rõ lên máy chủ.</p><button v-if="tab!=='trash'&&!isPreviewBlocked(selected.displayLabel)" class="primary-button !px-5 !py-2.5" @click="openPreview(selected)"><Eye :size="18"/>Xem trước an toàn</button><p v-else-if="isPreviewBlocked(selected.displayLabel)">Tệp nén hoặc thư mục không hỗ trợ xem trước.</p><p v-else>Khôi phục tệp để tiếp tục.</p></div>
          </div>
          <div v-show="detailsTab==='info'" class="file-detail-panel"><dl><div><dt>Nhãn hiển thị</dt><dd class="break-all">{{selected.displayLabel}}</dd></div><div><dt>Người chia sẻ</dt><dd>{{isMine(selected)?'Tôi':selected.ownerName||selected.ownerEmail||'Không xác định'}}</dd></div><div><dt>Kích thước bản mã</dt><dd>{{formatSize(selected.cipherSize)}}</dd></div><div><dt>Thời gian</dt><dd>{{formatDate(recordDate(selected))}}</dd></div><div><dt>Quyền truy cập</dt><dd>{{permissionName(selected)}}</dd></div><div v-if="selected.expiresAt"><dt>Hết hạn chia sẻ</dt><dd>{{formatDate(selected.expiresAt)}}</dd></div><div v-if="isMine(selected)"><dt>Số người nhận còn hiệu lực</dt><dd>{{selected.recipientCount||0}}</dd></div><div><dt>Bảo mật</dt><dd>ML-KEM · ML-DSA · AES-256-GCM</dd></div><div v-if="selected.sourceType==='RESEARCH'"><dt>Nguồn</dt><dd>Tệp mẫu nghiên cứu, mã hóa thật</dd></div></dl><p class="details-note"><ShieldCheck :size="18"/>Chữ ký và nội dung chỉ được xác minh khi thực hiện giải mã.</p></div>
          <div class="preview-bottom"><button v-if="tab!=='trash'" class="primary-button" :disabled="!preview" @click="fullscreen"><Eye :size="18"/>Mở xem toàn màn hình</button><button v-if="tab!=='trash'" :disabled="!!working" @click="download(selected)"><Download :size="19"/>Tải xuống</button><button v-if="tab==='trash'" @click="restore(selected)"><RotateCcw :size="18"/>Khôi phục</button><button v-else-if="isMine(selected)" @click="openShare(selected)"><Share2 :size="19"/>Chia sẻ</button><NuxtLink v-else to="/keys" class="preview-secondary"><LockKeyhole :size="18"/>Kho khóa</NuxtLink></div>
        </template>
        <div v-else class="no-selection"><FolderOpen :size="62" class="text-blue-300"/><h2>Chọn một tệp để xem chi tiết</h2><p>Chọn tệp từ danh sách và bấm biểu tượng mắt để xem trước an toàn.</p></div>
      </aside>
    </div>

    <div v-if="modal" class="pq-modal-overlay" @click.self="modal=null"><section class="pq-modal-card !max-w-xl" role="dialog" aria-modal="true" :aria-label="modal==='rename'?'Đổi nhãn tệp':'Quản lý chia sẻ'"><div class="flex items-start justify-between gap-3"><div><h2 class="text-xl font-extrabold">{{modal==='rename'?'Đổi nhãn hiển thị':'Quản lý chia sẻ'}}</h2><p class="mt-1 break-all text-sm text-slate-500">{{editing?.displayLabel}}</p></div><button class="pq-action" aria-label="Đóng" @click="modal=null"><X :size="20"/></button></div>
      <template v-if="modal==='rename'"><p class="my-4 text-sm text-slate-500">Tên tệp gốc nằm trong nội dung đã mã hóa; thay đổi nhãn không thay đổi tệp gốc.</p><form @submit.prevent="rename"><label class="form-label" for="new-file-label">Nhãn mới</label><input id="new-file-label" v-model="editLabel" class="pq-field" maxlength="160" required/><button class="primary-button mt-4 w-full" :disabled="!!working||!editLabel.trim()">Lưu thay đổi</button></form></template>
      <template v-else><p class="my-4 flex items-start gap-2 rounded-xl bg-blue-50 p-3 text-sm text-blue-800"><ShieldCheck :size="18" class="shrink-0"/>Khóa nội dung chỉ được bọc cho người nhận bằng ML-KEM. Hãy xác nhận fingerprint khóa của họ qua kênh đáng tin cậy.</p><label class="form-label" for="share-email">Email người nhận mới</label><div class="flex gap-2"><input id="share-email" v-model="recipientEmail" class="pq-field min-w-0 flex-1" type="email" placeholder="nguoinhan@example.com" @keyup.enter="findRecipient"/><button class="primary-button !rounded-xl !px-4" :disabled="recipientEmail.trim().length<3" @click="findRecipient"><Search :size="18"/>Tìm</button></div><button v-for="person in foundRecipients" :key="person.id" class="mt-2 w-full rounded-xl border p-3 text-left text-sm" :class="chosenRecipient?.id===person.id?'border-blue-600 bg-blue-50':'border-slate-200 bg-white'" @click="chosenRecipient=person"><strong>{{person.displayName}}</strong> · {{person.email}}<small class="mt-1 block break-all font-mono text-slate-500">{{person.key.algorithm}} · {{person.key.fingerprint}}</small></button><label class="form-label mt-4" for="share-expiry">Hết hạn chia sẻ (nên đặt 1–7 ngày)</label><input id="share-expiry" v-model="shareExpiry" type="datetime-local" class="pq-field"/><div class="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm" aria-label="Đánh giá rủi ro chia sẻ">
        <h3 class="flex items-center gap-2 font-extrabold text-amber-950"><ShieldAlert :size="20"/> Rủi ro cấp quyền · <span :class="shareRiskValue.score>=55?'text-rose-700':'text-blue-700'">{{shareRiskValue.level}} ({{shareRiskValue.score}}/100)</span></h3>
        <p class="mt-1 text-xs text-slate-700">Đánh giá ngay trên trình duyệt dựa vào nội dung đã giải mã, người nhận, thời hạn và cảnh báo truy cập.</p>
        <p v-if="shareScanBusy" class="mt-2 text-blue-700">Đang giải mã và phân tích nội dung cục bộ…</p>
        <p v-else-if="shareScanError" class="mt-2 text-rose-700">Không thể quét: {{shareScanError}}. Chỉ tiếp tục sau khi tự kiểm tra tệp.</p>
        <template v-else-if="shareScan"><p class="mt-2 text-xs text-slate-700">{{shareScan.note}} · Naive Bayes gợi ý: {{shareScan.suggestion}} (điểm chưa hiệu chuẩn: {{shareScan.confidence}}%).</p><p v-if="shareScan.pii.length" class="mt-1 text-rose-800">Phát hiện {{shareScan.pii.length}} vị trí có nguy cơ lộ dữ liệu cá nhân.</p>
          <ul v-if="shareScan.pii.length" class="mt-1 flex flex-wrap gap-1"><li v-for="(hit,j) in shareScan.pii.slice(0,5)" :key="j" class="rounded bg-white px-2 py-1 text-xs">{{hit.kind}}: {{hit.masked}}</li></ul>
          <button v-if="canRedact(shareScanFileName,shareScan)" type="button" class="pq-icon-button mt-2" :disabled="!!working" @click="downloadRedacted"><EyeOff :size="16"/> Tải bản sao đã che để chia sẻ riêng</button>
          <p v-else-if="shareScan.pii.length" class="mt-1 text-xs text-amber-900">Để che dữ liệu định dạng này, hãy sửa trong ứng dụng gốc rồi tải bản sao mới lên.</p>
        </template>
        <div class="mt-2 flex flex-wrap items-center gap-2"><label class="font-semibold" for="share-manual-class">Mức bảo mật được xác nhận:</label><select id="share-manual-class" v-model="shareClass" class="pq-field !w-auto !py-1.5"><option :value="null" disabled>-- Chọn thủ công --</option><option v-for="level in CLASSIFICATIONS" :key="level">{{level}}</option></select></div>
        <p v-if="shareScan&&shareClass&&CLASSIFICATIONS.indexOf(shareClass)<CLASSIFICATIONS.indexOf(shareScan.suggestion)" class="mt-2 text-xs font-bold text-rose-700">Đã hạ mức thủ công: đánh giá rủi ro vẫn giữ mức cảnh báo cao hơn.</p>
        <ul v-if="shareRiskValue.reasons.length" class="mt-2 list-disc space-y-1 pl-4 text-xs text-amber-900"><li v-for="reason in shareRiskValue.reasons" :key="reason">{{reason}}</li></ul>
        <p v-if="shareRiskValue.actions.length" class="mt-2 text-xs text-slate-700">Khuyến nghị: {{shareRiskValue.actions.join('; ')}}.</p>
        <label v-if="shareMustReview" class="mt-3 flex items-start gap-2 font-semibold text-amber-950"><input v-model="shareChecked" type="checkbox" class="mt-1"/> Tôi đã xác minh người nhận và tự kiểm tra nội dung, chấp nhận rủi ro cấp quyền.</label>
      </div>
      <button class="primary-button mt-3 w-full" :disabled="!chosenRecipient||!!working||shareScanBusy||!shareClass||(shareMustReview&&!shareChecked)" @click="createShare"><Share2 :size="18"/>Cấp quyền chia sẻ</button><h3 class="mb-2 mt-5 border-t pt-4 font-extrabold">Người đã nhận tệp</h3><p v-if="shareLoading" class="text-sm text-slate-500">Đang tải người nhận...</p><p v-else-if="!shareGrants.length" class="text-sm text-slate-500">Chưa chia sẻ với người dùng nào.</p><div v-for="g in shareGrants" :key="g.sharedWith" class="flex items-center justify-between gap-3 border-b py-3 text-sm"><div class="min-w-0"><strong class="block truncate">{{g.displayName}}</strong><span class="block truncate text-slate-500">{{g.email}}</span><small :class="grantIsActive(g)?'text-emerald-700':'text-slate-500'">{{grantIsActive(g)?'Đang hiệu lực':'Đã hết hạn hoặc thu hồi'}}{{g.expiresAt?` · ${formatDate(g.expiresAt)}`:''}}</small></div><button v-if="grantIsActive(g)" class="rounded-lg border border-rose-200 px-3 py-2 text-rose-700 hover:bg-rose-50" :disabled="!!working" @click="revokeShare(g)">Thu hồi</button></div></template>
      <div v-if="error" class="pq-alert pq-alert-error mt-4">{{error}}</div><div v-if="success" class="pq-alert pq-alert-success mt-4">{{success}}</div>
    </section></div>
  </div>
</template>

<style scoped>
.file-portal{min-height:calc(100vh - 70px);background:linear-gradient(180deg,rgba(190,223,255,.3),rgba(230,245,255,.12));padding-bottom:42px}
.share-hero{height:143px;position:relative;isolation:isolate;overflow:hidden;background:linear-gradient(110deg,#0075ef,#0071e8 60%,#0b8df3);color:#fff}
.hero-photo{position:absolute;z-index:-2;inset:0 0 0 46%;background-image:linear-gradient(90deg,#0089fa44,#0089fa00),var(--pq-campus-image);background-size:cover;background-position:center 42%;opacity:.9}
.hero-wave{position:absolute;z-index:-1;inset:0;background:linear-gradient(100deg,#0074e8 4%,#0074ecdd 41%,#0084ff17 77%),linear-gradient(160deg,transparent 62%,#009bff65 63%,#00aeff40 72%,transparent 73%)}
.hero-wave:after{content:'';position:absolute;left:-5%;right:-5%;bottom:-75px;height:94px;background:#a6ddffcc;border-radius:50% 50% 0 0;filter:blur(10px)}
.hero-inner{max-width:1700px;margin:auto;padding:25px clamp(16px,3vw,48px);display:flex;gap:36px;align-items:center;position:relative}
.hero-icon{width:88px;height:88px;flex-shrink:0;display:grid;place-items:center;background:linear-gradient(150deg,#15bbff,#0054e7);border-radius:20px;box-shadow:0 7px 18px #004da850}
.hero-inner h1{font-size:clamp(28px,3vw,43px);font-weight:900;letter-spacing:-.035em;line-height:1.12;text-shadow:0 3px 9px #05277733}
.hero-inner p{font-size:clamp(15px,1.4vw,20px);margin-top:9px;font-weight:500}
.portal-layout{max-width:1700px;margin:-2px auto 0;padding:0 8px;display:grid;grid-template-columns:minmax(0,1.9fr) minmax(410px,.91fr);gap:12px;align-items:start}
.portal-left{min-width:0}.library-tabs{display:flex;align-items:center;flex-wrap:wrap;gap:8px;min-height:75px;padding:11px clamp(10px,2vw,32px)}
.library-tabs button{display:inline-flex;align-items:center;justify-content:center;gap:11px;min-height:49px;padding:9px 17px;border-radius:14px;font-size:14px;font-weight:800;color:#0c236e;transition:background .2s,box-shadow .2s}
.library-tabs button:hover:not(.tab-active){background:#ffffff8e}.library-tabs .tab-active{background:linear-gradient(180deg,#078eff,#0055f4);box-shadow:0 4px 12px #0065d943;color:#fff}.library-tabs .trash-tab{margin-left:auto;padding:9px 13px}
.library-card,.preview-panel{background:linear-gradient(155deg,#fff,#f8fbff);border:1px solid #cfe4fc;border-radius:26px;box-shadow:0 9px 23px #0656b833;min-width:0}
.library-card{overflow:visible;padding:18px 20px 17px}
.filter-bar{display:grid;grid-template-columns:minmax(205px,1fr) minmax(163px,.52fr) minmax(170px,.55fr) minmax(132px,.43fr) 38px;gap:11px;align-items:center;margin-bottom:25px}
.filter-search,.filter-select{height:45px;border:1px solid #d3e1ff;display:flex;align-items:center;gap:10px;border-radius:14px;background:linear-gradient(180deg,#fff,#f9fbff);box-shadow:0 3px 6px #1b5ba40d;padding:0 12px;color:#172b76;min-width:0}
.filter-search:focus-within,.filter-select:focus-within{border-color:#1688ff;outline:2px solid #b9e4ff}
.filter-search svg,.filter-select svg{flex-shrink:0;color:#193b97}
.filter-search input{width:100%;min-width:0;border:0;outline:0;background:transparent;font-size:13px;color:#0d235e}
.filter-search input::placeholder{color:#687ba8}
.filter-select{position:relative;gap:7px}.filter-select select{appearance:none;min-width:0;flex:1;background:transparent;border:0;outline:none;font-size:13px;font-weight:700;color:#0b216b;cursor:pointer}.filter-select>svg:last-child{pointer-events:none}.refresh-control{height:42px;width:38px;border:1px solid #d3e1ff;border-radius:13px;background:white;display:grid;place-items:center;color:#0d53d8}
.file-table-wrap{overflow:visible;min-height:260px}.file-table{width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed;text-align:left}
.file-table th{background:linear-gradient(100deg,#dcedff,#e8f3ff);font-size:13px;font-weight:850;color:#091d65;padding:14px 11px;white-space:nowrap}.file-table th:first-child{border-radius:15px 0 0 0;width:32%}.file-table th:nth-child(2){width:20%}.file-table th:nth-child(3){width:17%}.file-table th:nth-child(4){width:18%}.file-table th:last-child{width:13%;border-radius:0 15px 0 0;text-align:center}
.file-table td{padding:14px 9px;border-bottom:1px solid #e3edfb;color:#092165;vertical-align:middle;font-size:13px;font-weight:600}.file-table tbody tr{position:relative;transition:background .15s;cursor:pointer}.file-table tbody tr:hover{background:#eff7ff}.file-table tbody .file-row-selected{background:#dfefff;outline:2px solid #148aff;outline-offset:-2px;border-radius:12px}.file-table tbody tr:last-child td{border-bottom:0}
.file-info{display:flex;align-items:center;gap:11px;min-width:0}.type-icon{position:relative;display:grid;place-items:center;flex-shrink:0;width:38px;height:42px;border-radius:7px;color:white;background:linear-gradient(150deg,#4c91fa,#0758eb)}.type-icon span{font-size:9px;font-weight:900;position:absolute;bottom:3px;left:0;right:0;text-align:center;background:#ffffff2d;border-radius:2px}.type-pdf{background:linear-gradient(155deg,#ff6667,#f51837)}.type-doc{background:linear-gradient(155deg,#2893ff,#0044d5)}.type-sheet{background:linear-gradient(155deg,#2dca78,#00864e)}.type-slides{background:linear-gradient(155deg,#ff9841,#f45200)}.type-archive{background:linear-gradient(155deg,#ffbd3c,#f38b00)}.type-image{background:linear-gradient(155deg,#8d7bff,#6b37d6)}.type-markdown{background:linear-gradient(155deg,#64748b,#334155)}
.file-name{min-width:0}.file-name strong{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:850;font-size:13px}.file-name small{display:block;color:#526da8;font-size:12px;margin-top:4px;font-weight:500}
.person-info{display:flex;align-items:center;gap:9px;min-width:0}.person-avatar{width:36px;height:36px;flex-shrink:0;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#8a53ff,#7325ee);font-size:12px;color:white;font-weight:800}.person-avatar.avatar-blue{background:linear-gradient(135deg,#0098ff,#1055eb)}.person-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}.time-cell{font-size:12px!important;white-space:normal}
.permission-chip{display:inline-flex;align-items:center;gap:5px;border-radius:16px;padding:7px 9px;white-space:nowrap;font-weight:700;font-size:12px;background:#e1f3ff;color:#006ae5}.permission-chip.owner-chip{background:#e4f9ef;color:#008f53}
.row-actions{display:flex;gap:5px;align-items:center;justify-content:flex-end}.row-actions>button,.more-wrap>button{width:36px;height:36px;border-radius:11px;display:grid;place-items:center;background:#fff;border:1px solid #d8e7ff;color:#0055e5;box-shadow:0 2px 4px #376eb11a}.row-actions button:hover:not(:disabled){background:#e6f2ff}.more-wrap{position:relative}.more-menu{position:absolute;right:0;top:calc(100% + 5px);width:204px;z-index:20;background:white;border:1px solid #dceafe;border-radius:13px;box-shadow:0 10px 25px #163a8c44;padding:6px}.more-menu button{display:flex;align-items:center;gap:9px;width:100%;text-align:left;padding:10px;font-size:13px;font-weight:700;border-radius:8px}.more-menu button:hover{background:#e8f3ff}.more-menu .danger-menu{color:#d72845}
.table-footer{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:19px 8px 1px;border-top:1px solid #e0ebfb;margin-top:14px;font-size:13px;color:#0c276f}.pagination{display:flex;gap:5px}.pagination button{min-width:35px;height:42px;padding:4px 10px;display:grid;place-items:center;border-radius:12px;background:#f8fbff;border:1px solid #d7e5ff;font-size:14px;font-weight:800}.pagination .current-page{background:linear-gradient(#087cff,#0751eb);color:white;box-shadow:0 3px 7px #006cfc44}
.loading-state,.empty-library{display:grid;place-items:center;gap:12px;padding:90px 20px 105px;color:#667ba8;text-align:center}.empty-library h2{font-size:22px;font-weight:850;color:#11296b}.empty-library p{font-size:14px}
.preview-panel{display:flex;flex-direction:column;min-height:681px;overflow:hidden;margin-top:0;padding:20px}.preview-heading{display:flex;gap:12px;align-items:center;min-height:67px}.preview-file-icon{width:49px;height:55px}.preview-heading h2{font-weight:900;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.preview-heading p{font-size:12px;color:#5977ac;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.preview-close{padding:6px;color:#061a69}
.preview-tabs{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:20px 0 20px}.preview-tabs button{display:flex;align-items:center;justify-content:center;gap:9px;padding:11px;border:1px solid #e1ecff;border-radius:20px;background:#f9fbff;color:#123b8a;font-size:14px;font-weight:800}.preview-tabs .preview-active{background:#d8ecff;color:#0067eb;border-color:#d8ecff}
.document-viewer{height:440px;min-height:340px;overflow:hidden;background:#edf4fa;border:9px solid #333d51;border-radius:13px;display:flex;flex-direction:column}.document-viewer:fullscreen{height:100dvh;border:0;border-radius:0}.viewer-toolbar{display:flex;align-items:center;justify-content:space-between;gap:6px;background:#30394a;color:#fff;min-height:44px;padding:0 9px;font-size:13px}.viewer-toolbar button{padding:6px;display:grid;place-items:center;border-radius:5px;color:#e4e9f2}.viewer-toolbar button:hover:not(:disabled){background:#566177}.viewer-toolbar button:disabled{color:#8390a8}.viewer-pages,.viewer-zoom{display:flex;align-items:center;gap:4px}.viewer-pages span{min-width:58px;text-align:center}.viewer-zoom span{min-width:40px;text-align:center}.pdf-frame{width:100%;height:100%;border:0;background:white;flex:1}.viewer-placeholder{flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:13px;padding:24px;text-align:center;color:#5470a2;background:linear-gradient(145deg,#f5faff,#e8f2ff)}.viewer-placeholder h3{font-weight:850;font-size:17px;color:#163773}.viewer-placeholder p{font-size:13px;line-height:1.6;max-width:330px}.viewer-image-wrap{flex:1;overflow:auto;display:grid;place-items:center;background:#f8fbff}.viewer-image-wrap img{max-width:92%;max-height:350px;object-fit:contain;transition:transform .2s}.viewer-text-wrap{flex:1;overflow:auto;background:white;color:#1d314c}.viewer-text-wrap pre{padding:18px;white-space:pre-wrap;overflow-wrap:anywhere;font-family:ui-monospace,monospace;line-height:1.55}
.file-detail-panel{height:440px;overflow:auto;background:#f8fbff;border:1px solid #e0ecfc;border-radius:14px;padding:14px}.file-detail-panel dl>div{display:flex;justify-content:space-between;gap:10px;padding:11px 2px;border-bottom:1px solid #e4eefb;font-size:13px}.file-detail-panel dt{color:#6178a4;flex-shrink:0}.file-detail-panel dd{font-weight:750;text-align:right;word-break:break-word}.details-note{display:flex;align-items:flex-start;gap:9px;margin-top:22px;font-size:12px;color:#3472ba}.details-note svg{flex-shrink:0}
.preview-bottom{display:flex;gap:8px;align-items:center;justify-content:space-between;margin-top:auto;padding-top:19px}.preview-bottom>button,.preview-bottom>.preview-secondary{display:inline-flex;gap:7px;align-items:center;justify-content:center;border-radius:14px;border:1px solid #d2e6fc;padding:10px 9px;color:#0054d7;font-weight:750;font-size:12px;white-space:nowrap;background:#f9fbff}.preview-bottom>.primary-button{background:linear-gradient(#008dff,#0054fa);color:#fff;border:0;font-size:12px;padding:11px 12px;box-shadow:0 3px 9px #005be53d}.no-selection{min-height:600px;display:flex;align-items:center;flex-direction:column;justify-content:center;gap:14px;text-align:center;padding:35px;color:#6d86af}.no-selection h2{color:#183770;font-weight:850;font-size:19px}.no-selection p{font-size:13px;line-height:1.5}
@media(max-width:1480px){.portal-layout{grid-template-columns:minmax(0,1.65fr) minmax(355px,.85fr)}.library-card{padding:15px 11px}.filter-bar{grid-template-columns:minmax(170px,1fr) minmax(145px,.6fr) minmax(150px,.6fr);gap:7px}.sort-select{grid-column:1/3}.refresh-control{justify-self:end}.file-table th{font-size:11px;padding:12px 5px}.file-table td{padding:12px 5px;font-size:12px}.row-actions{gap:3px}.row-actions>button,.more-wrap>button{width:31px;height:34px}.file-name strong{font-size:12px}.person-avatar{width:28px;height:28px}.permission-chip{font-size:10px;padding:5px}}
@media(max-width:1120px){.portal-layout{grid-template-columns:1fr;gap:15px;padding:0 16px}.preview-panel{min-height:0}.document-viewer,.file-detail-panel{height:480px}.preview-bottom{justify-content:flex-start}.filter-bar{grid-template-columns:minmax(180px,2fr) repeat(3,minmax(133px,1fr)) 40px}.sort-select{grid-column:auto}.file-table th{font-size:13px;padding:12px 9px}.file-table td{font-size:13px;padding:12px 9px}.library-card{padding:18px}.row-actions>button,.more-wrap>button{width:36px;height:36px}}
@media(max-width:740px){.hero-inner{gap:15px;padding:25px 18px}.hero-icon{width:62px;height:62px;border-radius:15px}.hero-inner h1{font-size:27px}.hero-inner p{font-size:14px}.hero-photo{left:36%;opacity:.3}.library-tabs{gap:4px;padding:9px 0}.library-tabs button{font-size:12px;min-height:41px;padding:7px 9px;gap:5px}.library-tabs button svg{width:16px}.portal-layout{padding:0 8px}.library-card{padding:13px 9px}.filter-bar{display:grid;grid-template-columns:repeat(2,minmax(0,1fr)) 35px;gap:7px;margin-bottom:17px}.filter-search{grid-column:1/-1}.sort-select{grid-column:1/3}.filter-search,.filter-select{padding:0 8px;height:41px}.file-table-wrap{overflow-x:auto}.file-table{min-width:780px}.file-table th,.file-table td{font-size:12px}.table-footer{flex-wrap:wrap}.preview-panel{padding:15px}.document-viewer,.file-detail-panel{height:430px}.preview-bottom{flex-wrap:wrap}.preview-bottom>button{flex:1}}
.file-name-button{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left;font-size:13px;font-weight:850;color:#0a2367;border-radius:5px;padding:2px 0}
.file-name-button:hover{text-decoration:underline;text-underline-offset:2px;color:#0069e8}
@media(max-width:740px){.file-name-button{font-size:12px}}

/* One consistent upload entry point in the library banner, at any tab and width. */
.share-hero{height:auto;min-height:143px}
.hero-inner{min-height:143px;gap:clamp(14px,2.4vw,36px)}
.hero-copy{flex:1;min-width:0}
.hero-upload-action{display:inline-flex;align-items:center;justify-content:center;gap:10px;flex-shrink:0;min-height:48px;padding:11px 20px;border:1px solid rgba(214,239,255,.94);border-radius:15px;background:rgba(255,255,255,.96);color:#0750b5;font-size:14px;font-weight:850;box-shadow:0 8px 22px rgba(0,43,128,.22);transition:transform .18s ease,background .18s ease,box-shadow .18s ease}
.hero-upload-action:hover{background:#fff;transform:translateY(-2px);box-shadow:0 11px 27px rgba(0,43,128,.3)}
.hero-upload-action:focus-visible{outline:3px solid #ffedac;outline-offset:4px}
@media(max-width:740px){.hero-inner{flex-wrap:wrap;padding:21px 18px}.hero-copy{flex:1;min-width:min(180px,60%)}.hero-upload-action{flex-basis:100%;min-height:44px;padding:10px 14px;font-size:13px}}
@media(prefers-reduced-motion:reduce){.hero-upload-action{transition:none}.hero-upload-action:hover{transform:none}}

/* Mobile uses cards rather than a table whose action column disappears off-screen. */
.file-mobile-list{display:none}
.preview-panel{scroll-margin-top:86px}
@media(max-width:900px){
 .file-table-wrap{display:none}
 .file-mobile-list{display:grid;gap:10px}
 .file-mobile-card{position:relative;min-width:0;border:1px solid #d5e6fa;border-radius:16px;background:#fff;padding:12px;box-shadow:0 3px 9px #0554b00a}
 .file-mobile-card--selected{border-color:#0a78ef;background:#eff7ff}
 .file-mobile-card--menu{z-index:12}
 .file-mobile-main{display:flex;align-items:center;gap:10px;min-width:0}
 .file-mobile-title{display:block;max-width:100%;text-align:left;color:#0b2b69;font-weight:850;font-size:13px;line-height:1.45;overflow-wrap:anywhere}
 .file-mobile-title:hover{text-decoration:underline}
 .file-mobile-meta{margin-top:3px;font-size:11px;color:#6a7fa3}
 .file-mobile-main .permission-chip{max-width:94px;white-space:normal;text-align:center;font-size:10px;line-height:1.25}
 .file-mobile-details{display:flex;justify-content:space-between;flex-wrap:wrap;gap:5px 10px;margin-top:10px;padding-top:9px;border-top:1px solid #e7f0fb;font-size:11px;color:#547095;overflow-wrap:anywhere}
 .file-mobile-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:11px}
 .file-mobile-actions>button,.file-mobile-actions>.more-wrap>button{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:42px;border:1px solid #cfe1f8;border-radius:10px;padding:8px 10px;color:#0c57c6;font-weight:750;font-size:11px;background:#f8fbff}
 .file-mobile-actions>button:disabled{opacity:.5}
 .file-mobile-actions .more-wrap{position:relative}
 .file-mobile-actions .more-menu{right:0;top:calc(100% + 4px);z-index:15}
 .file-mobile-actions .more-wrap>button{height:auto;width:auto}
 .file-mobile-actions .more-wrap>button svg{flex-shrink:0}
 .table-footer{padding-inline:2px}
 .pagination{flex-wrap:wrap}
}
@media(max-width:410px){
 .library-tabs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));width:100%;gap:6px}
 .library-tabs button{justify-content:flex-start;min-width:0;padding:8px 9px;white-space:normal;line-height:1.2}
 .library-tabs .trash-tab{margin-left:0}
 .file-mobile-main{flex-wrap:wrap}
 .file-mobile-main .permission-chip{margin-left:48px;max-width:none}
 .file-mobile-actions>button,.file-mobile-actions>.more-wrap{flex:1}
 .file-mobile-actions>.more-wrap>button{width:100%}
 .table-footer{justify-content:center;text-align:center}
 .preview-tabs{gap:6px}
 .preview-tabs button{font-size:12px;padding:9px 6px}
 .viewer-toolbar{flex-wrap:wrap;padding:6px;justify-content:center}
}
@media(max-width:350px){
 .filter-bar{grid-template-columns:1fr 38px}
 .filter-search{grid-column:1/-1}
 .filter-select{grid-column:1/-1}
 .sort-select{grid-column:1}
 .refresh-control{grid-column:2;grid-row:4}
 .file-mobile-actions>button{flex:1 1 calc(50% - 6px)}
}

/* Container-query companion to the existing mobile rules: a sidebar reduces
   the actual library column, even if the browser viewport is quite wide. */
.library-card{container-type:inline-size;container-name:pq-file-library}
@container pq-file-library (max-width:900px){
 .file-table-wrap{display:none}
 .file-mobile-list{display:grid;gap:10px}
 .file-mobile-card{position:relative;min-width:0;border:1px solid #d5e6fa;border-radius:16px;background:#fff;padding:12px;box-shadow:0 3px 9px #0554b00a}
 .file-mobile-card--selected{border-color:#0a78ef;background:#eff7ff}
 .file-mobile-card--menu{z-index:12}
 .file-mobile-main{display:flex;align-items:center;gap:10px;min-width:0}
 .file-mobile-title{display:block;max-width:100%;text-align:left;color:#0b2b69;font-weight:850;font-size:13px;line-height:1.45;overflow-wrap:anywhere}
 .file-mobile-title:hover{text-decoration:underline}
 .file-mobile-meta{margin-top:3px;font-size:11px;color:#6a7fa3}
 .file-mobile-main .permission-chip{max-width:94px;white-space:normal;text-align:center;font-size:10px;line-height:1.25}
 .file-mobile-details{display:flex;justify-content:space-between;flex-wrap:wrap;gap:5px 10px;margin-top:10px;padding-top:9px;border-top:1px solid #e7f0fb;font-size:11px;color:#547095;overflow-wrap:anywhere}
 .file-mobile-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:11px}
 .file-mobile-actions>button,.file-mobile-actions>.more-wrap>button{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:42px;border:1px solid #cfe1f8;border-radius:10px;padding:8px 10px;color:#0c57c6;font-weight:750;font-size:11px;background:#f8fbff}
 .file-mobile-actions>button:disabled{opacity:.5}
 .file-mobile-actions .more-wrap{position:relative}
 .file-mobile-actions .more-menu{right:0;top:calc(100% + 4px);z-index:15}
 .file-mobile-actions .more-wrap>button{height:auto;width:auto}
 .file-mobile-actions .more-wrap>button svg{flex-shrink:0}
 .table-footer{padding-inline:2px}
 .pagination{flex-wrap:wrap}
 }
@container pq-file-library (max-width:610px){
 .filter-bar{display:grid;grid-template-columns:repeat(2,minmax(0,1fr)) 38px;gap:7px}
 .filter-search{grid-column:1/-1}
 .sort-select{grid-column:1/3}
 .file-mobile-actions{flex-wrap:wrap}
 .preview-bottom{flex-wrap:wrap}
}

/* Local document viewers: responsive, read-only and isolated from the rest of the UI. */
.viewer-reader-body,.viewer-sheet-body,.viewer-slide-body{flex:1;min-height:0;overflow:auto;background:#fff;color:#263650}
.reader-mode-tabs,.reader-sheet-tabs{position:sticky;top:0;z-index:2;display:flex;gap:5px;align-items:center;padding:9px 12px;background:#f5f9ff;border-bottom:1px solid #dce7f6;overflow-x:auto;scrollbar-width:thin}
.reader-mode-tabs button,.reader-sheet-tabs button{flex-shrink:0;padding:7px 11px;border-radius:9px;color:#35557f;font-size:12px;font-weight:750}
.reader-mode-tabs button.selected,.reader-sheet-tabs button.selected{background:#126ce2;color:#fff}
.reader-markdown,.reader-document{max-width:920px;margin:0 auto;padding:clamp(16px,3vw,34px);background:#fff;color:#24334c;overflow-wrap:anywhere;line-height:1.75}
.reader-markdown :deep(h1),.reader-document :deep(h1){font-size:2em;font-weight:850;line-height:1.3;margin:1.2em 0 .6em;color:#152954}
.reader-markdown :deep(h2),.reader-document :deep(h2){font-size:1.55em;font-weight:800;margin:1.25em 0 .6em;color:#183965;border-bottom:1px solid #e3ebf6;padding-bottom:.35em}
.reader-markdown :deep(h3),.reader-document :deep(h3){font-size:1.25em;font-weight:780;margin:1.1em 0 .5em;color:#1a4379}
.reader-markdown :deep(h4),.reader-document :deep(h4){font-size:1.07em;font-weight:760;margin:1em 0 .4em}
.reader-markdown :deep(p),.reader-document :deep(p){margin:.75em 0;white-space:normal}
.reader-markdown :deep(ul),.reader-markdown :deep(ol){padding-left:1.7em;margin:.9em 0;list-style:revert}
.reader-markdown :deep(li){margin:.35em 0}
.reader-markdown :deep(blockquote){border-left:4px solid #60a5fa;padding:8px 16px;background:#f2f7ff;color:#3c5982;margin:1em 0}
.reader-markdown :deep(code){background:#eff5fc;border-radius:5px;padding:.12em .35em;font-family:ui-monospace,monospace;font-size:.9em}
.reader-markdown :deep(pre){background:#142033;color:#e8f1ff;padding:14px 16px;border-radius:11px;overflow:auto;margin:1em 0}
.reader-markdown :deep(pre code){background:transparent;padding:0;color:inherit;font-size:.9em}
.reader-markdown :deep(a){color:#0969d8;text-decoration:underline;text-underline-offset:3px}
.reader-markdown :deep(hr){margin:1.4em 0;border-color:#d4e2f4}
.reader-markdown :deep(table),.reader-document :deep(table){border-collapse:collapse;min-width:100%;max-width:100%;font-size:.9em;margin:1em 0}
.reader-markdown :deep(th),.reader-markdown :deep(td),.reader-document :deep(td){border:1px solid #cbd9eb;padding:8px 11px;text-align:left}
.reader-markdown :deep(th){background:#e8f2ff;font-weight:750}
.reader-table-scroll{overflow:auto;max-width:100%;max-height:100%;scrollbar-width:thin}
.reader-document .reader-table-scroll{margin:14px 0}
.reader-omitted-image{display:inline-block;color:#61758f;border:1px dashed #b5cce9;background:#f4f8fe;padding:3px 8px;border-radius:6px;font-size:.82em}
.reader-source{padding:18px 20px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere;font-family:ui-monospace,monospace}
.reader-caption{margin:10px 14px 14px;color:#5a6b83;font-size:11px;line-height:1.55}
.reader-data-grid{border-collapse:separate;border-spacing:0;min-width:max-content;background:#fff;font-size:12px}
.reader-data-grid th,.reader-data-grid td{border-right:1px solid #e0e8f3;border-bottom:1px solid #e0e8f3;padding:7px 10px;white-space:pre-wrap;max-width:350px;min-width:88px;vertical-align:top;overflow-wrap:anywhere}
.reader-data-grid th{position:sticky;left:0;z-index:1;background:#f0f6fd;color:#68809f;min-width:40px;text-align:center}
.reader-data-grid tr:nth-child(even) td{background:#fbfdff}
.viewer-sheet-body{display:flex;flex-direction:column}.viewer-sheet-body>.reader-table-scroll{flex:1;min-height:0}
.viewer-media-wrap{display:flex;align-items:center;justify-content:center;flex-direction:column;gap:15px;flex:1;min-height:0;padding:18px;background:#f6f9ff;color:#28508e;text-align:center}
.viewer-media-wrap audio{width:min(100%,520px)}.viewer-media-wrap video{max-width:100%;max-height:90%;background:#152034;border-radius:8px}
.viewer-media-wrap p{font-size:12px;max-width:450px;color:#526b8d}
.reader-slide{max-width:850px;margin:18px auto;padding:22px 24px;min-height:205px;box-shadow:0 2px 14px #122d4d22;border-radius:9px;border:1px solid #dce7f5;background:linear-gradient(125deg,#f7faff,#fff);overflow-wrap:anywhere}
.reader-slide>span{color:#5c7ba3;font-size:.75em;font-weight:750}.reader-slide h3{font-size:1.4em;font-weight:850;color:#193a73;margin:12px 0}.reader-slide ul{list-style:disc;padding-left:21px}.reader-slide li{margin:7px 0}
@media(max-width:540px){.reader-markdown,.reader-document{padding:14px}.reader-slide{margin:10px 8px;padding:15px}.reader-mode-tabs button{font-size:11px;padding:6px 8px}}

/* --------------------------------------------------------------------------
   Files workspace 2026 — calm visual hierarchy, accessible actions and a
   responsive details drawer. This is presentation-only: encryption and API
   request paths are unchanged.
   -------------------------------------------------------------------------- */
.file-portal{background:#f4f7fc;color:#163052;min-height:calc(100dvh - var(--pq-topbar-height,70px));padding-bottom:40px}
.share-hero{height:auto;min-height:122px;background:linear-gradient(125deg,#fff 0%,#f3f8ff 100%);border-bottom:1px solid #e2eaf5;color:#172b4d}
.hero-photo,.hero-wave{display:none}
.hero-inner{max-width:1680px;min-height:122px;gap:16px;padding:22px clamp(18px,2.8vw,38px)}
.hero-icon{width:60px;height:60px;border-radius:18px;background:linear-gradient(140deg,#ecf7ff,#dceaff);color:#126ce3;box-shadow:none}
.hero-icon svg{width:33px;height:33px}
.hero-eyebrow{display:block;margin-bottom:3px;color:#6281a8;font-size:10px;font-weight:850;letter-spacing:.12em}
.hero-inner h1{color:#12305f;font-weight:850;letter-spacing:-.035em;font-size:clamp(22px,2.2vw,32px);text-shadow:none}
.hero-inner p{margin-top:4px;font-size:clamp(12px,1vw,14px);font-weight:500;color:#61738f;line-height:1.45}
.hero-upload-action{min-height:42px;padding:10px 15px;border:1px solid #176cda;border-radius:11px;background:#126de3;color:#fff;box-shadow:0 4px 10px #115abb24;font-size:13px}
.hero-upload-action:hover{background:#0757c1;box-shadow:0 5px 12px #115abb30}
.hero-upload-action:focus-visible{outline-color:#3b82f6}
.portal-layout{max-width:1680px;margin:0 auto;padding:0 clamp(12px,2.2vw,30px);display:grid;grid-template-columns:minmax(0,1.7fr) minmax(355px,.88fr);gap:18px;align-items:start}
.portal-left{min-width:0}
.library-tabs{min-height:70px;padding:13px 0;gap:8px;flex-wrap:wrap}
.library-tabs button{min-height:41px;gap:7px;padding:8px 12px;border-radius:11px;font-size:12px;font-weight:750;color:#526b90;white-space:normal;text-align:center;transition:background .15s,color .15s}
.library-tabs button:hover:not(.tab-active){background:#e6eefb;color:#1f5baa}
.library-tabs .tab-active{background:#136bdc;color:#fff;box-shadow:0 3px 8px #176adc26}
.library-tabs .trash-tab{margin-left:auto;color:#61748f}
.library-tabs .trash-tab.tab-active{color:#fff}
.library-card,.preview-panel{border:1px solid #dfe7f0;background:#fff;border-radius:17px;box-shadow:0 6px 24px #16365d0a}
.library-card{padding:18px;overflow:visible;container-type:inline-size;container-name:pq-file-library}
.library-section-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:15px}
.library-section-heading h2{color:#1a3557;font-size:16px;font-weight:850;letter-spacing:-.012em}
.library-section-heading p{margin-top:3px;color:#75879b;font-size:11px;line-height:1.45}
.library-section-heading>svg{flex:none;color:#2c8a70}
.filter-bar{display:grid;grid-template-columns:minmax(170px,2.2fr) repeat(3,minmax(115px,1fr)) 40px;gap:8px;margin-bottom:16px}
.filter-search,.filter-select{height:42px;padding:0 10px;gap:7px;border-color:#dfe7f1;border-radius:10px;background:#f9fbfd;box-shadow:none}
.filter-search input,.filter-select select{font-size:12px;color:#233a5e}
.filter-search input::placeholder{color:#8190a2}
.filter-search svg,.filter-select svg{color:#59799e;width:16px}
.refresh-control{height:42px;width:40px;border-color:#dfe7f1;border-radius:10px;color:#2869b7}
/* Cards are intentionally used at all widths: names and actions never hide in a five-column table. */
.file-table-wrap{display:none!important}
.file-mobile-list{display:grid!important;gap:11px}
.file-mobile-card{position:relative;min-width:0;padding:16px;border:1px solid #e1e9f3;border-radius:13px;background:#fff;box-shadow:none;transition:border-color .15s,background .15s,box-shadow .15s}
.file-mobile-card:hover{border-color:#9dc5f2;background:#fcfdff;box-shadow:0 4px 13px #1a5a9a0d}
.file-mobile-card--selected{border-color:#529cf0;background:#f5faff;box-shadow:inset 3px 0 #2683ed}
.file-mobile-card--menu{z-index:12}
.file-mobile-main{display:flex;align-items:center;gap:12px;min-width:0}
.file-mobile-main>div:nth-child(2){flex:1;min-width:0}
.file-mobile-main .type-icon{height:45px;width:43px;border-radius:10px}
.file-mobile-title{display:block;max-width:100%;text-align:left;font-size:13px;line-height:1.5;font-weight:800;color:#19365f;overflow-wrap:anywhere}
.file-mobile-title:hover{text-decoration:underline;text-underline-offset:2px}
.file-mobile-meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:3px;font-size:11px;color:#778ba4}
.file-mobile-main .permission-chip{max-width:132px;flex-shrink:0;white-space:normal;line-height:1.25;text-align:center;font-size:10px;padding:6px 9px;border-radius:8px}
.permission-chip.download-chip{color:#1465a8;background:#eaf5ff}
.file-mobile-details{display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px 12px;padding:10px 0;margin-top:10px;border-top:1px solid #edf1f7;color:#6d829d;font-size:11px}
.file-mobile-details span{overflow-wrap:anywhere}
.file-mobile-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:0;align-items:center}
.file-mobile-actions>button,.file-mobile-actions>.more-wrap>button{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:38px;padding:8px 11px;border:1px solid #dbe6f2;border-radius:9px;background:#fff;color:#2c5b96;font-size:11px;font-weight:750}
.file-mobile-actions>button:hover:not(:disabled),.file-mobile-actions>.more-wrap>button:hover:not(:disabled){background:#edf5ff;border-color:#aacdf3}
.file-mobile-actions>button.file-mobile-preview{color:#075dc8;background:#eff6ff;border-color:#c9e1ff}
.file-mobile-actions>button:disabled{opacity:.5}
.file-mobile-actions .more-wrap{position:relative}
.file-mobile-actions .more-wrap>button{width:auto;height:auto}
.file-mobile-actions .more-wrap .more-menu{right:0;top:calc(100% + 5px);z-index:20}
.table-footer{padding:16px 2px 0;margin-top:14px;color:#687d99;gap:8px;font-size:11px;flex-wrap:wrap}
.pagination button{min-width:34px;height:35px;border:1px solid #e0e8f3;border-radius:9px;background:white;font-size:12px}
.pagination .current-page{background:#126de3;box-shadow:none}
.preview-panel{position:sticky;top:calc(var(--pq-topbar-height,70px) + 14px);display:flex;flex-direction:column;min-height:0;max-height:calc(100dvh - var(--pq-topbar-height,70px) - 28px);overflow-y:auto;overscroll-behavior:contain;padding:18px;scrollbar-width:thin}
.preview-heading{align-items:center;min-height:54px;gap:11px}
.preview-file-icon{width:43px;height:45px}
.preview-heading h2{font-size:13px;color:#1d385e;line-height:1.4;font-weight:850}
.preview-heading p{font-size:11px;margin-top:3px;color:#7186a1}
.preview-close{display:grid;place-items:center;width:34px;height:34px;flex:none;border:1px solid #e2eaf3;border-radius:9px;color:#657d9a}
.preview-close:hover{background:#eff5fc}
.preview-inline-alert{margin-top:12px;padding:9px 11px;font-size:11px;line-height:1.5}
.preview-ai-control{margin:13px 0 0}
.preview-ai-control .pq-icon-button{width:100%;min-height:39px;background:#f6f9ff;border-color:#d8e6f7;border-radius:10px;font-size:11px;color:#365c95}
.preview-tabs{gap:6px;margin:14px 0 12px;padding:4px;background:#f3f6fb;border:1px solid #e9eff6;border-radius:11px}
.preview-tabs button{border:0;border-radius:8px;padding:8px;font-size:12px;font-weight:800;color:#58718e;background:transparent}
.preview-tabs .preview-active{background:#fff;border:0;box-shadow:0 2px 6px #30497014;color:#0962c5}
.document-viewer{flex:none;height:clamp(315px,44vh,490px);min-height:315px;overflow:hidden;background:#f7f9fc;border:1px solid #dce5f0;border-radius:12px}
.viewer-toolbar{min-height:42px;padding:0 8px;background:#f3f6fa;border-bottom:1px solid #dce5f0;color:#4b617c;font-size:12px}
.viewer-toolbar button{color:#456487}
.viewer-toolbar button:hover:not(:disabled){background:#e6eff9}
.viewer-toolbar button:disabled{color:#a5b0be}
.viewer-placeholder{background:#f7faff;color:#677e9b;gap:11px;padding:22px}
.viewer-placeholder>svg{width:45px;height:45px;color:#8fb8e9}
.viewer-placeholder h3{font-size:15px;font-weight:850;color:#1d416f}
.viewer-placeholder p{font-size:12px;line-height:1.65;max-width:320px}
.viewer-placeholder .primary-button{padding:10px 15px;font-size:12px;border-radius:10px;box-shadow:0 5px 15px #0b63c32b}
.file-detail-panel{height:auto;min-height:350px;border-radius:12px;background:#f9fbfe;border-color:#e4ebf5}
.preview-bottom{position:relative;display:grid;grid-template-columns:1fr 1fr;gap:8px;padding-top:13px;margin-top:0}
.preview-bottom>button,.preview-bottom>.preview-secondary{min-width:0;white-space:normal;min-height:42px;border-radius:9px;font-size:11px;line-height:1.3;padding:9px}
.preview-bottom>.primary-button{grid-column:1/-1;border-radius:10px;padding:10px 12px;background:#126de3;box-shadow:none;font-size:12px}
.no-selection{min-height:390px;gap:10px;padding:30px}
.no-selection h2{color:#1e416e;font-size:16px}
.no-selection p{max-width:260px;color:#7186a1;font-size:12px}
/* Keep an existing blocking share/rename dialog above a preview drawer. */
.file-portal .pq-modal-overlay{z-index:120}
.preview-backdrop{display:none}
:global(body.pq-file-drawer-open){overflow:hidden}
@media(max-width:1430px){
 .portal-layout{grid-template-columns:minmax(0,1fr)}
 .preview-backdrop{position:fixed;inset:0;z-index:86;display:block;width:100vw;height:100dvh;background:rgba(10,29,57,.50);border:0;backdrop-filter:blur(2px)}
 .preview-panel{position:fixed;z-index:87;inset:0 0 0 auto;top:0;width:min(660px,100vw);height:100dvh;max-height:100dvh;padding:22px;border-radius:18px 0 0 18px;box-shadow:-14px 0 45px #0b234b33;transform:translateX(104%);visibility:hidden;pointer-events:none;transition:transform .22s ease,visibility .22s}
 .preview-panel.is-mobile-open{transform:translateX(0);visibility:visible;pointer-events:auto}
 .document-viewer{height:clamp(360px,58dvh,720px)}
 .library-tabs{min-height:62px}
 .file-mobile-card{padding:14px}
}
@media(min-width:1050px) and (max-width:1430px){
 .portal-layout{max-width:1040px}
 .filter-bar{grid-template-columns:minmax(170px,2fr) repeat(3,minmax(115px,1fr)) 40px}
}
@media(max-width:900px){
 .share-hero{min-height:100px}
 .hero-inner{min-height:100px;padding:16px}
 .hero-icon{width:50px;height:50px;border-radius:14px}
 .hero-icon svg{width:27px;height:27px}
 .hero-inner h1{font-size:24px}
 .hero-inner p{font-size:12px}
 .library-tabs{padding:12px 0}
 .library-card{padding:15px}
 .filter-bar{grid-template-columns:repeat(2,minmax(0,1fr)) 40px;gap:8px}
 .filter-search{grid-column:1/-1}
 .sort-select{grid-column:1/3}
 .refresh-control{grid-column:3;grid-row:3}
 .preview-panel{width:min(640px,100vw)}
}
@media(max-width:600px){
 .share-hero{min-height:0}
 .hero-inner{gap:10px;padding:16px 13px;flex-wrap:wrap}
 .hero-icon{width:44px;height:44px;flex:none}
 .hero-icon svg{width:25px;height:25px}
 .hero-copy{flex:1;min-width:0}
 .hero-inner h1{font-size:21px}
 .hero-inner p{font-size:11px}
 .hero-upload-action{flex-basis:100%;min-height:39px;font-size:12px;box-shadow:none}
 .portal-layout{padding:0 9px;gap:0}
 .library-tabs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
 .library-tabs button{min-width:0;min-height:38px;padding:8px;font-size:11px;line-height:1.3;justify-content:center}
 .library-tabs .trash-tab{margin-left:0}
 .library-card{padding:12px;border-radius:14px}
 .library-section-heading{margin-bottom:12px}
 .library-section-heading h2{font-size:15px}
 .library-section-heading p{font-size:10px}
 .filter-bar{gap:7px;grid-template-columns:repeat(2,minmax(0,1fr)) 38px}
 .filter-search{grid-column:1/-1}
 .filter-search,.filter-select{height:41px}
 .sort-select{grid-column:1/3}
 .refresh-control{grid-column:3;grid-row:3;width:38px;height:41px}
 .file-mobile-card{padding:12px}
 .file-mobile-main{gap:9px;align-items:flex-start;flex-wrap:wrap}
 .file-mobile-main .type-icon{height:42px;width:38px}
 .file-mobile-title{font-size:12px}
 .file-mobile-main .permission-chip{margin-left:47px;max-width:calc(100% - 47px);text-align:left}
 .file-mobile-details{font-size:10px;gap:5px}
 .file-mobile-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}
 .file-mobile-actions>button,.file-mobile-actions>.more-wrap>button{width:100%;min-height:40px;font-size:11px}
 .file-mobile-actions .more-wrap>button{width:100%}
 .preview-panel{width:100%;padding:16px 13px max(18px,env(safe-area-inset-bottom));border-radius:0}
 .preview-heading{align-items:flex-start}
 .preview-heading h2{font-size:13px;white-space:normal;overflow-wrap:anywhere}
 .preview-heading p{white-space:normal}
 .document-viewer{height:clamp(300px,55dvh,650px);min-height:290px}
 .viewer-toolbar{gap:2px;padding:4px;flex-wrap:wrap;justify-content:center}
 .preview-bottom{gap:7px}
 .preview-bottom>button,.preview-bottom>.preview-secondary{min-height:42px}
 .reader-markdown,.reader-document{max-width:100%}
}
@media(max-width:340px){
 .hero-inner h1{font-size:19px}
 .library-tabs button{font-size:10px}
 .file-mobile-actions>button,.file-mobile-actions>.more-wrap>button{padding:7px 5px}
 .filter-bar{grid-template-columns:minmax(0,1fr) 38px}
 .filter-search,.filter-select{grid-column:1/-1}
 .sort-select{grid-column:1;grid-row:auto}
 .refresh-control{grid-column:2;grid-row:5}
}
@media(prefers-reduced-motion:reduce){.preview-panel{transition:none}}

\n/* --------------------------------------------------------------------------
   Fixed-height library workspace. Header, hero, tabs, filters, pagination and
   preview panel stay in place; only file-list-scroll handles page-level wheel.
   Scoped to /files, so dashboard and other project routes behave unchanged.
   -------------------------------------------------------------------------- */
:global(body.pq-files-workspace-fixed){overflow:hidden}
:global(body.pq-files-workspace-fixed .pq-layout-frame){height:100dvh;overflow:hidden}
:global(body.pq-files-workspace-fixed .pq-layout-main){height:calc(100dvh - var(--pq-topbar-height,70px));min-height:0;overflow:hidden}
:global(body.pq-files-workspace-fixed .pq-layout-footer){display:none}
.file-portal{display:flex;flex-direction:column;height:100%;min-height:0;padding-bottom:0;overflow:hidden}
.share-hero{flex:none}
.portal-layout{flex:1;min-height:0;width:100%;align-items:stretch;overflow:hidden;padding-bottom:clamp(8px,1.3vh,16px)}
.portal-left{display:flex;flex-direction:column;min-height:0;overflow:hidden}
.library-tabs{flex:none}
.library-card{display:flex;flex:1;min-height:0;flex-direction:column;overflow:hidden}
.library-section-heading,.filter-bar{flex:none}
.file-list-scroll{min-height:0;flex:1;overflow-y:auto;overflow-x:hidden;overscroll-behavior-y:contain;scrollbar-width:thin;scrollbar-color:#a9c6e6 transparent;padding:2px 5px 9px 2px;scroll-padding-top:12px}
.file-list-scroll::-webkit-scrollbar{width:9px}
.file-list-scroll::-webkit-scrollbar-thumb{background:#c7d9ee;border:2px solid transparent;border-radius:9px;background-clip:padding-box}
.file-list-scroll::-webkit-scrollbar-thumb:hover{background:#92b9e4;background-clip:padding-box}
.file-list-scroll:focus-visible{outline:2px solid #1874de;outline-offset:-2px;border-radius:8px}
.file-mobile-card:nth-last-child(-n+2) .more-menu{top:auto;bottom:calc(100% + 4px)}
.table-footer{flex:none;margin-top:0;padding:10px 5px 0;border-top:1px solid #e6edf5;background:#fff}
.preview-panel{align-self:stretch;height:100%;min-height:0;max-height:100%;overflow:hidden}
.preview-heading,.preview-ai-control,.preview-tabs,.preview-bottom{flex-shrink:0}
.document-viewer{flex:1 1 0;height:auto;min-height:140px;max-height:none}
.file-detail-panel{flex:1 1 0;height:auto;min-height:0;overflow-y:auto}
.preview-bottom{margin-top:8px;padding-top:8px}
.preview-panel .no-selection{min-height:0;flex:1}
.preview-panel section.max-h-72{max-height:min(17dvh,140px)}
.filter-toggle{display:none}
.filter-extra{display:contents}
/* The preview switches to an independent drawer below 1431px. */
@media(max-width:1430px){
 .preview-panel{align-self:auto;height:100dvh;max-height:100dvh;overflow-y:auto}
 .document-viewer{flex:none;height:clamp(300px,50dvh,620px);min-height:290px}
 .file-detail-panel{flex:none;height:auto;min-height:290px}
}
@media(max-width:900px){
 .share-hero,.hero-inner{min-height:88px}
 .hero-inner{padding-block:12px}
 .library-tabs{min-height:0;padding-block:8px}
 .library-tabs button{min-height:36px;padding:6px 8px}
 .library-section-heading{margin-bottom:8px}
 .filter-bar{grid-template-columns:minmax(0,1fr) auto 40px;gap:7px;margin-bottom:9px}
 .filter-search{grid-column:1;min-width:0}
 .filter-toggle{grid-column:2;display:inline-flex;align-items:center;justify-content:center;gap:5px;height:42px;padding:0 9px;border:1px solid #dfe7f1;border-radius:10px;background:#f9fbfd;color:#295c9a;font-size:12px;font-weight:750;white-space:nowrap}
 .filter-toggle .filter-toggle-open{transform:rotate(180deg)}
 .filter-extra{display:none}
 .filter-bar.filter-expanded .filter-extra{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;grid-column:1/-1;grid-row:2}
 .filter-bar.filter-expanded .filter-extra .filter-select{display:flex;grid-column:auto;grid-row:auto}
 .filter-bar.filter-expanded .filter-extra .sort-select{grid-column:1/-1}
 .refresh-control{grid-column:3;grid-row:1}
 .table-footer{padding-top:7px}
}
@media(max-width:600px){
 .share-hero,.hero-inner{min-height:65px!important}
 .hero-inner{flex-wrap:nowrap;gap:8px;padding:8px 12px}
 .hero-icon{display:none}
 .hero-eyebrow,.hero-inner p{display:none}
 .hero-inner h1{font-size:clamp(15px,4.5vw,19px);line-height:1.3}
 .hero-upload-action{flex-basis:auto;width:40px;height:40px;min-height:40px;max-width:40px;flex-shrink:0;padding:0}
 .hero-upload-action span{display:none}
 .portal-layout{padding:0 8px 7px}
 .library-tabs{grid-template-columns:repeat(2,minmax(0,1fr));padding:7px 0;gap:5px}
 .library-tabs button{min-height:31px;padding:4px 6px;font-size:10px}
 .library-card{padding:10px;border-radius:12px}
 .library-section-heading{margin-bottom:6px}
 .library-section-heading h2{font-size:14px}
 .library-section-heading p{display:none}
 .filter-bar{grid-template-columns:minmax(0,1fr) auto 36px;gap:5px;margin-bottom:7px}
 .filter-search,.filter-toggle,.refresh-control{height:38px}
 .filter-search{padding:0 7px}
 .filter-search input{font-size:11px}
 .filter-toggle{padding:0 7px;font-size:11px}
 .refresh-control{width:36px}
 .file-mobile-list{gap:8px}
 .file-mobile-card{padding:10px}
 .table-footer{justify-content:center;flex-wrap:wrap;gap:4px;padding:5px 0 0;font-size:11px}
 .table-footer .pagination{gap:3px;justify-content:center}
 .table-footer .pagination button{min-width:28px;height:30px;padding:3px 5px;font-size:11px;border-radius:7px}
 .table-footer .pagination svg{width:16px;height:16px}
}
@media(max-width:365px){
 .filter-toggle{font-size:0;gap:2px;min-width:39px}
 .filter-toggle svg{width:15px;height:15px}
 .filter-bar.filter-expanded .filter-extra{grid-template-columns:1fr}
 .filter-bar.filter-expanded .filter-extra .sort-select{grid-column:auto}
}
@media(max-height:680px){
 .share-hero,.hero-inner{min-height:66px!important}
 .hero-icon{width:40px;height:40px}
 .hero-inner h1{font-size:19px}
 .library-tabs{padding-block:5px}
 .library-card{padding-top:10px;padding-bottom:8px}
 .preview-tabs{margin-block:7px}
 .preview-ai-control{margin-top:6px}
 .document-viewer{min-height:125px}
}

</style>

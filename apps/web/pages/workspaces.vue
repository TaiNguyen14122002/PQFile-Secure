<script setup lang="ts">
import { UsersRound, PlusCircle, UserPlus, ShieldCheck, Trash2, RefreshCw, LogOut,
  LoaderCircle, Search, Pencil, Check, X, UserRound, FolderOpen, LockKeyhole } from 'lucide-vue-next';
type Workspace={id:string;name:string;role:string;createdAt:string};
type Member={id:string;email:string;displayName:string;role:string};
const {user}=useAuth();
const workspaces=ref<Workspace[]>([]),members=ref<Member[]>([]),active=ref<Workspace|null>(null);
const name=ref(''),query=ref(''),email=ref(''),role=ref('VIEWER');
const renaming=ref(false),newName=ref('');
const memberSearch=ref(''),memberRoleFilter=ref('all'),groupScope=ref('all');
let memberRequest=0;
const busy=ref(false),loading=ref(true),loadingMembers=ref(false),error=ref(''),success=ref('');
const roles=['ADMIN','EDITOR','UPLOADER','VIEWER'];
const labels:Record<string,string>={OWNER:'Chủ nhóm',ADMIN:'Quản trị',EDITOR:'Biên tập',UPLOADER:'Tải lên',VIEWER:'Chỉ xem'};
const filtered=computed(()=>workspaces.value.filter(w=>w.name.toLocaleLowerCase('vi').includes(query.value.trim().toLocaleLowerCase('vi'))&&
  (groupScope.value==='all'||(groupScope.value==='mine'?w.role==='OWNER':['OWNER','ADMIN'].includes(w.role)))));
const visibleMembers=computed(()=>members.value.filter(m=>{const text=memberSearch.value.trim().toLocaleLowerCase('vi');return (!text||`${m.displayName} ${m.email}`.toLocaleLowerCase('vi').includes(text))&&(memberRoleFilter.value==='all'||m.role===memberRoleFilter.value);}));
const managerGroups=computed(()=>workspaces.value.filter(w=>['OWNER','ADMIN'].includes(w.role)).length);
const canManage=computed(()=>active.value?.role==='OWNER'||active.value?.role==='ADMIN');
const isOwner=computed(()=>active.value?.role==='OWNER');
const adminCount=computed(()=>members.value.filter(m=>['OWNER','ADMIN'].includes(m.role)).length);
function clearNotices(){error.value='';success.value='';}
function canEdit(m:Member){return active.value?.role==='OWNER'&&m.role!=='OWNER'||active.value?.role==='ADMIN'&&!['OWNER','ADMIN'].includes(m.role);}
async function load(){
  loading.value=true;
  try{
    const response=await requestApi<Workspace[]>('/workspaces');
    workspaces.value=response.sort((a,b)=>a.name.localeCompare(b.name,'vi'));
    const selected=active.value&&workspaces.value.find(w=>w.id===active.value!.id);
    if(selected)await open(selected);else{active.value=null;members.value=[];}
    error.value='';
  }catch(e:any){error.value=e?.message||'Không tải được nhóm làm việc.';}
  finally{loading.value=false;}
}
async function open(w:Workspace){
  const current=++memberRequest;active.value=w;loadingMembers.value=true;renaming.value=false;newName.value=w.name;
  memberSearch.value='';memberRoleFilter.value='all';
  try{const response=await requestApi<Member[]>(`/workspaces/${w.id}/members`);if(current!==memberRequest)return;
   members.value=response.sort((a,b)=>a.role==='OWNER'?-1:b.role==='OWNER'?1:a.displayName.localeCompare(b.displayName,'vi'));
  }catch(e:any){if(current!==memberRequest)return;error.value=e?.message||'Không thể tải thành viên';members.value=[];}
  finally{if(current===memberRequest)loadingMembers.value=false;}
}
async function createGroup(){
  if(name.value.trim().length<2)return;
  busy.value=true;clearNotices();
  try{const created=await requestApi<{id:string}>('/workspaces',{method:'POST',body:JSON.stringify({name:name.value.trim()})});
    name.value='';await load();const group=workspaces.value.find(w=>w.id===created.id);if(group)await open(group);
    success.value='Nhóm mới đã được tạo.';
  }catch(e:any){error.value=e?.message||'Tạo nhóm thất bại';}finally{busy.value=false;}
}
async function renameGroup(){
  if(!active.value||!isOwner.value||newName.value.trim().length<2)return;
  busy.value=true;clearNotices();const id=active.value.id;
  try{await requestApi(`/workspaces/${id}`,{method:'PATCH',body:JSON.stringify({name:newName.value.trim()})});renaming.value=false;
    await load();success.value='Đã cập nhật tên nhóm.';
  }catch(e:any){error.value=e?.message||'Không đổi được tên nhóm';}finally{busy.value=false;}
}
async function deleteGroup(){
  if(!active.value||!isOwner.value)return;
  if(!confirm(`Xóa nhóm “${active.value.name}” cùng danh sách thành viên? Thao tác này không xóa tệp tin.`))return;
  busy.value=true;clearNotices();
  try{await requestApi(`/workspaces/${active.value.id}`,{method:'DELETE'});active.value=null;members.value=[];
    await load();success.value='Đã xóa nhóm. Dữ liệu tệp cá nhân vẫn được giữ nguyên.';
  }catch(e:any){error.value=e?.message||'Không thể xóa nhóm';}finally{busy.value=false;}
}
async function addMember(){
  if(!active.value||!email.value.trim())return;
  busy.value=true;clearNotices();
  try{await requestApi(`/workspaces/${active.value.id}/members`,{method:'POST',body:JSON.stringify({email:email.value.trim(),role:role.value})});
    email.value='';await open(active.value);success.value='Đã thêm thành viên vào nhóm.';
  }catch(e:any){error.value=e?.message||'Không thể thêm thành viên';}finally{busy.value=false;}
}
async function changeRole(m:Member,r:string){
  if(!active.value||m.role===r)return;
  busy.value=true;clearNotices();
  try{await requestApi(`/workspaces/${active.value.id}/members/${m.id}`,{method:'PATCH',body:JSON.stringify({role:r})});
    await load();success.value='Đã cập nhật quyền thành viên.';
  }catch(e:any){error.value=e?.message||'Không thể cập nhật quyền';}finally{busy.value=false;}
}
async function removeMember(m:Member){
  if(!active.value||!confirm(m.id===user.value?.id?'Rời nhóm làm việc này?':`Xóa ${m.displayName} khỏi nhóm?`))return;
  busy.value=true;clearNotices();
  try{const self=m.id===user.value?.id;await requestApi(`/workspaces/${active.value.id}/members/${m.id}`,{method:'DELETE'});
    if(self){active.value=null;members.value=[];}await load();success.value=self?'Bạn đã rời nhóm.':'Đã xóa thành viên.';
  }catch(e:any){error.value=e?.message||'Không thể xóa thành viên';}finally{busy.value=false;}
}
onMounted(load);
onBeforeUnmount(()=>{memberRequest++;});
</script>
<template>
  <div class="pq-container pq-refined-page pq-library-pattern pq-space-optimized pq-refined-workspaces pq-ops-page space-y-5 py-7 sm:py-9">
    <PageHeading eyebrow="LÀM VIỆC CÙNG NHAU" title="Nhóm làm việc"
      description="Tạo nhóm, phân vai trò và quản lý người dùng đã đăng ký mà không ảnh hưởng đến dữ liệu tệp cá nhân.">
      <template #icon><UsersRound :size="35" /></template>
      <template #actions><NuxtLink to="/files?tab=sent"><FolderOpen :size="17"/> Tệp đã chia sẻ</NuxtLink><button :disabled="loading" @click="load"><RefreshCw :size="17" :class="loading?'animate-spin':''"/> Làm mới</button></template>
    </PageHeading>
    <div v-if="error" role="alert" class="pq-alert pq-alert-error">{{error}}</div>
    <div v-if="success" role="status" class="pq-alert pq-alert-success">{{success}}</div>
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <div class="pq-kpi-mini"><strong>{{workspaces.length}}</strong><span>Nhóm đang tham gia</span></div>
      <div class="pq-kpi-mini"><strong>{{active?members.length:'—'}}</strong><span>Thành viên nhóm đã chọn</span></div>
      <div class="pq-kpi-mini col-span-2 sm:col-span-1"><strong>{{managerGroups}}</strong><span>Nhóm bạn có quyền quản trị</span></div>
    </div>
    <div class="grid pq-workspace-columns pq-ops-workspace-layout items-start gap-5 xl:grid-cols-[minmax(290px,.78fr)_minmax(0,1.22fr)]">
      <section class="soft-card pq-ops-panel min-w-0 p-4 sm:p-6">
        <div class="pq-section-head"><h2>Danh sách nhóm</h2><span class="text-xs text-[#52729c]">{{filtered.length}} / {{workspaces.length}}</span></div>
        <form class="pq-workspace-create flex flex-wrap gap-2" @submit.prevent="createGroup">
          <label class="min-w-0 flex-1"><span class="sr-only">Tên nhóm mới</span><input v-model="name" class="pq-field" maxlength="120" minlength="2" placeholder="Nhập tên nhóm mới..." required/></label>
          <button class="primary-button !rounded-xl !px-4" type="submit" :disabled="busy||name.trim().length<2"><PlusCircle :size="18"/> Tạo</button>
        </form>
        <div class="pq-ops-group-controls"><label class="relative block"><Search :size="17" class="absolute left-3 top-3 text-[#6281a8]"/><input v-model="query" class="pq-field !pl-10" placeholder="Tìm nhóm theo tên..." aria-label="Tìm nhóm"/></label><label><span class="sr-only">Lọc nhóm theo quyền</span><select v-model="groupScope" class="pq-field"><option value="all">Tất cả nhóm</option><option value="mine">Do tôi sở hữu</option><option value="managed">Có quyền quản trị</option></select></label></div>
        <div v-if="loading" class="mt-4 space-y-2"><div v-for="i in 4" :key="i" class="pq-skeleton h-14"/></div>
        <div v-else-if="!filtered.length" class="pq-empty"><UsersRound :size="39" class="text-blue-300"/><h3>{{query?'Không có nhóm phù hợp':'Chưa có nhóm làm việc'}}</h3><p>{{query?'Hãy thay đổi từ khóa.':'Tạo nhóm đầu tiên để bắt đầu cộng tác.'}}</p></div>
        <div v-else class="pq-ops-group-list mt-4 max-h-[560px] space-y-2 overflow-y-auto pr-1" tabindex="0" role="region" aria-label="Danh sách nhóm có thể cuộn">
          <button v-for="w in filtered" :key="w.id" class="flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition hover:bg-blue-50" :class="active?.id===w.id?'border-blue-500 bg-blue-50 ring-1 ring-blue-200':'border-blue-100 bg-white'" :aria-pressed="active?.id===w.id" @click="open(w)">
            <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e3f1ff] text-blue-700"><UsersRound :size="21"/></span>
            <span class="min-w-0 flex-1"><strong class="block truncate text-sm text-[#18316b]">{{w.name}}</strong><small class="text-xs text-[#607da6]">{{labels[w.role]||w.role}}</small></span>
            <ShieldCheck v-if="active?.id===w.id" :size="18" class="shrink-0 text-blue-600"/>
          </button>
        </div>
      </section>
      <section class="soft-card pq-ops-panel min-w-0 p-4 sm:p-6">
        <template v-if="active">
          <div class="pq-section-head"><div class="min-w-0"><h2 class="break-words">{{active.name}}</h2><p class="mt-1 text-xs text-[#6881a1]">Vai trò của bạn: {{labels[active.role]||active.role}}</p></div>
            <div v-if="isOwner" class="flex gap-2"><button class="pq-icon-button" title="Đổi tên nhóm" :disabled="busy" @click="newName=active.name;renaming=!renaming"><Pencil :size="16"/> Sửa</button><button class="pq-icon-button danger" title="Xóa nhóm" :disabled="busy" @click="deleteGroup"><Trash2 :size="16"/></button></div>
          </div>
          <form v-if="renaming&&isOwner" class="mb-5 flex flex-wrap gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3" @submit.prevent="renameGroup"><input v-model="newName" class="pq-field min-w-0 flex-1" maxlength="120" required minlength="2" aria-label="Tên nhóm mới"/><button class="pq-icon-button" type="submit" :disabled="busy||newName.trim().length<2"><Check :size="17"/> Lưu</button><button type="button" class="pq-icon-button" @click="renaming=false"><X :size="16"/></button></form>
          <form v-if="canManage" class="mb-4 rounded-xl border border-blue-100 bg-blue-50/70 p-4" @submit.prevent="addMember">
            <label class="form-label" for="member-email">Thêm người dùng đã có tài khoản</label>
            <div class="flex flex-col gap-2 sm:flex-row"><input id="member-email" v-model="email" type="email" class="pq-field min-w-0 flex-1" maxlength="255" required autocomplete="off" placeholder="email@domain.com"/>
              <select v-model="role" class="pq-field sm:!w-[152px]" aria-label="Vai trò thành viên"><option v-for="r in roles" :key="r" :value="r" :disabled="active.role==='ADMIN'&&r==='ADMIN'">{{labels[r]}}</option></select>
              <button class="primary-button !rounded-xl !px-4" :disabled="busy||!email.trim()" type="submit"><UserPlus :size="17"/> Thêm</button></div>
            <p class="mt-2 text-xs text-[#5676a0]">Chỉ chủ nhóm được cấp vai trò quản trị. Thao tác này không tự động chia sẻ tệp.</p>
          </form>
          <div class="pq-section-head !mb-2"><h2>Thành viên</h2><span class="text-xs text-[#6782a7]">{{visibleMembers.length}} / {{members.length}} người · {{adminCount}} quản trị</span></div>
          <div class="pq-ops-member-filters"><label class="relative"><Search :size="16" class="absolute left-3 top-3 text-[#6281a8]"/><input v-model="memberSearch" class="pq-field !pl-10" type="search" placeholder="Tìm tên hoặc email" aria-label="Tìm thành viên"/></label><select v-model="memberRoleFilter" class="pq-field" aria-label="Lọc vai trò thành viên"><option value="all">Mọi vai trò</option><option value="OWNER">Chủ nhóm</option><option v-for="r in roles" :key="r" :value="r">{{labels[r]}}</option></select></div>
          <div v-if="loadingMembers" class="space-y-3 py-4"><div v-for="i in 3" :key="i" class="pq-skeleton h-14"/></div>
          <div v-else-if="!visibleMembers.length" class="pq-empty !py-6">Không tìm thấy thành viên theo bộ lọc.</div>
          <div v-else class="divide-y divide-blue-100 pq-ops-member-list" tabindex="0" role="region" aria-label="Danh sách thành viên có thể cuộn">
            <div v-for="m in visibleMembers" :key="m.id" class="pq-list-entry pq-workspace-member pq-ops-member flex-wrap">
              <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#dcecff] font-extrabold text-blue-700">{{m.displayName.trim().slice(0,1).toUpperCase()}}</span>
              <div class="min-w-0 flex-1"><p class="font-extrabold text-[#18316b]">{{m.displayName}} <span v-if="m.id===user?.id" class="text-xs font-normal text-[#7089a7]">(Bạn)</span></p><p class="break-all text-xs text-[#6781a0]">{{m.email}}</p></div>
              <div class="flex items-center gap-2"><select v-if="canEdit(m)" :value="m.role" class="pq-field !h-10 !w-32 !px-2 text-xs" :disabled="busy" :aria-label="'Vai trò của '+m.displayName" @change="changeRole(m,($event.target as HTMLSelectElement).value)"><option v-for="r in roles" :key="r" :value="r" :disabled="active?.role==='ADMIN'&&r==='ADMIN'">{{labels[r]}}</option></select><span v-else class="rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800">{{labels[m.role]||m.role}}</span>
                <button v-if="canEdit(m)||m.id===user?.id&&m.role!=='OWNER'" class="pq-icon-button danger" :title="m.id===user?.id?'Rời nhóm':'Xóa khỏi nhóm'" :aria-label="m.id===user?.id?'Rời nhóm':'Xóa '+m.displayName+' khỏi nhóm'" :disabled="busy" @click="removeMember(m)"><LogOut v-if="m.id===user?.id" :size="17"/><Trash2 v-else :size="17"/></button>
              </div>
            </div>
          </div>
          <div class="mt-4 flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-900"><LockKeyhole :size="18" class="shrink-0"/><p>Quyền nhóm dùng cho quản trị thành viên; nhóm chưa tự động cấp quyền vào tệp mã hóa. Muốn người khác giải mã tệp, hãy dùng chức năng Chia sẻ và khóa công khai của họ.</p></div>
        </template>
        <div v-else class="pq-empty py-20"><UserRound :size="48" class="text-blue-300"/><h3>Chọn một nhóm để bắt đầu</h3><p>Xem và quản lý thành viên, đổi vai trò hoặc sửa tên nhóm ở khung bên cạnh.</p></div>
      </section>
    </div>
  </div>
</template>

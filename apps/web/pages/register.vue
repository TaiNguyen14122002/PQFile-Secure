<script setup lang="ts">
import { ShieldPlus, ShieldCheck, Eye, EyeOff, KeyRound, LockKeyhole } from 'lucide-vue-next';
const displayName=ref(''),email=ref(''),password=ref(''),confirmPassword=ref('');
const error=ref(''),busy=ref(false),showPassword=ref(false);
const {load}=useAuth();
const matching=computed(()=>!confirmPassword.value||password.value===confirmPassword.value);
async function submit(){
  if(busy.value)return;
  if(password.value.length<12){error.value='Mật khẩu đăng nhập cần tối thiểu 12 ký tự';return;}
  if(password.value!==confirmPassword.value){error.value='Mật khẩu xác nhận không trùng khớp';return;}
  busy.value=true;error.value='';
  try{await requestApi('/auth/register',{method:'POST',body:JSON.stringify({displayName:displayName.value.trim(),email:email.value.trim(),password:password.value})});
    password.value='';confirmPassword.value='';await load();await navigateTo('/keys');
  }catch(e:any){error.value=e?.message||'Không thể tạo tài khoản.';}
  finally{busy.value=false;}
}
</script>
<template>
  <div class="pq-auth-layout pq-container pq-refined-page pq-library-pattern pq-space-optimized pq-refined-register py-8 sm:py-12">
    <section class="pq-auth-intro" aria-label="Đăng ký PQFile Secure">
      <div class="relative z-10 space-y-5"><span class="pq-auth-eyebrow">BẮT ĐẦU AN TOÀN</span>
        <div class="flex items-center gap-3"><ShieldCheck :size="52"/><span class="text-3xl font-black tracking-tight">PQFile Secure</span></div>
        <h1 class="text-3xl font-extrabold leading-tight sm:text-4xl">Bắt đầu bằng tài khoản và bộ khóa của riêng bạn</h1>
        <p class="max-w-lg text-sm leading-7 text-blue-50 sm:text-base">Sau khi tạo tài khoản, ứng dụng sẽ hướng dẫn bạn sinh bộ khóa ML-KEM và ML-DSA ngay trên trình duyệt.</p>
        <div class="space-y-3 border-t border-white/30 pt-5 text-sm font-bold"><p class="flex items-center gap-2"><KeyRound :size="19"/> Khóa bí mật được bảo vệ bằng mật khẩu riêng</p><p class="flex items-center gap-2"><LockKeyhole :size="19"/> Hãy lưu bản sao kho khóa ở nơi an toàn</p></div>
      </div>
    </section>
    <section class="soft-card flex flex-col justify-center p-6 sm:p-9" aria-label="Đăng ký">
      <div class="mb-5"><p class="pq-eyebrow">TẠO TÀI KHOẢN MỚI</p><h2 class="mt-2 text-3xl font-black tracking-tight text-[#0e2e72]">Đăng ký</h2><p class="mt-2 text-sm text-[#607aa0]">Điền thông tin để bắt đầu quản lý tệp mã hóa.</p></div>
      <form class="space-y-4" @submit.prevent="submit">
        <div><label for="register-name" class="form-label">Họ và tên</label><input id="register-name" v-model.trim="displayName" class="pq-field" required minlength="2" maxlength="150" autocomplete="name" placeholder="Họ tên hiển thị"/></div>
        <div><label for="register-email" class="form-label">Email</label><input id="register-email" v-model.trim="email" type="email" class="pq-field" required maxlength="255" autocomplete="email" placeholder="email@domain.com"/></div>
        <div><label for="register-password" class="form-label">Mật khẩu đăng nhập (12 ký tự trở lên)</label><div class="relative"><input id="register-password" v-model="password" :type="showPassword?'text':'password'" class="pq-field !pr-12" minlength="12" maxlength="128" required autocomplete="new-password" placeholder="Tạo mật khẩu mạnh"/><button type="button" class="absolute inset-y-0 right-1 flex w-10 items-center justify-center text-[#5579a3]" :aria-label="showPassword?'Ẩn mật khẩu':'Hiện mật khẩu'" @click="showPassword=!showPassword"><EyeOff v-if="showPassword" :size="19"/><Eye v-else :size="19"/></button></div></div>
        <div><label for="register-confirm" class="form-label">Xác nhận mật khẩu</label><input id="register-confirm" v-model="confirmPassword" :type="showPassword?'text':'password'" class="pq-field" required autocomplete="new-password" placeholder="Nhập lại mật khẩu"/><small v-if="!matching" class="mt-1 block font-semibold text-rose-600">Mật khẩu nhập lại chưa khớp.</small></div>
        <div v-if="error" role="alert" class="pq-alert pq-alert-error">{{error}}</div>
        <button class="primary-button w-full" :disabled="busy||!matching" type="submit"><ShieldPlus :size="19"/>{{busy?'Đang tạo tài khoản...':'Tạo tài khoản'}}</button>
      </form>
      <p class="mt-6 border-t border-blue-100 pt-5 text-center text-sm text-[#61789e]"><NuxtLink to="/onboarding" class="mb-3 block font-semibold text-blue-600 underline">Thử mô phỏng & kiểm tra trình duyệt trước khi đăng ký</NuxtLink>Đã có tài khoản? <NuxtLink to="/login" class="font-bold text-blue-600 underline">Đăng nhập</NuxtLink></p>
    </section>
  </div>
</template>

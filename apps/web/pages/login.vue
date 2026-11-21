<script setup lang="ts">
import { ShieldCheck, LogIn, Eye, EyeOff, LockKeyhole, KeyRound } from 'lucide-vue-next';
const email=ref(''),password=ref(''),error=ref(''),busy=ref(false),showPassword=ref(false);
const {load}=useAuth();
async function submit(){
  if(busy.value)return;
  busy.value=true;error.value='';
  try{await requestApi('/auth/login',{method:'POST',body:JSON.stringify({email:email.value.trim(),password:password.value})});
    password.value='';await load();await navigateTo('/dashboard');
  }catch(e:any){error.value=e?.message||'Không thể đăng nhập. Vui lòng thử lại.';}
  finally{busy.value=false;}
}
</script>
<template>
  <div class="pq-auth-layout pq-container pq-refined-page pq-library-pattern pq-space-optimized pq-refined-login py-8 sm:py-12">
    <section class="pq-auth-intro" aria-label="Giới thiệu PQFile Secure">
      <div class="relative z-10 space-y-5"><span class="pq-auth-eyebrow">NỀN TẢNG BẢO VỆ TỆP TIN</span>
        <div class="flex items-center gap-3"><ShieldCheck :size="52"/><span class="text-3xl font-black tracking-tight">PQFile Secure</span></div>
        <h1 class="text-3xl font-extrabold leading-tight sm:text-4xl">Quản lý tệp an toàn với mật mã hậu lượng tử</h1>
        <p class="max-w-lg text-sm leading-7 text-blue-50 sm:text-base">Mã hóa tệp trên thiết bị, bảo vệ khóa nội dung bằng ML-KEM và xác minh chữ ký số ML-DSA trước khi giải mã.</p>
        <div class="space-y-3 border-t border-white/30 pt-5 text-sm font-bold"><p class="flex items-center gap-2"><LockKeyhole :size="19"/> Bản rõ không được tải lên máy chủ</p><p class="flex items-center gap-2"><KeyRound :size="19"/> Bạn tự quản lý mật khẩu kho khóa</p></div>
      </div>
    </section>
    <section class="soft-card flex flex-col justify-center p-6 sm:p-9" aria-label="Đăng nhập">
      <div class="mb-7"><p class="pq-eyebrow">CHÀO MỪNG TRỞ LẠI</p><h2 class="mt-2 text-3xl font-black tracking-tight text-[#0e2e72]">Đăng nhập</h2><p class="mt-2 text-sm text-[#607aa0]">Truy cập thư viện, chia sẻ và kho khóa của bạn.</p></div>
      <form class="space-y-5" @submit.prevent="submit">
        <div><label for="login-email" class="form-label">Địa chỉ email</label><input id="login-email" v-model.trim="email" type="email" class="pq-field" maxlength="255" required autocomplete="username" placeholder="email@domain.com"/></div>
        <div><label for="login-password" class="form-label">Mật khẩu đăng nhập</label><div class="relative"><input id="login-password" v-model="password" :type="showPassword?'text':'password'" class="pq-field !pr-12" required autocomplete="current-password" placeholder="Nhập mật khẩu"/><button type="button" class="absolute inset-y-0 right-1 flex w-10 items-center justify-center text-[#5579a3]" :aria-label="showPassword?'Ẩn mật khẩu':'Hiện mật khẩu'" @click="showPassword=!showPassword"><EyeOff v-if="showPassword" :size="19"/><Eye v-else :size="19"/></button></div></div>
        <div v-if="error" role="alert" class="pq-alert pq-alert-error">{{error}}</div>
        <button class="primary-button w-full" :disabled="busy" type="submit"><LogIn :size="19"/>{{busy?'Đang xác thực...':'Đăng nhập an toàn'}}</button>
      </form>
      <p class="mt-7 border-t border-blue-100 pt-5 text-center text-sm text-[#61789e]">Chưa có tài khoản? <NuxtLink to="/register" class="font-bold text-blue-600 underline">Đăng ký ngay</NuxtLink></p>
    </section>
  </div>
</template>

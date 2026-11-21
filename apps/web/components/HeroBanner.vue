<script setup lang="ts">
import { ShieldCheck, LockKeyhole, FileUp, CheckCircle2 } from 'lucide-vue-next';
</script>
<template>
  <section class="pq-upload-hero" aria-labelledby="pq-upload-page-title">
    <div class="pq-upload-hero-main">
      <div class="pq-upload-hero-icon" aria-hidden="true"><FileUp :size="28" /></div>
      <div class="pq-upload-hero-copy">
        <p class="pq-upload-hero-eyebrow">KHÔNG GIAN LƯU TRỮ BẢO MẬT</p>
        <h1 id="pq-upload-page-title">Tải lên và mã hóa tệp</h1>
        <p>Chọn tài liệu, kiểm tra rủi ro và mã hóa ngay trên thiết bị trước khi chia sẻ.</p>
      </div>
    </div>
    <div class="pq-upload-hero-steps" aria-label="Quy trình bảo vệ tệp">
      <span><CheckCircle2 :size="16"/> Chọn tệp</span>
      <span><ShieldCheck :size="16"/> Kiểm tra bảo mật</span>
      <span><LockKeyhole :size="16"/> Mã hóa và lưu trữ</span>
    </div>
  </section>
</template>

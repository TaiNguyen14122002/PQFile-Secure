<script setup lang="ts">
// Single source of truth: the received-files tab owns all preview/decryption actions.
await navigateTo('/files?tab=received',{replace:true});
</script>
<template><div class="pq-container py-12 text-center">Đang mở thư viện tệp được chia sẻ…</div></template>

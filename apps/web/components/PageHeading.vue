<script setup lang="ts">
defineProps<{eyebrow:string;title:string;description:string}>();
</script>
<template>
  <header class="pq-page-heading">
    <div class="pq-heading-icon" aria-hidden="true"><slot name="icon"/></div>
    <div class="min-w-0 flex-1">
      <p class="pq-heading-eyebrow">{{eyebrow}}</p>
      <h1>{{title}}</h1>
      <p class="pq-heading-description">{{description}}</p>
    </div>
    <div v-if="$slots.actions" class="pq-heading-actions"><slot name="actions"/></div>
  </header>
</template>

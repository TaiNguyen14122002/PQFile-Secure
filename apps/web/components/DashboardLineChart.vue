<script setup lang="ts">
type Month = { label: string; uploads: number; shares: number };
const props = defineProps<{ months: Month[] }>();
const maxY = computed(() => {
  const maxValue = Math.max(0, ...props.months.flatMap(m => [m.uploads, m.shares]));
  return Math.max(4, Math.ceil(maxValue / 4) * 4);
});
const getX = (i: number) => 52 + i * 660 / Math.max(1, props.months.length - 1);
const getY = (v: number) => 208 - (Math.max(0, v) / maxY.value) * 170;
const makePoints = (key: 'uploads' | 'shares') => props.months.map((m, i) => ({ x: getX(i), y: getY(m[key]), value: m[key], label: m.label }));
const points = computed(() => ({ uploads: makePoints('uploads'), shares: makePoints('shares') }));
const line = (items: ReturnType<typeof makePoints>) => items.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
const fill = (items: ReturnType<typeof makePoints>) => items.length ? `${line(items)} L ${items[items.length - 1].x} 208 L ${items[0].x} 208 Z` : '';
</script>
<template>
  <svg class="w-full" viewBox="0 0 760 255" role="img" aria-label="Biểu đồ số tệp tải lên và lượt chia sẻ trong bảy tháng gần nhất">
    <defs>
      <linearGradient id="pq-upload-gradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#1289ff" stop-opacity=".20" />
        <stop offset="1" stop-color="#1289ff" stop-opacity=".01" />
      </linearGradient>
      <linearGradient id="pq-share-gradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#8a4eff" stop-opacity=".20" />
        <stop offset="1" stop-color="#8a4eff" stop-opacity=".01" />
      </linearGradient>
    </defs>
    <g v-for="step in 5" :key="step">
      <line x1="52" :y1="208-(step-1)*42.5" x2="715" :y2="208-(step-1)*42.5" stroke="#d8e7fa" stroke-width="1" />
      <text x="42" :y="213-(step-1)*42.5" font-size="13" text-anchor="end" fill="#243e7a">{{Math.round((step-1)*maxY/4)}}</text>
    </g>
    <path :d="fill(points.shares)" fill="url(#pq-share-gradient)" />
    <path :d="fill(points.uploads)" fill="url(#pq-upload-gradient)" />
    <path :d="line(points.shares)" stroke="#874bfa" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    <path :d="line(points.uploads)" stroke="#0678fa" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    <g v-for="(p,i) in points.uploads" :key="'u'+i"><circle :cx="p.x" :cy="p.y" r="5" fill="white" stroke="#0678fa" stroke-width="3"><title>{{p.label}}: {{p.value}} tệp tải lên</title></circle></g>
    <g v-for="(p,i) in points.shares" :key="'s'+i"><circle :cx="p.x" :cy="p.y" r="5" fill="white" stroke="#874bfa" stroke-width="3"><title>{{p.label}}: {{p.value}} lượt chia sẻ</title></circle></g>
    <text v-for="(m,i) in months" :key="m.label+i" :x="getX(i)" y="238" font-size="13" text-anchor="middle" fill="#152b64">{{m.label}}</text>
  </svg>
</template>

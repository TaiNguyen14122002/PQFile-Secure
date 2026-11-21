<script setup lang="ts">
import '~/assets/css/dashboard-next.css';
import {
  Activity, AlertTriangle, ArrowRight, ChartPie, CheckCircle2, Clock3,
  FileClock, FileText, FileUp, FolderOpen, LockKeyhole, RefreshCw,
  Share2, ShieldCheck, TrendingUp, UsersRound
} from 'lucide-vue-next';

type Overview = {
  scope: 'personal'; updatedAt: string; researchFiles?: number;
  totals: { accessibleFiles: number; activeShares: number; encryptedFiles: number; workspaces: number; activityRecords: number };
  changes: { uploads: number | null; shares: number | null };
  monthly: { label: string; uploads: number; shares: number }[];
  types: { documents: number; spreadsheets: number; slides: number; images: number; others: number };
  metadata: {
    complete: number; needsReview: number; missingSignature: number;
    completePercent: number | null; signedPercent: number | null;
    activeSharesPercent: number | null;
  };
  activity: { id: string; action: string; createdAt: string; fileName: string | null }[];
};

const overview = ref<Overview | null>(null);
const loading = ref(true);
const error = ref('');

async function load() {
  if (loading.value && overview.value) return;
  loading.value = true;
  try {
    overview.value = await requestApi<Overview>('/dashboard/overview');
    error.value = '';
  } catch (cause: unknown) {
    error.value = cause instanceof Error ? cause.message : 'Không thể tải dữ liệu Bảng điều khiển.';
  } finally {
    loading.value = false;
  }
}
onMounted(() => { void load(); });

const number = (value: number) => new Intl.NumberFormat('vi-VN').format(value);
const percentage = (value: number | null) => value === null || !Number.isFinite(value)
  ? '—'
  : `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value)}%`;
const clampPercent = (value: number | null) => Math.min(100, Math.max(0, value ?? 0));
const delta = (value: number | null) => value === null
  ? 'Chưa có mốc so sánh'
  : `${value > 0 ? '+' : ''}${percentage(value)} so với tháng trước`;
const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Chưa có thời gian' : date.toLocaleString('vi-VN', {
    hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
  });
};

const metrics = computed(() => {
  const data = overview.value;
  return [
    { key: 'files', label: 'Tệp có thể truy cập', value: data?.totals.accessibleFiles ?? 0, note: delta(data?.changes.uploads ?? null), icon: FolderOpen, tone: 'blue', to: '/files?tab=all' },
    { key: 'shares', label: 'Chia sẻ hiệu lực', value: data?.totals.activeShares ?? 0, note: delta(data?.changes.shares ?? null), icon: Share2, tone: 'purple', to: '/files?tab=sent' },
    { key: 'encrypted', label: 'Tệp đã mã hóa', value: data?.totals.encryptedFiles ?? 0, note: 'Tệp bạn đang sở hữu', icon: LockKeyhole, tone: 'green', to: '/files?tab=all' },
    { key: 'workspaces', label: 'Nhóm làm việc', value: data?.totals.workspaces ?? 0, note: 'Nhóm bạn tham gia', icon: UsersRound, tone: 'orange', to: '/workspaces' }
  ];
});
const types = computed(() => {
  const value = overview.value?.types;
  return [
    { key: 'documents', name: 'Văn bản / PDF', count: value?.documents ?? 0, color: '#2877e8' },
    { key: 'spreadsheets', name: 'Bảng tính', count: value?.spreadsheets ?? 0, color: '#17a97c' },
    { key: 'slides', name: 'Trình chiếu', count: value?.slides ?? 0, color: '#8a64dd' },
    { key: 'images', name: 'Hình ảnh', count: value?.images ?? 0, color: '#f4a740' },
    { key: 'others', name: 'Định dạng khác', count: value?.others ?? 0, color: '#a5b7cc' }
  ];
});
const typeTotal = computed(() => types.value.reduce((sum, item) => sum + item.count, 0));
const typeDonut = computed(() => {
  if (!typeTotal.value) return 'conic-gradient(#e7edf7 0% 100%)';
  let offset = 0;
  const segments = types.value.map(item => {
    const start = offset;
    offset += item.count / typeTotal.value * 100;
    return `${item.color} ${start.toFixed(2)}% ${offset.toFixed(2)}%`;
  });
  return `conic-gradient(${segments.join(', ')})`;
});
const securityChecks = computed(() => [
  { key: 'metadata', label: 'Metadata mã hóa đầy đủ', value: overview.value?.metadata.completePercent ?? null, tone: 'blue' },
  { key: 'signatures', label: 'Có metadata chữ ký số', value: overview.value?.metadata.signedPercent ?? null, tone: 'green' },
  { key: 'sharing', label: 'Chia sẻ còn hiệu lực', value: overview.value?.metadata.activeSharesPercent ?? null, tone: 'purple' }
]);
const metadataParts = computed(() => [
  { label: 'Metadata đầy đủ', count: overview.value?.metadata.complete ?? 0, tone: 'complete' },
  { label: 'Cần rà soát', count: overview.value?.metadata.needsReview ?? 0, tone: 'review' },
  { label: 'Thiếu chữ ký', count: overview.value?.metadata.missingSignature ?? 0, tone: 'missing' }
]);
const labels: Record<string, string> = {
  FILE_ENCRYPT_UPLOAD: 'Tải lên và mã hóa', FILE_SHARE: 'Chia sẻ tài liệu',
  FILE_SHARE_REVOKE: 'Thu hồi quyền chia sẻ', FILE_TRASH: 'Chuyển vào thùng rác',
  FILE_RESTORE: 'Khôi phục tài liệu', FILE_RENAME: 'Đổi tên tài liệu',
  FILE_DELETE_PERMANENT: 'Xóa tài liệu vĩnh viễn'
};
const actionLabel = (action: string) => labels[action] || 'Thao tác với tài liệu';
const activityTone = (action: string) => action.includes('SHARE') ? 'purple' : (action.includes('DELETE') || action.includes('TRASH')) ? 'orange' : 'blue';
</script>

<template>
  <div class="pq-home">
    <div class="pq-home-wrap">
      <header class="pq-home-intro">
        <div class="pq-home-intro-content">
          <span class="pq-home-eyebrow"><ShieldCheck :size="15" aria-hidden="true"/> KHÔNG GIAN LÀM VIỆC AN TOÀN</span>
          <h1>Bảng điều khiển</h1>
          <p>Theo dõi tài liệu mã hóa, hoạt động chia sẻ và trạng thái bảo vệ của tài khoản.</p>
          <div class="pq-home-updated" aria-live="polite">
            <span class="pq-home-scope-dot" aria-hidden="true" />
            <span>Dữ liệu của tài khoản</span>
            <span v-if="overview">· Cập nhật {{formatDate(overview.updatedAt)}}</span>
          </div>
        </div>
        <nav class="pq-home-actions" aria-label="Thao tác nhanh">
          <button type="button" class="pq-home-action pq-home-action--quiet" :disabled="loading" @click="load">
            <RefreshCw :size="17" :class="{'pq-home-spinning':loading}" aria-hidden="true"/> Làm mới
          </button>
          <NuxtLink class="pq-home-action pq-home-action--outline" to="/files?tab=all">
            <FolderOpen :size="17" aria-hidden="true"/> Thư viện
          </NuxtLink>
          <NuxtLink class="pq-home-action pq-home-action--primary" to="/upload">
            <FileUp :size="17" aria-hidden="true"/> Tải lên tệp
          </NuxtLink>
        </nav>
      </header>

      <div v-if="error" class="pq-home-error" role="alert">
        <AlertTriangle :size="20" aria-hidden="true"/>
        <span>{{error}}</span>
        <button type="button" :disabled="loading" @click="load">Thử lại</button>
      </div>

      <div v-if="loading && !overview" class="pq-home-loading" role="status" aria-live="polite">
        <span class="pq-home-loading-pulse" aria-hidden="true"/>
        Đang tải số liệu từ tài khoản của bạn...
      </div>

      <template v-if="overview">
        <p v-if="overview.researchFiles" class="pq-home-research-note">
          <FileText :size="16" aria-hidden="true" /> Có {{number(overview.researchFiles)}} tệp nghiên cứu trong số tài liệu tài khoản của bạn được phép truy cập.
        </p>

        <section class="pq-home-metrics" aria-label="Chỉ số tổng quan">
          <NuxtLink v-for="metric in metrics" :key="metric.key" :to="metric.to"
                    class="pq-home-metric" :class="`pq-home-tone-${metric.tone}`">
            <div class="pq-home-metric-top">
              <span class="pq-home-metric-icon"><component :is="metric.icon" :size="22" aria-hidden="true"/></span>
              <ArrowRight :size="17" class="pq-home-metric-arrow" aria-hidden="true"/>
            </div>
            <span class="pq-home-metric-label">{{metric.label}}</span>
            <strong>{{number(metric.value)}}</strong>
            <span class="pq-home-metric-note">{{metric.note}}</span>
          </NuxtLink>
        </section>

        <section class="pq-home-chart-row" aria-label="Biểu đồ tệp tin">
          <article class="pq-home-panel pq-home-trends">
            <div class="pq-home-panel-head">
              <div>
                <h2><TrendingUp :size="19" aria-hidden="true"/> Lưu trữ & chia sẻ</h2>
                <p>Diễn biến hoạt động trong những tháng gần đây</p>
              </div>
              <div class="pq-home-legends" aria-label="Chú thích biểu đồ">
                <span><i class="pq-home-dot pq-home-dot--blue"/>Tải lên</span>
                <span><i class="pq-home-dot pq-home-dot--purple"/>Chia sẻ</span>
              </div>
            </div>
            <div class="pq-home-chart-holder">
              <DashboardLineChart :months="overview.monthly" />
            </div>
            <p class="pq-home-footnote">Lượt chia sẻ được ghi theo thời điểm cấp quyền, gồm cả quyền sau đó đã thu hồi.</p>
          </article>

          <article class="pq-home-panel pq-home-filetypes">
            <div class="pq-home-panel-head">
              <div>
                <h2><ChartPie :size="19" aria-hidden="true"/> Loại tài liệu</h2>
                <p>Phân bố theo định dạng</p>
              </div>
            </div>
            <div class="pq-home-donut-row">
              <div class="pq-home-donut" :style="{ background: typeDonut }" role="img" :aria-label="`Tổng ${number(typeTotal)} tệp theo định dạng`">
                <div class="pq-home-donut-inner"><strong>{{number(typeTotal)}}</strong><span>Tệp tin</span></div>
              </div>
              <ul class="pq-home-types-list">
                <li v-for="item in types" :key="item.key">
                  <i class="pq-home-dot" :style="{backgroundColor:item.color}" aria-hidden="true"/>
                  <span>{{item.name}}</span>
                  <strong>{{number(item.count)}}</strong>
                </li>
              </ul>
            </div>
          </article>
        </section>

        <section class="pq-home-bottom-row" aria-label="Bảo vệ và hoạt động gần đây">
          <article class="pq-home-panel pq-home-activity">
            <div class="pq-home-panel-head">
              <div>
                <h2><Clock3 :size="19" aria-hidden="true"/> Hoạt động gần đây</h2>
                <p>{{number(overview.totals.activityRecords)}} bản ghi hoạt động của tài khoản</p>
              </div>
              <NuxtLink class="pq-home-panel-link" to="/activity">Xem nhật ký <ArrowRight :size="16" aria-hidden="true"/></NuxtLink>
            </div>
            <div v-if="!overview.activity.length" class="pq-home-empty">
              <FileClock :size="28" aria-hidden="true"/>
              <span>Chưa có hoạt động gần đây.</span>
            </div>
            <ol v-else class="pq-home-events">
              <li v-for="event in overview.activity.slice(0, 6)" :key="event.id" class="pq-home-event">
                <span class="pq-home-event-icon" :class="`pq-home-event-icon--${activityTone(event.action)}`"><Activity :size="17" aria-hidden="true"/></span>
                <div class="pq-home-event-main">
                  <strong>{{actionLabel(event.action)}}</strong>
                  <span v-if="event.fileName" :title="event.fileName">{{event.fileName}}</span>
                </div>
                <time :datetime="event.createdAt">{{formatDate(event.createdAt)}}</time>
              </li>
            </ol>
          </article>

          <div class="pq-home-aside">
            <article class="pq-home-panel pq-home-protection">
              <div class="pq-home-panel-head">
                <div>
                  <h2><ShieldCheck :size="19" aria-hidden="true"/> Trạng thái bảo vệ</h2>
                  <p>Chỉ số tổng hợp từ metadata</p>
                </div>
              </div>
              <ul class="pq-home-progress-list">
                <li v-for="check in securityChecks" :key="check.key">
                  <div class="pq-home-progress-label"><span>{{check.label}}</span><strong>{{percentage(check.value)}}</strong></div>
                  <div class="pq-home-progress-track" role="progressbar" :aria-label="check.label" :aria-valuenow="check.value === null ? undefined : clampPercent(check.value)" aria-valuemin="0" aria-valuemax="100">
                    <span :class="`pq-home-progress-fill--${check.tone}`" :style="{ width: `${clampPercent(check.value)}%` }"/>
                  </div>
                </li>
              </ul>
              <p class="pq-home-footnote">Các tỷ lệ phản ánh metadata, không phải kết quả kiểm định mật mã.</p>
            </article>
            <article class="pq-home-panel pq-home-metadata">
              <div class="pq-home-panel-head"><h2><CheckCircle2 :size="19" aria-hidden="true"/> Kiểm tra metadata</h2></div>
              <ul class="pq-home-metadata-list">
                <li v-for="item in metadataParts" :key="item.label">
                  <span class="pq-home-meta-label"><i class="pq-home-meta-dot" :class="`pq-home-meta-dot--${item.tone}`"/>{{item.label}}</span>
                  <strong>{{number(item.count)}}</strong>
                </li>
              </ul>
            </article>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>

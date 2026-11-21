<script setup lang="ts">
import {
  FlaskConical, ShieldCheck, Cpu, SlidersHorizontal, FileKey2, KeyRound,
  Lock, FileCheck2, ArrowRight, BadgeCheck, AlertTriangle, RotateCcw,
  FileUp, CheckCircle2, Info, Activity, ChartColumn, Sparkles, Clock3,
  Users, Database, ChevronRight, Download
} from 'lucide-vue-next';
import { runProtectionLab, probeDevice, MODE_LABELS } from '~/utils/onboarding-lab';
import type { LabMode, LabResult, CompatibilityReport } from '~/utils/onboarding-lab';
import { recommendProtection } from '~/utils/protection-advisor';
import type { AdvisorInput } from '~/utils/protection-advisor';

definePageMeta({ layout: 'default' });
useHead({ title: 'Mô phỏng & tư vấn bảo mật | PQFile Secure' });
const { user } = useAuth();
const current = ref<'simulation' | 'advisor' | 'device'>('simulation');
const tabs = [
  { key: 'simulation' as const, label: 'Mô phỏng mật mã', icon: FlaskConical },
  { key: 'advisor' as const, label: 'Tư vấn cấu hình', icon: SlidersHorizontal },
  { key: 'device' as const, label: 'Kiểm tra thiết bị', icon: Cpu },
];
const defaultExample = 'Báo cáo nghiên cứu PQFile Secure – dữ liệu minh họa. Tệp được mã hóa trên thiết bị và được xác minh trước khi giải mã.';
const sampleText = ref(defaultExample);
const sampleFile = shallowRef<File | null>(null);
const selectedMode = ref<LabMode>('PQC');
const modes: LabMode[] = ['CLASSIC', 'PQC', 'HYBRID'];
const results = ref<LabResult[]>([]);
const labError = ref('');
const busy = ref(false);
const activeStep = ref(0);
const sampleLabel = computed(() => sampleFile.value?.name || 'Văn bản minh họa (không tải lên máy chủ)');
const selectedResult = computed(() => results.value.find(r => r.mode === selectedMode.value) || null);
const maxDuration = computed(() => Math.max(1, ...results.value.map(r => r.durationMs)));
async function chooseFile(event: Event) {
  const el = event.target as HTMLInputElement;
  labError.value = '';
  results.value = [];
  const candidate = el.files?.[0];
  el.value = '';
  if (!candidate) return;
  if (!candidate.size || candidate.size > 512 * 1024) {
    labError.value = 'Chỉ chọn tệp mẫu từ 1 byte đến 512 KiB. Không cần dùng tài liệu thật.';
    return;
  }
  sampleFile.value = candidate;
}
function clearSample() {
  sampleFile.value = null;
  sampleText.value = defaultExample;
  results.value = [];
  labError.value = '';
}
async function getBytes(): Promise<Uint8Array> {
  return sampleFile.value ? new Uint8Array(await sampleFile.value.arrayBuffer()) : new TextEncoder().encode(sampleText.value);
}
async function runLab(all = false) {
  if (busy.value) return;
  busy.value = true; labError.value = ''; results.value = []; activeStep.value = 0;
  let sample: Uint8Array | null = null;
  try {
    sample = await getBytes();
    if (!sample.length || sample.length > 512 * 1024) throw new Error('Mẫu thử phải từ 1 byte đến 512 KiB.');
    const runModes = all ? modes : [selectedMode.value];
    for (const mode of runModes) {
      const data = await runProtectionLab(sample, mode);
      results.value = [...results.value, data];
    }
    // Keep the user's chosen mode active after comparing all three.
  } catch (e) {
    labError.value = e instanceof Error ? e.message : 'Phép thử không thành công.';
  } finally { sample?.fill(0); busy.value = false; }
}

const advisor = reactive<AdvisorInput>({
  category: 'research', confidentiality: 'internal', recipients: 5,
  protectionYears: 5, totalSizeGb: 1, externalRecipients: false,
});
const recommended = computed(() => {
  try { return { data: recommendProtection(advisor), error: '' }; }
  catch (e) { return { data: null, error: e instanceof Error ? e.message : 'Thông số chưa hợp lệ.' }; }
});
const report = ref<CompatibilityReport | null>(null);
const probing = ref(false);
const probeError = ref('');
async function checkDevice() {
  if (probing.value) return;
  probing.value = true; report.value = null; probeError.value = '';
  try { report.value = await probeDevice(); }
  catch (e) { probeError.value = e instanceof Error ? e.message : 'Không thể hoàn tất phép thử.'; }
  finally { probing.value = false; }
}
function exportReport() {
  if (!report.value || !import.meta.client) return;
  const output = JSON.stringify({ name: 'PQFile Secure - compatibility probe', version: 1, report: report.value }, null, 2);
  const url = URL.createObjectURL(new Blob([output], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = 'pqfile-browser-compatibility.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1048576).toFixed(2)} MiB`;
}
</script>

<template>
  <div class="pq-guide pq-library-pattern">
    <section class="pq-guide-hero" aria-labelledby="guide-title">
      <div class="pq-guide-hero-main">
        <div class="pq-guide-symbol"><FlaskConical :size="28" /></div>
        <div>
          <p class="pq-guide-overline">KHÁM PHÁ & CẤU HÌNH PQFILE SECURE</p>
          <h1 id="guide-title">Trải nghiệm bảo mật hậu lượng tử</h1>
          <p>Quan sát mật mã hoạt động, chọn chính sách bảo vệ và kiểm tra trình duyệt trước khi sử dụng.</p>
        </div>
      </div>
      <NuxtLink :to="user ? '/upload' : '/register'" class="pq-guide-hero-action">
        {{ user ? 'Đi đến tải tệp' : 'Tạo tài khoản' }} <ArrowRight :size="17" />
      </NuxtLink>
    </section>

    <nav class="pq-guide-tabs" role="tablist" aria-label="Các công cụ trải nghiệm">
      <button v-for="tab in tabs" :key="tab.key" type="button" role="tab"
        :id="`guide-tab-${tab.key}`" :aria-controls="`guide-panel-${tab.key}`"
        :aria-selected="current === tab.key" :class="{ 'is-active': current === tab.key }"
        @click="current = tab.key">
        <component :is="tab.icon" :size="18" /> {{ tab.label }}
      </button>
    </nav>

    <section v-show="current === 'simulation'" id="guide-panel-simulation" role="tabpanel" aria-labelledby="guide-tab-simulation" class="pq-guide-panel">
      <div class="pq-guide-section-head">
        <div><p class="pq-guide-overline">01 / MÔ PHỎNG TƯƠNG TÁC</p><h2>Từ tệp gốc đến bản mã đã xác minh</h2>
          <p>Phép thử thực tế chạy ngay trong trình duyệt với khóa mới, không liên quan khóa tài khoản và không gửi tệp lên API.</p></div>
        <span class="pq-guide-pill"><Lock :size="15" /> Thực thi cục bộ</span>
      </div>
      <div class="pq-guide-two-col">
        <section class="pq-guide-card">
          <h3><FileUp :size="19" /> Chọn dữ liệu mẫu</h3>
          <label class="pq-guide-upload" for="pq-guide-sample">
            <FileKey2 :size="23" />
            <span><strong>{{ sampleLabel }}</strong><small>Chọn tệp nhỏ (≤ 512 KiB), mọi định dạng; chỉ đọc trong RAM</small></span>
          </label>
          <input id="pq-guide-sample" type="file" class="pq-guide-file-input" @change="chooseFile" />
          <div v-if="!sampleFile" class="pq-guide-form-row">
            <label for="pq-guide-text">Hoặc nhập văn bản thử nghiệm</label>
            <textarea id="pq-guide-text" v-model="sampleText" rows="3" maxlength="4000" class="pq-guide-input" />
          </div>
          <button v-else class="pq-guide-text-link" type="button" @click="clearSample"><RotateCcw :size="15" /> Dùng lại văn bản mẫu</button>
          <div class="pq-guide-form-row">
            <label for="pq-guide-mode">Cơ chế bảo vệ</label>
            <select id="pq-guide-mode" v-model="selectedMode" class="pq-guide-input" @change="activeStep = 0">
              <option v-for="mode in modes" :key="mode" :value="mode">{{ MODE_LABELS[mode] }}</option>
            </select>
          </div>
          <div class="pq-guide-actions">
            <button class="pq-guide-primary" type="button" :disabled="busy" @click="runLab(false)"><ShieldCheck :size="17" />{{ busy ? 'Đang đo và xác minh...' : 'Chạy quy trình' }}</button>
            <button class="pq-guide-outline" type="button" :disabled="busy" @click="runLab(true)"><ChartColumn :size="17" /> So sánh 3 chế độ</button>
          </div>
          <p v-if="labError" role="alert" class="pq-guide-error">{{ labError }}</p>
          <div class="pq-guide-help"><Info :size="17" /> Mật mã thử nghiệm thật; không lưu khóa hay bản rõ. Không phải phép thử chứng nhận an toàn hoặc đo hiệu năng chuẩn hóa.</div>
        </section>
        <section class="pq-guide-card pq-guide-process" aria-label="Các bước bảo vệ tệp">
          <h3><Activity :size="19" /> Quy trình bảo vệ</h3>
          <p class="pq-guide-muted">Chọn từng bước để xem kết quả và thời gian đo.</p>
          <ol class="pq-guide-steps">
            <li v-for="(step, index) in (selectedResult?.steps || [
              { id:'keys', label:'Sinh khóa thử nghiệm', detail:'Tạo khóa cho người gửi/nhận.',durationMs:0,ok:false },
              { id:'kem', label:'Thiết lập khóa phiên', detail:'Thiết lập bí mật độc lập.',durationMs:0,ok:false },
              { id:'encrypt', label:'Mã hóa bản rõ', detail:'AES-256-GCM.',durationMs:0,ok:false },
              { id:'sign', label:'Ký bản mã', detail:'Ký số.',durationMs:0,ok:false },
              { id:'verify', label:'Xác minh chữ ký', detail:'Kiểm tra tính toàn vẹn.',durationMs:0,ok:false },
              { id:'decrypt', label:'Giải mã', detail:'Đối chiếu bản rõ.',durationMs:0,ok:false }
            ])" :key="step.id">
              <button type="button" class="pq-guide-step" :class="{ 'is-current': selectedResult && activeStep === index, 'is-passed': selectedResult && step.ok }" :disabled="!selectedResult" @click="activeStep = index">
                <span class="pq-guide-step-num">{{ index + 1 }}</span>
                <span class="pq-guide-step-text"><strong>{{ step.label }}</strong><small>{{ selectedResult && activeStep === index ? step.detail : 'Chọn để xem chi tiết' }}</small></span>
                <span v-if="selectedResult" class="pq-guide-step-time">{{ step.durationMs.toFixed(2) }} ms</span>
                <ChevronRight v-else :size="14" />
              </button>
            </li>
          </ol>
          <div v-if="selectedResult" class="pq-guide-success"><CheckCircle2 :size="19" /> Chữ ký hợp lệ, dữ liệu giải mã khớp từng byte.</div>
          <p v-else class="pq-guide-muted">Nhấn “Chạy quy trình” để đo các bước bằng dữ liệu thực tế.</p>
        </section>
      </div>
      <section v-if="results.length" class="pq-guide-card pq-guide-table-card">
        <div class="pq-guide-section-head"><div><h3><ChartColumn :size="20" /> Kết quả đo trong phiên này</h3><p>Thời gian và kích thước thực đo trên thiết bị hiện tại.</p></div></div>
        <div class="pq-guide-results">
          <div v-for="result in results" :key="result.mode" class="pq-guide-result">
            <div class="pq-guide-result-title"><strong>{{ MODE_LABELS[result.mode] }}</strong><span>{{ result.durationMs.toFixed(1) }} ms</span></div>
            <div class="pq-guide-bars"><span :style="{width: `${Math.max(2,result.durationMs / maxDuration * 100)}%`}" /></div>
            <dl><div><dt>Bản mã</dt><dd>{{ formatBytes(result.ciphertextBytes) }}</dd></div>
              <div><dt>Khóa công khai</dt><dd>{{ formatBytes(result.publicKeyBytes) }}</dd></div>
              <div><dt>Trao đổi khóa + IV/salt</dt><dd>{{ formatBytes(result.exchangeBytes) }}</dd></div>
              <div><dt>Chữ ký</dt><dd>{{ formatBytes(result.signatureBytes) }}</dd></div></dl>
          </div>
        </div>
        <p class="pq-guide-muted">Thời gian bao gồm sinh khóa, mã hóa, ký, xác minh và giải mã. Kích thước bản mã không cộng metadata/tệp gói; không nên suy ra độ an toàn chỉ từ thời gian hoặc kích thước.</p>
      </section>
    </section>

    <section v-show="current === 'advisor'" id="guide-panel-advisor" role="tabpanel" aria-labelledby="guide-tab-advisor" class="pq-guide-panel">
      <div class="pq-guide-section-head"><div><p class="pq-guide-overline">02 / CẤU HÌNH ĐỀ XUẤT</p><h2>Chính sách phù hợp với nhu cầu</h2>
        <p>Điều chỉnh tiêu chí để nhận gợi ý tức thì. Quy tắc được giải thích rõ, không tự động thay đổi chính sách tài khoản.</p></div></div>
      <div class="pq-guide-two-col">
        <section class="pq-guide-card">
          <h3><SlidersHorizontal :size="19" /> Thông tin sử dụng</h3>
          <div class="pq-guide-form-grid">
            <label>Loại tài liệu
              <select v-model="advisor.category" class="pq-guide-input"><option value="general">Tài liệu thông thường</option><option value="personal">Thông tin cá nhân</option><option value="financial">Tài chính</option><option value="research">Nghiên cứu</option><option value="legal">Hợp đồng / pháp lý</option></select>
            </label>
            <label>Mức độ bảo mật
              <select v-model="advisor.confidentiality" class="pq-guide-input"><option value="public">Công khai</option><option value="internal">Nội bộ</option><option value="confidential">Mật</option><option value="restricted">Tối mật</option></select>
            </label>
            <label>Số người cộng tác
              <input v-model.number="advisor.recipients" type="number" min="1" max="10000" class="pq-guide-input" />
            </label>
            <label>Thời gian cần bảo vệ (năm)
              <input v-model.number="advisor.protectionYears" type="number" min="0" max="50" class="pq-guide-input" />
            </label>
            <label>Quy mô dữ liệu (GiB)
              <input v-model.number="advisor.totalSizeGb" type="number" min="0" max="100000" step="0.5" class="pq-guide-input" />
            </label>
          </div>
          <label class="pq-guide-checkbox"><input v-model="advisor.externalRecipients" type="checkbox" /> Có người nhận ngoài tổ chức</label>
          <p v-if="recommended.error" role="alert" class="pq-guide-error">{{ recommended.error }}</p>
          <div class="pq-guide-help"><Info :size="17" /> Không cần tải tài liệu lên, các tiêu chí chỉ được tính trên trình duyệt.</div>
        </section>
        <section class="pq-guide-card">
          <h3><Sparkles :size="19" /> Cấu hình gợi ý</h3>
          <template v-if="recommended.data">
            <div class="pq-guide-recommendation" :data-level="recommended.data.level">
              <span>CHÍNH SÁCH</span><strong>{{ recommended.data.summary }}</strong>
              <small>Đề xuất tham khảo, không tự động áp dụng.</small>
            </div>
            <dl class="pq-guide-settings">
              <div><dt><KeyRound :size="16"/> Mật mã</dt><dd>{{ recommended.data.algorithm }}</dd></div>
              <div><dt><Users :size="16"/> Phân quyền</dt><dd>{{ recommended.data.sharePolicy }}</dd></div>
              <div><dt><Clock3 :size="16"/> Hạn chia sẻ đề xuất</dt><dd>{{ recommended.data.expiresInDays }} ngày</dd></div>
              <div><dt><BadgeCheck :size="16"/> Kiểm tra người nhận</dt><dd>{{ recommended.data.approval }}</dd></div>
              <div><dt><Database :size="16"/> Sao lưu khóa</dt><dd>{{ recommended.data.backup }}</dd></div>
              <div><dt><Cpu :size="16"/> Chi phí tài nguyên</dt><dd>{{ recommended.data.resourceCost }}</dd></div>
            </dl>
            <h4>Lý do đề xuất</h4><ul class="pq-guide-bullets"><li v-for="reason in recommended.data.reasons" :key="reason">{{ reason }}</li></ul>
            <h4>Giới hạn</h4><ul class="pq-guide-bullets pq-guide-caution"><li v-for="note in recommended.data.limitations" :key="note">{{ note }}</li></ul>
          </template>
        </section>
      </div>
    </section>

    <section v-show="current === 'device'" id="guide-panel-device" role="tabpanel" aria-labelledby="guide-tab-device" class="pq-guide-panel">
      <div class="pq-guide-section-head"><div><p class="pq-guide-overline">03 / KHẢ NĂNG TƯƠNG THÍCH</p><h2>Thiết bị này có thể chạy PQFile Secure?</h2>
        <p>Kiểm tra trình duyệt hiện tại với những phép thử mật mã nhỏ; không gửi thông số máy lên máy chủ.</p></div>
        <button class="pq-guide-primary" type="button" :disabled="probing" @click="checkDevice"><Cpu :size="17"/> {{ probing ? 'Đang thử nghiệm...' : report ? 'Kiểm tra lại' : 'Kiểm tra thiết bị' }}</button>
      </div>
      <p v-if="probeError" role="alert" class="pq-guide-error">{{ probeError }}</p>
      <div class="pq-guide-two-col">
        <section class="pq-guide-card">
          <h3><Activity :size="19"/> Danh sách kiểm tra</h3>
          <p v-if="!report" class="pq-guide-muted">Nhấn “Kiểm tra thiết bị” để bắt đầu. Kết quả chỉ xuất hiện ở đây và không tự lưu.</p>
          <div v-for="check in report?.checks || []" :key="check.id" class="pq-guide-check">
            <span :class="check.ok ? 'pq-guide-indicator-ok' : 'pq-guide-indicator-bad'"><CheckCircle2 v-if="check.ok" :size="18"/><AlertTriangle v-else :size="18"/></span>
            <div><strong>{{ check.title }} <small v-if="check.optional">(tùy chọn)</small></strong><p>{{ check.detail }}</p></div>
          </div>
        </section>
        <section class="pq-guide-card">
          <h3><Cpu :size="19"/> Đánh giá và khuyến nghị</h3>
          <template v-if="report">
            <div class="pq-guide-recommendation" :data-level="report.overall === 'good' ? 'standard' : report.overall === 'limited' ? 'enhanced' : 'strict'">
              <span>KẾT QUẢ THIẾT BỊ</span>
              <strong>{{ report.overall === 'good' ? 'Tương thích tốt' : report.overall === 'limited' ? 'Tương thích có giới hạn' : 'Chưa đáp ứng' }}</strong>
              <small>Đánh giá cục bộ, không phải chứng nhận khả năng vận hành.</small>
            </div>
            <dl class="pq-guide-settings">
              <div><dt>RAM báo bởi trình duyệt</dt><dd>{{ report.browserMemoryGb === null ? 'Không công bố' : `${report.browserMemoryGb} GiB (ước lượng)` }}</dd></div>
              <div><dt>Luồng xử lý logic</dt><dd>{{ report.logicalCores ?? 'Không công bố' }}</dd></div>
              <div><dt>Thử tệp AES-GCM (128 KiB)</dt><dd>{{ report.fileTestMs === null ? 'Chưa thành công' : `${report.fileTestMs} ms` }}</dd></div>
              <div><dt>Thử ML-KEM-768</dt><dd>{{ report.sampleMs === null ? 'Chưa thành công' : `${report.sampleMs} ms` }}</dd></div>
            </dl>
            <ul class="pq-guide-bullets pq-guide-caution"><li v-for="note in report.notes" :key="note">{{ note }}</li></ul>
            <button type="button" class="pq-guide-outline" @click="exportReport"><Download :size="17"/> Tải kết quả JSON</button>
          </template>
          <div v-else class="pq-guide-empty"><ShieldCheck :size="36"/><strong>Chưa chạy đánh giá</strong><span>Nhấn nút kiểm tra để xem trình duyệt hỗ trợ những cơ chế nào.</span></div>
        </section>
      </div>
    </section>
    <p class="pq-guide-footer-note">Các kết quả chỉ có giá trị cho phiên mô phỏng. PQFile Secure không truyền dữ liệu thử nghiệm hoặc thông tin thiết bị về máy chủ từ ba công cụ này.</p>
  </div>
</template>

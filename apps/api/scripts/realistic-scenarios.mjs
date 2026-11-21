/**
 * Deterministic synthetic research scenarios for PQFile Secure.
 * This module has NO database, storage or network dependencies.
 * All personal details are invented; never present them as authentic people or incidents.
 */
import { createHash } from 'node:crypto';

export const DATASET_V2 = 'pqfile-realistic-research-v2';
export const PEOPLE_EMAILS = ['demo.admin@pqfile.local', ...Array.from({ length: 11 }, (_, i) => `demo.person${String(i + 1).padStart(2, '0')}@pqfile.local`)];
export const PEOPLE_NAMES = ['Nguyễn Minh Anh','Phạm Thanh Trung','Lê Văn Nam','Phan Thị Mai','Nguyễn Đức Duy','Ngô Hạnh','Trần Minh Quân','Hoàng Thị Lan','Võ Thanh Bình','Đỗ Hải Yến','Bùi Thanh Tâm','Nguyễn Hoài An'];
export const DEPARTMENTS = ['Ban điều hành','Nhóm an ninh','Văn phòng dự án','Tổ đánh giá','Hạ tầng','Pháp chế','Nghiên cứu AI','Kiểm thử'];
export const EXTENSIONS = ['pdf','docx','xlsx','txt','csv','json','png','zip'];
export const TOPICS = [
  { label:'Kế hoạch nâng cấp hạ tầng lưu trữ', category:'Vận hành', classification:'Nội bộ', action:'Đối chiếu cấu hình và phân công kiểm thử', risk:'Gián đoạn dịch vụ khi cập nhật cấu hình' },
  { label:'Báo cáo rà soát phân quyền tài liệu', category:'An ninh', classification:'Mật', action:'Thu hồi các quyền không còn nhu cầu sử dụng', risk:'Truy cập vượt phạm vi nhiệm vụ' },
  { label:'Biên bản họp nghiệm thu dự án', category:'Quản lý', classification:'Nội bộ', action:'Tổng hợp ý kiến của các nhóm trước nghiệm thu', risk:'Chậm phê duyệt hạng mục cần xử lý' },
  { label:'Bảng dự toán ngân sách quý', category:'Tài chính', classification:'Mật', action:'Kiểm tra dự toán và khoản chênh lệch', risk:'Sai lệch dự toán hoặc cấp quyền quá rộng' },
  { label:'Hồ sơ đánh giá nhà cung cấp', category:'Mua sắm', classification:'Mật', action:'Đối chiếu tiêu chí và hoàn thành đánh giá', risk:'Lộ thông tin thương mại trong hồ sơ' },
  { label:'Bản tổng hợp tiến độ công việc', category:'Tiến độ', classification:'Nội bộ', action:'Rà soát việc tồn đọng và chốt mốc bàn giao', risk:'Chậm tiến độ do phụ thuộc giữa các nhóm' },
  { label:'Phương án ứng cứu sự cố giả lập', category:'Ứng cứu', classification:'Tối mật', action:'Diễn tập thu hồi phiên và thông báo người quản trị', risk:'Phát tán tài liệu nhạy cảm khi phối hợp' },
  { label:'Báo cáo kiểm thử chữ ký hậu lượng tử', category:'Mật mã', classification:'Nội bộ', action:'Đối chiếu kết quả ML-DSA theo bộ kiểm thử', risk:'Thiếu minh chứng xác minh chữ ký' },
  { label:'Đánh giá hiệu năng ML-KEM', category:'Mật mã', classification:'Công khai', action:'Chạy lại bài đo trên cấu hình mục tiêu', risk:'Kết quả đo không đại diện thiết bị thực tế' },
  { label:'Danh sách tài khoản thử nghiệm', category:'Nhân sự', classification:'Mật', action:'Rà soát tài khoản nghỉ tham gia nhóm', risk:'Tài khoản không hoạt động vẫn còn quyền' },
  { label:'Phương án sao lưu phục hồi dữ liệu', category:'Hạ tầng', classification:'Mật', action:'Xác minh bản sao lưu và quy trình khôi phục', risk:'Mất dữ liệu hoặc không thể khôi phục đúng hạn' },
  { label:'Quy trình bảo vệ dữ liệu cá nhân', category:'Tuân thủ', classification:'Nội bộ', action:'Cập nhật hướng dẫn che dữ liệu trước chia sẻ', risk:'Vô tình lộ dữ liệu cá nhân trong bản gửi' },
  { label:'Kế hoạch đào tạo sử dụng hệ thống', category:'Đào tạo', classification:'Công khai', action:'Chuẩn bị bộ câu hỏi và tài liệu hướng dẫn', risk:'Người sử dụng cấp quyền không đúng' },
  { label:'Thông báo thay đổi chính sách lưu trữ', category:'Chính sách', classification:'Nội bộ', action:'Lấy ý kiến các bộ phận và thông qua chính sách', risk:'Tài liệu hết hạn vẫn được lưu không cần thiết' },
  { label:'Báo cáo kiểm tra cấu trúc tệp', category:'Kiểm thử', classification:'Nội bộ', action:'Chạy kiểm tra chữ ký định dạng và tệp giả mạo', risk:'Tệp nguy hiểm được chia sẻ như tài liệu thông thường' },
  { label:'Tổng hợp sự kiện an ninh tháng', category:'An ninh', classification:'Mật', action:'Xác minh các cảnh báo bất thường', risk:'Đánh giá sai mức độ ưu tiên sự kiện' },
  { label:'Kết quả đánh giá khả năng truy cập', category:'Giao diện', classification:'Công khai', action:'Kiểm tra responsive và thao tác bằng bàn phím', risk:'Mất khả năng thao tác trên màn hình nhỏ' },
  { label:'Phiếu yêu cầu chỉnh sửa tính năng', category:'Phát triển', classification:'Nội bộ', action:'Xác nhận phạm vi và người chịu trách nhiệm', risk:'Thực hiện thay đổi chưa được phê duyệt' }
];

const DAY = 86_400_000;
export const syntheticId = (namespace) => {
  const h = createHash('sha256').update(`${DATASET_V2}:${namespace}`).digest('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;
};
const at = (anchorMs, deltaDays, offsetHours = 10) => new Date(anchorMs + Math.round(deltaDays * DAY) + offsetHours * 3_600_000).toISOString();
const random = (seed) => { let n = seed >>> 0; return () => ((n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 2 ** 32); };
const round = (x) => Math.round(x * 100) / 100;

export function buildPlan(reference = new Date()) {
  if (!(reference instanceof Date) || Number.isNaN(reference.getTime())) throw new Error('Ngày tham chiếu không hợp lệ');
  const anchorMs = Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate());
  const anchor = new Date(anchorMs).toISOString().slice(0,10);
  const prng = random(0x50f12e3);
  const documents = [];
  const shares = [];
  const activities = [];
  const security = [];
  const usedPairs = new Set();
  for (let i = 0; i < 144; i++) {
    const topic = TOPICS[i % TOPICS.length];
    const ext = EXTENSIONS[(i + Math.floor(i / 18)) % EXTENSIONS.length];
    const ownerIndex = i % 5 === 0 ? 1 + (i % 11) : 0;
    const createdDaysAgo = 2 + ((i * 23 + Math.floor(i / 9) * 3) % 160);
    const createdAt = at(anchorMs, -createdDaysAgo);
    const taskDaysFromCreate = 10 + (i * 7 % 44);
    const taskDeadlineAt = at(anchorMs, -createdDaysAgo + taskDaysFromCreate);
    const costMillions = 8 + (i * 13 % 590);
    const indicator = round(72 + (i * 11 % 280) / 10);
    const name = `${topic.label} - HS${String(i+1).padStart(4,'0')} - ${anchor.slice(0,4)}.${ext}`;
    const d = {
      id:syntheticId(`file:${i}`),index:i+1,fileName:name,ownerIndex,extension:ext,
      title:topic.label,category:topic.category,classification:topic.classification,
      action:topic.action,risk:topic.risk,createdAt,taskDeadlineAt,
      costMillions,indicator,department:DEPARTMENTS[(i*5)%DEPARTMENTS.length],
      approval: ['Chờ phê duyệt','Đang triển khai','Cần bổ sung minh chứng','Hoàn thành'][i % 4],
      author:PEOPLE_NAMES[ownerIndex],
      recordCode:`PQF-SYN-${String(i+1).padStart(5,'0')}`,
      email:`nhom${String(i%8+1).padStart(2,'0')}@demo.example`,
      scenario:createdDaysAgo > taskDaysFromCreate && i % 4 === 0 ? 'Đã quá hạn công việc' : i % 11 === 0 ? 'Tệp có nhiều mối quan hệ chia sẻ' : i % 9 === 0 ? 'Cần xác minh bảo mật' : 'Nghiệp vụ thông thường'
    };
    documents.push(d);
    const recipientIndexes = ownerIndex === 0 ? [1 + ((i * 3 + 1) % 11)] : [0];
    if(i % 6 === 0){let second = 1 + ((i * 7 + 4) % 11);while(second===ownerIndex || recipientIndexes.includes(second))second=1+(second%11);recipientIndexes.push(second);}
    if(i % 19 === 0){let third=1+((i*5+8)%11);while(third===ownerIndex || recipientIndexes.includes(third))third=1+(third%11);recipientIndexes.push(third);}
    for (const recipientIndex of recipientIndexes) {
      const pair=`${d.id}:${recipientIndex}`;
      if(usedPairs.has(pair))continue;usedPairs.add(pair);
      const idx=shares.length;
      const shareCreatedAt=at(anchorMs,-createdDaysAgo,12+idx%7);
      const expiryDays = [null,14,30,45,90][idx%5];
      const expiresAt=expiryDays===null?null:at(anchorMs,-createdDaysAgo+expiryDays);
      // Revoked grants remain as historical rows; they must not permit downloads now.
      const revokedAt=idx%13===0?at(anchorMs,-Math.min(createdDaysAgo-1,8)) : null;
      const taskDue = (idx % 4 === 0 || idx % 7 === 0) ? taskDeadlineAt : null;
      shares.push({id:syntheticId(`share:${idx}`),fileId:d.id,ownerIndex,recipientIndex,createdAt:shareCreatedAt,
        expiresAt,taskDeadlineAt:taskDue,revokedAt,documentIndex:i});
    }
  }
  // Coherent simulated interactions: only granted recipients download, during the grant's lifetime.
  for(const [i,d] of documents.entries()){
    const startTime=new Date(d.createdAt).getTime();
    activities.push({id:syntheticId(`activity:upload:${i}`),actorIndex:d.ownerIndex,fileId:d.id,action:'FILE_ENCRYPT_UPLOAD',resourceType:'file',createdAt:d.createdAt,details:{syntheticDataset:DATASET_V2,scenario:'Tải lên và mã hóa'}});
    if(i % 3 === 0)activities.push({id:syntheticId(`activity:rename:${i}`),actorIndex:d.ownerIndex,fileId:d.id,action:'FILE_RENAME',resourceType:'file',createdAt:new Date(startTime+4*3_600_000).toISOString(),details:{syntheticDataset:DATASET_V2}});
    if(i % 7 === 0)activities.push({id:syntheticId(`activity:policy:${i}`),actorIndex:d.ownerIndex,fileId:d.id,action:'GRANT_TASK_DEADLINE',resourceType:'file',createdAt:new Date(startTime+9*3_600_000).toISOString(),details:{syntheticDataset:DATASET_V2}});
  }
  for(const [i,s] of shares.entries()){
    activities.push({id:syntheticId(`activity:share:${i}`),actorIndex:s.ownerIndex,fileId:s.fileId,action:'FILE_SHARE',resourceType:'file',createdAt:s.createdAt,details:{syntheticDataset:DATASET_V2,recipientIndex:s.recipientIndex}});
    const grantStart=new Date(s.createdAt).getTime();
    const grantEnd=Math.min(anchorMs-3_600_000, s.expiresAt?new Date(s.expiresAt).getTime()-3_600_000:Infinity, s.revokedAt?new Date(s.revokedAt).getTime()-3_600_000:Infinity);
    if(i%4!==0 && grantEnd>grantStart+2*3_600_000){
      const ratio=0.15+(i%7)*0.10;
      const usedAt=new Date(grantStart+(grantEnd-grantStart)*Math.min(0.85,ratio)).toISOString();
      activities.push({id:syntheticId(`activity:download:${i}`),actorIndex:s.recipientIndex,fileId:s.fileId,action:'FILE_DOWNLOAD',resourceType:'file',createdAt:usedAt,details:{syntheticDataset:DATASET_V2,kind:'Simulated authorized download'}});
    }
    if(s.revokedAt)activities.push({id:syntheticId(`activity:revocation:${i}`),actorIndex:s.ownerIndex,fileId:s.fileId,action:'FILE_SHARE_REVOKE_REVIEW',resourceType:'file',createdAt:s.revokedAt,details:{syntheticDataset:DATASET_V2,recipientIndex:s.recipientIndex}});
  }
  const scenarios=[
    {eventType:'UNFAMILIAR_BROWSER',score:48,reason:'Dấu hiệu trình duyệt chưa từng được ghi nhận trong dữ liệu mô phỏng'},
    {eventType:'DOWNLOAD_BURST',score:85,reason:'10 lượt tải ciphertext trong 60 giây (tình huống mô phỏng)'},
    {eventType:'DENIED_BURST',score:92,reason:'7 lần truy cập không đủ quyền trong 5 phút (tình huống mô phỏng)'},
    {eventType:'UNFAMILIAR_BROWSER',score:44,reason:'Phát hiện chuỗi trình duyệt mới (mô phỏng, không định danh thiết bị)'},
    {eventType:'DOWNLOAD_BURST',score:68,reason:'5 lượt tải ciphertext trong 60 giây (tình huống mô phỏng)'},
    {eventType:'DENIED_BURST',score:71,reason:'3 lần từ chối truy cập trong 5 phút (tình huống mô phỏng)'},
    {eventType:'LOGIN_OBSERVED',score:0,reason:'Quan sát đăng nhập của tài khoản thử nghiệm'},
    {eventType:'DOWNLOAD_OBSERVED',score:0,reason:'Quan sát lượt tải tài liệu mô phỏng'}
  ];
  for(let i=0;i<180;i++){
    const template=scenarios[i%scenarios.length];
    const dayAgo=1+(i*17%100);
    security.push({id:syntheticId(`security:${i}`),userIndex:i%4===0?1+(i%11):0,
      eventType:template.eventType,riskScore:template.score,reason:template.reason,
      createdAt:at(anchorMs,-dayAgo,2+i%18),acknowledgedAt:i%9===0?at(anchorMs,Math.min(-1, -dayAgo+1),20):null,
      deviceTag: createHash('sha256').update(`${DATASET_V2}:device:${i%13}`).digest('hex').slice(0,40)});
  }
  // Add audit-only records, never fabricate a successful read without an active grant.
  const misc=['WORKSPACE_CREATE','WORKSPACE_MEMBER_ADD','SECURITY_ALERT_ACK','FILE_PREVIEW','FILE_LABEL_CHANGE'];
  for(let i=0;i<580;i++){
    const d=documents[(i*31)%documents.length];
    const createdMs=new Date(d.createdAt).getTime();
    const latestMs=anchorMs-3_600_000;
    const eventMs=Math.min(latestMs,createdMs+(i*3+1)*3_600_000);
    activities.push({id:syntheticId(`activity:misc:${i}`),actorIndex:d.ownerIndex,
      fileId:i%5<2?null:d.id,action:misc[i%5],resourceType:i%5<2?'workspace':'file',
      createdAt:new Date(eventMs).toISOString(),details:{syntheticDataset:DATASET_V2,source:'synthetic-scenario'}});
  }
  return {dataset:DATASET_V2,referenceDate:anchor,people:PEOPLE_EMAILS,documents,shares,activities,security};
}

export function linesForDocument(doc){
  return [
    'BỘ DỮ LIỆU TỔNG HỢP - CHỈ DÙNG NGHIÊN CỨU / SYNTHETIC DATA',
    `Mã hồ sơ: ${doc.recordCode}`,
    `Tên: ${doc.title}`,
    `Đơn vị: ${doc.department}`,
    `Phân loại đề xuất: ${doc.classification}`,
    `Người phụ trách (giả lập): ${doc.author}`,
    `Ngày lập: ${doc.createdAt.slice(0,10)}`,
    `Hạn xử lý: ${doc.taskDeadlineAt.slice(0,10)}`,
    `Trạng thái: ${doc.approval}`,
    `Kinh phí dự kiến (giá trị giả lập): ${doc.costMillions} triệu đồng`,
    `Chỉ số thực hiện mô phỏng: ${doc.indicator}%`,
    `Nội dung chính: ${doc.title} thuộc nhóm nghiệp vụ ${doc.category}. Hồ sơ được biên soạn cho việc kiểm thử mã hóa, chia sẻ, tìm kiếm và thu hồi quyền truy cập.`,
    `Công việc cần thực hiện: ${doc.action}. Người phụ trách cập nhật tiến độ và ghi nhận minh chứng trước hạn xử lý.`,
    `Đánh giá rủi ro: ${doc.risk}. Cần xác minh quyền truy cập theo nguyên tắc cấp quyền tối thiểu.`,
    `Tình huống kiểm thử: ${doc.scenario}. Ưu tiên thông báo khi một tài khoản không còn tham gia nhóm hoặc khi quyền chia sẻ quá hạn.`,
    `Đầu mối thử nghiệm: ${doc.email}. Đây là địa chỉ giả lập, không dùng để liên hệ.`,
    'Kết luận: Đề xuất rà soát quyền theo từng đợt, ghi nhận nhật ký thao tác và bảo vệ khóa cá nhân tại thiết bị người dùng.',
    'Lưu ý: không chứa chứng từ, danh tính, tài khoản ngân hàng hoặc tình huống an ninh có thật.'
  ];
}

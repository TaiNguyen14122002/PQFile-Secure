/** Deterministic, explanatory suggestions, not an AI classifier or security certification. */
export type DocumentCategory = 'general' | 'personal' | 'financial' | 'research' | 'legal';
export type Confidentiality = 'public' | 'internal' | 'confidential' | 'restricted';
export type AdvisorInput = {
  category: DocumentCategory; confidentiality: Confidentiality;
  recipients: number; protectionYears: number; totalSizeGb: number;
  externalRecipients: boolean;
};
export type AdvisorResult = {
  level: 'standard' | 'enhanced' | 'strict'; algorithm: string; sharePolicy: string;
  expiresInDays: number; approval: string; backup: string; summary: string;
  reasons: string[]; limitations: string[]; resourceCost: string;
};
export function recommendProtection(raw: AdvisorInput): AdvisorResult {
  const v = { ...raw };
  if (!['general', 'personal', 'financial', 'research', 'legal'].includes(v.category) ||
    !['public', 'internal', 'confidential', 'restricted'].includes(v.confidentiality) ||
    !Number.isFinite(v.recipients) || !Number.isFinite(v.protectionYears) || !Number.isFinite(v.totalSizeGb) ||
    v.recipients < 1 || v.recipients > 10000 || v.protectionYears < 0 || v.protectionYears > 50 ||
    v.totalSizeGb < 0 || v.totalSizeGb > 100000) throw new Error('Thông số đánh giá nằm ngoài phạm vi hỗ trợ.');
  const sensitive = v.confidentiality === 'confidential' || v.confidentiality === 'restricted';
  const strict = v.confidentiality === 'restricted' || (sensitive && v.externalRecipients && v.recipients > 5);
  const enhanced = strict || sensitive || v.protectionYears >= 7 || v.recipients > 15 || v.externalRecipients;
  const longTerm = v.protectionYears >= 7;
  const level: AdvisorResult['level'] = strict ? 'strict' : enhanced ? 'enhanced' : 'standard';
  const algorithm = strict || longTerm ? 'ML-KEM-1024 (ưu tiên) hoặc cấu hình lai đã được kiểm định' : enhanced ? 'ML-KEM-768 / cấu hình lai đã được kiểm định' : 'ML-KEM-768 + AES-256-GCM';
  const expiresInDays = strict ? 1 : enhanced ? 7 : 30;
  const reasons: string[] = [];
  if (sensitive) reasons.push('Tài liệu có mức nhạy cảm cao: nên xác minh khóa người nhận và giới hạn quyền.');
  if (v.externalRecipients) reasons.push('Có người nhận bên ngoài: đề xuất xác minh danh tính/khóa qua kênh độc lập.');
  if (v.recipients > 15) reasons.push('Phạm vi chia sẻ lớn: nên chia thành nhóm quyền tối thiểu và rà soát định kỳ.');
  if (longTerm) reasons.push('Cần bảo mật dài hạn: ưu tiên hoạch định chuyển đổi và luân chuyển khóa có kiểm soát.');
  if (v.totalSizeGb > 5) reasons.push('Dung lượng lớn: nên cân nhắc tải theo lô/từng khối (nếu phiên bản triển khai hỗ trợ).');
  if (!reasons.length) reasons.push('Nhu cầu cơ bản: ưu tiên cấu hình đơn giản, hạn chia sẻ rõ ràng, sao lưu khóa an toàn.');
  const limitations = [
    'Đây là gợi ý dựa trên quy tắc, không phải đánh giá tuân thủ hoặc chứng nhận mật mã.',
    'Tính năng tải theo khối, phê duyệt nhiều cấp và cơ chế lai chỉ được dùng khi phiên bản thực tế hỗ trợ và đã được kiểm thử.',
    'Thu hồi quyền không thể xóa bản sao mà người nhận đã tải/giải mã trước đó.',
  ];
  return {
    level, algorithm,
    sharePolicy: strict ? 'Chỉ định đích danh, tối thiểu quyền, cấm công khai' : enhanced ? 'Chỉ định người nhận/nhóm, thời hạn ngắn' : 'Người nhận được chọn, không chia sẻ công khai',
    expiresInDays,
    approval: strict ? 'Phê duyệt độc lập trước khi cấp quyền (nếu có quy trình)' : enhanced ? 'Xác nhận lại người nhận và fingerprint' : 'Chủ tệp xác nhận',
    backup: sensitive ? 'Sao lưu kho khóa đã mã hóa, kiểm tra khả năng khôi phục, phân quyền người giữ bản sao' : 'Sao lưu kho khóa đã mã hóa định kỳ',
    summary: strict ? 'Bảo vệ nghiêm ngặt' : enhanced ? 'Bảo vệ tăng cường' : 'Bảo vệ tiêu chuẩn',
    reasons, limitations,
    resourceCost: strict || longTerm ? 'Cao hơn: khóa/chữ ký lớn hơn; cần đo thử trên thiết bị.' : enhanced ? 'Trung bình: tăng chi phí quản lý quyền/khóa.' : 'Vừa phải: phù hợp hầu hết tác vụ phổ thông.',
  };
}

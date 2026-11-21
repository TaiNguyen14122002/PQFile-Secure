/** PQFile Secure client-side onboarding. Ephemeral keys only; never reads session vault. */
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';

export type LabMode = 'CLASSIC' | 'PQC' | 'HYBRID';
export const MODE_LABELS: Record<LabMode, string> = {
  CLASSIC: 'Truyền thống (X25519 + ECDSA)',
  PQC: 'Hậu lượng tử (ML-KEM-768 + ML-DSA-65)',
  HYBRID: 'Lai (X25519 + ML-KEM-768, chữ ký kép)',
};
export type LabStep = { id: string; label: string; detail: string; durationMs: number; ok: boolean };
export type LabResult = {
  mode: LabMode; fileBytes: number; ciphertextBytes: number; publicKeyBytes: number;
  exchangeBytes: number; signatureBytes: number; durationMs: number;
  signatureVerified: boolean; decryptedMatches: boolean; steps: LabStep[];
};
const encoder = new TextEncoder();
const asBuffer = (v: Uint8Array): ArrayBuffer => new Uint8Array(v).buffer;
const asBytes = (v: ArrayBuffer): Uint8Array => new Uint8Array(v);
const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);
const ticks = () => performance.now();
const measured = (n: number) => Math.round(n * 100) / 100;
function combine(parts: Uint8Array[]): Uint8Array {
  // Unambiguous length-prefix framing: avoid concatenation collisions.
  const out = new Uint8Array(parts.reduce((sum, p) => sum + 4 + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    new DataView(out.buffer).setUint32(offset, p.length, false); offset += 4;
    out.set(p, offset); offset += p.length;
  }
  return out;
}

/** Uses actual cryptographic operations, but only with new ephemeral keys. */
export async function runProtectionLab(input: Uint8Array, mode: LabMode): Promise<LabResult> {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) throw new Error('Cần HTTPS hoặc localhost và WebCrypto.');
  if (!['CLASSIC', 'PQC', 'HYBRID'].includes(mode)) throw new Error('Chế độ mật mã không hợp lệ.');
  if (!input.length || input.length > 512 * 1024) throw new Error('Mẫu thử phải từ 1 byte đến 512 KiB.');
  const steps: LabStep[] = [];
  const partsSender: Uint8Array[] = [], partsReceiver: Uint8Array[] = [];
  let publicKeyBytes = 0, exchangeBytes = 0, signatureBytes = 0;
  let pqKemSecret: Uint8Array | undefined, pqDsaSecret: Uint8Array | undefined;
  let contentKey: Uint8Array | undefined, restoredKey: Uint8Array | undefined;
  const started = ticks();
  function push(id: string, label: string, detail: string, at: number, ok = true) {
    steps.push({ id, label, detail, durationMs: measured(ticks() - at), ok });
  }
  try {
    let at = ticks();
    let classicRecipient: CryptoKeyPair | undefined;
    let classicSignature: CryptoKeyPair | undefined;
    let kemPublic: Uint8Array | undefined;
    let dsaPublic: Uint8Array | undefined;
    if (mode !== 'PQC') {
      classicRecipient = await crypto.subtle.generateKey('X25519', false, ['deriveBits']) as CryptoKeyPair;
      classicSignature = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']) as CryptoKeyPair;
      publicKeyBytes += (await crypto.subtle.exportKey('raw', classicRecipient.publicKey)).byteLength;
      publicKeyBytes += (await crypto.subtle.exportKey('raw', classicSignature.publicKey)).byteLength;
    }
    if (mode !== 'CLASSIC') {
      const k = ml_kem768.keygen(); kemPublic = k.publicKey; pqKemSecret = k.secretKey;
      const s = ml_dsa65.keygen(); dsaPublic = s.publicKey; pqDsaSecret = s.secretKey;
      publicKeyBytes += k.publicKey.length + s.publicKey.length;
    }
    push('keys', 'Sinh bộ khóa thử nghiệm', 'Sinh khóa mới chỉ trong phiên mô phỏng, không sử dụng kho khóa tài khoản.', at);

    at = ticks();
    if (classicRecipient) {
      const ephemeral = await crypto.subtle.generateKey('X25519', false, ['deriveBits']) as CryptoKeyPair;
      const outgoing = asBytes(await crypto.subtle.deriveBits({ name: 'X25519', public: classicRecipient.publicKey }, ephemeral.privateKey, 256));
      const incoming = asBytes(await crypto.subtle.deriveBits({ name: 'X25519', public: ephemeral.publicKey }, classicRecipient.privateKey, 256));
      if (!same(outgoing, incoming)) throw new Error('Khóa X25519 thử nghiệm không khớp.');
      partsSender.push(outgoing); partsReceiver.push(incoming);
      exchangeBytes += (await crypto.subtle.exportKey('raw', ephemeral.publicKey)).byteLength;
    }
    if (kemPublic && pqKemSecret) {
      const encapsulated = ml_kem768.encapsulate(kemPublic);
      const recovered = ml_kem768.decapsulate(encapsulated.cipherText, pqKemSecret);
      if (!same(encapsulated.sharedSecret, recovered)) throw new Error('Bí mật ML-KEM thử nghiệm không khớp.');
      partsSender.push(encapsulated.sharedSecret); partsReceiver.push(recovered);
      exchangeBytes += encapsulated.cipherText.length;
    }
    push('kem', 'Thiết lập khóa phiên', mode === 'HYBRID' ? 'Kết hợp hai bí mật độc lập bằng HKDF-SHA-256.' : 'Thỏa thuận/đóng gói một bí mật phiên độc lập.', at);

    at = ticks();
    const salt = crypto.getRandomValues(new Uint8Array(32));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const context = encoder.encode(`PQFILE:ONBOARDING-LAB:v1:${mode}`);
    const derive = async (parts: Uint8Array[]) => {
      const inputKeyMaterial = combine(parts);
      const h = await crypto.subtle.importKey('raw', asBuffer(inputKeyMaterial), 'HKDF', false, ['deriveBits']);
      inputKeyMaterial.fill(0);
      return asBytes(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: asBuffer(salt), info: asBuffer(context) }, h, 256));
    };
    // Derive from length-prefixed secret material. Keep the same order for both parties.
    contentKey = await derive(partsSender);
    const aesKey = await crypto.subtle.importKey('raw', asBuffer(contentKey), 'AES-GCM', false, ['encrypt']);
    const sealed = asBytes(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: asBuffer(iv), additionalData: asBuffer(context) }, aesKey, asBuffer(input)));
    push('encrypt', 'Mã hóa AES-256-GCM', `Bản mã gồm ${sealed.length.toLocaleString('vi-VN')} byte, có thẻ xác thực.`, at);

    at = ticks();
    let classicSig: Uint8Array | undefined, pqSig: Uint8Array | undefined;
    if (classicSignature) classicSig = asBytes(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, classicSignature.privateKey, asBuffer(sealed)));
    if (pqDsaSecret) pqSig = ml_dsa65.sign(sealed, pqDsaSecret);
    signatureBytes = (classicSig?.length || 0) + (pqSig?.length || 0);
    push('sign', 'Ký bản mã', mode === 'HYBRID' ? 'Ký hai chữ ký độc lập (ECDSA và ML-DSA).' : 'Chữ ký gắn với bản mã đã mã hóa.', at);

    at = ticks();
    const verifiedClassic = !classicSignature || (!!classicSig && await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, classicSignature.publicKey, asBuffer(classicSig), asBuffer(sealed)));
    const verifiedPq = !dsaPublic || (!!pqSig && ml_dsa65.verify(pqSig, sealed, dsaPublic));
    const signatureVerified = Boolean(verifiedClassic && verifiedPq);
    if (!signatureVerified) throw new Error('Chữ ký thử nghiệm không hợp lệ.');
    push('verify', 'Xác minh chữ ký', 'Phát hiện thay đổi nội dung ký trước khi giải mã.', at);

    at = ticks();
    restoredKey = await derive(partsReceiver);
    const openKey = await crypto.subtle.importKey('raw', asBuffer(restoredKey), 'AES-GCM', false, ['decrypt']);
    const plain = asBytes(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: asBuffer(iv), additionalData: asBuffer(context) }, openKey, asBuffer(sealed)));
    const decryptedMatches = same(plain, input);
    plain.fill(0);
    if (!decryptedMatches) throw new Error('Nội dung giải mã không khớp mẫu ban đầu.');
    push('decrypt', 'Giải mã và đối chiếu', 'Xác thực AES-GCM thành công và dữ liệu khớp từng byte.', at);
    return { mode, fileBytes: input.length, ciphertextBytes: sealed.length, publicKeyBytes, exchangeBytes: exchangeBytes + salt.length + iv.length,
      signatureBytes, durationMs: measured(ticks() - started), signatureVerified, decryptedMatches, steps };
  } finally {
    // Clear all JS byte buffers containing key material when possible.
    [...partsSender, ...partsReceiver, pqKemSecret, pqDsaSecret, contentKey, restoredKey]
      .forEach(v => v?.fill(0));
    // WebCrypto private CryptoKeys are non-extractable; they are not returned/stored.
  }
}

export type CompatibilityCheck = { id: string; title: string; ok: boolean; detail: string; durationMs?: number; optional?: boolean };
export type CompatibilityReport = { checks: CompatibilityCheck[]; overall: 'good' | 'limited' | 'unsupported';
  browserMemoryGb: number | null; logicalCores: number | null; sampleMs: number | null; fileTestMs: number | null; testedAt: string; notes: string[] };

/** Runs in this browser. Does not upload hardware information or test results. */
export async function probeDevice(): Promise<CompatibilityReport> {
  const checks: CompatibilityCheck[] = [];
  const hasWebCrypto = Boolean(globalThis.crypto?.subtle && globalThis.crypto?.getRandomValues);
  const secure = Boolean(globalThis.isSecureContext);
  checks.push({ id: 'context', title: 'Ngữ cảnh an toàn', ok: secure, detail: secure ? 'HTTPS/localhost được chấp nhận.' : 'Cần HTTPS hoặc localhost để dùng WebCrypto.' });
  checks.push({ id: 'webcrypto', title: 'WebCrypto AES-GCM/SHA-256', ok: hasWebCrypto, detail: hasWebCrypto ? 'Đã tìm thấy WebCrypto API.' : 'Thiếu WebCrypto, không thể mã hóa trong trình duyệt.' });
  let x25519 = false, hkdf = false, kem = false, fileOk = false, elapsed: number | null = null, fileTestMs: number | null = null;
  if (hasWebCrypto) {
    try {
      const kp = await crypto.subtle.generateKey('X25519', false, ['deriveBits']) as CryptoKeyPair;
      x25519 = Boolean(kp.publicKey && kp.privateKey);
    } catch { /* feature detection */ }
    try {
      const key = await crypto.subtle.importKey('raw', asBuffer(new Uint8Array(32)), 'HKDF', false, ['deriveBits']);
      hkdf = (await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: asBuffer(new Uint8Array(32)), info: asBuffer(encoder.encode('PQFILE:PROBE')) }, key, 256)).byteLength === 32;
    } catch { /* feature detection */ }
    try {
      // Bounded 128 KiB local Blob/ArrayBuffer and AES-GCM round trip.
      const start = ticks();
      const sample = new Uint8Array(128 * 1024);
      // WebCrypto limits getRandomValues to 65,536 bytes per call.
      crypto.getRandomValues(sample.subarray(0, 65536));
      crypto.getRandomValues(sample.subarray(65536));
      const blob = new Blob([asBuffer(sample)], { type: 'application/octet-stream' });
      const readBack = asBytes(await blob.arrayBuffer());
      const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: asBuffer(iv) }, key, asBuffer(readBack));
      const decrypted = asBytes(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: asBuffer(iv) }, key, sealed));
      fileOk = same(sample, decrypted); fileTestMs = measured(ticks() - start);
      sample.fill(0); readBack.fill(0); decrypted.fill(0);
    } catch { /* feature unavailable */ }
    const start = ticks();
    try {
      const pair = ml_kem768.keygen();
      const capsule = ml_kem768.encapsulate(pair.publicKey);
      const plain = ml_kem768.decapsulate(capsule.cipherText, pair.secretKey);
      kem = same(capsule.sharedSecret, plain);
      pair.secretKey.fill(0); capsule.sharedSecret.fill(0); plain.fill(0);
      elapsed = measured(ticks() - start);
    } catch { /* feature detection */ }
  }
  checks.push({ id: 'file', title: 'Tệp mẫu + AES-GCM (128 KiB)', ok: fileOk, durationMs: fileTestMs ?? undefined, detail: fileOk ? `Đọc tệp và mã hóa/giải mã khớp (${fileTestMs} ms).` : 'Không thực hiện được vòng kiểm tra tệp và mã hóa.' });
  checks.push({ id: 'x25519', title: 'X25519', ok: x25519, detail: x25519 ? 'Sinh khóa X25519 thành công.' : 'Không khả dụng trong trình duyệt này.', optional: true });
  checks.push({ id: 'hkdf', title: 'HKDF-SHA-256', ok: hkdf, detail: hkdf ? 'Có thể dẫn xuất khóa phiên.' : 'Không đủ điều kiện dùng cơ chế lai.' });
  checks.push({ id: 'mlkem', title: 'Thử nghiệm ML-KEM-768', ok: kem, durationMs: elapsed ?? undefined,
    detail: kem ? `Đóng gói và mở khóa thành công (${elapsed} ms trên mẫu nhỏ).` : 'Không chạy được phép thử ML-KEM.' });
  const nav = navigator as Navigator & { deviceMemory?: number };
  const browserMemoryGb = typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null;
  const logicalCores = navigator.hardwareConcurrency || null;
  const supportsBasic = secure && hasWebCrypto && hkdf && kem && fileOk;
  const overall: CompatibilityReport['overall'] = !supportsBasic ? 'unsupported' : (!x25519 || (elapsed ?? 0) > 1200 || (browserMemoryGb !== null && browserMemoryGb < 4)) ? 'limited' : 'good';
  const notes = [
    'Thông số RAM trình duyệt có thể không được cung cấp; không thể suy ra RAM còn trống.',
    'Thời gian thử nghiệm phụ thuộc tải CPU, nhiệt độ và trình duyệt; không phải benchmark chuẩn hóa.',
    'Không kiểm tra GPU, ổ đĩa hoặc quyền lưu trữ của hệ điều hành.',
  ];
  if (overall === 'limited') notes.unshift('Đề nghị tệp nhỏ, xử lý theo từng đợt và tránh nhiều tác vụ cùng lúc.');
  if (overall === 'unsupported') notes.unshift('Một số thành phần thiết yếu không khả dụng; cần nâng cấp trình duyệt hoặc dùng HTTPS.');
  return { checks, overall, browserMemoryGb, logicalCores, sampleMs: elapsed, fileTestMs, testedAt: new Date().toISOString(), notes };
}

/**
 * Parse API responses without interpreting HTML from a misplaced SPA route as
 * successful JSON. This module intentionally has no Nuxt/browser globals.
 */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly errorId?: string;
  constructor(message: string, status: number, errorId?: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.errorId = errorId;
  }
}

export function apiEndpoint(path: string): string {
  // Never include query values (emails, filters, etc.) in user-facing errors.
  const pathname = path.split(/[?#]/, 1)[0] || '/';
  return `/api${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
}

export function isJsonContentType(value: string): boolean {
  return /^\s*(?:application\/(?:json|[a-z0-9.+-]+\+json)|text\/json)(?:\s*;|\s*$)/i.test(value);
}

export async function parseApiResponse<T>(res: Response, path: string): Promise<T> {
  const route = apiEndpoint(path);
  const contentType = res.headers.get('content-type') || '';
  const gatewayRoute = res.headers.get('x-pqfile-route') || '';
  const isJson = isJsonContentType(contentType);

  if (!res.ok) {
    // Do not parse/expose an upstream HTML error page or a Nuxt SPA fallback.
    let payload: Record<string, unknown> = {};
    if (isJson || !contentType) {
      try {
        const body: unknown = await res.json();
        if (body && typeof body === 'object' && !Array.isArray(body))
          payload = body as Record<string, unknown>;
      } catch { /* Use a safe HTTP status message below. */ }
    } else {
      await res.body?.cancel().catch(() => {});
    }
    const errorId = typeof payload.errorId === 'string' && /^[0-9a-f-]{36}$/i.test(payload.errorId)
      ? payload.errorId : undefined;
    const raw = payload.message;
    const message = Array.isArray(raw) ? raw.filter(x => typeof x === 'string').join('; ')
      : typeof raw === 'string' ? raw : '';
    const fallback = res.status === 401 ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
      : res.status === 403 ? 'Bạn không có quyền thực hiện thao tác này.'
      : res.status === 404 ? 'Không tìm thấy tài nguyên.'
      : res.status === 413 ? 'Tệp vượt quá giới hạn tải lên.'
      : res.status === 429 ? 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.'
      : [502, 503, 504].includes(res.status) ? 'API hoặc dịch vụ phía sau Gateway đang gián đoạn.'
      : res.status >= 500 ? 'Máy chủ gặp sự cố. Kiểm tra nhật ký API.'
      : `Yêu cầu thất bại (HTTP ${res.status}).`;
    const notJsonHint = contentType && !isJson
      ? ` Phản hồi ${contentType.split(';', 1)[0]} không phải JSON; kiểm tra tuyến Gateway.` : '';
    throw new ApiRequestError(
      `${message || fallback}${notJsonHint} [${route}, HTTP ${res.status}]${errorId ? ` (mã lỗi: ${errorId})` : ''}`,
      res.status, errorId
    );
  }

  // No-body success statuses are valid, not a gateway problem.
  if (res.status === 204 || res.status === 205) return undefined as T;

  // A successful HTML response is almost always a Nuxt page or proxy fallback,
  // not an API response. Reject it explicitly; never silently accept HTML.
  if (contentType && !isJson) {
    await res.body?.cancel().catch(() => {});
    const hint = contentType.toLowerCase().includes('html')
      ? 'Có thể Gateway đã chuyển yêu cầu API sang trang Nuxt.'
      : 'Kiểm tra Content-Type của API.';
    throw new ApiRequestError(
      `${route} trả về HTTP ${res.status} nhưng có kiểu ${contentType.split(';', 1)[0]} thay vì JSON. ${hint}${gatewayRoute ? ` Tuyến: ${gatewayRoute}.` : ''}`,
      res.status
    );
  }
  try {
    // If an intermediate proxy omitted Content-Type, accept ONLY syntactically
    // valid JSON. Invalid or empty bodies still fail closed.
    return await res.json() as T;
  } catch {
    throw new ApiRequestError(`${route} trả về HTTP ${res.status} nhưng nội dung JSON rỗng hoặc không hợp lệ.`, res.status);
  }
}

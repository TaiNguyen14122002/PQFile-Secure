/** Read a timestamp from mapped Drizzle rows or raw PostgreSQL aggregates.
 * Do not assume sql<T> converts runtime values. Invalid dates never grant access.
 */
export function readTimestamp(value: unknown): number | null {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : null;
  }
  if (typeof value === 'string' && value.trim()) {
    const time = Date.parse(value);
    return Number.isFinite(time) ? time : null;
  }
  return null;
}

/** Null expiration means no expiration; malformed expiration always means DENY. */
export function hasActiveGrantExpiration(expiresAt: unknown, now = Date.now()): boolean {
  if (expiresAt === null || expiresAt === undefined) return true;
  const time = readTimestamp(expiresAt);
  return time !== null && time > now;
}

/** No SQL code, constraint name or internal string is sent to the browser. */
export type ClassifiedApiFailure = { status: number; message: string; code: string };
export function classifyApiFailure(error: unknown): ClassifiedApiFailure | null {
  let current: unknown = error;
  const seen = new Set<object>();
  for (let depth = 0; depth < 4; depth++) {
    if (!current || typeof current !== 'object' || seen.has(current)) break;
    seen.add(current);
    const record = current as Record<string, unknown>;
    const code = typeof record.code === 'string' ? record.code : '';
    switch (code) {
      case '23505': return { status: 409, message: 'Dữ liệu đã tồn tại. Hãy tải lại trang trước khi thử lại.', code };
      case '23503': return { status: 409, message: 'Dữ liệu liên quan đã thay đổi hoặc không còn tồn tại.', code };
      case '40001':
      case '40P01': return { status: 409, message: 'Thao tác đồng thời bị xung đột. Vui lòng thử lại.', code };
      case '23502':
      case '23514':
      case '22P02':
      case '22001':
      case '22003':
      case '22007':
      case '22008': return { status: 400, message: 'Dữ liệu yêu cầu không đúng định dạng hoặc vượt giới hạn.', code };
      case '42P01':
      case '42703':
      case '42883': return { status: 503, message: 'Cấu trúc cơ sở dữ liệu chưa đồng bộ với API. Kiểm tra migration.', code };
      case '53300':
      case '53400':
      case '57P01':
      case '57P02':
      case '57P03':
      case 'ECONNREFUSED':
      case 'ECONNRESET':
      case 'ETIMEDOUT':
      case 'ENOTFOUND':
      case 'EAI_AGAIN': return { status: 503, message: 'Không thể kết nối tới dịch vụ cơ sở dữ liệu. Vui lòng thử lại.', code };
    }
    if (/^08[A-Z0-9]{3}$/.test(code)) return { status: 503, message: 'Kết nối cơ sở dữ liệu bị gián đoạn. Vui lòng thử lại.', code };
    current = record.cause ?? record.driverError ?? record.originalError;
  }
  return null;
}

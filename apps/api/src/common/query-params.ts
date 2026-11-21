import { BadRequestException } from '@nestjs/common';

/** Express may deliver repeated or structured query params as arrays/objects.
 * Reject them instead of calling .trim() on an unknown value and returning HTTP 500.
 */
export function optionalQueryText(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new BadRequestException(`Tham số ${field} phải là chuỗi đơn`);
  return value;
}

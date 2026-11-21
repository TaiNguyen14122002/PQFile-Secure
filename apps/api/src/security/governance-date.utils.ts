/** Normalize timestamps returned by raw PostgreSQL aggregates (e.g. MAX(created_at)).
 * The Drizzle sql<T> generic is a TypeScript type assertion, not a runtime parser.
 * Invalid/null dates are ignored so the review falls back to the grant creation date.
 */
export function parseGovernanceTimestamp(value: unknown): Date | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

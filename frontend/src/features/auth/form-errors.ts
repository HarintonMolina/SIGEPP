import type { ApiError } from '../../api/errors';

export function splitFormErrors(
  error: ApiError,
  allowedFields: readonly string[],
): { fields: Record<string, string>; general: string[] } {
  const fields = new Map<string, string>();
  const general = [error.message];
  for (const detail of error.detalles) {
    const separator = detail.indexOf(':');
    const field = separator < 0 ? '' : detail.slice(0, separator).trim();
    const message = separator < 0 ? '' : detail.slice(separator + 1).trim();
    if (field && message && allowedFields.includes(field)) {
      const previous = fields.get(field);
      fields.set(field, previous ? `${previous}\n${message}` : message);
    } else {
      general.push(detail);
    }
  }
  return { fields: Object.fromEntries(fields), general };
}

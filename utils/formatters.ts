export function formatIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDateIndo(dateString: string): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function getWibDateStr(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Returns relative date label ('Hari ini', 'Besok', 'Lusa', or '')
 * based on WIB calendar date comparison (Asia/Jakarta, UTC+7).
 */
export function getRelativeDateLabel(dateString?: string | null, nowInput: Date | string = new Date()): string {
  if (!dateString) return '';

  const trimmed = dateString.trim();
  let targetDateStr = '';

  // If input is purely YYYY-MM-DD (e.g. '2026-09-12'), use it directly as WIB date
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    targetDateStr = trimmed;
  } else {
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) return '';
    targetDateStr = getWibDateStr(d);
  }

  const now = typeof nowInput === 'string' ? new Date(nowInput) : nowInput;
  if (isNaN(now.getTime())) return '';

  const todayStr = getWibDateStr(now);

  const [year, month, day] = todayStr.split('-').map(Number);
  const todayDateUtc = new Date(Date.UTC(year, month - 1, day));

  const tomorrowUtc = new Date(todayDateUtc);
  tomorrowUtc.setUTCDate(todayDateUtc.getUTCDate() + 1);
  const tomorrowStr = tomorrowUtc.toISOString().split('T')[0];

  const dayAfterTomorrowUtc = new Date(todayDateUtc);
  dayAfterTomorrowUtc.setUTCDate(todayDateUtc.getUTCDate() + 2);
  const dayAfterTomorrowStr = dayAfterTomorrowUtc.toISOString().split('T')[0];

  if (targetDateStr === todayStr) return 'Hari ini';
  if (targetDateStr === tomorrowStr) return 'Besok';
  if (targetDateStr === dayAfterTomorrowStr) return 'Lusa';

  return '';
}

/**
 * Formats date string into Indonesian locale date with relative label suffix.
 * Example: 'Sabtu, 12 September 2026 · Hari ini'
 */
export function formatDateIndoWithRelative(dateString?: string | null, nowInput?: Date | string): string {
  if (!dateString) return '-';
  const baseFormatted = formatDateIndo(dateString);
  if (baseFormatted === '-') return '-';

  const relativeLabel = getRelativeDateLabel(dateString, nowInput);
  if (relativeLabel) {
    return `${baseFormatted} · ${relativeLabel}`;
  }
  return baseFormatted;
}

export function formatDateTimeIndo(dateString: string): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date) + ' WIB';
}

export function generateTrackingId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = 'LND-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function isValidUuid(id?: string | null): boolean {
  if (!id) return false;
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id);
}

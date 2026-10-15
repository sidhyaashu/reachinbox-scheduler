import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatDateTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '—';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

export function formatFigmaScheduleTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return 'Tue 9:15:12 AM';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return 'Tue 9:15:12 AM';

  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(d);
  const time = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(d);

  return `${weekday} ${time}`;
}

export function formatRelativeTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '—';
  const target = new Date(dateInput).getTime();
  const now = Date.now();
  const diffMs = target - now;
  const absDiffSec = Math.floor(Math.abs(diffMs) / 1000);

  if (absDiffSec < 60) {
    return diffMs > 0 ? 'in < 1 min' : 'just now';
  }

  const mins = Math.floor(absDiffSec / 60);
  if (mins < 60) {
    return diffMs > 0 ? `in ${mins}m` : `${mins}m ago`;
  }

  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return diffMs > 0 ? `in ${hours}h` : `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return diffMs > 0 ? `in ${days}d` : `${days}d ago`;
}

/**
 * Extracts and deduplicates valid email addresses from raw CSV, TSV, or plain text content.
 */
export function parseLeadsFromTextOrCsv(content: string): {
  validEmails: string[];
  totalParsed: number;
  invalidCount: number;
} {
  if (!content || !content.trim()) {
    return { validEmails: [], totalParsed: 0, invalidCount: 0 };
  }

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const rawTokens = content
    .split(/[\r\n,;\t]+/)
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);

  const seen = new Set<string>();
  const validEmails: string[] = [];
  let invalidCount = 0;

  for (const token of rawTokens) {
    // If it's a header like "email" or "lead", skip
    if (token.toLowerCase() === 'email' || token.toLowerCase() === 'leads' || token.toLowerCase() === 'recipient') {
      continue;
    }

    if (emailRegex.test(token)) {
      const lower = token.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        validEmails.push(lower);
      }
    } else {
      invalidCount++;
    }
  }

  return {
    validEmails,
    totalParsed: rawTokens.length,
    invalidCount,
  };
}

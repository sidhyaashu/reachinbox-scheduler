import { describe, it, expect } from 'vitest';
import {
  parseLeadsFromTextOrCsv,
  formatFigmaScheduleTime,
  formatDateTime,
  formatRelativeTime,
  getFallbackInitials,
} from '../lib/utils.js';

describe('Web Utilities & Parsers', () => {
  describe('parseLeadsFromTextOrCsv', () => {
    it('returns empty array when content is empty or whitespace', () => {
      expect(parseLeadsFromTextOrCsv('')).toEqual({
        validEmails: [],
        totalParsed: 0,
        invalidCount: 0,
      });
      expect(parseLeadsFromTextOrCsv('   \n\t  ')).toEqual({
        validEmails: [],
        totalParsed: 0,
        invalidCount: 0,
      });
    });

    it('extracts and deduplicates emails from comma-separated list', () => {
      const input = 'alex@acme.com, sarah@corp.io, alex@acme.com, john@startup.co';
      const result = parseLeadsFromTextOrCsv(input);
      expect(result.validEmails).toEqual([
        'alex@acme.com',
        'sarah@corp.io',
        'john@startup.co',
      ]);
      expect(result.invalidCount).toBe(0);
    });

    it('parses CSV with header rows and skips "email", "leads", "recipient"', () => {
      const csvContent = `Email,Name,Company
alex@acme.com,Alex Founder,Acme
leads,Ignore Me,Test
sarah@corp.io,Sarah Clark,Corp
invalid-email-address,Bad Lead,Bad
recipient,Skip Header,Test`;

      const result = parseLeadsFromTextOrCsv(csvContent);
      expect(result.validEmails).toEqual(['alex@acme.com', 'sarah@corp.io']);
      expect(result.invalidCount).toBeGreaterThanOrEqual(1);
    });

    it('normalizes uppercase emails to lowercase', () => {
      const input = 'ALEX@REACHINBOX.AI, alex@reachinbox.ai';
      const result = parseLeadsFromTextOrCsv(input);
      expect(result.validEmails).toEqual(['alex@reachinbox.ai']);
    });
  });

  describe('formatFigmaScheduleTime', () => {
    it('formats a date to weekday, hour, minute, and second matching Figma design', () => {
      const date = new Date('2026-10-20T10:30:15Z');
      const formatted = formatFigmaScheduleTime(date);
      expect(formatted).toMatch(/[A-Z][a-z]{2}\s\d{1,2}:\d{2}:\d{2}\s(AM|PM)/);
    });

    it('returns fallback for null or invalid date', () => {
      expect(formatFigmaScheduleTime(null)).toBe('Tue 9:15:12 AM');
      expect(formatFigmaScheduleTime('invalid-date')).toBe('Tue 9:15:12 AM');
    });
  });

  describe('formatDateTime & formatRelativeTime', () => {
    it('formats valid date with month, day, year, and time', () => {
      const date = new Date('2026-10-20T14:30:00Z');
      const formatted = formatDateTime(date);
      expect(formatted).toContain('2026');
    });

    it('returns relative time string for past and future dates', () => {
      const future = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours ahead
      expect(formatRelativeTime(future)).toMatch(/in \d+h/);

      const past = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
      expect(formatRelativeTime(past)).toBe('30m ago');
    });
  });

  describe('getFallbackInitials', () => {
    it('returns 2 uppercase letters for multi-word names', () => {
      expect(getFallbackInitials('Oliver Brown')).toBe('OB');
      expect(getFallbackInitials('Alex Founder')).toBe('AF');
      expect(getFallbackInitials('John Fitzgerald Kennedy')).toBe('JF');
    });

    it('returns first 2 uppercase letters for single-word names', () => {
      expect(getFallbackInitials('GuffixMind')).toBe('GU');
      expect(getFallbackInitials('reachinbox')).toBe('RE');
    });

    it('falls back to email prefix letters when name is missing or empty', () => {
      expect(getFallbackInitials(null, 'guffixmind@gmail.com')).toBe('GU');
      expect(getFallbackInitials('', 'alex@acme.com')).toBe('AL');
    });

    it('handles single-character names and empty values with uppercase fallback', () => {
      expect(getFallbackInitials('X')).toBe('X');
      expect(getFallbackInitials(null, null)).toBe('US');
    });
  });
});


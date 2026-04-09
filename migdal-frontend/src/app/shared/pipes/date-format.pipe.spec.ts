import { DateFormatPipe } from './date-format.pipe';

describe('DateFormatPipe', () => {
    let pipe: DateFormatPipe;

    beforeEach(() => {
        pipe = new DateFormatPipe();
    });

    it('should return "-" for null', () => {
        expect(pipe.transform(null)).toBe('-');
    });

    it('should return "-" for undefined', () => {
        expect(pipe.transform(undefined)).toBe('-');
    });

    it('should return "-" for invalid date string', () => {
        expect(pipe.transform('not-a-date')).toBe('-');
    });

    it('should format a UTC date string as datetime in Asia/Jerusalem', () => {
        // 2025-06-15T10:30:00Z → Israel is UTC+3 in summer → 13:30
        const result = pipe.transform('2025-06-15T10:30:00Z');
        expect(result).toMatch(/15\/06\/2025\s+13:30/);
    });

    it('should format date-only', () => {
        const result = pipe.transform('2025-06-15T10:30:00Z', 'date');
        expect(result).toBe('15/06/2025');
    });

    it('should format time-only', () => {
        const result = pipe.transform('2025-06-15T10:30:00Z', 'time');
        expect(result).toBe('13:30');
    });

    it('should accept Date objects', () => {
        const d = new Date('2025-01-15T08:00:00Z');
        // Israel is UTC+2 in winter → 10:00
        const result = pipe.transform(d, 'time');
        expect(result).toBe('10:00');
    });

    it('should handle midnight UTC correctly', () => {
        // 2025-06-01T00:00:00Z → Israel UTC+3 → 03:00 same day
        const result = pipe.transform('2025-06-01T00:00:00Z', 'time');
        expect(result).toBe('03:00');
    });

    it('should handle late night UTC crossing day boundary to Israel next day', () => {
        // 2025-06-01T22:00:00Z → Israel UTC+3 → 01:00 on June 2
        const result = pipe.transform('2025-06-01T22:00:00Z', 'date');
        expect(result).toBe('02/06/2025');
    });
});

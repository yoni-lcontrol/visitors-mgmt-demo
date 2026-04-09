import { getDayBoundsUtc } from './date.util';

describe('getDayBoundsUtc', () => {
    it('should return dayStart at midnight Israel time in UTC (UTC+3 in summer)', () => {
        // July 15 2025, 10:00 UTC → 13:00 Israel (IDT = UTC+3)
        const date = new Date('2025-07-15T10:00:00.000Z');
        const { dayStart, dayEnd } = getDayBoundsUtc(date, 'Asia/Jerusalem');

        // Midnight July 15 Israel = July 14 21:00 UTC  (UTC+3)
        expect(dayStart.toISOString()).toBe('2025-07-14T21:00:00.000Z');
        // Midnight July 16 Israel = July 15 21:00 UTC
        expect(dayEnd.toISOString()).toBe('2025-07-15T21:00:00.000Z');
    });

    it('should return dayStart at midnight Israel time in UTC (UTC+2 in winter)', () => {
        // January 15 2025, 10:00 UTC → 12:00 Israel (IST = UTC+2)
        const date = new Date('2025-01-15T10:00:00.000Z');
        const { dayStart, dayEnd } = getDayBoundsUtc(date, 'Asia/Jerusalem');

        // Midnight Jan 15 Israel = Jan 14 22:00 UTC  (UTC+2)
        expect(dayStart.toISOString()).toBe('2025-01-14T22:00:00.000Z');
        // Midnight Jan 16 Israel = Jan 15 22:00 UTC
        expect(dayEnd.toISOString()).toBe('2025-01-15T22:00:00.000Z');
    });

    it('should return UTC day bounds when timezone is UTC', () => {
        const date = new Date('2025-04-10T15:30:00.000Z');
        const { dayStart, dayEnd } = getDayBoundsUtc(date, 'UTC');

        expect(dayStart.toISOString()).toBe('2025-04-10T00:00:00.000Z');
        expect(dayEnd.toISOString()).toBe('2025-04-11T00:00:00.000Z');
    });

    it('should handle dates near midnight UTC with a positive-offset timezone', () => {
        // April 10, 22:30 UTC → April 11, 01:30 Israel (UTC+3)
        // So "today" in Israel is April 11
        const date = new Date('2025-04-10T22:30:00.000Z');
        const { dayStart, dayEnd } = getDayBoundsUtc(date, 'Asia/Jerusalem');

        // Midnight April 11 Israel = April 10 21:00 UTC
        expect(dayStart.toISOString()).toBe('2025-04-10T21:00:00.000Z');
        // Midnight April 12 Israel = April 11 21:00 UTC
        expect(dayEnd.toISOString()).toBe('2025-04-11T21:00:00.000Z');
    });

    it('should handle dates near midnight UTC with a negative-offset timezone', () => {
        // April 10, 01:00 UTC → April 9, 21:00 US Eastern (EDT = UTC-4)
        // So "today" in US Eastern is April 9
        const date = new Date('2025-04-10T01:00:00.000Z');
        const { dayStart, dayEnd } = getDayBoundsUtc(date, 'America/New_York');

        // Midnight April 9 Eastern (EDT) = April 9 04:00 UTC
        expect(dayStart.toISOString()).toBe('2025-04-09T04:00:00.000Z');
        // Midnight April 10 Eastern = April 10 04:00 UTC
        expect(dayEnd.toISOString()).toBe('2025-04-10T04:00:00.000Z');
    });

    it('should span exactly one calendar day', () => {
        const date = new Date('2025-06-20T12:00:00.000Z');
        const { dayStart, dayEnd } = getDayBoundsUtc(date, 'Asia/Jerusalem');

        const durationMs = dayEnd.getTime() - dayStart.getTime();
        // 24 hours in ms
        expect(durationMs).toBe(24 * 60 * 60 * 1000);
    });

    it('should default to Asia/Jerusalem timezone', () => {
        // Clear any BUSINESS_TIMEZONE env to test default
        const origEnv = process.env.BUSINESS_TIMEZONE;
        delete process.env.BUSINESS_TIMEZONE;

        try {
            const date = new Date('2025-07-15T10:00:00.000Z');
            const { dayStart } = getDayBoundsUtc(date);
            // Default is Asia/Jerusalem, July = IDT (UTC+3)
            // Midnight July 15 Israel = July 14 21:00 UTC
            expect(dayStart.toISOString()).toBe('2025-07-14T21:00:00.000Z');
        } finally {
            if (origEnv !== undefined) {
                process.env.BUSINESS_TIMEZONE = origEnv;
            }
        }
    });

    it('should respect BUSINESS_TIMEZONE env variable', () => {
        const origEnv = process.env.BUSINESS_TIMEZONE;
        process.env.BUSINESS_TIMEZONE = 'America/New_York';

        try {
            // April 10, 15:00 UTC → 11:00 US Eastern (EDT)
            const date = new Date('2025-04-10T15:00:00.000Z');
            const { dayStart } = getDayBoundsUtc(date);
            // Midnight April 10 EDT = April 10 04:00 UTC
            expect(dayStart.toISOString()).toBe('2025-04-10T04:00:00.000Z');
        } finally {
            if (origEnv !== undefined) {
                process.env.BUSINESS_TIMEZONE = origEnv;
            } else {
                delete process.env.BUSINESS_TIMEZONE;
            }
        }
    });

    it('should return Date objects (not strings)', () => {
        const { dayStart, dayEnd } = getDayBoundsUtc(new Date(), 'Asia/Jerusalem');
        expect(dayStart).toBeInstanceOf(Date);
        expect(dayEnd).toBeInstanceOf(Date);
    });
});

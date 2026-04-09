/**
 * Returns UTC Date objects for the start (midnight) and end (next midnight)
 * of the calendar day containing `date` in the business timezone.
 *
 * This ensures that "today" filtering is consistent regardless of the
 * server's local timezone setting.
 */
export function getDayBoundsUtc(
    date: Date = new Date(),
    timezone: string = process.env.BUSINESS_TIMEZONE || 'Asia/Jerusalem',
): { dayStart: Date; dayEnd: Date } {
    // Get the calendar date in the target timezone (YYYY-MM-DD)
    const todayStr = date.toLocaleDateString('en-CA', { timeZone: timezone });

    // Compute next calendar date
    const noon = new Date(todayStr + 'T12:00:00Z');
    const nextNoon = new Date(noon.getTime() + 86_400_000);
    const nextStr = nextNoon.toISOString().slice(0, 10);

    const dayStart = calendarMidnightToUtc(todayStr, timezone);
    const dayEnd = calendarMidnightToUtc(nextStr, timezone);

    return { dayStart, dayEnd };
}

/**
 * Converts midnight of a calendar date (YYYY-MM-DD) in the given timezone
 * to a UTC Date.
 */
function calendarMidnightToUtc(dateStr: string, timezone: string): Date {
    // Start with UTC midnight of the calendar date
    const utcMidnight = new Date(dateStr + 'T00:00:00.000Z');

    // Compute the timezone offset at noon of that date (noon avoids DST
    // transition edge cases that occur near midnight in some timezones)
    const noonUtc = new Date(dateStr + 'T12:00:00.000Z');
    const offsetMs = tzOffsetMs(noonUtc, timezone);

    // Midnight in the target timezone expressed as UTC
    return new Date(utcMidnight.getTime() - offsetMs);
}

/**
 * Returns the signed offset in milliseconds between the given timezone and UTC
 * at the specified UTC instant.  Positive = east of UTC.
 */
function tzOffsetMs(utcDate: Date, timezone: string): number {
    const parts: Record<string, number> = {};
    new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
    })
        .formatToParts(utcDate)
        .forEach((p) => {
            if (p.type !== 'literal') {
                parts[p.type] =
                    p.type === 'hour' && p.value === '24'
                        ? 0
                        : parseInt(p.value, 10);
            }
        });

    const localMs = Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second,
    );
    return localMs - utcDate.getTime();
}

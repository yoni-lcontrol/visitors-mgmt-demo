import { Pipe, PipeTransform } from '@angular/core';

const BUSINESS_TZ = 'Asia/Jerusalem';

@Pipe({ name: 'dateFormat', standalone: true })
export class DateFormatPipe implements PipeTransform {
    private static readonly dateFormatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: BUSINESS_TZ,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });

    private static readonly dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: BUSINESS_TZ,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });

    private static readonly timeFormatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: BUSINESS_TZ,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });

    transform(value: string | Date | null | undefined, format: 'datetime' | 'date' | 'time' = 'datetime'): string {
        if (!value) return '-';

        const d = typeof value === 'string' ? new Date(value) : value;
        if (isNaN(d.getTime())) return '-';

        if (format === 'date') {
            return DateFormatPipe.dateFormatter.format(d);
        }

        if (format === 'time') {
            return DateFormatPipe.timeFormatter.format(d);
        }

        // 'datetime' — Intl formats as "dd/mm/yyyy, HH:mm", strip the comma
        return DateFormatPipe.dateTimeFormatter.format(d).replace(',', '');
    }
}

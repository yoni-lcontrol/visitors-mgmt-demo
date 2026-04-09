import { Injectable, inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { HttpErrorResponse } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class NotificationService {
    private messageService = inject(MessageService);
    private translate = inject(TranslateService);

    success(detailKey: string): void {
        this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('COMMON.SUCCESS'),
            detail: this.translate.instant(detailKey),
            life: 3000,
        });
    }

    error(error: unknown): void {
        const detail = this.extractErrorMessage(error);
        this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('COMMON.ERROR'),
            detail,
            life: 5000,
        });
    }

    warn(detail: string): void {
        this.messageService.add({
            severity: 'warn',
            summary: this.translate.instant('COMMON.WARNING'),
            detail,
            life: 5000,
        });
    }

    info(detail: string): void {
        this.messageService.add({
            severity: 'info',
            summary: '',
            detail,
            life: 4000,
        });
    }

    private extractErrorMessage(error: unknown): string {
        if (error instanceof HttpErrorResponse) {
            const body = error.error;
            if (body?.message) {
                return Array.isArray(body.message) ? body.message.join(', ') : body.message;
            }
            return error.statusText || this.translate.instant('COMMON.ERROR');
        }
        return this.translate.instant('COMMON.ERROR');
    }
}

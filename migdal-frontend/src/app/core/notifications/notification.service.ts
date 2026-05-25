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

    warn(detailKey: string): void {
        this.messageService.add({
            severity: 'warn',
            summary: this.translate.instant('COMMON.WARNING'),
            detail: this.translate.instant(detailKey),
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

    showHttpError(error: HttpErrorResponse): void {
        const detail = this.extractHttpErrorMessage(error);
        const summary = this.getErrorSummary(error);
        this.messageService.add({
            severity: 'error',
            summary,
            detail,
            life: 5000,
        });
    }

    private getErrorSummary(error: HttpErrorResponse): string {
        if (error.status === 403) {
            return this.translate.instant('COMMON.PERMISSION_DENIED');
        }
        if (error.status === 400) {
            return this.translate.instant('COMMON.VALIDATION_ERROR');
        }
        return this.translate.instant('COMMON.ERROR');
    }

    private extractHttpErrorMessage(error: HttpErrorResponse): string {
        if (error.status === 0) {
            return this.translate.instant('COMMON.NETWORK_ERROR');
        }
        if (error.status === 502 || error.status === 503) {
            return this.translate.instant('COMMON.SERVICE_UNAVAILABLE');
        }
        if (error.status === 403) {
            return this.getBackendMessage(error) || this.translate.instant('COMMON.FORBIDDEN_MESSAGE');
        }
        if (error.status === 400 || error.status === 422) {
            return this.getBackendMessage(error) || this.translate.instant('COMMON.MISSING_DATA_MESSAGE');
        }

        // Business errors (409, 404, etc.) — use backend message
        const backendMsg = this.getBackendMessage(error);
        if (backendMsg) {
            return backendMsg;
        }

        return this.translate.instant('COMMON.UNKNOWN_ERROR');
    }

    private getBackendMessage(error: HttpErrorResponse): string | null {
        const body = error.error;
        // Backend wraps in { success: false, error: { code, message, details } }
        if (body?.error?.message) {
            return body.error.message;
        }
        // Fallback: direct message field
        if (body?.message) {
            return Array.isArray(body.message) ? body.message.join('. ') : body.message;
        }
        if (body?.details) {
            return Array.isArray(body.details) ? body.details.join('. ') : body.details;
        }
        return null;
    }

    private extractErrorMessage(error: unknown): string {
        if (error instanceof HttpErrorResponse) {
            return this.extractHttpErrorMessage(error);
        }
        return this.translate.instant('COMMON.ERROR');
    }
}

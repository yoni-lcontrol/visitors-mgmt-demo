import { Injectable } from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';

@Injectable({ providedIn: 'root' })
export class ConfirmService {
    constructor(
        private confirmationService: ConfirmationService,
        private translate: TranslateService,
    ) { }

    /**
     * Show a styled confirmation dialog. Returns a Promise that resolves to
     * true (accepted) or false (rejected/dismissed).
     */
    confirm(messageKey: string, params?: Record<string, string>): Promise<boolean> {
        const message = params
            ? this.translate.instant(messageKey, params)
            : this.translate.instant(messageKey);

        return new Promise<boolean>(resolve => {
            this.confirmationService.confirm({
                message,
                header: this.translate.instant('COMMON.CONFIRM_TITLE'),
                acceptLabel: this.translate.instant('COMMON.YES'),
                rejectLabel: this.translate.instant('COMMON.NO'),
                icon: 'pi pi-exclamation-triangle',
                accept: () => resolve(true),
                reject: () => resolve(false),
            });
        });
    }
}

import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';

@Injectable({ providedIn: 'root' })
export class ToasterService {

  constructor(
    private toastr: ToastrService,
    private translate: TranslateService,
  ) { }

  showSuccess(messageKey: string, titleKey: string = 'TOASTER.TITLE_SUCCESS'): void {
    this.toastr.success(
      this.translate.instant(messageKey),
      this.translate.instant(titleKey),
    );
  }

  showInfo(messageKey: string, titleKey: string = 'TOASTER.TITLE_INFO'): void {
    this.toastr.info(
      this.translate.instant(messageKey),
      this.translate.instant(titleKey),
    );
  }

  showWarn(messageKey: string, titleKey: string = 'TOASTER.TITLE_WARNING'): void {
    this.toastr.warning(
      this.translate.instant(messageKey),
      this.translate.instant(titleKey),
    );
  }

  showError(messageKey: string, titleKey: string = 'TOASTER.TITLE_ERROR'): void {
    this.toastr.error(
      this.translate.instant(messageKey),
      this.translate.instant(titleKey),
    );
  }

  clear(): void {
    this.toastr.clear();
  }
}
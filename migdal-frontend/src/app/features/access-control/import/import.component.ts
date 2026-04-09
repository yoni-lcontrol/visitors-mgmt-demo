import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '@core/api/api.service';
import { NotificationService } from '@core/notifications/notification.service';

@Component({
    selector: 'app-import',
    standalone: true,
    imports: [TranslateModule],
    template: `
    <div class="page-header">
      <h1>{{ 'ACCESS_CONTROL.IMPORT_TITLE' | translate }}</h1>
    </div>
    <div class="card import-card">
      <p class="description">{{ 'ACCESS_CONTROL.IMPORT_DESCRIPTION' | translate }}</p>

      <div class="import-action">
        <button class="btn btn-primary" (click)="doImport()" [disabled]="importing">
          <i class="pi pi-cloud-download"></i>
          {{ importing ? ('ACCESS_CONTROL.IMPORTING' | translate) : ('ACCESS_CONTROL.IMPORT_FROM_SERVER' | translate) }}
        </button>
      </div>

      @if (triggered) {
        <div class="result">
          <div class="result-success">
            <i class="pi pi-check-circle"></i>
            {{ 'ACCESS_CONTROL.IMPORT_TRIGGERED' | translate }}
          </div>
        </div>
      }

      <div class="form-actions">
        <button class="btn btn-secondary" (click)="router.navigate(['/access-control/controllers'])">{{ 'COMMON.BACK' | translate }}</button>
      </div>
    </div>
  `,
    styles: [`
      .import-card { max-width: 640px; }
      .description { color: var(--color-text-secondary, #5c5a78); margin-bottom: 1.5rem; }
      .import-action { text-align: center; padding: 2rem; border: 1px solid var(--color-border, #e4e2f0); border-radius: var(--radius-md, 10px); }
      .import-action .btn i { margin-inline-end: 0.5rem; }
      .result { margin-top: 1.5rem; }
      .result-success { padding: 0.75rem; background: #e8f5e9; color: #2e7d32; border-radius: var(--radius-sm, 6px); font-weight: 500; display: flex; align-items: center; gap: 0.5rem; }
      .form-actions { display: flex; justify-content: flex-end; margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid var(--color-border-light, #eeedfa); }
    `],
})
export class ImportComponent {
    private api = inject(ApiService);
    private notify = inject(NotificationService);
    router = inject(Router);

    importing = false;
    triggered = false;

    doImport(): void {
        this.importing = true;
        this.triggered = false;
        this.api.post('/access-control/controllers/import', {}).subscribe({
            next: () => {
                this.triggered = true;
                this.importing = false;
                this.notify.success('ACCESS_CONTROL.IMPORT_TRIGGERED');
            },
            error: (err) => {
                this.importing = false;
                this.notify.error(err);
            },
        });
    }
}

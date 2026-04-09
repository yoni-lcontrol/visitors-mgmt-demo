import { Component, Input, Output, EventEmitter } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { HasPermissionDirective } from '@core/permissions/has-permission.directive';
import { VisitEscort } from '@core/models/entities.model';

@Component({
  selector: 'app-visit-escorts-table',
  standalone: true,
  imports: [TranslateModule, HasPermissionDirective],
  template: `
    <div class="card">
      <h3 class="section-title"><i class="pi pi-shield"></i> {{ 'VISITS.ESCORTS' | translate }}</h3>
      @if (loading) {
        <div class="loading-msg">{{ 'COMMON.LOADING' | translate }}</div>
      } @else if (escorts.length === 0) {
        <div class="empty-msg">{{ 'COMMON.NO_DATA' | translate }}</div>
      } @else {
        <div class="data-table">
          <table>
            <thead>
              <tr>
                <th>{{ 'VISITS.FIRST_NAME' | translate }}</th>
                <th>{{ 'VISITS.LAST_NAME' | translate }}</th>
                <th>{{ 'VISITS.PHONE' | translate }}</th>
                <th>{{ 'VISITS.EMAIL' | translate }}</th>
                <th>{{ 'COMMON.ACTIONS' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (escort of escorts; track escort.id) {
                <tr>
                  <td>{{ escort.firstName }}</td>
                  <td>{{ escort.lastName }}</td>
                  <td>{{ escort.phone }}</td>
                  <td>{{ escort.email }}</td>
                  <td class="actions">
                    <button class="btn-icon" *hasPermission="'visits.update'" (click)="editEscort.emit(escort)" [title]="'COMMON.EDIT' | translate">
                      <i class="pi pi-pencil"></i>
                    </button>
                    <button class="btn-icon danger" *hasPermission="'visits.delete'" (click)="removeEscort.emit(escort)" [title]="'COMMON.DELETE' | translate">
                      <i class="pi pi-trash"></i>
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .card { margin-bottom: 1.25rem; }
    .section-title {
      display: flex; align-items: center; gap: 0.5rem;
      font-size: 1.05rem; font-weight: 700;
      margin: 0 0 1rem 0;
      color: var(--color-primary, #020140);
    }
    .section-title i { color: var(--color-accent, #6c63ff); font-size: 1.05rem; }
    .data-table { overflow-x: auto; }
    .data-table table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 0.88rem; }
    .data-table th {
      text-align: start; padding: 0.75rem 0.85rem;
      font-weight: 600; font-size: 0.78rem;
      color: var(--color-text-muted);
      border-bottom: 2px solid var(--color-border, #e4e2f0);
      text-transform: uppercase; letter-spacing: 0.04em;
      background: var(--color-surface-alt, #f8f7fc);
      white-space: nowrap;
    }
    .data-table th:first-child { border-radius: 8px 0 0 0; }
    .data-table th:last-child { border-radius: 0 8px 0 0; }
    .data-table td {
      padding: 0.7rem 0.85rem;
      border-bottom: 1px solid var(--color-border-light, #eeedfa);
      vertical-align: middle;
    }
    .data-table tbody tr { transition: background 0.15s; }
    .data-table tbody tr:hover { background: rgba(108, 99, 255, 0.03); }
    .data-table tbody tr:last-child td { border-bottom: none; }
    .actions { display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap; }
    .loading-msg, .empty-msg { text-align: center; padding: 2.5rem; color: var(--color-text-muted); font-size: 0.9rem; }
  `],
})
export class VisitEscortsTableComponent {
  @Input() escorts: VisitEscort[] = [];
  @Input() loading = false;

  @Output() editEscort = new EventEmitter<VisitEscort>();
  @Output() removeEscort = new EventEmitter<VisitEscort>();
}

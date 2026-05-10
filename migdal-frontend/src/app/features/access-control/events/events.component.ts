import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { UserWebSocketService } from '@core/websocket/user-websocket.service';
import { WsEvent } from '@core/websocket/ws-events.enum';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AccessControlApiService, AmadeusEvent } from '../services/access-control-api.service';

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [CommonModule, TranslateModule, TableModule, TagModule],
  template: `
    <div class="page-header">
      <h1>{{ 'ACCESS_CONTROL.EVENTS_TITLE' | translate }}</h1>
      <div class="header-actions">
        <span class="listening-badge"><i class="pi pi-circle-fill pulse"></i> {{ 'ACCESS_CONTROL.LISTENING' | translate }}</span>
      </div>
    </div>
    <div class="card table-card">
      <p-table
        [value]="events"
        [lazy]="true"
        (onLazyLoad)="onLazyLoad($event)"
        [loading]="loading"
        [totalRecords]="totalRecords"
        [paginator]="true"
        [rows]="rows"
        [first]="first"
        [rowsPerPageOptions]="[10, 25, 50, 100]"
        [showCurrentPageReport]="true"
        currentPageReportTemplate="{first}-{last} / {totalRecords}"
        dataKey="externalEventId"
        styleClass="p-datatable-sm p-datatable-striped p-datatable-gridlines"
        [paginatorDropdownAppendTo]="'body'"
      >
        <ng-template pTemplate="header">
          <tr>
            <th>{{ 'ACCESS_CONTROL.OCCURRED_AT' | translate }}</th>
            <th>{{ 'ACCESS_CONTROL.EVENT_TYPE' | translate }}</th>
            <th>{{ 'ACCESS_CONTROL.EQUIPMENT' | translate }}</th>
            <th>{{ 'ACCESS_CONTROL.EQUIPMENT_KIND' | translate }}</th>
            <th>{{ 'ACCESS_CONTROL.CARDHOLDER' | translate }}</th>
            <th>{{ 'ACCESS_CONTROL.CARD_CODE' | translate }}</th>
            <th>{{ 'COMMON.STATUS' | translate }}</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-ev>
          <tr>
            <td>{{ ev.occurredAt | date:'dd/MM/yyyy HH:mm:ss' }}</td>
            <td>{{ formatEventType(ev.eventType) }}</td>
            <td>{{ ev.equipmentName || '-' }}</td>
            <td>{{ ev.equipmentKind || '-' }}</td>
            <td>{{ ev.cardholderName || '-' }}</td>
            <td>{{ ev.cardCode || '-' }}</td>
            <td>
              <p-tag [severity]="ev.isActive ? 'success' : 'secondary'" [value]="ev.isActive ? 'Active' : 'Inactive'" />
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr>
            <td colspan="7" class="empty-state">
              <i class="pi pi-bell" style="font-size: 2rem; color: var(--text-color-secondary)"></i>
              <span>{{ 'ACCESS_CONTROL.NO_EVENTS' | translate }}</span>
            </td>
          </tr>
        </ng-template>
      </p-table>
    </div>
  `,
  styles: [`
    .listening-badge {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      color: var(--text-color-secondary);
    }
    .listening-badge .pulse {
      color: var(--green-500);
      animation: pulse-anim 1.5s infinite;
    }
    @keyframes pulse-anim {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
    .empty-state {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      padding: 3rem 2rem;
      color: var(--text-color-secondary);
    }
  `],
})
export class EventsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly userWs = inject(UserWebSocketService);
  private readonly accessControlApi = inject(AccessControlApiService);

  events: AmadeusEvent[] = [];
  totalRecords = 0;
  rows = 25;
  first = 0;
  loading = false;

  private lastLazyEvent: any = { first: 0, rows: 25 };

  ngOnInit(): void {
    this.userWs.on<AmadeusEvent>(WsEvent.IntegrationsAmadeusEventReceived)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        // Reload first page when a new event arrives
        this.first = 0;
        this.loadData({ ...this.lastLazyEvent, first: 0 });
      });
  }

  onLazyLoad(event: any): void {
    this.loadData(event);
  }

  loadData(event: any = this.lastLazyEvent): void {
    this.loading = true;
    this.lastLazyEvent = event;
    this.first = event.first ?? 0;
    this.rows = event.rows ?? 25;

    const page = Math.floor(this.first / this.rows) + 1;

    this.accessControlApi.getAmadeusEvents({ page, limit: this.rows })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.events = result.items;
        this.totalRecords = result.total;
        this.loading = false;
      });
  }

  formatEventType(eventType: string): string {
    if (!eventType) {
      return '-';
    }

    return eventType
      .split('.')
      .filter(Boolean)
      .map((part) => this.humanizeEventPart(part))
      .join(' / ');
  }

  private humanizeEventPart(value: string): string {
    return value
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map((word) => this.normalizeEventWord(word))
      .join(' ');
  }

  private normalizeEventWord(word: string): string {
    const upper = word.toUpperCase();
    if (upper === 'IO') {
      return 'IO';
    }

    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }
}

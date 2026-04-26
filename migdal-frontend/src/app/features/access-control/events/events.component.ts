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
        <button class="btn btn-secondary" (click)="clearEvents()" [disabled]="events.length === 0">
          <i class="pi pi-trash"></i> {{ 'ACCESS_CONTROL.CLEAR_EVENTS' | translate }}
        </button>
      </div>
    </div>
    <div class="card table-card">
      @if (events.length === 0) {
        <div class="empty-state">
          <i class="pi pi-bell" style="font-size: 3rem; color: var(--text-color-secondary)"></i>
          <p>{{ 'ACCESS_CONTROL.NO_EVENTS' | translate }}</p>
        </div>
      } @else {
        <p-table
          [value]="events"
          [paginator]="true"
          [rows]="20"
          [rowsPerPageOptions]="[10, 20, 50, 100]"
          [showCurrentPageReport]="true"
          currentPageReportTemplate="{first}-{last} / {totalRecords}"
          dataKey="externalEventId"
          styleClass="p-datatable-sm p-datatable-striped p-datatable-gridlines"
          [sortField]="'occurredAt'"
          [sortOrder]="-1"
          [paginatorDropdownAppendTo]="'body'"
        >
          <ng-template pTemplate="header">
            <tr>
              <th pSortableColumn="occurredAt">{{ 'ACCESS_CONTROL.OCCURRED_AT' | translate }} <p-sortIcon field="occurredAt" /></th>
              <th pSortableColumn="eventType">{{ 'ACCESS_CONTROL.EVENT_TYPE' | translate }} <p-sortIcon field="eventType" /></th>
              <th pSortableColumn="equipmentName">{{ 'ACCESS_CONTROL.EQUIPMENT' | translate }} <p-sortIcon field="equipmentName" /></th>
              <th pSortableColumn="equipmentKind">{{ 'ACCESS_CONTROL.EQUIPMENT_KIND' | translate }} <p-sortIcon field="equipmentKind" /></th>
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
        </p-table>
      }
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
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem 2rem;
      gap: 1rem;
    }
  `],
})
export class EventsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly userWs = inject(UserWebSocketService);
  private readonly accessControlApi = inject(AccessControlApiService);

  events: AmadeusEvent[] = [];

  ngOnInit(): void {
    this.accessControlApi.getAmadeusEvents()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((events) => {
        this.events = this.deduplicateEvents(events);
      });

    this.userWs.on<AmadeusEvent>(WsEvent.IntegrationsAmadeusEventReceived)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.events = this.deduplicateEvents([event, ...this.events]);
      });
  }

  clearEvents(): void {
    this.events = [];
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

  private deduplicateEvents(events: AmadeusEvent[]): AmadeusEvent[] {
    const seen = new Set<string>();
    const result: AmadeusEvent[] = [];

    for (const event of events) {
      const key = event.externalEventId || `${event.eventType}:${event.occurredAt}`;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      result.push(event);
    }

    return result;
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

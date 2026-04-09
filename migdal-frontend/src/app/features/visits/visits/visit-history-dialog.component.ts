import { Component, Input, Output, EventEmitter } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { DateFormatPipe } from '@shared/pipes/date-format.pipe';
import { VisitorAccessLogEntry, VisitorAccessEventType } from '@core/models/entities.model';
import { DialogModule } from 'primeng/dialog';

@Component({
  selector: 'app-visit-history-dialog',
  standalone: true,
  imports: [TranslateModule, DateFormatPipe, DialogModule],
  template: `
    <p-dialog [header]="'VISITS.VISITOR_HISTORY' | translate"
      [(visible)]="visible" (visibleChange)="visibleChange.emit($event)" [modal]="true" [style]="{width: '600px'}" [draggable]="false">
      @if (loading) {
        <div class="loading-msg">{{ 'COMMON.LOADING' | translate }}</div>
      } @else if (items.length === 0) {
        <div class="empty-msg">{{ 'COMMON.NO_DATA' | translate }}</div>
      } @else {
        <div class="history-list">
          @for (log of items; track log.logId) {
            <div class="history-item">
              <span [class]="'history-event ' + getEventClass(log.eventType)">
                {{ getEventLabel(log.eventType) | translate }}
              </span>
              <span class="history-time" dir="ltr">{{ log.eventTimeUtc | dateFormat }}</span>
              @if (log.source) {
                <span class="history-source">{{ log.source }}</span>
              }
              @if (log.notes) {
                <span class="history-notes">{{ log.notes }}</span>
              }
            </div>
          }
        </div>
      }
    </p-dialog>
  `,
  styles: [`
    .history-list { display: flex; flex-direction: column; gap: 0.5rem; }
    .history-item {
      display: flex; align-items: center; gap: 0.75rem;
      padding: 0.65rem 0.85rem; border-radius: 8px;
      background: var(--color-surface-alt, #f8f8fc);
      border: 1px solid var(--color-border-light, #eeedfa);
      transition: border-color 0.15s;
    }
    .history-item:hover { border-color: var(--color-border, #e4e2f0); }
    .history-event {
      font-weight: 600; font-size: 0.82rem;
      padding: 0.28rem 0.65rem; border-radius: 8px;
      white-space: nowrap;
      display: inline-flex; align-items: center; gap: 0.3rem;
      border: 1px solid transparent;
    }
    .history-event::before {
      content: ''; display: inline-block;
      width: 6px; height: 6px; border-radius: 50%;
      background: currentColor; opacity: 0.65; flex-shrink: 0;
    }
    .history-event.event-arrived { background: rgba(59, 130, 246, 0.10); color: #1d4ed8; border-color: rgba(59, 130, 246, 0.18); }
    .history-event.event-checked-in { background: rgba(34, 197, 94, 0.10); color: #15803d; border-color: rgba(34, 197, 94, 0.18); }
    .history-event.event-checked-out { background: rgba(100, 116, 139, 0.10); color: #475569; border-color: rgba(100, 116, 139, 0.18); }
    .history-time { font-size: 0.82rem; color: var(--color-text-secondary); }
    .history-source { font-size: 0.78rem; color: var(--color-text-muted); font-style: italic; }
    .history-notes { font-size: 0.78rem; color: var(--color-text-muted); }
    .loading-msg, .empty-msg { text-align: center; padding: 2.5rem; color: var(--color-text-muted); font-size: 0.9rem; }
  `],
})
export class VisitHistoryDialogComponent {
  @Input() visible = false;
  @Input() items: VisitorAccessLogEntry[] = [];
  @Input() loading = false;

  @Output() visibleChange = new EventEmitter<boolean>();

  getEventClass(eventType: number): string {
    switch (eventType) {
      case VisitorAccessEventType.Arrived: return 'event-arrived';
      case VisitorAccessEventType.CheckedIn: return 'event-checked-in';
      case VisitorAccessEventType.CheckedOut: return 'event-checked-out';
      default: return '';
    }
  }

  getEventLabel(eventType: number): string {
    switch (eventType) {
      case VisitorAccessEventType.Arrived: return 'VISITS.STATUS_ARRIVED';
      case VisitorAccessEventType.CheckedIn: return 'VISITS.STATUS_CHECKED_IN';
      case VisitorAccessEventType.CheckedOut: return 'VISITS.STATUS_CHECKED_OUT';
      default: return '';
    }
  }
}

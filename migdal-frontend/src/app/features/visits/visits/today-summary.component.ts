import { Component, OnInit, inject, ChangeDetectionStrategy, DestroyRef, ChangeDetectorRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';
import { merge } from 'rxjs';
import { VisitsApiService, TodaySummary } from '../services/visits-api.service';
import { UserWebSocketService } from '@core/websocket/user-websocket.service';
import { WsEvent } from '@core/websocket/ws-events.enum';

@Component({
  selector: 'app-today-summary',
  standalone: true,
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="summary-cards">
      <div class="summary-card total">
        <div class="card-icon"><i class="pi pi-calendar"></i></div>
        <div class="card-body">
          <span class="card-value">{{ loading ? '...' : summary.totalVisitsToday }}</span>
          <span class="card-label">{{ 'VISITS.SUMMARY_TOTAL_VISITS' | translate }}</span>
        </div>
      </div>
      <div class="summary-card arrived">
        <div class="card-icon"><i class="pi pi-sign-in"></i></div>
        <div class="card-body">
          <span class="card-value">{{ loading ? '...' : summary.arrivedToday }}</span>
          <span class="card-label">{{ 'VISITS.SUMMARY_ARRIVED' | translate }}</span>
        </div>
      </div>
      <div class="summary-card checked-in">
        <div class="card-icon"><i class="pi pi-check-circle"></i></div>
        <div class="card-body">
          <span class="card-value">{{ loading ? '...' : summary.checkedInToday }}</span>
          <span class="card-label">{{ 'VISITS.SUMMARY_CHECKED_IN' | translate }}</span>
        </div>
      </div>
      <div class="summary-card completed">
        <div class="card-icon"><i class="pi pi-sign-out"></i></div>
        <div class="card-body">
          <span class="card-value">{{ loading ? '...' : summary.completedToday }}</span>
          <span class="card-label">{{ 'VISITS.SUMMARY_COMPLETED' | translate }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; margin-bottom: 1.25rem; }
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
    }
    @media (max-width: 992px) {
      .summary-cards { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 576px) {
      .summary-cards { grid-template-columns: 1fr; }
    }
    .summary-card {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1.1rem 1.25rem;
      border-radius: var(--radius-md, 8px);
      background: var(--color-surface, #fff);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
      border-inline-start: 4px solid transparent;
      transition: box-shadow 0.2s, transform 0.15s;
    }
    .summary-card:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      transform: translateY(-1px);
    }
    .card-icon {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.15rem;
      flex-shrink: 0;
    }
    .card-body {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }
    .card-value {
      font-size: 1.5rem;
      font-weight: 700;
      line-height: 1.2;
      color: var(--color-text, #1e1e2f);
    }
    .card-label {
      font-size: 0.8rem;
      font-weight: 500;
      color: var(--color-text-muted, #9896ad);
    }

    /* ── Card color variants ── */
    .summary-card.total { border-inline-start-color: var(--color-accent, #6c63ff); }
    .summary-card.total .card-icon {
      background: rgba(108, 99, 255, 0.10);
      color: #6c63ff;
    }
    .summary-card.arrived { border-inline-start-color: #1d4ed8; }
    .summary-card.arrived .card-icon {
      background: rgba(59, 130, 246, 0.10);
      color: #1d4ed8;
    }
    .summary-card.checked-in { border-inline-start-color: #15803d; }
    .summary-card.checked-in .card-icon {
      background: rgba(34, 197, 94, 0.10);
      color: #15803d;
    }
    .summary-card.completed { border-inline-start-color: #475569; }
    .summary-card.completed .card-icon {
      background: rgba(100, 116, 139, 0.10);
      color: #475569;
    }
  `],
})
export class TodaySummaryComponent implements OnInit {
  private visitsApi = inject(VisitsApiService);
  private ws = inject(UserWebSocketService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  loading = true;
  summary: TodaySummary = {
    totalVisitsToday: 0,
    arrivedToday: 0,
    checkedInToday: 0,
    completedToday: 0,
  };

  ngOnInit(): void {
    this.loadSummary();

    // Re-fetch on any visitor status change or visit creation
    merge(
      this.ws.on(WsEvent.VisitsCreated),
      this.ws.on(WsEvent.VisitsVisitorArrived),
      this.ws.on(WsEvent.VisitsVisitorCheckedIn),
      this.ws.on(WsEvent.VisitsVisitorCheckedOut),
    ).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => this.loadSummary());
  }

  private loadSummary(): void {
    this.visitsApi.getTodaySummary().subscribe({
      next: (data) => {
        this.summary = data;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }
}

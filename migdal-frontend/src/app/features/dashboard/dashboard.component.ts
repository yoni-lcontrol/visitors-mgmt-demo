import { Component, inject, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe, registerLocaleData } from '@angular/common';
import localeHe from '@angular/common/locales/he';
import { TranslateModule } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { merge } from 'rxjs';
import { PermissionService } from '../../core/permissions/permission.service';
import { AuthService } from '../../core/auth/auth.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { VisitsApiService, TodaySummary, OnSiteResponse } from '../../features/visits/services/visits-api.service';
import { UserWebSocketService } from '../../core/websocket/user-websocket.service';
import { WsEvent } from '../../core/websocket/ws-events.enum';
import { Visit } from '../../core/models/entities.model';

registerLocaleData(localeHe);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [TranslateModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dashboard">
      <!-- ── Welcome Banner ── -->
      <div class="welcome-banner">
        <div class="welcome-left">
          <div class="welcome-text">
            <p class="greeting">{{ greetingKey | translate }},</p>
            <h1>{{ userName }}</h1>
            <p class="subtitle">{{ 'DASHBOARD.SUBTITLE' | translate }}</p>
          </div>
        </div>
        <div class="welcome-right">
          <div class="datetime-block">
            <span class="time">{{ currentTime | date:'HH:mm':'':(isHebrew ? 'he' : 'en') }}</span>
            <span class="date">{{ currentTime | date:(isHebrew ? 'EEEE, d MMMM yyyy' : 'EEEE, MMMM d, yyyy'):'':(isHebrew ? 'he' : 'en') }}</span>
          </div>
        </div>
      </div>

      <!-- ── KPI Cards ── -->
      @if (hasVisitsPermission) {
        <div class="section-header">
          <h2 class="section-title">{{ 'DASHBOARD.TODAY_OVERVIEW' | translate }}</h2>
        </div>
        <div class="kpi-cards">
          <div class="kpi-card total">
            <div class="kpi-icon"><i class="pi pi-calendar"></i></div>
            <div class="kpi-body">
              <span class="kpi-value">{{ summaryLoading ? '...' : summary.totalVisitsToday }}</span>
              <span class="kpi-label">{{ 'DASHBOARD.KPI_TOTAL_VISITS' | translate }}</span>
            </div>
          </div>
          <div class="kpi-card on-site" (click)="navigate('/visits/on-site')">
            <div class="kpi-icon"><i class="pi pi-users"></i></div>
            <div class="kpi-body">
              <span class="kpi-value">{{ onSiteLoading ? '...' : onSiteSummary.onSite }}</span>
              <span class="kpi-label">{{ 'DASHBOARD.KPI_ON_SITE' | translate }}</span>
            </div>
            <i class="pi pi-arrow-right kpi-arrow"></i>
          </div>
          <div class="kpi-card arrived">
            <div class="kpi-icon"><i class="pi pi-sign-in"></i></div>
            <div class="kpi-body">
              <span class="kpi-value">{{ summaryLoading ? '...' : summary.arrivedToday }}</span>
              <span class="kpi-label">{{ 'DASHBOARD.KPI_ARRIVED' | translate }}</span>
            </div>
          </div>
          <div class="kpi-card checked-in">
            <div class="kpi-icon"><i class="pi pi-check-circle"></i></div>
            <div class="kpi-body">
              <span class="kpi-value">{{ summaryLoading ? '...' : summary.checkedInToday }}</span>
              <span class="kpi-label">{{ 'DASHBOARD.KPI_CHECKED_IN' | translate }}</span>
            </div>
          </div>
          <div class="kpi-card completed">
            <div class="kpi-icon"><i class="pi pi-sign-out"></i></div>
            <div class="kpi-body">
              <span class="kpi-value">{{ summaryLoading ? '...' : summary.completedToday }}</span>
              <span class="kpi-label">{{ 'DASHBOARD.KPI_COMPLETED' | translate }}</span>
            </div>
          </div>
        </div>

        <!-- ── Upcoming Visits ── -->
        <div class="section-header upcoming-header">
          <h2 class="section-title">{{ 'DASHBOARD.UPCOMING_VISITS' | translate }}</h2>
          <button class="view-all-link" (click)="navigate('/visits')">
            {{ 'DASHBOARD.VIEW_ALL' | translate }} <i class="pi pi-arrow-right"></i>
          </button>
        </div>
        @if (upcomingLoading) {
          <div class="upcoming-placeholder">
            <span class="placeholder-text">{{ 'APP.LOADING' | translate }}</span>
          </div>
        } @else if (upcomingVisits.length === 0) {
          <div class="upcoming-empty">
            <i class="pi pi-calendar-times"></i>
            <p>{{ 'DASHBOARD.NO_UPCOMING' | translate }}</p>
          </div>
        } @else {
          <div class="upcoming-list">
            @for (visit of upcomingVisits; track visit.id) {
              <button class="upcoming-row" (click)="navigate('/visits/' + visit.id)">
                <div class="upcoming-time">
                  {{ visit.plannedStartTimeUtc | date:'HH:mm':'':(isHebrew ? 'he' : 'en') }}
                </div>
                <div class="upcoming-info">
                  <span class="upcoming-title">{{ visit.title }}</span>
                  @if (visit.visitRequester) {
                    <span class="upcoming-host">{{ visit.visitRequester.firstName }} {{ visit.visitRequester.lastName }}</span>
                  }
                </div>
                @if (visit.statusSummary) {
                  <div class="upcoming-badge">
                    <span class="badge-count">{{ visit.statusSummary.total }}</span>
                    <span class="badge-label">{{ 'DASHBOARD.VISITORS' | translate }}</span>
                  </div>
                }
                <i class="pi pi-chevron-right upcoming-arrow"></i>
              </button>
            }
          </div>
        }
      }

      <!-- ── Quick Access ── -->
      @if (availableModules.length > 0) {
        <div class="section-header">
          <h2 class="section-title">{{ 'DASHBOARD.QUICK_ACCESS' | translate }}</h2>
          <span class="module-count">{{ availableModules.length }} {{ 'DASHBOARD.MODULES' | translate }}</span>
        </div>
        <div class="nav-cards">
          @for (item of availableModules; track item.route) {
            <button class="nav-card" (click)="navigate(item.route)">
              <div class="card-icon-wrap" [style.background]="item.color + '14'" [style.color]="item.color">
                <i class="pi" [class]="item.icon"></i>
              </div>
              <div class="card-content">
                <span class="card-label">{{ item.labelKey | translate }}</span>
                <span class="card-desc">{{ item.descKey | translate }}</span>
              </div>
              <i class="pi pi-arrow-right card-arrow"></i>
            </button>
          }
        </div>
      } @else {
        <div class="empty-state">
          <i class="pi pi-lock"></i>
          <p>{{ 'DASHBOARD.NO_ACCESS' | translate }}</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .dashboard {
      padding: 1.5rem 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    /* ── Welcome Banner ── */
    .welcome-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: linear-gradient(135deg, #020140 0%, #1a1968 35%, #3d3a99 70%, #6c63ff 100%);
      border-radius: 18px;
      padding: 2.25rem 2.5rem;
      margin-bottom: 2rem;
      color: #fff;
      position: relative;
      overflow: hidden;
    }
    .welcome-banner::before {
      content: '';
      position: absolute;
      top: -60%;
      right: -8%;
      width: 280px;
      height: 280px;
      background: radial-gradient(circle, rgba(108, 99, 255, 0.25) 0%, transparent 70%);
      border-radius: 50%;
      pointer-events: none;
    }
    .welcome-banner::after {
      content: '';
      position: absolute;
      bottom: -50%;
      left: 15%;
      width: 200px;
      height: 200px;
      background: radial-gradient(circle, rgba(255, 255, 255, 0.06) 0%, transparent 70%);
      border-radius: 50%;
      pointer-events: none;
    }
    .welcome-left { position: relative; z-index: 1; }
    .greeting { margin: 0 0 0.15rem; font-size: 0.9rem; opacity: 0.7; font-weight: 400; }
    .welcome-text h1 { margin: 0 0 0.5rem; font-size: 1.65rem; font-weight: 700; letter-spacing: -0.01em; color: #fff; }
    .subtitle { margin: 0; font-size: 0.88rem; opacity: 0.6; }
    .welcome-right { position: relative; z-index: 1; text-align: end; }
    .datetime-block { display: flex; flex-direction: column; align-items: flex-end; gap: 0.2rem; }
    .datetime-block .time { font-size: 2.2rem; font-weight: 700; letter-spacing: 0.02em; line-height: 1; font-variant-numeric: tabular-nums; }
    .datetime-block .date { font-size: 0.82rem; opacity: 0.6; white-space: nowrap; }

    /* ── Section Headers ── */
    .section-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: 1rem;
    }
    .section-title {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--color-text-secondary, #5c5a78);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin: 0;
    }
    .module-count { font-size: 0.78rem; color: var(--color-text-muted, #9896ad); }

    /* ── KPI Cards ── */
    .kpi-cards {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 0.75rem;
      margin-bottom: 2rem;
    }
    .kpi-card {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 1.1rem;
      border-radius: 12px;
      background: var(--color-surface, #fff);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
      border-inline-start: 4px solid transparent;
      transition: box-shadow 0.2s, transform 0.15s;
    }
    .kpi-card:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      transform: translateY(-1px);
    }
    .kpi-card.on-site { cursor: pointer; }
    .kpi-card.on-site:hover .kpi-arrow { opacity: 1; }
    .kpi-arrow { font-size: 0.7rem; color: var(--color-text-muted, #9896ad); opacity: 0; transition: opacity 0.2s; }
    .kpi-icon {
      width: 40px; height: 40px;
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.05rem; flex-shrink: 0;
    }
    .kpi-body { display: flex; flex-direction: column; gap: 0.1rem; flex: 1; min-width: 0; }
    .kpi-value { font-size: 1.4rem; font-weight: 700; line-height: 1.2; color: var(--color-text, #1e1e2f); }
    .kpi-label { font-size: 0.75rem; font-weight: 500; color: var(--color-text-muted, #9896ad); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    /* KPI color variants */
    .kpi-card.total { border-inline-start-color: var(--color-accent, #6c63ff); }
    .kpi-card.total .kpi-icon { background: rgba(108, 99, 255, 0.10); color: #6c63ff; }
    .kpi-card.on-site { border-inline-start-color: #0ea5e9; }
    .kpi-card.on-site .kpi-icon { background: rgba(14, 165, 233, 0.10); color: #0ea5e9; }
    .kpi-card.arrived { border-inline-start-color: #1d4ed8; }
    .kpi-card.arrived .kpi-icon { background: rgba(59, 130, 246, 0.10); color: #1d4ed8; }
    .kpi-card.checked-in { border-inline-start-color: #15803d; }
    .kpi-card.checked-in .kpi-icon { background: rgba(34, 197, 94, 0.10); color: #15803d; }
    .kpi-card.completed { border-inline-start-color: #475569; }
    .kpi-card.completed .kpi-icon { background: rgba(100, 116, 139, 0.10); color: #475569; }

    /* ── Upcoming Visits ── */
    .upcoming-header { margin-top: 0; }
    .view-all-link {
      background: none; border: none; cursor: pointer;
      font-size: 0.8rem; font-weight: 500; color: var(--color-accent, #6c63ff);
      display: flex; align-items: center; gap: 0.3rem;
      font-family: inherit; padding: 0;
      transition: color 0.2s;
    }
    .view-all-link:hover { color: #4f46e5; }
    .view-all-link i { font-size: 0.7rem; }

    .upcoming-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-bottom: 2rem;
    }
    .upcoming-row {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.85rem 1.15rem;
      border: 1.5px solid var(--color-border, #e4e2f0);
      border-radius: 10px;
      background: var(--color-surface, #fff);
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: inherit;
      text-align: start;
      width: 100%;
    }
    .upcoming-row:hover {
      border-color: var(--color-accent, #6c63ff);
      background: var(--color-primary-wash, #f4f3fc);
      transform: translateY(-1px);
      box-shadow: 0 4px 14px rgba(2, 1, 64, 0.06);
    }
    .upcoming-row:hover .upcoming-arrow { opacity: 1; }
    .upcoming-time {
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--color-accent, #6c63ff);
      font-variant-numeric: tabular-nums;
      min-width: 48px;
    }
    .upcoming-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.1rem; }
    .upcoming-title { font-weight: 600; font-size: 0.88rem; color: var(--color-primary, #020140); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .upcoming-host { font-size: 0.78rem; color: var(--color-text-muted, #9896ad); }
    .upcoming-badge {
      display: flex; flex-direction: column; align-items: center;
      background: rgba(108, 99, 255, 0.08); border-radius: 8px;
      padding: 0.3rem 0.65rem; flex-shrink: 0;
    }
    .badge-count { font-size: 1rem; font-weight: 700; color: var(--color-accent, #6c63ff); line-height: 1.2; }
    .badge-label { font-size: 0.65rem; color: var(--color-text-muted, #9896ad); text-transform: uppercase; letter-spacing: 0.03em; }
    .upcoming-arrow { font-size: 0.7rem; color: var(--color-text-muted, #9896ad); opacity: 0; transition: opacity 0.2s; flex-shrink: 0; }

    .upcoming-empty {
      text-align: center; padding: 2rem 1rem 2.5rem;
      color: var(--color-text-muted, #9896ad);
    }
    .upcoming-empty i { font-size: 2rem; display: block; margin-bottom: 0.5rem; opacity: 0.3; }
    .upcoming-empty p { margin: 0; font-size: 0.85rem; }

    .upcoming-placeholder {
      text-align: center; padding: 2rem;
      color: var(--color-text-muted, #9896ad); font-size: 0.85rem;
    }

    /* ── Quick Access Cards ── */
    .nav-cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 0.75rem;
    }
    .nav-card {
      display: flex; align-items: center; gap: 1rem;
      padding: 1.1rem 1.25rem;
      border: 1.5px solid var(--color-border, #e4e2f0);
      border-radius: 12px; background: #fff; cursor: pointer;
      transition: all 0.2s ease; font-family: inherit;
      text-align: start; width: 100%;
    }
    .nav-card:hover {
      border-color: var(--color-accent, #6c63ff);
      background: var(--color-primary-wash, #f4f3fc);
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(2, 1, 64, 0.07);
    }
    .nav-card:hover .card-arrow { opacity: 1; transform: translateX(2px); }
    .nav-card:hover .card-icon-wrap { transform: scale(1.08); }
    .card-icon-wrap {
      display: flex; align-items: center; justify-content: center;
      width: 44px; height: 44px; border-radius: 12px;
      font-size: 1.15rem; flex-shrink: 0; transition: all 0.2s ease;
    }
    .card-content { flex: 1; min-width: 0; }
    .card-label { display: block; font-weight: 600; font-size: 0.92rem; color: var(--color-primary, #020140); }
    .card-desc { display: block; font-size: 0.78rem; color: var(--color-text-muted, #9896ad); margin-top: 0.15rem; }
    .card-arrow { font-size: 0.8rem; color: var(--color-text-muted, #9896ad); opacity: 0; transition: all 0.2s ease; flex-shrink: 0; }

    /* Empty state */
    .empty-state { text-align: center; padding: 3rem 1rem; color: var(--color-text-muted, #9896ad); }
    .empty-state i { font-size: 2.5rem; display: block; margin-bottom: 0.75rem; opacity: 0.4; }
    .empty-state p { margin: 0; font-size: 0.9rem; }

    /* ── Responsive ── */
    @media (max-width: 1100px) {
      .kpi-cards { grid-template-columns: repeat(3, 1fr); }
    }
    @media (max-width: 768px) {
      .kpi-cards { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 600px) {
      .dashboard { padding: 1rem; }
      .welcome-banner {
        flex-direction: column; align-items: flex-start;
        padding: 1.5rem; gap: 1.25rem;
      }
      .welcome-text h1 { font-size: 1.3rem; }
      .welcome-right { text-align: start; }
      .datetime-block { align-items: flex-start; }
      .datetime-block .time { font-size: 1.6rem; }
      .kpi-cards { grid-template-columns: 1fr; }
      .nav-cards { grid-template-columns: 1fr; }
    }
  `],
})
export class DashboardComponent implements OnInit, OnDestroy {
  private permissions = inject(PermissionService);
  private authService = inject(AuthService);
  private translation = inject(TranslationService);
  private router = inject(Router);
  private visitsApi = inject(VisitsApiService);
  private ws = inject(UserWebSocketService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  userName = this.authService.currentUser?.firstName || '';
  currentTime = new Date();
  greetingKey = this.getGreetingKey();
  hasVisitsPermission = this.permissions.hasPermission('visits.read');

  // KPI state
  summaryLoading = true;
  summary: TodaySummary = { totalVisitsToday: 0, arrivedToday: 0, checkedInToday: 0, completedToday: 0 };

  // On-site state
  onSiteLoading = true;
  onSiteSummary = { onSite: 0, arrived: 0, checkedIn: 0, blacklisted: 0 };

  // Upcoming visits state
  upcomingLoading = true;
  upcomingVisits: Visit[] = [];

  get isHebrew(): boolean {
    return this.translation.currentLang === 'he';
  }

  private readonly modules = [
    { route: '/users', permission: 'users.read', icon: 'pi-users', labelKey: 'NAV.USERS', descKey: 'DASHBOARD.DESC_USERS', color: '#6c63ff' },
    { route: '/roles', permission: 'roles.read', icon: 'pi-shield', labelKey: 'NAV.ROLES', descKey: 'DASHBOARD.DESC_ROLES', color: '#f59e0b' },
    { route: '/workstations', permission: 'workstations.read', icon: 'pi-desktop', labelKey: 'NAV.WORKSTATIONS', descKey: 'DASHBOARD.DESC_WORKSTATIONS', color: '#10b981' },
    { route: '/visits', permission: 'visits.read', icon: 'pi-calendar', labelKey: 'NAV.VISITS', descKey: 'DASHBOARD.DESC_VISITS', color: '#3b82f6' },
    { route: '/access-control', permission: 'access-control.read', icon: 'pi-lock', labelKey: 'NAV.ACCESS_CONTROL', descKey: 'DASHBOARD.DESC_ACCESS_CONTROL', color: '#ef4444' },
    { route: '/audit', permission: 'audit.read', icon: 'pi-history', labelKey: 'NAV.AUDIT_LOGS', descKey: 'DASHBOARD.DESC_AUDIT', color: '#8b5cf6' },
    { route: '/settings', permission: 'settings.read', icon: 'pi-cog', labelKey: 'NAV.SETTINGS', descKey: 'DASHBOARD.DESC_SETTINGS', color: '#64748b' },
  ];

  availableModules = this.modules.filter((m) => this.permissions.hasPermission(m.permission));

  ngOnInit(): void {
    this.timerInterval = setInterval(() => {
      this.currentTime = new Date();
      this.cdr.markForCheck();
    }, 30_000);

    if (this.hasVisitsPermission) {
      this.loadSummary();
      this.loadOnSite();
      this.loadUpcoming();

      merge(
        this.ws.on(WsEvent.VisitsCreated),
        this.ws.on(WsEvent.VisitsVisitorArrived),
        this.ws.on(WsEvent.VisitsVisitorCheckedIn),
        this.ws.on(WsEvent.VisitsVisitorCheckedOut),
      ).pipe(
        takeUntilDestroyed(this.destroyRef),
      ).subscribe(() => {
        this.loadSummary();
        this.loadOnSite();
        this.loadUpcoming();
      });
    }
  }

  ngOnDestroy(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  navigate(route: string): void {
    this.router.navigate([route]);
  }

  private loadSummary(): void {
    this.visitsApi.getTodaySummary().subscribe({
      next: (data) => {
        this.summary = data;
        this.summaryLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.summaryLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  private loadOnSite(): void {
    this.visitsApi.getOnSiteVisitors({ limit: 1 }).subscribe({
      next: (data) => {
        this.onSiteSummary = data.summary;
        this.onSiteLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.onSiteLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  private loadUpcoming(): void {
    this.visitsApi.getUpcomingVisits(5).subscribe({
      next: (data) => {
        this.upcomingVisits = data.items;
        this.upcomingLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.upcomingLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  private getGreetingKey(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'DASHBOARD.GOOD_MORNING';
    if (hour < 17) return 'DASHBOARD.GOOD_AFTERNOON';
    return 'DASHBOARD.GOOD_EVENING';
  }
}

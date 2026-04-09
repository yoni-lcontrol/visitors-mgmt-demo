import { Component, OnInit, OnDestroy, inject, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';
import { ApiService } from '@core/api/api.service';
import { VisitsApiService } from '../services/visits-api.service';
import { Visit, VisitStatusSummary } from '@core/models/entities.model';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

type CalendarView = 'month' | 'week' | 'day';

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  visits: Visit[];
}

@Component({
  selector: 'app-visit-calendar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    InputTextModule,
    ButtonModule,
    ProgressSpinnerModule,
    TooltipModule,
  ],
  template: `
    <div class="page-header">
      <h1>{{ 'CALENDAR.TITLE' | translate }}</h1>
      @if (totalVisitsInView > 0 && !loading) {
        <span class="visit-count-badge">
          <i class="pi pi-calendar"></i>
          {{ 'CALENDAR.VISIT_COUNT' | translate:{ count: totalVisitsInView } }}
        </span>
      }
    </div>

    <div class="card calendar-card">
      <!-- Toolbar -->
      <div class="calendar-toolbar">
        <div class="toolbar-nav">
          <button pButton type="button" icon="pi pi-chevron-left" class="p-button-text p-button-sm nav-btn"
            [pTooltip]="'CALENDAR.PREVIOUS' | translate" tooltipPosition="bottom" (click)="navigate(-1)"></button>
          <button pButton type="button" [label]="'CALENDAR.TODAY' | translate" class="p-button-outlined p-button-sm today-btn" (click)="goToday()"></button>
          <button pButton type="button" icon="pi pi-chevron-right" class="p-button-text p-button-sm nav-btn"
            [pTooltip]="'CALENDAR.NEXT' | translate" tooltipPosition="bottom" (click)="navigate(1)"></button>
          <h2 class="toolbar-title">{{ headerLabel }}</h2>
        </div>
        <div class="toolbar-actions">
          <span class="search-wrapper" [class.has-value]="searchTerm">
            <i class="pi pi-search search-icon"></i>
            <input pInputText type="text" [(ngModel)]="searchTerm" (ngModelChange)="onSearchChange($event)"
              [placeholder]="'COMMON.SEARCH' | translate" class="search-input" />
            @if (searchTerm) {
              <button class="search-clear" (click)="clearSearch()"><i class="pi pi-times"></i></button>
            }
          </span>
          <div class="view-switcher">
            @for (v of viewOptions; track v.key) {
              <button class="view-btn" [class.active]="currentView === v.key" (click)="setView(v.key)">
                <i [class]="v.icon"></i>
                <span class="view-label">{{ v.label | translate }}</span>
              </button>
            }
          </div>
        </div>
      </div>

      <!-- Loading overlay -->
      @if (loading) {
        <div class="calendar-loading">
          <div class="loading-pulse">
            <div class="pulse-dot"></div>
            <div class="pulse-dot"></div>
            <div class="pulse-dot"></div>
          </div>
        </div>
      }

      <!-- Month View -->
      @if (currentView === 'month') {
        <div class="month-grid" [class.loading-dim]="loading">
          <div class="weekday-header" *ngFor="let day of weekDays">{{ day }}</div>
          @for (cell of monthCells; track $index) {
            <div
              class="day-cell"
              [class.other-month]="!cell.isCurrentMonth"
              [class.today]="cell.isToday"
              [class.weekend]="cell.isWeekend"
              [class.has-visits]="cell.visits.length > 0"
              (click)="onDayClick(cell.date)"
            >
              <div class="day-header">
                <span class="day-number">{{ cell.date.getDate() }}</span>
                @if (cell.visits.length > 0) {
                  <span class="day-visit-count">{{ cell.visits.length }}</span>
                }
              </div>
              <div class="day-visits">
                @for (visit of cell.visits | slice:0:maxVisiblePerCell; track visit.id) {
                  <div class="visit-chip" [class]="'visit-chip ' + getVisitAccentClass(visit)"
                    (click)="goToVisit(visit.id, $event)"
                    [pTooltip]="buildTooltip(visit)" tooltipPosition="top" [escape]="false">
                    <span class="chip-time">{{ formatTime(visit.plannedStartTimeUtc) }}</span>
                    <span class="chip-title">{{ visit.title }}</span>
                  </div>
                }
                @if (cell.visits.length > maxVisiblePerCell) {
                  <button class="more-link" (click)="showDayView(cell.date, $event)">
                    +{{ cell.visits.length - maxVisiblePerCell }} {{ 'CALENDAR.MORE_LABEL' | translate }}
                  </button>
                }
              </div>
            </div>
          }
        </div>
      }

      <!-- Week View -->
      @if (currentView === 'week') {
        <div class="week-view" [class.loading-dim]="loading">
          @for (cell of weekCells; track $index) {
            <div class="week-day-row" [class.today]="cell.isToday" [class.weekend]="cell.isWeekend">
              <div class="week-day-label" (click)="showDayViewFromWeek(cell.date)">
                <span class="week-day-name">{{ formatWeekDayName(cell.date) }}</span>
                <span class="week-day-number" [class.today-badge]="cell.isToday">{{ cell.date.getDate() }}</span>
              </div>
              <div class="week-day-visits">
                @if (cell.visits.length > 0) {
                  @for (visit of cell.visits; track visit.id) {
                    <div class="week-visit-card" [class]="'week-visit-card ' + getVisitAccentClass(visit)"
                      (click)="goToVisit(visit.id, $event)">
                      <div class="week-visit-top">
                        <span class="week-visit-time">{{ formatTime(visit.plannedStartTimeUtc) }}@if (visit.plannedEndTimeUtc) { - {{ formatTime(visit.plannedEndTimeUtc) }}}</span>
                        @if (visit.statusSummary && visit.statusSummary.total > 0) {
                          <div class="week-visit-badges">
                            <span class="status-chip total"><i class="pi pi-users"></i> {{ visit.statusSummary.total }}</span>
                            @if (visit.statusSummary.arrived > 0) {
                              <span class="status-chip arrived"><i class="pi pi-sign-in"></i> {{ visit.statusSummary.arrived }}</span>
                            }
                            @if (visit.statusSummary.checkedIn > 0) {
                              <span class="status-chip checked-in"><i class="pi pi-check-circle"></i> {{ visit.statusSummary.checkedIn }}</span>
                            }
                          </div>
                        }
                      </div>
                      <span class="week-visit-title">{{ visit.title }}</span>
                      @if (visit.visitRequester) {
                        <span class="week-visit-meta"><i class="pi pi-user"></i> {{ visit.visitRequester.firstName }} {{ visit.visitRequester.lastName }}</span>
                      }
                    </div>
                  }
                } @else {
                  <span class="no-visits-label">{{ 'CALENDAR.NO_VISITS' | translate }}</span>
                }
              </div>
            </div>
          }
        </div>
      }

      <!-- Day View -->
      @if (currentView === 'day') {
        <div class="day-view" [class.loading-dim]="loading">
          @if (dayVisits.length === 0 && !loading) {
            <div class="empty-state">
              <div class="empty-icon-wrap">
                <i class="pi pi-calendar"></i>
              </div>
              <h3>{{ 'CALENDAR.NO_VISITS_DAY' | translate }}</h3>
              <p>{{ 'CALENDAR.NO_VISITS_DAY_HINT' | translate }}</p>
            </div>
          }
          @for (visit of dayVisits; track visit.id) {
            <div class="day-visit-card" [class]="'day-visit-card ' + getVisitAccentClass(visit)" (click)="goToVisit(visit.id, $event)">
              <div class="day-visit-time-col">
                <span class="day-time-start">{{ formatTime(visit.plannedStartTimeUtc) }}</span>
                @if (visit.plannedEndTimeUtc) {
                  <span class="day-time-separator"></span>
                  <span class="day-time-end">{{ formatTime(visit.plannedEndTimeUtc) }}</span>
                }
              </div>
              <div class="day-visit-content">
                <div class="day-visit-header">
                  <h3>{{ visit.title }}</h3>
                  <i class="pi pi-arrow-right day-visit-arrow"></i>
                </div>
                @if (visit.visitRequester) {
                  <div class="day-visit-meta">
                    <i class="pi pi-user"></i>
                    <span>{{ visit.visitRequester.firstName }} {{ visit.visitRequester.lastName }}</span>
                  </div>
                }
                @if (visit.statusSummary && visit.statusSummary.total > 0) {
                  <div class="day-visit-statuses">
                    <span class="status-chip total"><i class="pi pi-users"></i> {{ visit.statusSummary.total }} {{ 'VISITS.TOTAL' | translate }}</span>
                    @if (visit.statusSummary.pending > 0) {
                      <span class="status-chip pending"><i class="pi pi-clock"></i> {{ visit.statusSummary.pending }}</span>
                    }
                    @if (visit.statusSummary.arrived > 0) {
                      <span class="status-chip arrived"><i class="pi pi-sign-in"></i> {{ visit.statusSummary.arrived }}</span>
                    }
                    @if (visit.statusSummary.checkedIn > 0) {
                      <span class="status-chip checked-in"><i class="pi pi-check-circle"></i> {{ visit.statusSummary.checkedIn }}</span>
                    }
                    @if (visit.statusSummary.checkedOut > 0) {
                      <span class="status-chip checked-out"><i class="pi pi-sign-out"></i> {{ visit.statusSummary.checkedOut }}</span>
                    }
                  </div>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    /* ── Page header enhancements ── */
    :host { display: block; }
    .visit-count-badge {
      display: inline-flex; align-items: center; gap: 0.4rem;
      padding: 0.3rem 0.75rem; border-radius: 999px;
      background: rgba(108,99,255,0.10); color: var(--color-accent);
      font-size: 0.82rem; font-weight: 600;
    }

    /* ── Card container ── */
    .calendar-card { padding: 0; overflow: hidden; border-radius: var(--radius-lg); }

    /* ── Toolbar ── */
    .calendar-toolbar {
      display: flex; justify-content: space-between; align-items: center;
      padding: 0.85rem 1.25rem; border-bottom: 2px solid var(--color-border-light);
      flex-wrap: wrap; gap: 0.75rem;
      background: var(--color-surface);
      position: sticky; top: 0; z-index: 5;
    }
    .toolbar-nav { display: flex; align-items: center; gap: 0.35rem; }
    .nav-btn {
      width: 34px; height: 34px; border-radius: var(--radius-sm) !important;
      transition: all 0.15s ease;
    }
    .nav-btn:hover { background: var(--color-primary-wash) !important; }
    .today-btn { font-weight: 600; border-radius: var(--radius-sm) !important; }
    .toolbar-title {
      margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--color-primary);
      margin-inline-start: 0.5rem; letter-spacing: -0.01em;
      text-transform: capitalize;
    }
    .toolbar-actions { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }

    /* Search */
    .search-wrapper {
      position: relative; display: flex; align-items: center;
    }
    .search-icon {
      position: absolute; inset-inline-start: 0.7rem; font-size: 0.85rem;
      color: var(--color-text-muted); pointer-events: none; z-index: 1;
      transition: color 0.15s;
    }
    .search-wrapper.has-value .search-icon { color: var(--color-primary); }
    .search-input {
      width: 220px; padding-inline-start: 2.1rem !important; padding-inline-end: 2rem !important;
      font-size: 0.82rem !important; border-radius: var(--radius-sm) !important;
      transition: border-color var(--transition-speed), box-shadow var(--transition-speed), width 0.2s;
    }
    .search-input:focus { width: 280px; }
    .search-clear {
      position: absolute; inset-inline-end: 0.5rem; background: none; border: none;
      cursor: pointer; color: var(--color-text-muted); padding: 0.2rem;
      border-radius: 50%; display: flex; align-items: center; transition: all 0.15s;
    }
    .search-clear:hover { color: var(--color-danger); background: rgba(229,57,53,0.08); }

    /* View switcher */
    .view-switcher {
      display: flex; border: 1px solid var(--color-border); border-radius: var(--radius-sm);
      overflow: hidden;
    }
    .view-btn {
      display: flex; align-items: center; gap: 0.35rem;
      padding: 0.4rem 0.75rem; border: none; cursor: pointer;
      font-size: 0.78rem; font-weight: 500;
      background: var(--color-surface); color: var(--color-text-secondary);
      transition: all 0.15s ease;
      border-inline-end: 1px solid var(--color-border-light);
    }
    .view-btn:last-child { border-inline-end: none; }
    .view-btn:hover { background: var(--color-surface-alt); color: var(--color-text); }
    .view-btn.active {
      background: var(--color-primary); color: #fff;
    }
    .view-btn i { font-size: 0.82rem; }

    /* ── Loading ── */
    .calendar-loading {
      display: flex; justify-content: center; align-items: center;
      padding: 3rem; min-height: 200px;
    }
    .loading-pulse { display: flex; gap: 0.5rem; }
    .loading-pulse .pulse-dot {
      width: 10px; height: 10px; border-radius: 50%;
      background: var(--color-primary); opacity: 0.3;
      animation: pulse 1.2s ease-in-out infinite;
    }
    .loading-pulse .pulse-dot:nth-child(2) { animation-delay: 0.15s; }
    .loading-pulse .pulse-dot:nth-child(3) { animation-delay: 0.3s; }
    @keyframes pulse {
      0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
      40% { opacity: 1; transform: scale(1.1); }
    }
    .loading-dim { opacity: 0.5; pointer-events: none; transition: opacity 0.2s; }

    /* ── Month Grid ── */
    .month-grid { display: grid; grid-template-columns: repeat(7, 1fr); }
    .weekday-header {
      padding: 0.6rem 0.35rem; text-align: center; font-weight: 700; font-size: 0.72rem;
      text-transform: uppercase; letter-spacing: 0.06em;
      color: var(--color-text-secondary); background: var(--color-surface-alt);
      border-bottom: 2px solid var(--color-border-light);
    }
    .day-cell {
      min-height: 105px; padding: 0.3rem; border-inline-end: 1px solid var(--color-border-light);
      border-bottom: 1px solid var(--color-border-light); cursor: pointer;
      transition: background 0.15s ease, box-shadow 0.15s ease;
      position: relative;
    }
    .day-cell:nth-child(7n+7) { border-inline-end: none; }  /* last column */
    .day-cell:hover { background: var(--color-surface-alt); }
    .day-cell.has-visits:hover { box-shadow: inset 0 0 0 1px var(--color-border); }
    .day-cell.other-month {
      background: var(--color-surface-alt);
    }
    .day-cell.other-month .day-number,
    .day-cell.other-month .day-visit-count { opacity: 0.4; }
    .day-cell.other-month .visit-chip { opacity: 0.5; }
    .day-cell.weekend { background: rgba(248,247,252,0.7); }
    .day-cell.today {
      background: var(--color-primary-wash);
      box-shadow: inset 0 2px 0 0 var(--color-primary);
    }

    /* Day cell header (number + count badge) */
    .day-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 0.25rem; padding: 0 0.15rem;
    }
    .day-number {
      font-size: 0.8rem; font-weight: 600; color: var(--color-text-secondary);
      width: 26px; height: 26px; display: inline-flex; align-items: center; justify-content: center;
      border-radius: 50%; transition: all 0.15s;
    }
    .today .day-number {
      background: var(--color-primary); color: #fff; font-weight: 700;
    }
    .day-visit-count {
      font-size: 0.65rem; font-weight: 700; color: var(--color-accent);
      background: rgba(108,99,255,0.10); border-radius: 999px;
      padding: 0.1rem 0.4rem; min-width: 18px; text-align: center;
    }

    /* Visit chips in month cells */
    .day-visits { display: flex; flex-direction: column; gap: 2px; }
    .visit-chip {
      display: flex; align-items: center; gap: 0.25rem;
      padding: 0.2rem 0.4rem; border-radius: 4px;
      font-size: 0.7rem; overflow: hidden; white-space: nowrap;
      cursor: pointer; transition: all 0.15s ease;
      border-inline-start: 3px solid var(--color-primary);
      background: var(--color-primary-wash);
    }
    .visit-chip:hover {
      background: var(--color-primary-lighter); color: #fff;
      transform: translateX(2px);
    }
    .visit-chip:hover .chip-time { color: rgba(255,255,255,0.85); }
    .visit-chip.accent-active {
      border-inline-start-color: #2e7d32;
      background: rgba(34,197,94,0.08);
    }
    .visit-chip.accent-pending {
      border-inline-start-color: #f59e0b;
      background: rgba(245,158,11,0.08);
    }
    .chip-time { color: var(--color-primary); font-weight: 700; flex-shrink: 0; font-size: 0.68rem; }
    .chip-title { overflow: hidden; text-overflow: ellipsis; color: var(--color-text); }

    .more-link {
      font-size: 0.7rem; color: var(--color-accent); cursor: pointer;
      padding: 0.15rem 0.4rem; font-weight: 600; background: none; border: none;
      text-align: start; transition: color 0.15s;
    }
    .more-link:hover { color: var(--color-primary); text-decoration: underline; }

    /* ── Week View ── */
    .week-view { }
    .week-day-row {
      display: flex; border-bottom: 1px solid var(--color-border-light);
      min-height: 80px; transition: background 0.15s;
    }
    .week-day-row.today {
      background: var(--color-primary-wash);
      box-shadow: inset 4px 0 0 0 var(--color-primary);
    }
    .week-day-row.weekend { background: rgba(248,247,252,0.5); }
    .week-day-label {
      width: 90px; flex-shrink: 0; display: flex; flex-direction: column;
      align-items: center; justify-content: center; padding: 0.6rem 0.4rem;
      border-inline-end: 1px solid var(--color-border-light);
      cursor: pointer; transition: background 0.15s;
    }
    .week-day-label:hover { background: var(--color-surface-alt); }
    .week-day-name {
      font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em;
      color: var(--color-text-muted); font-weight: 700;
    }
    .week-day-number {
      font-size: 1.2rem; font-weight: 800; color: var(--color-text);
      width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center;
      border-radius: 50%; transition: all 0.15s;
    }
    .today-badge {
      background: var(--color-primary); color: #fff;
    }
    .week-day-visits {
      display: flex; flex-direction: column; gap: 0.4rem; padding: 0.6rem 0.75rem;
      flex: 1; min-width: 0;
    }
    .no-visits-label {
      font-size: 0.78rem; color: var(--color-text-muted); font-style: italic;
      padding: 0.25rem 0;
    }

    /* Week visit cards */
    .week-visit-card {
      display: flex; flex-direction: column; gap: 0.2rem;
      padding: 0.5rem 0.65rem; border-radius: var(--radius-sm);
      border: 1px solid var(--color-border-light);
      border-inline-start: 3px solid var(--color-primary);
      background: var(--color-surface); cursor: pointer;
      transition: all 0.15s ease;
    }
    .week-visit-card:hover {
      border-color: var(--color-primary);
      box-shadow: var(--shadow-sm);
      transform: translateY(-1px);
    }
    .week-visit-card.accent-active { border-inline-start-color: #2e7d32; }
    .week-visit-card.accent-pending { border-inline-start-color: #f59e0b; }
    .week-visit-top { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
    .week-visit-time { font-size: 0.75rem; font-weight: 700; color: var(--color-primary); white-space: nowrap; }
    .week-visit-badges { display: flex; gap: 0.25rem; flex-shrink: 0; }
    .week-visit-title {
      font-size: 0.82rem; font-weight: 600; color: var(--color-text);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .week-visit-meta {
      font-size: 0.72rem; color: var(--color-text-secondary);
      display: flex; align-items: center; gap: 0.3rem;
    }
    .week-visit-meta i { font-size: 0.68rem; }

    /* ── Status chips (shared) ── */
    .status-chip {
      display: inline-flex; align-items: center; gap: 0.2rem;
      padding: 0.15rem 0.45rem; border-radius: 999px;
      font-size: 0.68rem; font-weight: 600; border: 1px solid transparent;
      white-space: nowrap;
    }
    .status-chip i { font-size: 0.62rem; }
    .status-chip.total { background: rgba(108,99,255,0.10); color: #6c63ff; border-color: rgba(108,99,255,0.18); }
    .status-chip.pending { background: rgba(245,158,11,0.10); color: #b45309; border-color: rgba(245,158,11,0.20); }
    .status-chip.arrived { background: rgba(59,130,246,0.10); color: #1d4ed8; border-color: rgba(59,130,246,0.20); }
    .status-chip.checked-in { background: rgba(34,197,94,0.10); color: #15803d; border-color: rgba(34,197,94,0.20); }
    .status-chip.checked-out { background: rgba(100,116,139,0.10); color: #475569; border-color: rgba(100,116,139,0.20); }

    /* ── Day View ── */
    .day-view { padding: 1.25rem; }

    /* Empty state */
    .empty-state {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      min-height: 350px; text-align: center;
    }
    .empty-icon-wrap {
      width: 72px; height: 72px; border-radius: 50%;
      background: var(--color-primary-wash); display: flex; align-items: center; justify-content: center;
      margin-bottom: 1.25rem;
    }
    .empty-icon-wrap i { font-size: 2rem; color: var(--color-primary); opacity: 0.5; }
    .empty-state h3 { margin: 0 0 0.35rem; font-size: 1.05rem; font-weight: 600; color: var(--color-text); }
    .empty-state p { margin: 0; font-size: 0.85rem; color: var(--color-text-muted); }

    /* Day visit cards */
    .day-visit-card {
      display: flex; gap: 0; border-radius: var(--radius-md);
      border: 1px solid var(--color-border-light);
      margin-bottom: 0.65rem; cursor: pointer; overflow: hidden;
      transition: all 0.2s ease;
      border-inline-start: 4px solid var(--color-primary);
    }
    .day-visit-card:hover {
      border-color: var(--color-primary);
      box-shadow: var(--shadow-md);
      transform: translateY(-2px);
    }
    .day-visit-card.accent-active { border-inline-start-color: #2e7d32; }
    .day-visit-card.accent-pending { border-inline-start-color: #f59e0b; }

    .day-visit-time-col {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 1rem 0.85rem; min-width: 70px; background: var(--color-surface-alt);
      border-inline-end: 1px solid var(--color-border-light);
      gap: 0.15rem;
    }
    .day-time-start { font-size: 0.95rem; font-weight: 800; color: var(--color-primary); }
    .day-time-separator { width: 2px; height: 10px; background: var(--color-border); border-radius: 1px; }
    .day-time-end { font-size: 0.82rem; font-weight: 600; color: var(--color-text-secondary); }

    .day-visit-content { flex: 1; padding: 0.85rem 1rem; min-width: 0; }
    .day-visit-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.3rem; }
    .day-visit-header h3 { margin: 0; font-size: 0.95rem; font-weight: 700; color: var(--color-text); }
    .day-visit-arrow {
      font-size: 0.78rem; color: var(--color-text-muted);
      transition: all 0.15s; opacity: 0;
    }
    .day-visit-card:hover .day-visit-arrow {
      opacity: 1; color: var(--color-primary);
      transform: translateX(3px);
    }
    .day-visit-meta {
      display: flex; align-items: center; gap: 0.35rem;
      font-size: 0.78rem; color: var(--color-text-secondary); margin-bottom: 0.4rem;
    }
    .day-visit-meta i { font-size: 0.72rem; }
    .day-visit-statuses { display: flex; flex-wrap: wrap; gap: 0.3rem; }

    /* ── Responsive ── */
    @media (max-width: 900px) {
      .calendar-toolbar { flex-direction: column; align-items: stretch; }
      .toolbar-actions { flex-direction: column; gap: 0.5rem; }
      .search-input { width: 100% !important; }
      .search-input:focus { width: 100% !important; }
      .view-label { display: none; }
      .view-btn { padding: 0.4rem 0.65rem; }
    }
    @media (max-width: 768px) {
      .day-cell { min-height: 80px; }
      .day-cell .visit-chip { font-size: 0.65rem; }
      .chip-time { display: none; }
      .week-day-label { width: 60px; }
      .week-day-number { font-size: 1rem; width: 28px; height: 28px; }
      .day-visit-card { flex-direction: column; }
      .day-visit-time-col {
        flex-direction: row; gap: 0.5rem; padding: 0.5rem 0.85rem;
        border-inline-end: none; border-bottom: 1px solid var(--color-border-light);
      }
      .day-time-separator { width: 12px; height: 2px; }
    }
  `],
})
export class VisitCalendarComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private visitsApi = inject(VisitsApiService);
  private router = inject(Router);
  private translate = inject(TranslateService);

  currentView: CalendarView = 'month';
  currentDate = new Date();
  headerLabel = '';
  searchTerm = '';
  loading = false;
  maxVisiblePerCell = 3;
  totalVisitsInView = 0;

  viewOptions: { key: CalendarView; label: string; icon: string }[] = [
    { key: 'month', label: 'CALENDAR.MONTH', icon: 'pi pi-th-large' },
    { key: 'week', label: 'CALENDAR.WEEK', icon: 'pi pi-bars' },
    { key: 'day', label: 'CALENDAR.DAY', icon: 'pi pi-calendar' },
  ];

  weekDays: string[] = [];
  monthCells: CalendarDay[] = [];
  weekCells: CalendarDay[] = [];
  dayVisits: Visit[] = [];

  private allVisits: Visit[] = [];
  private searchSubject = new Subject<string>();
  private searchSub?: Subscription;
  private loadSub?: Subscription;

  ngOnInit(): void {
    this.buildWeekDays();
    this.searchSub = this.searchSubject
      .pipe(debounceTime(350), distinctUntilChanged())
      .subscribe(() => this.loadVisits());
    this.loadVisits();
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
    this.loadSub?.unsubscribe();
  }

  // --- Navigation ---

  navigate(direction: number): void {
    if (this.currentView === 'month') {
      this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + direction, 1);
    } else if (this.currentView === 'week') {
      this.currentDate = new Date(this.currentDate.getTime() + direction * 7 * 86400000);
    } else {
      this.currentDate = new Date(this.currentDate.getTime() + direction * 86400000);
    }
    this.loadVisits();
  }

  goToday(): void {
    this.currentDate = new Date();
    this.loadVisits();
  }

  setView(view: CalendarView): void {
    this.currentView = view;
    this.buildView();
  }

  onSearchChange(term: string): void {
    this.searchSubject.next(term);
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.loadVisits();
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent): void {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); this.navigate(-1); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); this.navigate(1); }
    else if (event.key === 't' || event.key === 'T') { this.goToday(); }
    else if (event.key === 'm' || event.key === 'M') { this.setView('month'); }
    else if (event.key === 'w' || event.key === 'W') { this.setView('week'); }
    else if (event.key === 'd' || event.key === 'D') { this.setView('day'); }
  }

  onDayClick(date: Date): void {
    this.currentDate = new Date(date);
    this.currentView = 'day';
    this.buildView();
  }

  showDayView(date: Date, event: Event): void {
    event.stopPropagation();
    this.onDayClick(date);
  }

  showDayViewFromWeek(date: Date): void {
    this.onDayClick(date);
  }

  goToVisit(id: string, event: Event): void {
    event.stopPropagation();
    this.router.navigate(['/visits', id]);
  }

  // --- Data loading ---

  private loadVisits(): void {
    const { start, end } = this.getDateRange();
    this.loading = true;
    this.loadSub?.unsubscribe();

    this.loadSub = this.visitsApi.getCalendarVisits(start.toISOString(), end.toISOString(), this.searchTerm?.trim() || undefined).subscribe({
      next: (visits) => {
        this.allVisits = visits;
        this.loading = false;
        this.buildView();
      },
      error: () => {
        this.allVisits = [];
        this.loading = false;
        this.buildView();
      },
    });
  }

  private getDateRange(): { start: Date; end: Date } {
    if (this.currentView === 'month') {
      const y = this.currentDate.getFullYear();
      const m = this.currentDate.getMonth();
      const firstDay = new Date(y, m, 1);
      const startOffset = (firstDay.getDay() + 6) % 7; // Monday start
      const start = new Date(y, m, 1 - startOffset);
      const lastDay = new Date(y, m + 1, 0);
      const endOffset = (7 - lastDay.getDay()) % 7;
      const end = new Date(y, m + 1, endOffset || 7);
      return { start, end };
    } else if (this.currentView === 'week') {
      const dayOfWeek = (this.currentDate.getDay() + 6) % 7;
      const d = this.currentDate;
      const startDay = d.getDate() - dayOfWeek;
      const start = new Date(d.getFullYear(), d.getMonth(), startDay);
      const end = new Date(d.getFullYear(), d.getMonth(), startDay + 7);
      return { start, end };
    } else {
      const d = this.currentDate;
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      return { start, end };
    }
  }

  // --- View building ---

  private buildView(): void {
    this.updateHeaderLabel();
    if (this.currentView === 'month') {
      this.buildMonthCells();
    } else if (this.currentView === 'week') {
      this.buildWeekCells();
    } else {
      this.buildDayVisits();
    }
  }

  private buildMonthCells(): void {
    const y = this.currentDate.getFullYear();
    const m = this.currentDate.getMonth();
    const today = new Date();

    const firstDay = new Date(y, m, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const gridStart = new Date(y, m, 1 - startOffset);

    const lastDay = new Date(y, m + 1, 0);
    const endOffset = (7 - lastDay.getDay()) % 7;
    const totalDays = lastDay.getDate() + startOffset + (endOffset || 7);

    const cells: CalendarDay[] = [];
    for (let i = 0; i < totalDays; i++) {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + i);
      const dow = date.getDay();
      cells.push({
        date,
        isCurrentMonth: date.getMonth() === m,
        isToday: this.isSameDay(date, today),
        isWeekend: dow === 0 || dow === 6,
        visits: this.getVisitsForDay(date),
      });
    }
    this.monthCells = cells;
    this.totalVisitsInView = this.allVisits.length;
  }

  private buildWeekCells(): void {
    const dayOfWeek = (this.currentDate.getDay() + 6) % 7;
    const monday = new Date(this.currentDate);
    monday.setDate(monday.getDate() - dayOfWeek);
    monday.setHours(0, 0, 0, 0);
    const today = new Date();

    const cells: CalendarDay[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const dow = date.getDay();
      cells.push({
        date,
        isCurrentMonth: true,
        isToday: this.isSameDay(date, today),
        isWeekend: dow === 0 || dow === 6,
        visits: this.getVisitsForDay(date),
      });
    }
    this.weekCells = cells;
    this.totalVisitsInView = this.allVisits.length;
  }

  private buildDayVisits(): void {
    this.dayVisits = this.getVisitsForDay(this.currentDate);
    this.totalVisitsInView = this.dayVisits.length;
  }

  private getVisitsForDay(date: Date): Visit[] {
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    const dayStartMs = dayStart.getTime();
    const dayEndMs = dayEnd.getTime();

    return this.allVisits.filter((v) => {
      const startMs = new Date(v.plannedStartTimeUtc).getTime();
      const endMs = v.plannedEndTimeUtc ? new Date(v.plannedEndTimeUtc).getTime() : null;
      // Visits with no end time are treated as single-day (start day only)
      return startMs < dayEndMs && (endMs !== null ? endMs > dayStartMs : startMs >= dayStartMs);
    });
  }

  // --- Helpers ---

  getVisitAccentClass(visit: Visit): string {
    const s = visit.statusSummary;
    if (!s || s.total === 0) return '';
    if (s.checkedIn > 0 || s.arrived > 0) return 'accent-active';
    if (s.pending > 0) return 'accent-pending';
    return '';
  }

  buildTooltip(visit: Visit): string {
    const parts = [`<strong>${this.escapeHtml(visit.title)}</strong>`];
    parts.push(`${this.formatTime(visit.plannedStartTimeUtc)}${visit.plannedEndTimeUtc ? ' - ' + this.formatTime(visit.plannedEndTimeUtc) : ''}`);
    if (visit.visitRequester) {
      parts.push(`${visit.visitRequester.firstName} ${visit.visitRequester.lastName}`);
    }
    if (visit.statusSummary && visit.statusSummary.total > 0) {
      parts.push(`${visit.statusSummary.total} ${this.translate.instant('CALENDAR.VISITORS_LABEL')}`);
    }
    return parts.join('<br>');
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private buildWeekDays(): void {
    const days = ['CALENDAR.MON', 'CALENDAR.TUE', 'CALENDAR.WED', 'CALENDAR.THU', 'CALENDAR.FRI', 'CALENDAR.SAT', 'CALENDAR.SUN'];
    this.weekDays = days.map((key) => this.translate.instant(key));
  }

  private updateHeaderLabel(): void {
    const d = this.currentDate;
    if (this.currentView === 'month') {
      this.headerLabel = d.toLocaleDateString(this.translate.currentLang || 'en', { month: 'long', year: 'numeric' });
    } else if (this.currentView === 'week') {
      const dayOfWeek = (d.getDay() + 6) % 7;
      const monday = new Date(d);
      monday.setDate(d.getDate() - dayOfWeek);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      this.headerLabel = `${this.formatShortDate(monday)} – ${this.formatShortDate(sunday)}`;
    } else {
      this.headerLabel = d.toLocaleDateString(this.translate.currentLang || 'en', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
  }

  formatTime(dateStr: string): string {
    const d = new Date(dateStr);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  formatWeekDayName(date: Date): string {
    return date.toLocaleDateString(this.translate.currentLang || 'en', { weekday: 'short' });
  }

  private formatShortDate(date: Date): string {
    return `${date.getDate()}/${date.getMonth() + 1}`;
  }

  private isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }
}

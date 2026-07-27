import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { TranslationService } from '../../../core/i18n/translation.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiService } from '../../../core/api/api.service';
import { WorkstationSessionService } from '../../../core/services/workstation-session.service';
import { DeviceStatusService } from '../../../core/services/device-status.service';
import { AccessibleWorkstation } from '../../../core/models/entities.model';

@Component({
    selector: 'app-select-workstation',
    standalone: true,
    imports: [TranslateModule],
    template: `
    <div class="ws-container">
      <div class="ws-card">
        <div class="ws-header">
          <img src="images/logo.png" alt="Migdal" class="ws-logo" />
          <h1>{{ 'SELECT_WORKSTATION.TITLE' | translate }}</h1>
          <p>{{ 'SELECT_WORKSTATION.SUBTITLE' | translate }}</p>
        </div>
        <div class="lang-toggle">
          <button type="button" class="btn-lang" (click)="translation.toggleLanguage()">
            {{ translation.currentLang === 'en' ? 'עברית' : 'English' }}
          </button>
        </div>
        @if (loading) {
          <div class="loading">{{ 'COMMON.LOADING' | translate }}</div>
        } @else if (workstations.length === 0) {
          <div class="empty-state">
            <i class="pi pi-desktop"></i>
            <p>{{ 'SELECT_WORKSTATION.NO_WORKSTATIONS' | translate }}</p>
          </div>
        } @else {
          <div class="ws-list">
            @for (ws of workstations; track ws.id) {
              <button
                type="button"
                class="ws-item"
                [class.selected]="selectedId === ws.id"
                [class.binding]="binding && selectedId === ws.id"
                (click)="selectWorkstation(ws)"
              >
                <i class="pi pi-desktop ws-item-icon"></i>
                <div class="ws-item-info">
                  <span class="ws-item-name">{{ ws.displayName || ws.code }}</span>
                  @if (ws.displayName && ws.code) {
                    <span class="ws-item-code">{{ ws.code }}</span>
                  }
                </div>
                @if (ws.devices.length > 0) {
                  <div class="ws-item-devices">
                    @for (d of ws.devices; track d.providerType) {
                      <span class="device-dot" [class.connected]="d.isConnected">
                        <i class="pi" [class.pi-print]="d.providerType === 'printer'" [class.pi-camera]="d.providerType === 'scanner'"></i>
                      </span>
                    }
                  </div>
                }
                <i class="pi pi-chevron-right ws-item-arrow"></i>
              </button>
            }
          </div>
        }
        @if (errorMessage) {
          <div class="error-message">{{ errorMessage }}</div>
        }
        <div class="ws-footer">
          <button type="button" class="btn-skip" (click)="skip()">
            {{ 'SELECT_WORKSTATION.SKIP' | translate }}
          </button>
          <button type="button" class="btn-logout" (click)="logout()">
            <i class="pi pi-sign-out"></i>
            {{ 'SELECT_WORKSTATION.LOGOUT' | translate }}
          </button>
        </div>
      </div>
    </div>
  `,
    styles: [`
    .ws-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #020140 0%, #1a1968 40%, #3d3a99 100%);
      padding: 1rem;
      position: relative;
      overflow: hidden;
    }
    .ws-container::before {
      content: '';
      position: absolute;
      top: -30%;
      right: -15%;
      width: 450px;
      height: 450px;
      background: radial-gradient(circle, rgba(108, 99, 255, 0.25) 0%, transparent 70%);
      border-radius: 50%;
      pointer-events: none;
    }
    .ws-container::after {
      content: '';
      position: absolute;
      bottom: -20%;
      left: -10%;
      width: 350px;
      height: 350px;
      background: radial-gradient(circle, rgba(108, 99, 255, 0.15) 0%, transparent 70%);
      border-radius: 50%;
      pointer-events: none;
    }
    .ws-card {
      background: #fff;
      padding: 2.5rem;
      border-radius: 16px;
      box-shadow: 0 16px 48px rgba(2, 1, 64, 0.25);
      width: 100%;
      max-width: 440px;
      position: relative;
      z-index: 1;
    }
    .ws-header {
      text-align: center;
      margin-bottom: 1.5rem;
    }
    .ws-header h1 {
      color: var(--color-primary, #020140);
      margin: 0 0 0.35rem;
      font-size: 1.45rem;
      font-weight: 700;
    }
    .ws-logo {
      height: 60px;
      width: auto;
      margin-bottom: 0.75rem;
    }
    .ws-header p {
      color: var(--color-text-muted, #9896ad);
      margin: 0;
      font-size: 0.88rem;
    }
    .lang-toggle {
      text-align: center;
      margin-bottom: 1.25rem;
    }
    .btn-lang {
      padding: 0.3rem 0.75rem;
      border: 1px solid var(--color-border, #e4e2f0);
      background: var(--color-surface, #fff);
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--color-primary, #020140);
      transition: all 0.2s;
    }
    .btn-lang:hover { background: var(--color-primary-wash, #eeedf8); }
    .loading {
      text-align: center;
      padding: 2rem 0;
      color: var(--color-text-muted, #9896ad);
      font-size: 0.9rem;
    }
    .empty-state {
      text-align: center;
      padding: 2rem 0;
      color: var(--color-text-muted, #9896ad);
    }
    .empty-state i {
      font-size: 2.5rem;
      margin-bottom: 0.75rem;
      display: block;
      opacity: 0.5;
    }
    .empty-state p { margin: 0; font-size: 0.9rem; }
    .ws-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-height: 320px;
      overflow-y: auto;
      padding-right: 0.25rem;
    }
    .ws-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.85rem 1rem;
      border: 1.5px solid var(--color-border, #e4e2f0);
      border-radius: 10px;
      background: #fff;
      cursor: pointer;
      transition: all 0.2s;
      text-align: start;
      width: 100%;
      font-family: inherit;
    }
    .ws-item:hover {
      border-color: var(--color-accent, #6c63ff);
      background: var(--color-primary-wash, #f4f3fc);
    }
    .ws-item.selected {
      border-color: var(--color-accent, #6c63ff);
      background: var(--color-accent-subtle, #ddd9ff);
    }
    .ws-item.binding {
      opacity: 0.7;
      pointer-events: none;
    }
    .ws-item-icon {
      font-size: 1.3rem;
      color: var(--color-accent, #6c63ff);
      flex-shrink: 0;
    }
    .ws-item-info {
      flex: 1;
      min-width: 0;
    }
    .ws-item-name {
      display: block;
      font-weight: 600;
      font-size: 0.92rem;
      color: var(--color-primary, #020140);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .ws-item-code {
      display: block;
      font-size: 0.78rem;
      color: var(--color-text-muted, #9896ad);
      margin-top: 0.1rem;
    }
    .ws-item-devices {
      display: flex;
      gap: 0.3rem;
      flex-shrink: 0;
    }
    .device-dot {
      font-size: 0.85rem;
      color: #94a3b8;
    }
    .device-dot.connected { color: #22c55e; }
    .ws-item-arrow {
      font-size: 0.75rem;
      color: var(--color-text-muted, #9896ad);
      flex-shrink: 0;
    }
    .error-message {
      color: var(--color-danger, #e53935);
      margin-top: 0.75rem;
      font-size: 0.875rem;
      text-align: center;
    }
    .ws-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 1px solid var(--color-border, #e4e2f0);
    }
    .btn-skip {
      padding: 0.5rem 1rem;
      border: none;
      background: none;
      color: var(--color-accent, #6c63ff);
      font-size: 0.88rem;
      font-weight: 600;
      cursor: pointer;
      border-radius: 6px;
      transition: all 0.2s;
      font-family: inherit;
    }
    .btn-skip:hover { background: var(--color-primary-wash, #eeedf8); }
    .btn-logout {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.5rem 1rem;
      border: 1px solid var(--color-border, #e4e2f0);
      background: #fff;
      color: var(--color-text-secondary, #5c5a78);
      font-size: 0.85rem;
      font-weight: 500;
      cursor: pointer;
      border-radius: 6px;
      transition: all 0.2s;
      font-family: inherit;
    }
    .btn-logout:hover {
      border-color: var(--color-danger, #e53935);
      color: var(--color-danger, #e53935);
    }
    @media (max-width: 480px) {
      .ws-card { padding: 1.75rem; }
    }
  `],
})
export class SelectWorkstationComponent implements OnInit, OnDestroy {
    translation = inject(TranslationService);
    private api = inject(ApiService);
    private router = inject(Router);
    private authService = inject(AuthService);
    private wsSession = inject(WorkstationSessionService);
    private deviceStatus = inject(DeviceStatusService);

    workstations: AccessibleWorkstation[] = [];
    loading = true;
    binding = false;
    selectedId: string | null = null;
    errorMessage = '';
    private stateSub: Subscription | null = null;

    ngOnInit(): void {
        this.wsSession.initListeners();
        this.deviceStatus.initListeners();
        this.loadWorkstations();

        this.stateSub = this.wsSession.state$.subscribe((state) => {
            if (state.bound) {
                this.router.navigate(['/dashboard']);
            }
            if (state.error) {
                this.binding = false;
                this.errorMessage = state.error;
            }
        });
    }

    ngOnDestroy(): void {
        this.stateSub?.unsubscribe();
    }

    loadWorkstations(): void {
        this.loading = true;
        this.api.get<AccessibleWorkstation[]>('/workstations/accessible').subscribe({
            next: (list) => {
                this.workstations = list;
                this.loading = false;
                if (list.length === 0) {
                    this.router.navigate(['/dashboard']);
                }
            },
            error: () => {
                this.loading = false;
            },
        });
    }

    selectWorkstation(ws: AccessibleWorkstation): void {
        this.selectedId = ws.id;
        this.binding = true;
        this.errorMessage = '';
        this.wsSession.bindToWorkstation(ws.id);
    }

    skip(): void {
        this.router.navigate(['/dashboard']);
    }

    logout(): void {
        this.authService.logout();
    }
}

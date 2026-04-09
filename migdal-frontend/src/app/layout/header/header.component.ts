import { Component, EventEmitter, Output, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { WorkstationSessionService } from '../../core/services/workstation-session.service';
import { AsyncPipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AgentStatusIconsComponent } from './agent-status-icons.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [AsyncPipe, TranslateModule, AgentStatusIconsComponent],
  template: `
    <header class="app-header">
      <div class="header-left">
        <button class="btn-icon menu-toggle" (click)="toggleSidebar.emit()">
          <i class="pi pi-bars"></i>
        </button>
        <img src="images/logo.svg" alt="Migdal" class="header-logo" />
        <h2>{{ 'APP.NAME' | translate }}</h2>
      </div>
      <div class="header-right">
        @if (wsSession.state$ | async; as ws) {
          @if (ws.bound) {
            <app-agent-status-icons />
            <div class="header-separator"></div>
          }
        }
        <button class="btn-lang" (click)="translation.toggleLanguage()" [title]="translation.currentLang === 'en' ? 'עברית' : 'English'">
          {{ translation.currentLang === 'en' ? 'HE' : 'EN' }}
        </button>
        @if (authService.currentUser$ | async; as user) {
          <span class="user-name">{{ user.firstName }} {{ user.lastName }}</span>
          <button class="btn-icon" (click)="onLogout()" [title]="'AUTH.LOGOUT' | translate">
            <i class="pi pi-sign-out"></i>
          </button>
        }
      </div>
    </header>
  `,
  styles: [`
      .app-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0 1.5rem;
        height: var(--header-height, 62px);
        background: var(--color-surface, #fff);
        border-bottom: 1px solid var(--color-border-light, #eeedfa);
        gap: 0.75rem;
        box-shadow: 0 1px 4px rgba(2, 1, 64, 0.04);
      }
      .header-left {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      .header-left h2 {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 600;
        color: var(--color-primary, #020140);
        white-space: nowrap;
      }
      .header-logo {
        height: 30px;
        width: auto;
      }
      .header-right {
        display: flex;
        align-items: center;
        gap: 0.65rem;
      }
      .btn-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border: none;
        background: transparent;
        border-radius: var(--radius-sm, 6px);
        cursor: pointer;
        color: var(--color-text-secondary, #5c5a78);
        font-size: 1.1rem;
        transition: all 0.2s;
      }
      .btn-icon:hover {
        background: var(--color-primary-wash, #eeedf8);
        color: var(--color-primary, #020140);
      }
      .btn-lang {
        padding: 0.3rem 0.65rem;
        border: 1px solid var(--color-border, #e4e2f0);
        background: var(--color-surface, #fff);
        border-radius: var(--radius-sm, 6px);
        cursor: pointer;
        font-weight: 600;
        font-size: 0.8rem;
        color: var(--color-primary, #020140);
        transition: all 0.2s;
      }
      .btn-lang:hover {
        background: var(--color-primary-wash, #eeedf8);
        border-color: var(--color-accent, #6c63ff);
      }
      .user-name {
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--color-text, #1a1a2e);
      }
      .header-separator {
        width: 1px;
        height: 24px;
        background: var(--color-border-light, #eeedfa);
      }
      @media (max-width: 767px) {
        .user-name {
          display: none;
        }
      }
    `],
})
export class HeaderComponent {
  authService = inject(AuthService);
  translation = inject(TranslationService);
  wsSession = inject(WorkstationSessionService);

  @Output() toggleSidebar = new EventEmitter<void>();

  onLogout(): void {
    this.authService.logout();
  }
}

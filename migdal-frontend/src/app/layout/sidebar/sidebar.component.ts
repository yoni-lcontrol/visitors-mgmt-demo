import { Component, EventEmitter, Input, Output, inject, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { HasPermissionDirective } from '../../core/permissions/has-permission.directive';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, HasPermissionDirective, TranslateModule],
  animations: [
    trigger('submenu', [
      state('collapsed', style({ height: '0', opacity: 0 })),
      state('expanded', style({ height: '*', opacity: 1 })),
      transition('collapsed <=> expanded', animate('200ms ease-in-out')),
    ]),
  ],
  template: `
    <nav class="sidebar" [class.collapsed]="collapsed">
      <div class="sidebar-brand">
        <img src="images/logo.svg" alt="Migdal" class="brand-logo" />
        <span class="brand-text">{{ 'APP.NAME' | translate }}</span>
        <button class="btn-sidebar-close" (click)="closeSidebar.emit()">
          <i class="pi pi-times"></i>
        </button>
      </div>
      <ul class="sidebar-nav">
        <li>
          <a routerLink="/dashboard" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" (click)="menuItemClicked.emit()">
            <i class="pi pi-th-large"></i>
            <span>{{ 'NAV.DASHBOARD' | translate }}</span>
          </a>
        </li>
        <li class="nav-divider"></li>
        <li *hasPermission="'users.read'">
          <a routerLink="/users" routerLinkActive="active" (click)="menuItemClicked.emit()">
            <i class="pi pi-users"></i>
            <span>{{ 'NAV.USERS' | translate }}</span>
          </a>
        </li>
        <li *hasPermission="'roles.read'">
          <a routerLink="/roles" routerLinkActive="active" (click)="menuItemClicked.emit()">
            <i class="pi pi-shield"></i>
            <span>{{ 'NAV.ROLES' | translate }}</span>
          </a>
        </li>
        <li class="has-submenu" *hasPermission="'access-control.read'">
          <a class="submenu-toggle" [class.active]="isAccessControlActive()" (click)="toggleAccessControl()">
            <i class="pi pi-lock"></i>
            <span>{{ 'NAV.ACCESS_CONTROL' | translate }}</span>
            <i class="pi pi-chevron-down chevron" [class.rotated]="accessControlOpen"></i>
          </a>
          <ul class="submenu" [@submenu]="accessControlOpen ? 'expanded' : 'collapsed'">
            <li>
              <a routerLink="/access-control/controllers" routerLinkActive="active" (click)="menuItemClicked.emit()">
                <i class="pi pi-server"></i>
                <span>{{ 'NAV.CONTROLLERS' | translate }}</span>
              </a>
            </li>
            <li>
              <a routerLink="/access-control/access-levels" routerLinkActive="active" (click)="menuItemClicked.emit()">
                <i class="pi pi-list"></i>
                <span>{{ 'NAV.ACCESS_LEVELS' | translate }}</span>
              </a>
            </li>
          </ul>
        </li>
        <li *hasPermission="'visits.read'" class="has-submenu">
          <a class="submenu-toggle" [class.active]="isVisitsActive()" (click)="toggleVisits()">
            <i class="pi pi-user-plus"></i>
            <span>{{ 'NAV.VISITORS_MANAGEMENT' | translate }}</span>
            <i class="pi pi-chevron-down chevron" [class.rotated]="visitsOpen"></i>
          </a>
          <ul class="submenu" [@submenu]="visitsOpen ? 'expanded' : 'collapsed'">
            <li>
              <a routerLink="/visits" [class.active]="isVisitListActive()" (click)="menuItemClicked.emit()">
                <i class="pi pi-calendar-plus"></i>
                <span>{{ 'NAV.VISITS' | translate }}</span>
              </a>
            </li>
            <li>
              <a routerLink="/visits/calendar" routerLinkActive="active" (click)="menuItemClicked.emit()">
                <i class="pi pi-calendar"></i>
                <span>{{ 'NAV.CALENDAR' | translate }}</span>
              </a>
            </li>
            <li>
              <a routerLink="/visits/on-site" routerLinkActive="active" (click)="menuItemClicked.emit()">
                <i class="pi pi-map-marker"></i>
                <span>{{ 'NAV.ON_SITE' | translate }}</span>
              </a>
            </li>
            <li *hasPermission="'blacklist.read'">
              <a routerLink="/visits/blacklist" routerLinkActive="active" (click)="menuItemClicked.emit()">
                <i class="pi pi-ban"></i>
                <span>{{ 'NAV.BLACKLIST' | translate }}</span>
              </a>
            </li>
            <li *hasPermission="'parking.approve'">
              <a routerLink="/visits/parking-requests" routerLinkActive="active" (click)="menuItemClicked.emit()">
                <i class="pi pi-warehouse"></i>
                <span>{{ 'NAV.PARKING_REQUESTS' | translate }}</span>
              </a>
            </li>
            <li>
              <a routerLink="/visits/entrance-exit-logs" routerLinkActive="active" (click)="menuItemClicked.emit()">
                <i class="pi pi-history"></i>
                <span>{{ 'NAV.ENTRANCE_EXIT_LOGS' | translate }}</span>
              </a>
            </li>
          </ul>
        </li>
        <li *hasPermission="'settings.read'" class="has-submenu">
          <a class="submenu-toggle" [class.active]="isSettingsActive()" (click)="toggleSettings()">
            <i class="pi pi-cog"></i>
            <span>{{ 'NAV.SETTINGS' | translate }}</span>
            <i class="pi pi-chevron-down chevron" [class.rotated]="settingsOpen"></i>
          </a>
          <ul class="submenu" [@submenu]="settingsOpen ? 'expanded' : 'collapsed'">
            <li>
              <a routerLink="/settings" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" (click)="menuItemClicked.emit()">
                <i class="pi pi-sliders-h"></i>
                <span>{{ 'NAV.GENERAL_SETTINGS' | translate }}</span>
              </a>
            </li>
            <li>
              <a routerLink="/settings/notifications" routerLinkActive="active" (click)="menuItemClicked.emit()">
                <i class="pi pi-bell"></i>
                <span>{{ 'NAV.NOTIFICATION_SETTINGS' | translate }}</span>
              </a>
            </li>
            <li>
              <a routerLink="/settings/active-directory" routerLinkActive="active" (click)="menuItemClicked.emit()">
                <i class="pi pi-sitemap"></i>
                <span>{{ 'NAV.AD_SETTINGS' | translate }}</span>
              </a>
            </li>
            <li *hasPermission="'settings.card-templates.read'">
              <a routerLink="/settings/card-templates" routerLinkActive="active" (click)="menuItemClicked.emit()">
                <i class="pi pi-id-card"></i>
                <span>{{ 'NAV.CARD_TEMPLATES' | translate }}</span>
              </a>
            </li>
            <li *hasPermission="'buildings.read'">
              <a routerLink="/settings/buildings" routerLinkActive="active" (click)="menuItemClicked.emit()">
                <i class="pi pi-building"></i>
                <span>{{ 'NAV.BUILDINGS' | translate }}</span>
              </a>
            </li>
          </ul>
        </li>
        <li *hasPermission="'workstations.read'">
          <a routerLink="/workstations" routerLinkActive="active" (click)="menuItemClicked.emit()">
            <i class="pi pi-desktop"></i>
            <span>{{ 'NAV.WORKSTATIONS' | translate }}</span>
          </a>
        </li>
        <li *hasPermission="'audit.read'">
          <a routerLink="/audit" routerLinkActive="active" (click)="menuItemClicked.emit()">
            <i class="pi pi-list"></i>
            <span>{{ 'NAV.AUDIT_LOGS' | translate }}</span>
          </a>
        </li>
      </ul>
    </nav>
  `,
  styles: [`
      .sidebar {
        width: var(--sidebar-width, 260px);
        min-width: var(--sidebar-width, 260px);
        height: 100%;
        background: var(--color-primary, #020140);
        color: #fff;
        display: flex;
        flex-direction: column;
        transition: width var(--transition-speed, 0.25s) ease, min-width var(--transition-speed, 0.25s) ease, transform var(--transition-speed, 0.25s) ease;
        z-index: 999;
        overflow: hidden;
      }
      .sidebar.collapsed {
        width: 0;
        min-width: 0;
      }
      .sidebar-brand {
        display: flex;
        align-items: center;
        gap: 0.8rem;
        padding: 1rem 1.25rem;
        height: var(--header-height, 62px);
        font-size: 1.1rem;
        font-weight: 700;
        letter-spacing: 0.02em;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        white-space: nowrap;
      }
      .btn-sidebar-close {
        margin-left: auto;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border: none;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        cursor: pointer;
        color: rgba(255, 255, 255, 0.7);
        font-size: 0.85rem;
        transition: all 0.2s;
        flex-shrink: 0;
      }
      .btn-sidebar-close:hover {
        background: rgba(255, 255, 255, 0.2);
        color: #fff;
      }
      .brand-logo {
        height: 32px;
        width: auto;
        filter: brightness(0) invert(1);
      }
      .sidebar-nav {
        list-style: none;
        padding: 0.75rem 0.6rem;
        margin: 0;
        flex: 1;
        overflow-y: auto;
      }
      .sidebar-nav li a {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.65rem 0.85rem;
        border-radius: var(--radius-sm, 6px);
        color: rgba(255, 255, 255, 0.55);
        text-decoration: none;
        transition: all 0.2s;
        white-space: nowrap;
        margin-bottom: 2px;
        font-weight: 500;
        font-size: 0.9rem;
      }
      .sidebar-nav li a:hover {
        color: rgba(255, 255, 255, 0.9);
        background: rgba(255, 255, 255, 0.08);
      }
      .sidebar-nav li a.active {
        color: #fff;
        background: rgba(108, 99, 255, 0.35);
      }
      .sidebar-nav li a i {
        font-size: 1.05rem;
        min-width: 1.25rem;
        text-align: center;
      }
      .nav-divider {
        height: 1px;
        background: rgba(255, 255, 255, 0.08);
        margin: 0.5rem 0.85rem;
      }

      /* Submenu parent */
      .submenu-toggle {
        cursor: pointer;
      }
      .submenu-toggle .chevron {
        margin-inline-start: auto;
        font-size: 0.7rem;
        transition: transform 0.2s ease;
      }
      .submenu-toggle .chevron.rotated {
        transform: rotate(180deg);
      }

      /* Submenu children */
      .submenu {
        list-style: none;
        padding: 0;
        margin: 0;
        overflow: hidden;
      }
      .submenu li a {
        padding-inline-start: 2.5rem;
        font-size: 0.85rem;
      }

      @media (max-width: 767px) {
        .sidebar {
          position: fixed;
          top: 0;
          height: 100vh;
          transform: translateX(-100%);
        }
        :host-context([dir='rtl']) .sidebar {
          transform: translateX(100%);
        }
        :host-context(.sidebar-open) .sidebar {
          transform: translateX(0);
        }
      }
    `],
})
export class SidebarComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private routerSub: Subscription | null = null;

  @Input() collapsed = false;
  @Output() closeSidebar = new EventEmitter<void>();
  @Output() menuItemClicked = new EventEmitter<void>();

  accessControlOpen = this.isAccessControlActive();
  visitsOpen = this.isVisitsActive();
  settingsOpen = this.isSettingsActive();

  ngOnInit(): void {
    this.routerSub = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => {
        this.syncSubmenus();
      });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  private syncSubmenus(): void {
    if (this.isAccessControlActive()) this.accessControlOpen = true;
    if (this.isVisitsActive()) this.visitsOpen = true;
    if (this.isSettingsActive()) this.settingsOpen = true;
  }

  isAccessControlActive(): boolean {
    return this.router.url.startsWith('/access-control');
  }

  isVisitsActive(): boolean {
    return this.router.url.startsWith('/visits');
  }

  isSettingsActive(): boolean {
    return this.router.url.startsWith('/settings');
  }

  isVisitListActive(): boolean {
    const url = this.router.url.split('?')[0];
    return url === '/visits' || /^\/visits\/[0-9a-f-]{36}$/i.test(url);
  }

  toggleAccessControl(): void {
    if (!this.accessControlOpen) {
      this.accessControlOpen = true;
      this.router.navigate(['/access-control/controllers']);
      this.menuItemClicked.emit();
    } else {
      this.accessControlOpen = false;
    }
  }

  toggleVisits(): void {
    if (!this.visitsOpen) {
      this.visitsOpen = true;
      this.router.navigate(['/visits']);
      this.menuItemClicked.emit();
    } else {
      this.visitsOpen = false;
    }
  }

  toggleSettings(): void {
    if (!this.settingsOpen) {
      this.settingsOpen = true;
      this.router.navigate(['/settings']);
      this.menuItemClicked.emit();
    } else {
      this.settingsOpen = false;
    }
  }
}

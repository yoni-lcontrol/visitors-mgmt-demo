import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '@core/api/api.service';
import { User } from '@core/models/entities.model';
import { DateFormatPipe } from '@shared/pipes/date-format.pipe';

@Component({
  selector: 'app-user-detail',
  standalone: true,
  imports: [TranslateModule, DateFormatPipe],
  template: `
    <div class="page-header">
      <h1>{{ 'USERS.USER_DETAILS' | translate }}</h1>
      <button class="btn btn-secondary" (click)="router.navigate(['/users'])">{{ 'COMMON.BACK' | translate }}</button>
    </div>
    @if (user) {
      <div class="card">
        <div class="detail-grid">
          <div class="detail-item">
            <label>{{ 'USERS.FIRST_NAME' | translate }}</label>
            <span>{{ user.firstName }}</span>
          </div>
          <div class="detail-item">
            <label>{{ 'USERS.LAST_NAME' | translate }}</label>
            <span>{{ user.lastName }}</span>
          </div>
          <div class="detail-item">
            <label>{{ 'USERS.USERNAME' | translate }}</label>
            <span>{{ user.username }}</span>
          </div>
          <div class="detail-item">
            <label>{{ 'USERS.LAST_LOGIN' | translate }}</label>
            <span>{{ user.lastLoginAt ? (user.lastLoginAt | dateFormat) : ('USERS.NEVER' | translate) }}</span>
          </div>
          <div class="detail-item">
            <label>{{ 'USERS.ROLES' | translate }}</label>
            <span>@for (r of user.roles; track r.id) { <span class="role-chip">{{ r.name }}</span> }</span>
          </div>
          <div class="detail-item">
            <label>{{ 'COMMON.STATUS' | translate }}</label>
            <span class="status-badge" [class.active]="user.isActive" [class.inactive]="!user.isActive">
              {{ user.isActive ? ('COMMON.ACTIVE' | translate) : ('COMMON.INACTIVE' | translate) }}
            </span>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
      .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }
      .detail-item label { display: block; font-weight: 600; font-size: 0.78rem; color: var(--color-text-muted, #9896ad); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.25rem; }
      .detail-item span { font-size: 0.95rem; color: var(--color-text, #1a1a2e); }
      .role-chip { display: inline-block; padding: 0.15rem 0.55rem; background: var(--color-accent-subtle, #ddd9ff); color: var(--color-primary, #020140); border-radius: 4px; font-size: 0.78rem; font-weight: 500; margin: 0.1rem; }
      .btn { padding: 0.5rem 1.1rem; border: none; border-radius: var(--radius-sm, 6px); cursor: pointer; font-size: 0.875rem; font-weight: 500; transition: all 0.25s; font-family: inherit; }
      .btn-secondary { background: var(--color-primary-wash, #eeedf8); color: var(--color-primary, #020140); border: 1px solid var(--color-border, #e4e2f0); }
      .btn-secondary:hover { background: var(--color-accent-subtle, #ddd9ff); }
      @media (max-width: 600px) { .detail-grid { grid-template-columns: 1fr; } }
    `],
})
export class UserDetailComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  router = inject(Router);
  user: User | null = null;

  ngOnInit(): void {
    const id = this.route.snapshot.params['id'];
    this.api.get<User>(`/users/${id}`).subscribe((u) => (this.user = u));
  }
}

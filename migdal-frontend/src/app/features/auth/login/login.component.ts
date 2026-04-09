import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiService } from '../../../core/api/api.service';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule],
  template: `
    <div class="login-container">
      <div class="login-card">
        <div class="login-header">
          <img src="images/logo.svg" alt="Migdal" class="login-logo" />
          <h1>{{ 'APP.NAME' | translate }}</h1>
          <p>{{ 'AUTH.LOGIN_SUBTITLE' | translate }}</p>
        </div>
        <div class="lang-toggle">
          <button type="button" class="btn-lang" (click)="translation.toggleLanguage()">
            {{ translation.currentLang === 'en' ? 'עברית' : 'English' }}
          </button>
        </div>
        <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
          <div class="field">
            <label for="username">{{ 'AUTH.USERNAME' | translate }} <span class="required">*</span></label>
            <input
              id="username"
              type="text"
              formControlName="username"
              [placeholder]="'PLACEHOLDER.ENTER_USERNAME' | translate"
              autocomplete="username"
            />
            @if (loginForm.get('username')?.invalid && loginForm.get('username')?.touched) {
              <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
            }
          </div>
          <div class="field">
            <label for="password">{{ 'AUTH.PASSWORD' | translate }} <span class="required">*</span></label>
            <input
              id="password"
              type="password"
              formControlName="password"
              [placeholder]="'PLACEHOLDER.ENTER_PASSWORD' | translate"
              autocomplete="current-password"
            />
            @if (loginForm.get('password')?.hasError('required') && loginForm.get('password')?.touched) {
              <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
            } @else if (loginForm.get('password')?.hasError('minlength') && loginForm.get('password')?.touched) {
              <small class="field-error">{{ 'VALIDATION.MIN_LENGTH' | translate:{ min: 6 } }}</small>
            }
          </div>
          @if (errorMessage) {
            <div class="error-message">{{ errorMessage }}</div>
          }
          <button type="submit" [disabled]="loginForm.invalid || isLoading">
            {{ isLoading ? ('APP.LOADING' | translate) : ('AUTH.LOGIN' | translate) }}
          </button>
        </form>
        @if (entraEnabled) {
          <div class="divider">
            <span>{{ 'AUTH.OR' | translate }}</span>
          </div>
          <button type="button" class="btn-microsoft" (click)="onMicrosoftLogin()" [disabled]="isLoading">
            <svg class="ms-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21" width="21" height="21">
              <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
              <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
              <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
            </svg>
            {{ 'AUTH.LOGIN_WITH_MICROSOFT' | translate }}
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
      .login-container {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        background: linear-gradient(135deg, #020140 0%, #1a1968 40%, #3d3a99 100%);
        padding: 1rem;
        position: relative;
        overflow: hidden;
      }
      .login-container::before {
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
      .login-container::after {
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
      .login-card {
        background: #fff;
        padding: 2.5rem;
        border-radius: 16px;
        box-shadow: 0 16px 48px rgba(2, 1, 64, 0.25);
        width: 100%;
        max-width: 400px;
        position: relative;
        z-index: 1;
      }
      .login-header {
        text-align: center;
        margin-bottom: 1.75rem;
      }
      .login-header h1 {
        color: var(--color-primary, #020140);
        margin: 0 0 0.35rem;
        font-size: 1.65rem;
        font-weight: 700;
        letter-spacing: -0.01em;
      }
      .login-logo {
        height: 72px;
        width: auto;
        margin-bottom: 1rem;
      }
      .login-header p {
        color: var(--color-text-muted, #9896ad);
        margin: 0;
        font-size: 0.9rem;
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
      .field {
        margin-bottom: 1.1rem;
      }
      .field label {
        display: block;
        margin-bottom: 0.35rem;
        font-weight: 500;
        font-size: 0.88rem;
        color: var(--color-text-secondary, #5c5a78);
      }
      .field input {
        width: 100%;
        padding: 0.65rem 0.85rem;
        border: 1.5px solid var(--color-border, #e4e2f0);
        border-radius: 8px;
        font-size: 0.95rem;
        font-family: inherit;
        box-sizing: border-box;
        transition: border-color 0.2s, box-shadow 0.2s;
        background: var(--color-surface, #fff);
      }
      .field input:focus {
        outline: none;
        border-color: var(--color-accent, #6c63ff);
        box-shadow: 0 0 0 3px rgba(108, 99, 255, 0.12);
      }
      button[type="submit"] {
        width: 100%;
        padding: 0.75rem;
        background: var(--color-accent, #6c63ff);
        color: #fff;
        border: none;
        border-radius: 8px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        margin-top: 0.5rem;
        transition: all 0.25s;
        box-shadow: 0 4px 14px rgba(108, 99, 255, 0.3);
        font-family: inherit;
      }
      button[type="submit"]:hover:not(:disabled) {
        background: var(--color-accent-hover, #5a52e0);
        transform: translateY(-1px);
        box-shadow: 0 6px 20px rgba(108, 99, 255, 0.4);
      }
      button[type="submit"]:disabled { opacity: 0.55; cursor: not-allowed; }
      .error-message {
        color: var(--color-danger, #e53935);
        margin-bottom: 0.75rem;
        font-size: 0.875rem;
        text-align: center;
      }
      @media (max-width: 480px) {
        .login-card { padding: 1.75rem; }
      }
      .divider {
        display: flex;
        align-items: center;
        margin: 1.25rem 0;
        gap: 0.75rem;
      }
      .divider::before, .divider::after {
        content: '';
        flex: 1;
        height: 1px;
        background: var(--color-border, #e4e2f0);
      }
      .divider span {
        font-size: 0.82rem;
        color: var(--color-text-muted, #9896ad);
        font-weight: 500;
      }
      .btn-microsoft {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.6rem;
        padding: 0.7rem;
        border: 1.5px solid var(--color-border, #e4e2f0);
        background: var(--color-surface, #fff);
        border-radius: 8px;
        font-size: 0.95rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        font-family: inherit;
        color: var(--color-text-primary, #333);
      }
      .btn-microsoft:hover:not(:disabled) {
        background: var(--color-primary-wash, #f4f3fc);
        border-color: var(--color-accent, #6c63ff);
      }
      .btn-microsoft:disabled { opacity: 0.55; cursor: not-allowed; }
      .ms-icon { flex-shrink: 0; }
    `],
})
export class LoginComponent {
  translation = inject(TranslationService);
  loginForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  entraEnabled = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private api: ApiService,
    private translate: TranslateService,
  ) {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });

    // TO REMOVE: Pre-fill credentials for easier testing during development
    this.loginForm = this.fb.group({
      username: ['admin', [Validators.required]],
      password: ['Admin@123456', [Validators.required, Validators.minLength(6)]],
    });

    // Check if Entra ID login is available
    this.authService.getEntraConfig().subscribe({
      next: (config) => {
        this.entraEnabled = config.enabled;
      },
      error: () => {
        this.entraEnabled = false;
      },
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid) return;

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.login(this.loginForm.value).subscribe({
      next: () => {
        this.postLoginNavigate();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = this.resolveLoginError(err);
      },
    });
  }

  onMicrosoftLogin(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.authService.loginWithEntra().subscribe({
      next: () => {
        this.postLoginNavigate();
      },
      error: (err) => {
        this.isLoading = false;
        if (err.errorCode === 'user_cancelled') {
          this.errorMessage = '';
        } else {
          this.errorMessage = this.resolveLoginError(err);
        }
      },
    });
  }

  private postLoginNavigate(): void {
    this.api.get<unknown[]>('/workstations/accessible').subscribe({
      next: (list) => {
        if (list.length > 0) {
          this.router.navigate(['/select-workstation']);
        } else {
          this.router.navigate(['/dashboard']);
        }
      },
      error: () => {
        this.router.navigate(['/dashboard']);
      },
    });
  }

  private resolveLoginError(err: any): string {
    const msg = err.error?.error?.message ?? '';
    if (msg.includes('deactivated')) {
      return this.translate.instant('AUTH.ACCOUNT_DEACTIVATED');
    }
    return msg || this.translate.instant('AUTH.INVALID_CREDENTIALS');
  }
}

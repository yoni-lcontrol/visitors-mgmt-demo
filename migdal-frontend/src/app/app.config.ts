import { ApplicationConfig, provideZoneChangeDetection, APP_INITIALIZER } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import {
    provideHttpClient,
    withInterceptors,
    withFetch,
} from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { MessageService, ConfirmationService } from 'primeng/api';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { apiUnwrapInterceptor } from './core/auth/api-unwrap.interceptor';
import { AuthService } from './core/auth/auth.service';
import { firstValueFrom } from 'rxjs';

function initializeAuth(authService: AuthService) {
    return () => firstValueFrom(authService.tryRestoreSession());
}

export const appConfig: ApplicationConfig = {
    providers: [
        provideZoneChangeDetection({ eventCoalescing: true }),
        provideRouter(routes, withComponentInputBinding()),
        provideHttpClient(withFetch(), withInterceptors([authInterceptor, apiUnwrapInterceptor])),
        provideAnimations(),
        MessageService,
        ConfirmationService,
        ...TranslateModule.forRoot({
            defaultLanguage: 'en',
        }).providers!,
        provideTranslateHttpLoader({ prefix: './i18n/' }),
        {
            provide: APP_INITIALIZER,
            useFactory: initializeAuth,
            deps: [AuthService],
            multi: true,
        },
    ],
};

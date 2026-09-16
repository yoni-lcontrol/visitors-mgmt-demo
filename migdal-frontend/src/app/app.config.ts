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
import { providePrimeNG } from 'primeng/config';
import { definePreset } from '@primeng/themes';
import Lara from '@primeng/themes/lara';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { apiUnwrapInterceptor } from './core/auth/api-unwrap.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { AuthService } from './core/auth/auth.service';
import { firstValueFrom } from 'rxjs';

const MigdalPreset = definePreset(Lara, {
    semantic: {
        primary: {
            50: '{indigo.50}',
            100: '{indigo.100}',
            200: '{indigo.200}',
            300: '{indigo.300}',
            400: '{indigo.400}',
            500: '{indigo.500}',
            600: '{indigo.600}',
            700: '{indigo.700}',
            800: '{indigo.800}',
            900: '{indigo.900}',
            950: '{indigo.950}',
        },
    },
});

function initializeAuth(authService: AuthService) {
    return () => firstValueFrom(authService.tryRestoreSession());
}

export const appConfig: ApplicationConfig = {
    providers: [
        provideZoneChangeDetection({ eventCoalescing: true }),
        provideRouter(routes, withComponentInputBinding()),
        provideHttpClient(withFetch(), withInterceptors([authInterceptor, errorInterceptor, apiUnwrapInterceptor])),
        provideAnimations(),
        providePrimeNG({
            theme: {
                preset: MigdalPreset,
                options: {
                    darkModeSelector: false,
                }
            }
        }),
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

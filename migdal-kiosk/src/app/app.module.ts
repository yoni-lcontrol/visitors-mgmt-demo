import { NgModule, ErrorHandler, APP_INITIALIZER } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { GlobalErrorHandler } from './kiosk/global-error-handler';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { StatusBannerComponent } from './kiosk/status/status-banner.component';
import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { HomeComponent } from './pages/home/home.component';
import { ErrorPageComponent } from './pages/error-page/error-page.component';
import { ReactiveFormsModule } from '@angular/forms';
import { CheckInComponent } from './pages/check-in/check-in.component';
import { SuccessComponent } from './pages/success/success.component';
import { TranslateModule } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { TopNavbarComponent } from './components/top-navbar/top-navbar.component';
import { ScanComponent } from './pages/scan/scan.component';
import { DetailsComponent } from './pages/details/details.component';
import { ConsentComponent } from './pages/consent/consent.component';
import { LucideAngularModule } from 'lucide-angular';
import { Phone, Mail, IdCard, Building2, Wallet, User } from 'lucide-angular';
import { PdfViewerModule } from 'ng2-pdf-viewer';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { PairComponent } from './pair/pair.component';
import { NgxSpinnerModule } from 'ngx-spinner';
import { VisitNotFoundComponent } from './pages/visit-not-found/visit-not-found.component';
import { ToastrModule } from 'ngx-toastr';
import { StepsComponent } from './components/steps/steps.component';
import { KioskConfigService } from './config/kiosk-config.service';
import { KioskApiKeyInterceptor } from './kiosk/kiosk-api-key.interceptor';
import { VisitorTypeLabelPipe } from './pipes/visitor-type-lable.pipe';

export function initKioskConfig(cfg: KioskConfigService) {
  return () => cfg.load();
}

@NgModule({
  declarations: [
    AppComponent,
    TopNavbarComponent,
    StepsComponent,
    HomeComponent,
    ErrorPageComponent,
    StatusBannerComponent,
    CheckInComponent,
    DetailsComponent,
    ScanComponent,
    ConsentComponent,
    SuccessComponent,
    VisitNotFoundComponent,
    PairComponent,

    VisitorTypeLabelPipe
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    ReactiveFormsModule,
    HttpClientModule,
    PdfViewerModule,
    NgxSpinnerModule.forRoot({ type: 'ball-spin-clockwise' }),
    ToastrModule.forRoot({
      positionClass: 'toast-top-right',
      timeOut: 8000,
      closeButton: true,
      progressBar: true,
      preventDuplicates: true,
    }),
    LucideAngularModule.pick({
      Phone,
      Mail,
      IdCard,
      Building2,
      Wallet,
      User,
    }),
    TranslateModule.forRoot({
      fallbackLang: 'en',
      loader: provideTranslateHttpLoader({
        prefix: './assets/i18n/',
        suffix: '.json',
      }),
    }),
  ],
  providers: [
    { provide: APP_INITIALIZER, useFactory: initKioskConfig, deps: [KioskConfigService], multi: true, },
    { provide: HTTP_INTERCEPTORS, useClass: KioskApiKeyInterceptor, multi: true },
    { provide: ErrorHandler, useClass: GlobalErrorHandler }
    // { provide: HTTP_INTERCEPTORS, useClass: ApiErrorInterceptor, multi: true },
    // AUTH_INTERCEPTOR_PROVIDER,
  ],
  bootstrap: [AppComponent],
})
export class AppModule { }

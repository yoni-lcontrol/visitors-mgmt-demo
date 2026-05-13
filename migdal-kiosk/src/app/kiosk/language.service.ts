import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export type AppLang = 'he' | 'en';

@Injectable({
  providedIn: 'root'
})
export class LanguageService {

  private STORAGE_KEY = 'kiosk_lang';
  private defaultLang: AppLang = 'he';

  constructor(private translate: TranslateService) {
    this.translate.addLangs(['he', 'en']);
    this.translate.setDefaultLang(this.defaultLang);
  }

  init(): void {
    const savedLang =
      (localStorage.getItem(this.STORAGE_KEY) as AppLang)
      || this.defaultLang;

    this.setLanguage(savedLang);
  }

  setLanguage(lang: AppLang): void {
    this.translate.use(lang);

    localStorage.setItem(this.STORAGE_KEY, lang);

    // RTL / LTR handling
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
  }

  getCurrent(): AppLang {
    return this.translate.currentLang as AppLang;
  }
}
import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { PrimeNGConfig } from 'primeng/api';
import { BehaviorSubject } from 'rxjs';

export type AppLanguage = 'en' | 'he';
export type AppDirection = 'ltr' | 'rtl';

const LANG_KEY = 'migdal_lang';

@Injectable({ providedIn: 'root' })
export class TranslationService {
    private directionSubject = new BehaviorSubject<AppDirection>('ltr');
    direction$ = this.directionSubject.asObservable();

    private currentLangSubject = new BehaviorSubject<AppLanguage>('en');
    currentLang$ = this.currentLangSubject.asObservable();

    constructor(private translate: TranslateService, private primeNGConfig: PrimeNGConfig) {
        this.translate.addLangs(['en', 'he']);
        this.translate.setDefaultLang('en');

        this.translate.stream('PRIMENG').subscribe(res => {
            this.primeNGConfig.setTranslation(res);
        });

        const saved = localStorage.getItem(LANG_KEY) as AppLanguage | null;
        const lang = saved && ['en', 'he'].includes(saved) ? saved : 'en';
        this.setLanguage(lang);
    }

    get currentLang(): AppLanguage {
        return this.currentLangSubject.value;
    }

    get direction(): AppDirection {
        return this.directionSubject.value;
    }

    get isRtl(): boolean {
        return this.direction === 'rtl';
    }

    setLanguage(lang: AppLanguage): void {
        this.translate.use(lang);
        this.currentLangSubject.next(lang);

        const dir: AppDirection = lang === 'he' ? 'rtl' : 'ltr';
        this.directionSubject.next(dir);

        document.documentElement.lang = lang;
        document.documentElement.dir = dir;
        document.body.dir = dir;

        localStorage.setItem(LANG_KEY, lang);
    }

    toggleLanguage(): void {
        this.setLanguage(this.currentLang === 'en' ? 'he' : 'en');
    }
}

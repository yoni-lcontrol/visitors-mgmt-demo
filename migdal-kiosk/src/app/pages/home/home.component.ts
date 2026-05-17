import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { KioskFlowService } from '../../kiosk/kiosk-flow-state.service';
import { LanguageService } from '../../kiosk/language.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {

  currentLang: 'he' | 'en' = 'he';

  constructor(
    private router: Router,
    public language: LanguageService,
    private kioskFlowService: KioskFlowService
  ) { }

  ngOnInit(): void {
    this.currentLang = this.language.getCurrent() || 'he';

    // home always starts fresh
    this.kioskFlowService.reset();
  }

  setLang(lang: 'he' | 'en'): void {
    this.language.setLanguage(lang);
    this.currentLang = lang;
  }

  onStart(): void {
    // TODO: restore to '/check-in' when visit flow is ready
    this.router.navigateByUrl('/scan');
  }

  onClose(): void {
    // optional
  }
}

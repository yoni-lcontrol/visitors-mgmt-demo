import { Component, OnInit } from '@angular/core';
import { KioskService } from './kiosk/kiosk.service';
import { NetworkService } from './kiosk/status/network.service';
import { LanguageService } from './kiosk/language.service';
import { SignalrService } from './kiosk/signalr.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {

  constructor(
    private kiosk: KioskService,
    private network: NetworkService,
    private languageService: LanguageService,
    private ws: SignalrService,
  ) { }

  ngOnInit(): void {
    this.languageService.init();
    this.network.init();
    this.kiosk.init();
    this.ws.connect();
  }
}

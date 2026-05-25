import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { KioskService } from './kiosk/kiosk.service';
import { NetworkService } from './kiosk/status/network.service';
import { LanguageService } from './kiosk/language.service';
import { KioskSocketService } from './kiosk/kiosk-socket.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {

  constructor(
    private kiosk: KioskService,
    private network: NetworkService,
    private languageService: LanguageService,
    private ws: KioskSocketService,
    private router: Router,
  ) { }

  ngOnInit(): void {
    this.languageService.init();
    this.network.init();
    this.kiosk.init();
    this.ws.connect();

    // Auto-navigate to /scan when a scan result arrives and kiosk isn't already processing one
    this.ws.scanResults$.subscribe(() => {
      const url = this.router.url;
      if (!url.startsWith('/scan') && !url.startsWith('/details') && !url.startsWith('/consent') && !url.startsWith('/success')) {
        this.router.navigateByUrl('/scan');
      }
    });
  }
}

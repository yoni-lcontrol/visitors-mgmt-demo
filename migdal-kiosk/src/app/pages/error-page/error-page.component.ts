import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-error-page',
  templateUrl: './error-page.component.html',
})
export class ErrorPageComponent {
  constructor(private router: Router) { }

  retry(): void {
    this.router.navigateByUrl('/check-in');
  }

  home(): void {
    this.router.navigateByUrl('/home');
  }
}

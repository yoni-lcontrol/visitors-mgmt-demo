import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-visit-not-found',
  templateUrl: './visit-not-found.component.html',
  styleUrls: ['./visit-not-found.component.css']
})
export class VisitNotFoundComponent implements OnInit {

  constructor(private router: Router) { }

  ngOnInit() {
  }

  cancel(): void {
    this.router.navigateByUrl('/home');
  }
}

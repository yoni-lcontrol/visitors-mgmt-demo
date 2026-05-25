import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ErrorPageComponent } from './pages/error-page/error-page.component';
import { HomeComponent } from './pages/home/home.component';
import { SuccessComponent } from './pages/success/success.component';
import { ScanComponent } from './pages/scan/scan.component';
import { DetailsComponent } from './pages/details/details.component';
import { ConsentComponent } from './pages/consent/consent.component';
import { PairGuard } from './pair/pair.guard';
import { PairComponent } from './pair/pair.component';
import { VisitNotFoundComponent } from './pages/visit-not-found/visit-not-found.component';
import { VisitRequiredGuard } from './guards/visit-requried.guard';
import { ScanRequiredGuard } from './guards/scan-required.guard';
import { DetailsConfirmedGuard } from './guards/details-confiremed.guard';

const routes: Routes = [
  { path: 'home', component: HomeComponent },

  { path: 'scan', component: ScanComponent },

  {
    path: 'details', component: DetailsComponent,
    // canActivate: [VisitRequiredGuard, ScanRequiredGuard] 
  },

  {
    path: 'consent', component: ConsentComponent,
    // canActivate: [VisitRequiredGuard, ScanRequiredGuard, DetailsConfirmedGuard]
  },
  {
    path: 'success', component: SuccessComponent,
    // canActivate: [VisitRequiredGuard]
  },

  { path: 'visit-not-found', component: VisitNotFoundComponent },

  { path: 'error', component: ErrorPageComponent },
  { path: 'pair', component: PairComponent, canActivate: [PairGuard] },

  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: '**', redirectTo: 'home' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'enabled' })],
  exports: [RouterModule],
})
export class AppRoutingModule { }

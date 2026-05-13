import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, UrlTree } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class PairGuard implements CanActivate {
    // put this PIN in a safer place if you want (server / build-time).
    private readonly pin = '1234';

    constructor(private router: Router) { }

    canActivate(route: ActivatedRouteSnapshot): boolean | UrlTree {
        const pin = route.queryParamMap.get('pin');
        if (pin === this.pin) return true;

        // If pin missing/wrong -> redirect home
        return this.router.parseUrl('/home');
    }
}

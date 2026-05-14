import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/permissions/permission.guard';

export const VISITS_ROUTES: Routes = [
    {
        path: '',
        loadComponent: () =>
            import('./visits/visit-list.component').then(
                (m) => m.VisitListComponent,
            ),
    },
    {
        path: 'calendar',
        loadComponent: () =>
            import('./calendar/visit-calendar.component').then(
                (m) => m.VisitCalendarComponent,
            ),
    },
    {
        path: 'on-site',
        loadComponent: () =>
            import('./on-site/on-site.component').then(
                (m) => m.OnSiteComponent,
            ),
    },
    {
        path: 'blacklist',
        loadComponent: () =>
            import('./blacklist/blacklist-list.component').then(
                (m) => m.BlacklistListComponent,
            ),
        canActivate: [permissionGuard],
        data: { permission: 'blacklist.read' },
    },
    {
        path: 'parking-requests',
        loadComponent: () =>
            import('./parking/parking-requests.component').then(
                (m) => m.ParkingRequestsComponent,
            ),
        canActivate: [permissionGuard],
        data: { permission: 'parking.approve' },
    },
    {
        path: 'blacklist-overrides',
        loadComponent: () =>
            import('./blacklist-overrides/blacklist-overrides.component').then(
                (m) => m.BlacklistOverridesComponent,
            ),
        canActivate: [permissionGuard],
        data: { permission: 'blacklist.approve' },
    },
    {
        path: 'entrance-exit-logs',
        loadComponent: () =>
            import('./entrance-exit-logs/entrance-exit-logs.component').then(
                (m) => m.EntranceExitLogsComponent,
            ),
    },
    {
        path: ':visitId',
        loadComponent: () =>
            import('./visits/visit-detail.component').then(
                (m) => m.VisitDetailComponent,
            ),
    },
];

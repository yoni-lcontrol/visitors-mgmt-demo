import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { permissionGuard } from './core/permissions/permission.guard';

export const routes: Routes = [
    {
        path: 'login',
        loadChildren: () =>
            import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
    },
    {
        path: 'select-workstation',
        loadComponent: () =>
            import('./features/auth/select-workstation/select-workstation.component').then(
                (m) => m.SelectWorkstationComponent,
            ),
        canActivate: [authGuard],
    },
    {
        path: '',
        loadComponent: () =>
            import('./layout/layout.component').then((m) => m.LayoutComponent),
        canActivate: [authGuard],
        children: [
            { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
            {
                path: 'dashboard',
                loadComponent: () =>
                    import('./features/dashboard/dashboard.component').then(
                        (m) => m.DashboardComponent,
                    ),
            },
            {
                path: 'users',
                loadChildren: () =>
                    import('./features/users/users.routes').then((m) => m.USERS_ROUTES),
                canActivate: [permissionGuard],
                data: { permission: 'users.read' },
            },
            {
                path: 'roles',
                loadChildren: () =>
                    import('./features/roles/roles.routes').then((m) => m.ROLES_ROUTES),
                canActivate: [permissionGuard],
                data: { permission: 'roles.read' },
            },
            {
                path: 'access-control',
                loadChildren: () =>
                    import('./features/access-control/access-control.routes').then(
                        (m) => m.ACCESS_CONTROL_ROUTES,
                    ),
                canActivate: [permissionGuard],
                data: { permission: 'access-control.read' },
            },
            {
                path: 'visits',
                loadChildren: () =>
                    import('./features/visits/visits.routes').then(
                        (m) => m.VISITS_ROUTES,
                    ),
                canActivate: [permissionGuard],
                data: { permission: 'visits.read' },
            },
            {
                path: 'workstations',
                loadChildren: () =>
                    import('./features/workstations/workstations.routes').then(
                        (m) => m.WORKSTATIONS_ROUTES,
                    ),
                canActivate: [permissionGuard],
                data: { permission: 'workstations.read' },
            },
            {
                path: 'settings',
                loadChildren: () =>
                    import('./features/settings/settings.routes').then(
                        (m) => m.SETTINGS_ROUTES,
                    ),
                canActivate: [permissionGuard],
                data: { permission: 'settings.read' },
            },
            {
                path: 'audit',
                loadChildren: () =>
                    import('./features/audit/audit.routes').then(
                        (m) => m.AUDIT_ROUTES,
                    ),
                canActivate: [permissionGuard],
                data: { permission: 'audit.read' },
            },
        ],
    },
    { path: '**', redirectTo: '' },
];

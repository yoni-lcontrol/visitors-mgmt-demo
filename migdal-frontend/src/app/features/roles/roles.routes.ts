import { Routes } from '@angular/router';

export const ROLES_ROUTES: Routes = [
    {
        path: '',
        loadComponent: () =>
            import('./role-list/role-list.component').then(
                (m) => m.RoleListComponent,
            ),
    },
];

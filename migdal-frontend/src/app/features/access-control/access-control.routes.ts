import { Routes } from '@angular/router';

export const ACCESS_CONTROL_ROUTES: Routes = [
    {
        path: '',
        redirectTo: 'controllers',
        pathMatch: 'full',
    },
    {
        path: 'controllers',
        loadComponent: () =>
            import(
                './controllers/controller-list/controller-list.component'
            ).then((m) => m.ControllerListComponent),
    },
    {
        path: 'controllers/:id',
        loadComponent: () =>
            import(
                './controllers/controller-detail/controller-detail.component'
            ).then((m) => m.ControllerDetailComponent),
    },
    {
        path: 'doors',
        loadComponent: () =>
            import('./doors/door-list/door-list.component').then(
                (m) => m.DoorListComponent,
            ),
    },
    {
        path: 'extensions',
        loadComponent: () =>
            import(
                './extensions/extension-list/extension-list.component'
            ).then((m) => m.ExtensionListComponent),
    },
    {
        path: 'import',
        loadComponent: () =>
            import('./import/import.component').then((m) => m.ImportComponent),
    },
    {
        path: 'access-levels',
        loadComponent: () =>
            import(
                './access-levels/access-level-list/access-level-list.component'
            ).then((m) => m.AccessLevelListComponent),
    },
];

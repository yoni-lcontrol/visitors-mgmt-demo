import { TestBed } from '@angular/core/testing';
import { PermissionService } from './permission.service';
import { AuthService } from '../auth/auth.service';

describe('PermissionService', () => {
    let service: PermissionService;
    let authServiceSpy: jasmine.SpyObj<AuthService>;

    beforeEach(() => {
        authServiceSpy = jasmine.createSpyObj('AuthService', [], {
            currentUser: null,
        });

        TestBed.configureTestingModule({
            providers: [
                PermissionService,
                { provide: AuthService, useValue: authServiceSpy },
            ],
        });

        service = TestBed.inject(PermissionService);
    });

    it('should return false when no user is logged in', () => {
        expect(service.hasPermission('users.read')).toBeFalse();
    });

    it('should return true when user has the permission', () => {
        (Object.getOwnPropertyDescriptor(authServiceSpy, 'currentUser')!
            .get as jasmine.Spy).and.returnValue({
                id: 'u1',
                username: 'admin',
                firstName: 'A',
                lastName: 'U',
                roles: ['Admin'],
                permissions: ['users.read', 'users.create'],
            });

        expect(service.hasPermission('users.read')).toBeTrue();
        expect(service.hasPermission('users.create')).toBeTrue();
    });

    it('should return false when user lacks the permission', () => {
        (Object.getOwnPropertyDescriptor(authServiceSpy, 'currentUser')!
            .get as jasmine.Spy).and.returnValue({
                id: 'u1',
                username: 'viewer',
                firstName: 'V',
                lastName: 'U',
                roles: ['Viewer'],
                permissions: ['users.read'],
            });

        expect(service.hasPermission('users.delete')).toBeFalse();
    });

    it('should refresh permission state when user changes', () => {
        // Start with no user
        expect(service.hasPermission('users.read')).toBeFalse();

        // Simulate login — user now has permissions
        (Object.getOwnPropertyDescriptor(authServiceSpy, 'currentUser')!
            .get as jasmine.Spy).and.returnValue({
                id: 'u1',
                username: 'admin',
                firstName: 'A',
                lastName: 'U',
                roles: ['Admin'],
                permissions: ['users.read', 'users.create'],
            });

        expect(service.hasPermission('users.read')).toBeTrue();

        // Simulate logout — no user
        (Object.getOwnPropertyDescriptor(authServiceSpy, 'currentUser')!
            .get as jasmine.Spy).and.returnValue(null);

        expect(service.hasPermission('users.read')).toBeFalse();
    });

    it('hasAnyPermission should return true if at least one matches', () => {
        (Object.getOwnPropertyDescriptor(authServiceSpy, 'currentUser')!
            .get as jasmine.Spy).and.returnValue({
                id: 'u1',
                username: 'admin',
                firstName: 'A',
                lastName: 'U',
                roles: ['Admin'],
                permissions: ['users.read'],
            });

        expect(service.hasAnyPermission(['users.read', 'users.delete'])).toBeTrue();
        expect(service.hasAnyPermission(['users.delete', 'roles.delete'])).toBeFalse();
    });

    it('hasAllPermissions should return true only if all match', () => {
        (Object.getOwnPropertyDescriptor(authServiceSpy, 'currentUser')!
            .get as jasmine.Spy).and.returnValue({
                id: 'u1',
                username: 'admin',
                firstName: 'A',
                lastName: 'U',
                roles: ['Admin'],
                permissions: ['users.read', 'users.create'],
            });

        expect(service.hasAllPermissions(['users.read', 'users.create'])).toBeTrue();
        expect(service.hasAllPermissions(['users.read', 'users.delete'])).toBeFalse();
    });
});

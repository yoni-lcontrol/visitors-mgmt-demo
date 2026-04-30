import { Injectable } from '@angular/core';
import { AuthService } from '../auth/auth.service';

@Injectable({ providedIn: 'root' })
export class PermissionService {
    constructor(private authService: AuthService) { }

    hasPermission(permission: string): boolean {
        const user = this.authService.currentUser;
        if (!user) return false;
        return user.permissions.includes(permission);
    }

    hasAnyPermission(permissions: string[]): boolean {
        return permissions.some((p) => this.hasPermission(p));
    }

    hasAllPermissions(permissions: string[]): boolean {
        return permissions.every((p) => this.hasPermission(p));
    }

    getCurrentUserId(): string | null {
        return this.authService.currentUser?.id ?? null;
    }
}

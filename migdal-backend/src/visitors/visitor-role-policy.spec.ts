import { describe, expect, it } from '@jest/globals';
import { canAccessAllVisitors, shouldRestrictVisitorsToOwn } from './visitor-role-policy';
import { PermissionKey } from '../common/enums/permission-key.enum';

describe('visitor-role-policy', () => {
    describe('canAccessAllVisitors', () => {
        it('returns true when own-scope permission is absent', () => {
            expect(canAccessAllVisitors([PermissionKey.VisitorsRead])).toBe(true);
        });

        it('returns false when own-scope permission is granted', () => {
            expect(canAccessAllVisitors([PermissionKey.VisitorsRead, PermissionKey.VisitorsScopeOwn])).toBe(false);
        });
    });

    describe('shouldRestrictVisitorsToOwn', () => {
        it('returns true when own-scope permission exists', () => {
            expect(shouldRestrictVisitorsToOwn([PermissionKey.VisitorsScopeOwn])).toBe(true);
        });

        it('returns false when own-scope permission is missing', () => {
            expect(shouldRestrictVisitorsToOwn([PermissionKey.VisitorsRead])).toBe(false);
        });
    });
});
import { canAccessAllVisitors, shouldRestrictVisitorsToOwn } from './visitor-role-policy';

describe('visitor-role-policy', () => {
    describe('canAccessAllVisitors', () => {
        it('returns true for desk/security/kabat roles', () => {
            expect(canAccessAllVisitors(['דלפקים'])).toBe(true);
            expect(canAccessAllVisitors(['מוקד ביטחון'])).toBe(true);
            expect(canAccessAllVisitors(['קב"ט'])).toBe(true);
        });

        it('returns false for non full-access roles', () => {
            expect(canAccessAllVisitors(['עובד מגדל'])).toBe(false);
            expect(canAccessAllVisitors(['מנהלים בכירים ומזכירות'])).toBe(false);
        });
    });

    describe('shouldRestrictVisitorsToOwn', () => {
        it('returns true for regular and secretary/manager-like roles', () => {
            expect(shouldRestrictVisitorsToOwn(['עובד מגדל'])).toBe(true);
            expect(shouldRestrictVisitorsToOwn(['מנהלים בכירים ומזכירות'])).toBe(true);
            expect(shouldRestrictVisitorsToOwn(['מנהלי תחום'])).toBe(true);
            expect(shouldRestrictVisitorsToOwn(['מרכז הדרכות'])).toBe(true);
        });

        it('returns false for full-access roles', () => {
            expect(shouldRestrictVisitorsToOwn(['דלפקים'])).toBe(false);
            expect(shouldRestrictVisitorsToOwn(['מוקד ביטחון'])).toBe(false);
            expect(shouldRestrictVisitorsToOwn(['קב"ט'])).toBe(false);
        });

        it('returns false when no matching roles exist', () => {
            expect(shouldRestrictVisitorsToOwn(['Viewer'])).toBe(false);
        });
    });
});
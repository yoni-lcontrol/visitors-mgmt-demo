import {
    isEscortRequiredForVisit,
    isOnBehalfOnlyRole,
    resolveCreatorScopeRequirements,
    shouldRestrictDeletionToOwnVisits,
} from './visit-role-policy';

describe('visit-role-policy', () => {
    describe('isEscortRequiredForVisit', () => {
        it('requires escort for tower employee', () => {
            expect(isEscortRequiredForVisit(['עובד מגדל'], true)).toBe(true);
            expect(isEscortRequiredForVisit(['עובד מגדל'], false)).toBe(true);
        });

        it('requires escort for security desk only on self requester', () => {
            expect(isEscortRequiredForVisit(['מוקד ביטחון'], true)).toBe(true);
            expect(isEscortRequiredForVisit(['מוקד ביטחון'], false)).toBe(false);
        });

        it('does not require escort for roles without the policy', () => {
            expect(isEscortRequiredForVisit(['קב"ט'], true)).toBe(false);
        });
    });

    describe('isOnBehalfOnlyRole', () => {
        it('enables on-behalf-only for reception desk and kabat', () => {
            expect(isOnBehalfOnlyRole(['דלפקים'])).toBe(true);
            expect(isOnBehalfOnlyRole(['קב"ט'])).toBe(true);
        });

        it('does not enable on-behalf-only for other roles', () => {
            expect(isOnBehalfOnlyRole(['מוקד ביטחון'])).toBe(false);
        });
    });

    describe('resolveCreatorScopeRequirements', () => {
        it('returns self scope for tower employee', () => {
            expect(resolveCreatorScopeRequirements(['עובד מגדל'])).toEqual({
                includeCurrentUser: true,
                includeTrainingCenterUsers: false,
            });
        });

        it('returns training-center scope when role exists', () => {
            expect(resolveCreatorScopeRequirements(['מרכז הדרכות'])).toEqual({
                includeCurrentUser: false,
                includeTrainingCenterUsers: true,
            });
        });

        it('returns combined scope for users with both roles', () => {
            expect(resolveCreatorScopeRequirements(['עובד מגדל', 'מרכז הדרכות'])).toEqual({
                includeCurrentUser: true,
                includeTrainingCenterUsers: true,
            });
        });

        it('returns null for unrestricted roles', () => {
            expect(resolveCreatorScopeRequirements(['קב"ט'])).toBeNull();
        });
    });

    describe('shouldRestrictDeletionToOwnVisits', () => {
        it('restricts deletion for reception desk only', () => {
            expect(shouldRestrictDeletionToOwnVisits(['דלפקים'])).toBe(true);
            expect(shouldRestrictDeletionToOwnVisits(['קב"ט'])).toBe(false);
        });
    });
});

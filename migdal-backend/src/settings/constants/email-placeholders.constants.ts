/**
 * Supported placeholders for email templates.
 * Shared with SMS — same data model.
 */
export const EMAIL_PLACEHOLDERS = [
    '{{visit.title}}',
    '{{visit.startTime}}',
    '{{visit.endTime}}',
    '{{visit.hostName}}',
    '{{visit.siteName}}',
    '{{visit.purposeOfVisit}}',
    '{{visitor.firstName}}',
    '{{visitor.lastName}}',
    '{{visitor.personId}}',
    '{{visitor.phone}}',
    '{{visitor.company}}',
    '{{visitor.carNumber}}',
    '{{visitor.checkInCode}}',
    '{{parking.status}}',
    '{{parking.reviewNote}}',
] as const;

export type EmailPlaceholder = (typeof EMAIL_PLACEHOLDERS)[number];

/** Regex that matches any {{...}} placeholder token */
export const EMAIL_PLACEHOLDER_REGEX = /\{\{[a-zA-Z0-9_.]+\}\}/g;

/** Regex that matches only valid placeholders */
export const VALID_EMAIL_PLACEHOLDER_REGEX = new RegExp(
    EMAIL_PLACEHOLDERS.map((p) => p.replace(/[{}().]/g, '\\$&')).join('|'),
    'g',
);

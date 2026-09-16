/**
 * Supported placeholders for SMS templates.
 * Used for validation and documentation.
 */
export const SMS_PLACEHOLDERS = [
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
    '{{requester.firstName}}',
    '{{requester.lastName}}',
    '{{createdBy.firstName}}',
    '{{createdBy.lastName}}',
] as const;

export type SmsPlaceholder = (typeof SMS_PLACEHOLDERS)[number];

/** Regex that matches any {{...}} placeholder token */
export const PLACEHOLDER_REGEX = /\{\{[a-zA-Z0-9_.]+\}\}/g;

/** Regex that matches only valid placeholders */
export const VALID_PLACEHOLDER_REGEX = new RegExp(
    SMS_PLACEHOLDERS.map((p) => p.replace(/[{}().]/g, '\\$&')).join('|'),
    'g',
);

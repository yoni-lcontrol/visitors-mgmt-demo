const TARGET_GROUPS = ['system_users', 'visitors', 'escorts', 'visit_requester'] as const;

const baseTemplates: { event: string; template: string }[] = [
    {
        event: 'visitor_arrived',
        template:
            'שלום {{visitor.firstName}}, הגעת לביקור ב{{visit.siteName}}. המארח שלך: {{visit.hostName}}. קוד כניסה: {{visitor.checkInCode}}',
    },
    {
        event: 'visit_created',
        template:
            'שלום {{visitor.firstName}} {{visitor.lastName}}, נקבע לך ביקור ב{{visit.siteName}} בתאריך {{visit.startTime}}. המארח: {{visit.hostName}}. מטרת הביקור: {{visit.purposeOfVisit}}',
    },
    {
        event: 'visit_updated',
        template:
            'שלום {{visitor.firstName}}, הביקור שלך ב{{visit.siteName}} עודכן. תאריך: {{visit.startTime}}. המארח: {{visit.hostName}}',
    },
    {
        event: 'visitor_deleted',
        template:
            'שלום {{visitor.firstName}}, הביקור שלך ב{{visit.siteName}} בתאריך {{visit.startTime}} בוטל',
    },
    {
        event: 'visitor_blacklisted',
        template:
            'שלום, המבקר {{visitor.firstName}} {{visitor.lastName}} (ת.ז. {{visitor.personId}}) נחסם מכניסה ל{{visit.siteName}}',
    },
    {
        event: 'check_in_code_sent',
        template:
            'שלום {{visitor.firstName}}, קוד הכניסה שלך לביקור ב{{visit.siteName}} הוא: {{visitor.checkInCode}}. המארח: {{visit.hostName}}',
    },
    {
        event: 'parking_request_decision',
        template:
            'שלום, בקשת החנייה עבור {{visitor.firstName}} {{visitor.lastName}} (רכב {{visitor.carNumber}}) לביקור "{{visit.title}}" {{parking.status}}',
    },
    {
        event: 'visitor_checked_out',
        template:
            'שלום, המבקר {{visitor.firstName}} {{visitor.lastName}} יצא מ{{visit.siteName}}. ביקור: {{visit.title}}. מארח: {{visit.hostName}}',
    },
    {
        event: 'visitor_overstay',
        template:
            'שימו לב: המבקר {{visitor.firstName}} {{visitor.lastName}} טרם יצא מ{{visit.siteName}}. הביקור "{{visit.title}}" הסתיים ב{{visit.endTime}}. מארח: {{visit.hostName}}',
    },
];

/** Generates one SMS template per (event × targetGroup) combination. */
export const smsTemplatesSeed = baseTemplates.flatMap((t) =>
    TARGET_GROUPS.map((group) => ({
        event: t.event,
        targetGroup: group,
        template: t.template,
    })),
);

const TARGET_GROUPS = ['visit_creator', 'visitors', 'escorts', 'visit_requester'] as const;

/** Events seeded with the same generic text for every target group. */
const baseTemplates: { event: string; template: string }[] = [
    {
        event: 'visit_updated',
        template:
            'שלום {{visitor.firstName}}, הביקור שלך ב{{visit.siteName}} עודכן. תאריך: {{visit.startTime}}. המארח: {{visit.hostName}}',
    },
    {
        event: 'visit_deleted',
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
];

/** Events with content that differs per target group (recipient is greeted by their own name). */
const perGroupTemplates: { event: string; targetGroup: (typeof TARGET_GROUPS)[number]; template: string }[] = [
    {
        event: 'visit_created',
        targetGroup: 'visit_creator',
        template:
            'שלום {{createdBy.firstName}}, הפגישה עם {{visitor.firstName}} {{visitor.lastName}} תיערך בתאריך {{visit.startTime}}. תודה ויום טוב.',
    },
    {
        event: 'visit_created',
        targetGroup: 'visit_requester',
        template:
            'שלום {{requester.firstName}}, הפגישה עם {{visitor.firstName}} {{visitor.lastName}} תיערך בתאריך {{visit.startTime}}. תודה ויום טוב.',
    },
    {
        event: 'visit_created',
        targetGroup: 'visitors',
        template:
            'שלום {{visitor.firstName}}, הפגישה עם {{visit.hostName}} תיערך במשרדי מגדל, רחוב היצירה 2, פתח תקווה. פרטי הפגישה: {{visit.startTime}}. נבקש להגיע עם תעודת זהות. תודה ויום טוב. (אם יש חניה, פרטי החניה- לחניון העליון ברחוב היצירה 2)',
    },
    {
        event: 'parking_approved',
        targetGroup: 'visit_creator',
        template:
            'שלום {{createdBy.firstName}}, אושרה חנייה לקראת הפגישה עם {{visitor.firstName}} {{visitor.lastName}} בחניון העליון ברחוב היצירה 2. פרטי הפגישה: {{visit.startTime}}. תודה ויום טוב.',
    },
    {
        event: 'parking_rejected',
        targetGroup: 'visit_creator',
        template:
            'שלום {{createdBy.firstName}}, חיפשנו ולא מצאנו מקום חנייה פנוי עבור {{visitor.firstName}} {{visitor.lastName}}. סליחה ויום טוב.',
    },
    {
        event: 'visitor_arrived_with_escort',
        targetGroup: 'visit_creator',
        template:
            'שלום {{createdBy.firstName}}, אנו מבקשים לעדכן על הגעת {{visitor.firstName}} {{visitor.lastName}} לבניין מגדל. נבקש לאסוף את האורח/ת מהלובי. תודה ויום טוב.',
    },
    {
        event: 'visitor_arrived_with_escort',
        targetGroup: 'visit_requester',
        template:
            'שלום {{requester.firstName}}, אנו מבקשים לעדכן על הגעת {{visitor.firstName}} {{visitor.lastName}} לבניין מגדל. נבקש לאסוף את האורח/ת מהלובי. תודה ויום טוב.',
    },
    {
        event: 'visitor_arrived_without_escort',
        targetGroup: 'visit_creator',
        template:
            'שלום {{createdBy.firstName}}, אנו מבקשים לעדכן על הגעת {{visitor.firstName}} {{visitor.lastName}} לבניין מגדל. תודה ויום טוב.',
    },
    {
        event: 'visitor_arrived_without_escort',
        targetGroup: 'visit_requester',
        template:
            'שלום {{requester.firstName}}, אנו מבקשים לעדכן על הגעת {{visitor.firstName}} {{visitor.lastName}} לבניין מגדל. תודה ויום טוב.',
    },
    {
        event: 'visitor_checked_out',
        targetGroup: 'visit_requester',
        template:
            'שלום {{requester.firstName}}, אנו מבקשים לעדכן על עזיבת {{visitor.firstName}} {{visitor.lastName}} את משרדי מגדל. המשך יום טוב.',
    },
    {
        event: 'visitor_checked_out',
        targetGroup: 'visit_creator',
        template:
            'שלום {{createdBy.firstName}}, אנו מבקשים לעדכן על עזיבת {{visitor.firstName}} {{visitor.lastName}} את משרדי מגדל. המשך יום טוב.',
    },
    {
        event: 'visitor_overstay',
        targetGroup: 'visit_requester',
        template:
            'שלום {{requester.firstName}}, אנו מבקשים לעדכן כי {{visitor.firstName}} {{visitor.lastName}} טרם עזב/ה את משרדי מגדל. נבקש ליצור קשר עם מוקד ביטחון בטלפון 5555555555. תודה ויום טוב.',
    },
    {
        event: 'visitor_overstay',
        targetGroup: 'visit_creator',
        template:
            'שלום {{createdBy.firstName}}, אנו מבקשים לעדכן כי {{visitor.firstName}} {{visitor.lastName}} טרם עזב/ה את משרדי מגדל. נבקש ליצור קשר עם מוקד ביטחון בטלפון 5555555555. תודה ויום טוב.',
    },
    {
        event: 'parking_approved',
        targetGroup: 'visit_requester',
        template:
            'שלום {{requester.firstName}}, אושרה חנייה לקראת הפגישה עם {{visitor.firstName}} {{visitor.lastName}} בחניון העליון ברחוב היצירה 2. פרטי הפגישה: {{visit.startTime}}. תודה ויום טוב.',
    },
    {
        event: 'parking_rejected',
        targetGroup: 'visit_requester',
        template:
            'שלום {{requester.firstName}}, חיפשנו ולא מצאנו מקום חנייה פנוי עבור {{visitor.firstName}} {{visitor.lastName}}. סליחה ויום טוב.',
    },
];

/** Generates one SMS template per (event × targetGroup) combination. */
export const smsTemplatesSeed = [
    ...baseTemplates.flatMap((t) =>
        TARGET_GROUPS.map((group) => ({
            event: t.event,
            targetGroup: group,
            template: t.template,
        })),
    ),
    ...perGroupTemplates,
];

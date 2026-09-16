const TARGET_GROUPS = ['visit_creator', 'visitors', 'escorts', 'visit_requester'] as const;

/** Events seeded with the same generic text for every target group. */
const baseTemplates: { event: string; subject: string; bodyHtml: string }[] = [
    {
        event: 'visit_updated',
        subject: 'ביקור עודכן: {{visit.title}}',
        bodyHtml:
            '<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#020140;border-bottom:2px solid #f0ad4e;padding-bottom:10px">ביקור עודכן</h2><table style="width:100%;border-collapse:collapse"><tr><td style="padding:8px 0;font-weight:bold;color:#555">כותרת:</td><td style="padding:8px 0">{{visit.title}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">מועד:</td><td style="padding:8px 0">{{visit.startTime}} - {{visit.endTime}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">מארח:</td><td style="padding:8px 0">{{visit.hostName}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">אתר:</td><td style="padding:8px 0">{{visit.siteName}}</td></tr></table></div>',
    },
    {
        event: 'visit_deleted',
        subject: 'ביקור בוטל: {{visit.title}}',
        bodyHtml:
            '<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#d9534f;border-bottom:2px solid #d9534f;padding-bottom:10px">ביקור בוטל</h2><p style="font-size:16px">הביקור <strong>{{visit.title}}</strong> בוטל.</p><table style="width:100%;border-collapse:collapse"><tr><td style="padding:8px 0;font-weight:bold;color:#555">מועד מתוכנן:</td><td style="padding:8px 0">{{visit.startTime}} - {{visit.endTime}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">מארח:</td><td style="padding:8px 0">{{visit.hostName}}</td></tr></table></div>',
    },
    {
        event: 'visitor_blacklisted',
        subject: 'אזהרה: מבקר ברשימה שחורה הגיע!',
        bodyHtml:
            '<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#fff;background:#d9534f;padding:15px;border-radius:6px;text-align:center">אזהרה: מבקר ברשימה שחורה!</h2><table style="width:100%;border-collapse:collapse;margin-top:15px"><tr><td style="padding:8px 0;font-weight:bold;color:#555">שם:</td><td style="padding:8px 0;color:#d9534f;font-weight:bold">{{visitor.firstName}} {{visitor.lastName}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">ת.ז.:</td><td style="padding:8px 0">{{visitor.personId}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">ביקור:</td><td style="padding:8px 0">{{visit.title}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">מארח:</td><td style="padding:8px 0">{{visit.hostName}}</td></tr></table></div>',
    },
    {
        event: 'check_in_code_sent',
        subject: 'קוד כניסה לביקור ב{{visit.siteName}}',
        bodyHtml:
            '<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#020140;border-bottom:2px solid #6c63ff;padding-bottom:10px">קוד כניסה לביקור</h2><p style="font-size:16px">שלום {{visitor.firstName}}, להלן קוד הכניסה שלך:</p><table style="width:100%;border-collapse:collapse"><tr><td style="padding:8px 0;font-weight:bold;color:#555">אתר:</td><td style="padding:8px 0">{{visit.siteName}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">מארח:</td><td style="padding:8px 0">{{visit.hostName}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">תאריך:</td><td style="padding:8px 0">{{visit.startTime}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">קוד כניסה:</td><td style="padding:8px 0;font-size:22px;font-weight:700;letter-spacing:4px;color:#6c63ff">{{visitor.checkInCode}}</td></tr></table></div>',
    },
];

/** Events with content that differs per target group (recipient is greeted by their own name). */
const perGroupTemplates: { event: string; targetGroup: (typeof TARGET_GROUPS)[number]; subject: string; bodyHtml: string }[] = [
    {
        event: 'visit_created',
        targetGroup: 'visit_creator',
        subject: 'פגישה חדשה נקבעה: {{visitor.firstName}} {{visitor.lastName}}',
        bodyHtml:
            '<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#020140;border-bottom:2px solid #6c63ff;padding-bottom:10px">פגישה חדשה נקבעה</h2><p style="font-size:16px">שלום {{createdBy.firstName}}, הפגישה עם {{visitor.firstName}} {{visitor.lastName}} תיערך בתאריך {{visit.startTime}}.</p><table style="width:100%;border-collapse:collapse"><tr><td style="padding:8px 0;font-weight:bold;color:#555">כותרת:</td><td style="padding:8px 0">{{visit.title}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">אתר:</td><td style="padding:8px 0">{{visit.siteName}}</td></tr></table></div>',
    },
    {
        event: 'visit_created',
        targetGroup: 'visit_requester',
        subject: 'פגישה חדשה נקבעה: {{visitor.firstName}} {{visitor.lastName}}',
        bodyHtml:
            '<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#020140;border-bottom:2px solid #6c63ff;padding-bottom:10px">פגישה חדשה נקבעה</h2><p style="font-size:16px">שלום {{requester.firstName}}, הפגישה עם {{visitor.firstName}} {{visitor.lastName}} תיערך בתאריך {{visit.startTime}}.</p><table style="width:100%;border-collapse:collapse"><tr><td style="padding:8px 0;font-weight:bold;color:#555">כותרת:</td><td style="padding:8px 0">{{visit.title}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">אתר:</td><td style="padding:8px 0">{{visit.siteName}}</td></tr></table></div>',
    },
    {
        event: 'visit_created',
        targetGroup: 'visitors',
        subject: 'הזמנה לפגישה במגדל',
        bodyHtml:
            '<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#020140;border-bottom:2px solid #6c63ff;padding-bottom:10px">הזמנה לפגישה</h2><p style="font-size:16px">שלום {{visitor.firstName}}, הפגישה עם {{visit.hostName}} תיערך במשרדי מגדל, רחוב היצירה 2, פתח תקווה. נבקש להגיע עם תעודת זהות. (אם יש חניה, פרטי החניה- לחניון העליון ברחוב היצירה 2)</p><table style="width:100%;border-collapse:collapse"><tr><td style="padding:8px 0;font-weight:bold;color:#555">פרטי הפגישה:</td><td style="padding:8px 0">{{visit.startTime}}</td></tr></table></div>',
    },
    {
        event: 'parking_approved',
        targetGroup: 'visit_creator',
        subject: 'אושרה חנייה: {{visitor.firstName}} {{visitor.lastName}}',
        bodyHtml:
            '<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#020140;border-bottom:2px solid #5cb85c;padding-bottom:10px">אושרה חנייה</h2><p style="font-size:16px">שלום {{createdBy.firstName}}, אושרה חנייה לקראת הפגישה עם {{visitor.firstName}} {{visitor.lastName}} בחניון העליון ברחוב היצירה 2.</p><table style="width:100%;border-collapse:collapse"><tr><td style="padding:8px 0;font-weight:bold;color:#555">פרטי הפגישה:</td><td style="padding:8px 0">{{visit.startTime}}</td></tr></table></div>',
    },
    {
        event: 'parking_rejected',
        targetGroup: 'visit_creator',
        subject: 'לא נמצא מקום חנייה: {{visitor.firstName}} {{visitor.lastName}}',
        bodyHtml:
            '<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#020140;border-bottom:2px solid #d9534f;padding-bottom:10px">לא נמצא מקום חנייה</h2><p style="font-size:16px">שלום {{createdBy.firstName}}, חיפשנו ולא מצאנו מקום חנייה פנוי עבור {{visitor.firstName}} {{visitor.lastName}}. סליחה ויום טוב.</p></div>',
    },
    {
        event: 'visitor_arrived_with_escort',
        targetGroup: 'visit_creator',
        subject: 'מבקר הגיע - נדרש ליווי: {{visitor.firstName}} {{visitor.lastName}}',
        bodyHtml:
            '<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#5cb85c;border-bottom:2px solid #5cb85c;padding-bottom:10px">מבקר הגיע - נדרש ליווי</h2><p style="font-size:16px">שלום {{createdBy.firstName}}, אנו מבקשים לעדכן על הגעת {{visitor.firstName}} {{visitor.lastName}} לבניין מגדל. נבקש לאסוף את האורח/ת מהלובי.</p></div>',
    },
    {
        event: 'visitor_arrived_with_escort',
        targetGroup: 'visit_requester',
        subject: 'מבקר הגיע - נדרש ליווי: {{visitor.firstName}} {{visitor.lastName}}',
        bodyHtml:
            '<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#5cb85c;border-bottom:2px solid #5cb85c;padding-bottom:10px">מבקר הגיע - נדרש ליווי</h2><p style="font-size:16px">שלום {{requester.firstName}}, אנו מבקשים לעדכן על הגעת {{visitor.firstName}} {{visitor.lastName}} לבניין מגדל. נבקש לאסוף את האורח/ת מהלובי.</p></div>',
    },
    {
        event: 'visitor_arrived_without_escort',
        targetGroup: 'visit_creator',
        subject: 'מבקר הגיע - לא נדרש ליווי: {{visitor.firstName}} {{visitor.lastName}}',
        bodyHtml:
            '<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#5cb85c;border-bottom:2px solid #5cb85c;padding-bottom:10px">מבקר הגיע - לא נדרש ליווי</h2><p style="font-size:16px">שלום {{createdBy.firstName}}, אנו מבקשים לעדכן על הגעת {{visitor.firstName}} {{visitor.lastName}} לבניין מגדל.</p></div>',
    },
    {
        event: 'visitor_arrived_without_escort',
        targetGroup: 'visit_requester',
        subject: 'מבקר הגיע - לא נדרש ליווי: {{visitor.firstName}} {{visitor.lastName}}',
        bodyHtml:
            '<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#5cb85c;border-bottom:2px solid #5cb85c;padding-bottom:10px">מבקר הגיע - לא נדרש ליווי</h2><p style="font-size:16px">שלום {{requester.firstName}}, אנו מבקשים לעדכן על הגעת {{visitor.firstName}} {{visitor.lastName}} לבניין מגדל.</p></div>',
    },
    {
        event: 'visitor_checked_out',
        targetGroup: 'visit_requester',
        subject: 'מבקר עזב: {{visitor.firstName}} {{visitor.lastName}}',
        bodyHtml:
            '<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#020140;border-bottom:2px solid #5cb85c;padding-bottom:10px">מבקר עזב את הבניין</h2><p style="font-size:16px">שלום {{requester.firstName}}, אנו מבקשים לעדכן על עזיבת {{visitor.firstName}} {{visitor.lastName}} את משרדי מגדל. המשך יום טוב.</p></div>',
    },
    {
        event: 'visitor_checked_out',
        targetGroup: 'visit_creator',
        subject: 'מבקר עזב: {{visitor.firstName}} {{visitor.lastName}}',
        bodyHtml:
            '<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#020140;border-bottom:2px solid #5cb85c;padding-bottom:10px">מבקר עזב את הבניין</h2><p style="font-size:16px">שלום {{createdBy.firstName}}, אנו מבקשים לעדכן על עזיבת {{visitor.firstName}} {{visitor.lastName}} את משרדי מגדל. המשך יום טוב.</p></div>',
    },
    {
        event: 'visitor_overstay',
        targetGroup: 'visit_requester',
        subject: 'שימו לב: מבקר טרם עזב - {{visitor.firstName}} {{visitor.lastName}}',
        bodyHtml:
            '<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#e65100;border-bottom:2px solid #e65100;padding-bottom:10px">מבקר טרם עזב את הבניין</h2><p style="font-size:16px">שלום {{requester.firstName}}, אנו מבקשים לעדכן כי {{visitor.firstName}} {{visitor.lastName}} טרם עזב/ה את משרדי מגדל. נבקש ליצור קשר עם מוקד ביטחון בטלפון 5555555555.</p></div>',
    },
    {
        event: 'visitor_overstay',
        targetGroup: 'visit_creator',
        subject: 'שימו לב: מבקר טרם עזב - {{visitor.firstName}} {{visitor.lastName}}',
        bodyHtml:
            '<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#e65100;border-bottom:2px solid #e65100;padding-bottom:10px">מבקר טרם עזב את הבניין</h2><p style="font-size:16px">שלום {{createdBy.firstName}}, אנו מבקשים לעדכן כי {{visitor.firstName}} {{visitor.lastName}} טרם עזב/ה את משרדי מגדל. נבקש ליצור קשר עם מוקד ביטחון בטלפון 5555555555.</p></div>',
    },
    {
        event: 'parking_approved',
        targetGroup: 'visit_requester',
        subject: 'אושרה חנייה: {{visitor.firstName}} {{visitor.lastName}}',
        bodyHtml:
            '<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#020140;border-bottom:2px solid #5cb85c;padding-bottom:10px">אושרה חנייה</h2><p style="font-size:16px">שלום {{requester.firstName}}, אושרה חנייה לקראת הפגישה עם {{visitor.firstName}} {{visitor.lastName}} בחניון העליון ברחוב היצירה 2.</p><table style="width:100%;border-collapse:collapse"><tr><td style="padding:8px 0;font-weight:bold;color:#555">פרטי הפגישה:</td><td style="padding:8px 0">{{visit.startTime}}</td></tr></table></div>',
    },
    {
        event: 'parking_rejected',
        targetGroup: 'visit_requester',
        subject: 'לא נמצא מקום חנייה: {{visitor.firstName}} {{visitor.lastName}}',
        bodyHtml:
            '<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#020140;border-bottom:2px solid #d9534f;padding-bottom:10px">לא נמצא מקום חנייה</h2><p style="font-size:16px">שלום {{requester.firstName}}, חיפשנו ולא מצאנו מקום חנייה פנוי עבור {{visitor.firstName}} {{visitor.lastName}}. סליחה ויום טוב.</p></div>',
    },
];

/** Generates one email template per (event × targetGroup) combination. */
export const emailTemplatesSeed = [
    ...baseTemplates.flatMap((t) =>
        TARGET_GROUPS.map((group) => ({
            event: t.event,
            targetGroup: group,
            subject: t.subject,
            bodyHtml: t.bodyHtml,
        })),
    ),
    ...perGroupTemplates,
];

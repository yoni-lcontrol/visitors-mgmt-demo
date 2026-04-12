const TARGET_GROUPS = ['system_users', 'visitors', 'escorts', 'visit_requester'] as const;

const baseTemplates: { event: string; subject: string; bodyHtml: string }[] = [
    {
        event: 'visit_created',
        subject: 'ביקור חדש: {{visit.title}}',
        bodyHtml:
            '<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#020140;border-bottom:2px solid #6c63ff;padding-bottom:10px">ביקור חדש נוצר</h2><table style="width:100%;border-collapse:collapse"><tr><td style="padding:8px 0;font-weight:bold;color:#555">כותרת:</td><td style="padding:8px 0">{{visit.title}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">תאריך התחלה:</td><td style="padding:8px 0">{{visit.startTime}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">תאריך סיום:</td><td style="padding:8px 0">{{visit.endTime}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">מארח:</td><td style="padding:8px 0">{{visit.hostName}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">אתר:</td><td style="padding:8px 0">{{visit.siteName}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">מבקר:</td><td style="padding:8px 0">{{visitor.firstName}} {{visitor.lastName}}</td></tr></table></div>',
    },
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
        event: 'visitor_arrived',
        subject: 'מבקר הגיע: {{visitor.firstName}} {{visitor.lastName}}',
        bodyHtml:
            '<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#5cb85c;border-bottom:2px solid #5cb85c;padding-bottom:10px">מבקר הגיע</h2><table style="width:100%;border-collapse:collapse"><tr><td style="padding:8px 0;font-weight:bold;color:#555">שם:</td><td style="padding:8px 0">{{visitor.firstName}} {{visitor.lastName}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">ת.ז.:</td><td style="padding:8px 0">{{visitor.personId}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">ביקור:</td><td style="padding:8px 0">{{visit.title}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">מארח:</td><td style="padding:8px 0">{{visit.hostName}}</td></tr></table></div>',
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
    {
        event: 'parking_request_decision',
        subject: 'החלטת בקשת חנייה: {{visitor.firstName}} {{visitor.lastName}} - {{parking.status}}',
        bodyHtml:
            '<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#020140;border-bottom:2px solid #4527a0;padding-bottom:10px">החלטה על בקשת חנייה</h2><table style="width:100%;border-collapse:collapse"><tr><td style="padding:8px 0;font-weight:bold;color:#555">סטטוס:</td><td style="padding:8px 0;font-weight:600">{{parking.status}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">מבקר:</td><td style="padding:8px 0">{{visitor.firstName}} {{visitor.lastName}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">מספר רכב:</td><td style="padding:8px 0">{{visitor.carNumber}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">ביקור:</td><td style="padding:8px 0">{{visit.title}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">מארח:</td><td style="padding:8px 0">{{visit.hostName}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">הערה:</td><td style="padding:8px 0">{{parking.reviewNote}}</td></tr></table></div>',
    },
    {
        event: 'visitor_checked_out',
        subject: 'מבקר יצא: {{visitor.firstName}} {{visitor.lastName}} - {{visit.title}}',
        bodyHtml:
            '<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#020140;border-bottom:2px solid #5cb85c;padding-bottom:10px">מבקר יצא מהאתר</h2><table style="width:100%;border-collapse:collapse"><tr><td style="padding:8px 0;font-weight:bold;color:#555">שם:</td><td style="padding:8px 0">{{visitor.firstName}} {{visitor.lastName}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">ת.ז.:</td><td style="padding:8px 0">{{visitor.personId}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">ביקור:</td><td style="padding:8px 0">{{visit.title}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">אתר:</td><td style="padding:8px 0">{{visit.siteName}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">מארח:</td><td style="padding:8px 0">{{visit.hostName}}</td></tr></table></div>',
    },
    {
        event: 'visitor_overstay',
        subject: 'שימו לב: מבקר טרם יצא - {{visitor.firstName}} {{visitor.lastName}} - {{visit.title}}',
        bodyHtml:
            '<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#e65100;border-bottom:2px solid #e65100;padding-bottom:10px">מבקר טרם יצא מהאתר</h2><table style="width:100%;border-collapse:collapse"><tr><td style="padding:8px 0;font-weight:bold;color:#555">שם:</td><td style="padding:8px 0">{{visitor.firstName}} {{visitor.lastName}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">ת.ז.:</td><td style="padding:8px 0">{{visitor.personId}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">ביקור:</td><td style="padding:8px 0">{{visit.title}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">שעת סיום מתוכננת:</td><td style="padding:8px 0">{{visit.endTime}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">אתר:</td><td style="padding:8px 0">{{visit.siteName}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">מארח:</td><td style="padding:8px 0">{{visit.hostName}}</td></tr></table></div>',
    },
];

/** Generates one email template per (event × targetGroup) combination. */
export const emailTemplatesSeed = baseTemplates.flatMap((t) =>
    TARGET_GROUPS.map((group) => ({
        event: t.event,
        targetGroup: group,
        subject: t.subject,
        bodyHtml: t.bodyHtml,
    })),
);

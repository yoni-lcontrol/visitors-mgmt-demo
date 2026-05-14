export interface PrintVisitorCard {
    Template: {
        TemplateJson: string | undefined
    },
    FullName: string;
    Department: string;
    CardNumber: string;
    Title: string;
    QrValue: string;
    Image: string;
}
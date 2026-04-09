import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { EmailTemplateRendererService } from './email-template-renderer.service';
import { EmailProviderService } from './email-provider.service';

export interface EmailTemplateFile {
    event: string;
    subject: string;
    bodyHtml: string;
}

const EVENT_BADGES: Record<string, { text: string; bg: string; color: string }> = {
    visit_created: { text: 'ביקור חדש', bg: '#e8f5e9', color: '#2e7d32' },
    visit_updated: { text: 'ביקור עודכן', bg: '#fff3e0', color: '#e65100' },
    visit_deleted: { text: 'ביקור בוטל', bg: '#fce4ec', color: '#c62828' },
    visitor_arrived: { text: 'מבקר הגיע', bg: '#e3f2fd', color: '#1565c0' },
    visitor_blacklisted: { text: 'אזהרת אבטחה', bg: '#fce4ec', color: '#c62828' },
    parking_request_decision: { text: 'החלטת חנייה', bg: '#ede7f6', color: '#4527a0' },
    visitor_checked_out: { text: 'מבקר יצא', bg: '#e8f5e9', color: '#2e7d32' },
    visitor_overstay: { text: 'מבקר לא יצא', bg: '#fff3e0', color: '#e65100' },
};

@Injectable()
export class EmailTemplateService {
    private readonly logger = new Logger(EmailTemplateService.name);
    private readonly templatesDir: string;
    private readonly recipients: string[];
    private readonly layout: string | null;

    constructor(
        private readonly renderer: EmailTemplateRendererService,
        private readonly provider: EmailProviderService,
        private readonly config: ConfigService,
    ) {
        this.templatesDir = path.join(__dirname, 'email-templates');
        const raw = this.config.get<string>('EMAIL_RECIPIENTS', '');
        this.recipients = raw
            .split(',')
            .map((r) => r.trim())
            .filter(Boolean);
        this.layout = this.loadLayout();
    }

    getRecipients(): string[] {
        return [...this.recipients];
    }

    findAll(): EmailTemplateFile[] {
        const events = this.listEvents();
        return events.map((event) => this.loadTemplate(event)).filter(Boolean) as EmailTemplateFile[];
    }

    loadTemplate(event: string): EmailTemplateFile | null {
        const dir = path.join(this.templatesDir, event);
        const subjectPath = path.join(dir, 'subject.txt');
        const bodyPath = path.join(dir, 'body.html');

        if (!fs.existsSync(subjectPath) || !fs.existsSync(bodyPath)) {
            this.logger.debug(`Template files missing for event ${event}`);
            return null;
        }

        const subject = fs.readFileSync(subjectPath, 'utf-8').trim();
        const bodyContent = fs.readFileSync(bodyPath, 'utf-8');
        const bodyHtml = this.wrapInLayout(bodyContent, subject, event);

        return { event, subject, bodyHtml };
    }

    preview(event: string, customSubject?: string, customBodyHtml?: string): { renderedSubject: string; renderedBody: string; placeholders: string[] } {
        let subject = customSubject;
        let bodyHtml = customBodyHtml;

        if (!subject || !bodyHtml) {
            const template = this.loadTemplate(event);
            subject = subject ?? template?.subject ?? '';
            bodyHtml = bodyHtml ?? template?.bodyHtml ?? '';
        }

        this.renderer.validateTemplate(subject);
        this.renderer.validateTemplate(bodyHtml);
        const sampleData = this.renderer.getSampleData();

        return {
            renderedSubject: this.renderer.render(subject, sampleData),
            renderedBody: this.renderer.render(bodyHtml, sampleData),
            placeholders: this.renderer.getSupportedPlaceholders(),
        };
    }

    private wrapInLayout(content: string, subject: string, event: string): string {
        if (!this.layout) return content;

        const badge = EVENT_BADGES[event] ?? { text: event, bg: '#e0e0e0', color: '#333' };

        return this.layout
            .replace('{{CONTENT}}', content)
            .replace('{{SUBJECT}}', subject)
            .replace('{{BADGE_TEXT}}', badge.text)
            .replace('{{BADGE_BG}}', badge.bg)
            .replace('{{BADGE_COLOR}}', badge.color);
    }

    private loadLayout(): string | null {
        const layoutPath = path.join(this.templatesDir, 'layout.html');
        if (!fs.existsSync(layoutPath)) return null;
        return fs.readFileSync(layoutPath, 'utf-8');
    }

    private listEvents(): string[] {
        if (!fs.existsSync(this.templatesDir)) return [];
        return fs
            .readdirSync(this.templatesDir, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((d) => d.name);
    }

    async testEmail(email: string, subject: string, bodyHtml: string): Promise<{ success: boolean; subject: string; html: string }> {
        if (!this.provider.isConfigured()) {
            throw new BadRequestException('Email provider is not configured');
        }

        this.renderer.validateTemplate(subject);
        this.renderer.validateTemplate(bodyHtml);
        const sampleData = this.renderer.getSampleData();
        const renderedSubject = this.renderer.render(subject, sampleData);
        const html = this.renderer.render(bodyHtml, sampleData);
        const result = await this.provider.send({ to: email, subject: renderedSubject, html });

        if (!result.success) {
            throw new BadRequestException(result.error ?? 'Failed to send test email');
        }

        return { success: true, subject: renderedSubject, html };
    }
}

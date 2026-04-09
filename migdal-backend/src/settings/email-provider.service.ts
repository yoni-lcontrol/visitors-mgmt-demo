import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface EmailSendRequest {
    to: string;
    subject: string;
    html: string;
}

export interface EmailSendResult {
    success: boolean;
    to: string;
    error?: string;
}

@Injectable()
export class EmailProviderService {
    private readonly logger = new Logger(EmailProviderService.name);
    private readonly transporter: nodemailer.Transporter | null;
    private readonly from: string;

    constructor(private readonly config: ConfigService) {
        const host = this.config.get<string>('SMTP_HOST', '');
        const port = this.config.get<number>('SMTP_PORT', 587);
        const secure = this.config.get<string>('SMTP_SECURE', 'false') === 'true';
        const user = this.config.get<string>('SMTP_USER', '');
        const pass = this.config.get<string>('SMTP_PASS', '');
        this.from = this.config.get<string>('SMTP_FROM', user);

        if (host) {
            const options: nodemailer.TransportOptions & {
                host: string; port: number; secure: boolean; auth?: { user: string; pass: string };
            } = { host, port, secure };

            if (user && pass) {
                options.auth = { user, pass };
            }

            this.transporter = nodemailer.createTransport(options as nodemailer.TransportOptions);
        } else {
            this.transporter = null;
        }
    }

    isConfigured(): boolean {
        return this.transporter !== null;
    }

    async send(request: EmailSendRequest): Promise<EmailSendResult> {
        if (!this.isConfigured()) {
            this.logger.warn('Email provider not configured, skipping send');
            return { success: false, to: request.to, error: 'Email provider not configured' };
        }

        if (!this.isValidEmail(request.to)) {
            this.logger.warn(`Invalid email address: ${request.to}`);
            return { success: false, to: request.to, error: 'Invalid email address' };
        }

        try {
            await this.transporter!.sendMail({
                from: this.from,
                to: request.to,
                subject: request.subject,
                html: request.html,
            });

            this.logger.log(`Email sent successfully to ${request.to}`);
            return { success: true, to: request.to };
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            this.logger.error(`Email send error for ${request.to}: ${message}`);
            return { success: false, to: request.to, error: message };
        }
    }

    async sendBulk(requests: EmailSendRequest[]): Promise<EmailSendResult[]> {
        const results: EmailSendResult[] = [];
        for (const req of requests) {
            results.push(await this.send(req));
        }
        return results;
    }

    private isValidEmail(email: string): boolean {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
}

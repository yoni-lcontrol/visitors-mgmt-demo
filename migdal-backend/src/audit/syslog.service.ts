import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import * as http from 'http';

export interface SyslogMessage {
    category: string;
    userId?: string | null;
    module?: string | null;
    action: string;
    entity: string;
    entityId?: string | null;
    description?: string | null;
    ipAddress?: string | null;
    timestamp?: string;
}

@Injectable()
export class SyslogService {
    private readonly logger = new Logger(SyslogService.name);
    private readonly host: string;
    private readonly port: number;
    private readonly protocol: string;
    private readonly token: string;
    private readonly enabled: boolean;
    private readonly hecUrl: string;
    private readonly agent: https.Agent | http.Agent;

    constructor(private readonly config: ConfigService) {
        this.host = this.config.get<string>('SIEM_SYSLOG_HOST', '');
        this.port = this.config.get<number>('SIEM_SYSLOG_PORT', 8088);
        this.protocol = this.config.get<string>('SIEM_SYSLOG_PROTOCOL', 'https');
        this.token = this.config.get<string>('SIEM_SYSLOG_TOKEN', '');
        this.enabled = !!this.host && !!this.token;

        const scheme = this.protocol === 'http' ? 'http' : 'https';
        this.hecUrl = `${scheme}://${this.host}:${this.port}/services/collector/event`;

        if (scheme === 'https') {
            this.agent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });
        } else {
            this.agent = new http.Agent({ keepAlive: true });
        }

        if (this.enabled) {
            this.logger.log(`Splunk HEC configured: ${this.hecUrl}`);
        }
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    async send(message: SyslogMessage): Promise<boolean> {
        if (!this.enabled) {
            return true;
        }

        const payload = JSON.stringify({
            event: message,
            sourcetype: 'migdal-backend',
            source: message.module || 'migdal-backend',
            time: message.timestamp
                ? new Date(message.timestamp).getTime() / 1000
                : Date.now() / 1000,
        });

        try {
            await this.sendHec(payload);
            return true;
        } catch (err) {
            this.logger.warn(`Failed to send HEC event: ${(err as Error).message}`);
            return false;
        }
    }

    private sendHec(payload: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const url = new URL(this.hecUrl);
            const isHttps = url.protocol === 'https:';
            const lib = isHttps ? https : http;

            const req = lib.request(
                {
                    hostname: url.hostname,
                    port: url.port,
                    path: url.pathname,
                    method: 'POST',
                    headers: {
                        'Authorization': `Splunk ${this.token}`,
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(payload),
                    },
                    agent: this.agent,
                },
                (res) => {
                    let body = '';
                    res.on('data', (chunk) => (body += chunk));
                    res.on('end', () => {
                        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                            resolve();
                        } else {
                            reject(new Error(`HEC responded ${res.statusCode}: ${body}`));
                        }
                    });
                },
            );

            req.on('error', (err) => reject(err));
            req.write(payload);
            req.end();
        });
    }
}

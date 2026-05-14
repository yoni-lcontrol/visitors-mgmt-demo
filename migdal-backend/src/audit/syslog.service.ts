import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as net from 'net';
import * as dgram from 'dgram';

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
export class SyslogService implements OnModuleDestroy {
    private readonly logger = new Logger(SyslogService.name);
    private readonly host: string;
    private readonly port: number;
    private readonly protocol: 'tcp' | 'udp';
    private readonly token: string;
    private readonly enabled: boolean;
    private tcpSocket: net.Socket | null = null;
    private reconnecting = false;

    constructor(private readonly config: ConfigService) {
        this.host = this.config.get<string>('SIEM_SYSLOG_HOST', '');
        this.port = this.config.get<number>('SIEM_SYSLOG_PORT', 514);
        this.protocol = this.config.get<string>('SIEM_SYSLOG_PROTOCOL', 'tcp') as 'tcp' | 'udp';
        this.token = this.config.get<string>('SIEM_SYSLOG_TOKEN', '');
        this.enabled = !!this.host;

        if (this.enabled && this.protocol === 'tcp') {
            this.connectTcp();
        }
    }

    onModuleDestroy(): void {
        if (this.tcpSocket) {
            this.tcpSocket.destroy();
            this.tcpSocket = null;
        }
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    async send(message: SyslogMessage): Promise<boolean> {
        if (!this.enabled) {
            return true;
        }

        const syslogLine = this.formatRfc5424(message);

        try {
            if (this.protocol === 'udp') {
                await this.sendUdp(syslogLine);
            } else {
                await this.sendTcp(syslogLine);
            }
            return true;
        } catch (err) {
            this.logger.warn(`Failed to send syslog message: ${(err as Error).message}`);
            return false;
        }
    }

    private formatRfc5424(message: SyslogMessage): string {
        const facility = 16; // local0
        const severity = 6; // informational
        const priority = facility * 8 + severity;
        const timestamp = message.timestamp ?? new Date().toISOString();
        const appname = this.token || 'migdal-backend';
        const hostname = '-';
        const msgId = message.action;
        const structuredData = '-';
        const payload = JSON.stringify(message);

        return `<${priority}>1 ${timestamp} ${hostname} ${appname} - ${msgId} ${structuredData} ${payload}\n`;
    }

    private sendUdp(line: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const client = dgram.createSocket('udp4');
            const buffer = Buffer.from(line);
            client.send(buffer, 0, buffer.length, this.port, this.host, (err) => {
                client.close();
                if (err) reject(err);
                else resolve();
            });
        });
    }

    private sendTcp(line: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.tcpSocket || this.tcpSocket.destroyed) {
                this.connectTcp();
            }

            if (!this.tcpSocket || this.tcpSocket.destroyed) {
                reject(new Error('TCP socket not available'));
                return;
            }

            const success = this.tcpSocket.write(line, 'utf8', (err) => {
                if (err) reject(err);
                else resolve();
            });

            if (!success) {
                // Backpressure — wait for drain
                this.tcpSocket.once('drain', () => resolve());
            }
        });
    }

    private connectTcp(): void {
        if (this.reconnecting) return;
        this.reconnecting = true;

        this.tcpSocket = net.createConnection({ host: this.host, port: this.port }, () => {
            this.logger.log(`Syslog TCP connected to ${this.host}:${this.port}`);
            this.reconnecting = false;
        });

        this.tcpSocket.on('error', (err) => {
            this.logger.warn(`Syslog TCP error: ${err.message}`);
        });

        this.tcpSocket.on('close', () => {
            this.reconnecting = false;
            // Auto-reconnect after 5 seconds
            setTimeout(() => {
                if (this.enabled && (!this.tcpSocket || this.tcpSocket.destroyed)) {
                    this.connectTcp();
                }
            }, 5000);
        });
    }
}

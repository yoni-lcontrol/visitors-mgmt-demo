import { Injectable, Logger, BadGatewayException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';
import { AxiosRequestConfig } from 'axios';
import {
    RemoteCardholder,
    RemoteCardholderResponse,
    RemoteCardholderListResponse,
    CardholderQueryParams,
} from '../interfaces/ac-api.interface';
import {
    ImportCallbackPayload,
    AccessLevelCallbackPayload,
} from './import.service';

@Injectable()
export class AccessControlApiService {
    private readonly logger = new Logger(AccessControlApiService.name);

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
    ) { }

    // ──────────────────────────── Config helpers ────────────────────────────

    private getBaseUrl(): string {
        const url = this.configService.get<string>('ACCESS_CONTROL_REMOTE_URL');
        if (!url) {
            throw new BadRequestException('ACCESS_CONTROL_REMOTE_URL is not configured');
        }
        return url.replace(/\/+$/, '');
    }

    private getClientId(): string {
        const id = this.configService.get<string>('ACCESS_CONTROL_CLIENT_ID');
        if (!id) {
            throw new BadRequestException('ACCESS_CONTROL_CLIENT_ID is not configured');
        }
        return id;
    }

    private getSecret(): string {
        const secret = this.configService.get<string>('ACCESS_CONTROL_CLIENT_SECRET');
        if (!secret) {
            throw new BadRequestException('ACCESS_CONTROL_CLIENT_SECRET is not configured');
        }
        return secret;
    }

    private getCallbackBaseUrl(): string {
        return this.configService.get<string>('APP_URL') || 'http://localhost:3000';
    }

    // ──────────────────────────── HMAC signing ──────────────────────────────

    private signRequest(body: string): { clientId: string; timestamp: string; signature: string } {
        const clientId = this.getClientId();
        const timestamp = Date.now().toString();
        const payload = `${clientId}.${timestamp}.${body}`;
        const signature = crypto
            .createHmac('sha256', this.getSecret())
            .update(payload)
            .digest('hex');
        return { clientId, timestamp, signature };
    }

    private buildConfig(body: string, extraConfig?: AxiosRequestConfig): AxiosRequestConfig {
        const { clientId, timestamp, signature } = this.signRequest(body);
        return {
            timeout: 30_000,
            ...extraConfig,
            headers: {
                'Content-Type': 'application/json',
                'x-client-id': clientId,
                'x-timestamp': timestamp,
                'x-signature': signature,
                ...(extraConfig?.headers as Record<string, string> | undefined),
            },
        };
    }

    // ──────────────────────────── HTTP helpers ──────────────────────────────

    private async post<T>(path: string, data: unknown): Promise<T> {
        const url = `${this.getBaseUrl()}${path}`;
        const body = JSON.stringify(data);
        const config = this.buildConfig(body);

        try {
            const response = await firstValueFrom(
                this.httpService.post<T>(url, data, config),
            );
            return response.data;
        } catch (err: any) {
            this.handleHttpError(err, 'POST', path);
        }
    }

    private async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
        const url = `${this.getBaseUrl()}${path}`;
        const body = JSON.stringify(params ?? {});
        const config = this.buildConfig(body, { params });

        try {
            const response = await firstValueFrom(
                this.httpService.get<T>(url, config),
            );
            return response.data;
        } catch (err: any) {
            this.handleHttpError(err, 'GET', path);
        }
    }

    private async put<T>(path: string, data: unknown): Promise<T> {
        const url = `${this.getBaseUrl()}${path}`;
        const body = JSON.stringify(data);
        const config = this.buildConfig(body);

        try {
            const response = await firstValueFrom(
                this.httpService.put<T>(url, data, config),
            );
            return response.data;
        } catch (err: any) {
            this.handleHttpError(err, 'PUT', path);
        }
    }

    private async delete<T>(path: string): Promise<T> {
        const url = `${this.getBaseUrl()}${path}`;
        const body = '';
        const config = this.buildConfig(body);

        try {
            const response = await firstValueFrom(
                this.httpService.delete<T>(url, config),
            );
            return response.data;
        } catch (err: any) {
            this.handleHttpError(err, 'DELETE', path);
        }
    }

    private handleHttpError(err: any, method: string, path: string): never {
        const status = err.response?.status;
        const msg = err.response?.data?.message
            || err.cause?.message
            || err.message
            || 'Unknown error';
        this.logger.error(`AC server ${method} ${path} failed (${status ?? 'no status'}): ${msg}`);
        throw new BadGatewayException(`AC server error: ${msg}`);
    }

    // ──────────────────────── Import: full topology ─────────────────────────

    async triggerFullImport(): Promise<void> {
        const callbackUrl = this.getCallbackBaseUrl();
        this.logger.log('Triggering full import on remote AC server');

        await this.post('/api/import', {
            action: 'import',
            callbackUrl: `${callbackUrl}/api/access-control/import/callback`,
        });

        this.logger.log('Full import triggered, awaiting callback');
    }

    async triggerAccessLevelImport(): Promise<void> {
        const callbackUrl = this.getCallbackBaseUrl();
        this.logger.log('Triggering access-level import on remote AC server');

        await this.post('/api/import/access-levels', {
            action: 'import-access-levels',
            callbackUrl: `${callbackUrl}/api/access-control/import/access-levels/callback`,
        });

        this.logger.log('Access-level import triggered, awaiting callback');
    }

    // ──────────────────────── Cardholders CRUD ──────────────────────────────

    async downloadCardholders(query?: CardholderQueryParams): Promise<RemoteCardholderListResponse> {
        this.logger.log('Downloading cardholders from remote AC server');
        const params: Record<string, unknown> = {};
        if (query?.search) params.search = query.search;
        if (query?.accessLevelName) params.accessLevelName = query.accessLevelName;
        if (query?.isVisitor !== undefined) params.isVisitor = query.isVisitor;
        if (query?.active !== undefined) params.active = query.active;
        if (query?.page) params.page = query.page;
        if (query?.limit) params.limit = query.limit;

        return this.get<RemoteCardholderListResponse>('/api/cardholders', params);
    }

    async getCardholder(cardholderId: string): Promise<RemoteCardholder> {
        this.logger.log(`Getting cardholder ${cardholderId} from remote AC server`);
        return this.get<RemoteCardholder>(`/api/cardholders/${encodeURIComponent(cardholderId)}`);
    }

    async createCardholder(cardholder: RemoteCardholder): Promise<RemoteCardholderResponse> {
        this.logger.log(`Creating cardholder on remote AC server: ${cardholder.personId}`);
        return this.post<RemoteCardholderResponse>('/api/cardholders', cardholder);
    }

    async updateCardholder(
        cardholderId: string,
        cardholder: Partial<RemoteCardholder>,
    ): Promise<RemoteCardholderResponse> {
        this.logger.log(`Updating cardholder ${cardholderId} on remote AC server`);
        return this.put<RemoteCardholderResponse>(
            `/api/cardholders/${encodeURIComponent(cardholderId)}`,
            cardholder,
        );
    }

    async deleteCardholder(cardholderId: string): Promise<RemoteCardholderResponse> {
        this.logger.log(`Deleting cardholder ${cardholderId} on remote AC server`);
        return this.delete<RemoteCardholderResponse>(
            `/api/cardholders/${encodeURIComponent(cardholderId)}`,
        );
    }

    // ───────────────────── Cardholder batch operations ──────────────────────

    async createCardholderBatch(cardholders: RemoteCardholder[]): Promise<{
        succeeded: number;
        failed: number;
        errors: Array<{ index: number; error: string }>;
    }> {
        this.logger.log(`Batch creating ${cardholders.length} cardholders on remote AC server`);
        return this.post('/api/cardholders/batch', { cardholders });
    }

    async deleteCardholderBatch(cardholderIds: string[]): Promise<{
        succeeded: number;
        failed: number;
        errors: Array<{ id: string; error: string }>;
    }> {
        this.logger.log(`Batch deleting ${cardholderIds.length} cardholders on remote AC server`);
        return this.post('/api/cardholders/batch-delete', { ids: cardholderIds });
    }
}

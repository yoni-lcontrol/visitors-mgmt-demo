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

    private async post<T>(path: string, data: unknown, extraConfig?: AxiosRequestConfig): Promise<T> {
        const url = `${this.getBaseUrl()}${path}`;
        const body = JSON.stringify(data);
        const config = this.buildConfig(body, extraConfig);

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
        const data = {};
        const body = JSON.stringify(data);
        const config = this.buildConfig(body, { data });

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
        const code: string | undefined = err.code ?? err.cause?.code;
        const msg = err.response?.data?.message
            || err.cause?.message
            || err.message
            || code
            || 'Unknown error';
        const baseUrl = this.configService.get<string>('ACCESS_CONTROL_REMOTE_URL') ?? '<no URL>';
        const fullUrl = `${baseUrl}${path}`;

        if (!err.response && (code === 'ETIMEDOUT' || code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ECONNRESET')) {
            this.logger.error(
                `AC server ${method} ${fullUrl} — network error (${code}): cannot reach Amadeus service. ` +
                `Check ACCESS_CONTROL_REMOTE_URL and that the Amadeus service is running.`,
            );
            throw new BadGatewayException(`Cannot reach Amadeus service (${code})`);
        }

        this.logger.error(`AC server ${method} ${fullUrl} failed (${status ?? 'no status'}): ${msg}`);
        throw new BadGatewayException(`AC server error: ${msg}`);
    }

    // ──────────────────────── Import: full topology ─────────────────────────

    async triggerFullImport(): Promise<ImportCallbackPayload> {
        this.logger.log('Starting async import job on remote AC server');

        // 1. Start the job (returns immediately with a jobId)
        const { jobId } = await this.post<{ jobId: string }>('/api/import', {
            action: 'import',
        }, { timeout: 30_000 });

        this.logger.log(`Import job started with id=${jobId}, polling for completion`);

        // 2. Poll until done
        const payload = await this.pollImportJob(jobId);
        return payload;
    }

    private async pollImportJob(jobId: string): Promise<ImportCallbackPayload> {
        const maxWaitMs = 20 * 60_000; // 20 minutes max
        const intervalMs = 5_000;       // poll every 5 seconds
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitMs) {
            await this.sleep(intervalMs);

            const status = await this.get<{
                status: string;
                phase?: string;
                processed?: number;
                total?: number;
                payload?: ImportCallbackPayload;
                errorMessage?: string;
            }>(`/api/import/status/${jobId}`);

            if (status.status === 'Completed' && status.payload) {
                this.logger.log('Import job completed successfully');
                return status.payload;
            }

            if (status.status === 'Failed') {
                throw new BadGatewayException(
                    `Remote import failed: ${status.errorMessage ?? 'Unknown error'}`,
                );
            }

            this.logger.debug(
                `Import job ${jobId}: ${status.phase ?? 'unknown'} ${status.processed ?? '?'}/${status.total ?? '?'}`,
            );
        }

        throw new BadGatewayException('Import job timed out after 20 minutes');
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async triggerAccessLevelImport(): Promise<AccessLevelCallbackPayload> {
        this.logger.log('Starting async access-level import job on remote AC server');

        // 1. Start the job (returns immediately with a jobId)
        const { jobId } = await this.post<{ jobId: string }>('/api/import/access-levels', {
            action: 'import-access-levels',
        }, { timeout: 30_000 });

        this.logger.log(`Access-level import job started with id=${jobId}, polling for completion`);

        // 2. Poll until done
        const payload = await this.pollAccessLevelImportJob(jobId);
        return payload;
    }

    private async pollAccessLevelImportJob(jobId: string): Promise<AccessLevelCallbackPayload> {
        const maxWaitMs = 20 * 60_000; // 20 minutes max
        const intervalMs = 5_000;       // poll every 5 seconds
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitMs) {
            await this.sleep(intervalMs);

            const status = await this.get<{
                status: string;
                phase?: string;
                processed?: number;
                total?: number;
                accessLevelPayload?: AccessLevelCallbackPayload;
                errorMessage?: string;
            }>(`/api/import/status/${jobId}`);

            if (status.status === 'Completed' && status.accessLevelPayload) {
                this.logger.log('Access-level import job completed successfully');
                return status.accessLevelPayload;
            }

            if (status.status === 'Failed') {
                throw new BadGatewayException(
                    `Remote access-level import failed: ${status.errorMessage ?? 'Unknown error'}`,
                );
            }

            this.logger.debug(
                `Access-level import job ${jobId}: ${status.phase ?? 'unknown'} ${status.processed ?? '?'}/${status.total ?? '?'}`,
            );
        }

        throw new BadGatewayException('Access-level import job timed out after 20 minutes');
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

    async activateVisitorCardByIdNumber(cardholderIdNumber: string): Promise<{ success: boolean }> {
        this.logger.log(`Activating visitor card on remote AC server for personId ${cardholderIdNumber}`);
        return this.post<{ success: boolean }>(
            `/api/cardholders/by-id-number/${encodeURIComponent(cardholderIdNumber)}/activate`,
            {},
        );
    }

    // ───────────────────── Visitor-specific operations ──────────────────────

    async createVisitor(visitor: RemoteCardholder): Promise<RemoteCardholderResponse> {
        this.logger.log(`Creating visitor on remote AC server: ${visitor.personId}`);
        const dto = {
            firstName: visitor.firstName,
            lastName: visitor.lastName,
            fromDateValid: visitor.fromDate,
            toDateValid: visitor.toDate,
            cardholderIdNumber: visitor.personId,
            accessGroupApiKeys: visitor.accessLevelNames,
            cardNumber: visitor.cardNumber,
        };
        return this.post<RemoteCardholderResponse>('/api/cardholders/visitors', dto);
    }

    async deleteVisitor(visitorUid: string): Promise<RemoteCardholderResponse> {
        this.logger.log(`Deleting visitor ${visitorUid} on remote AC server`);
        return this.delete<RemoteCardholderResponse>(
            `/api/cardholders/visitors/${encodeURIComponent(visitorUid)}`,
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

    // ───────────────────── Cards / badges ──────────────────────

    async triggerCardholderSync(): Promise<unknown> {
        this.logger.log('Triggering cardholder sync on remote AC server');
        return this.post('/api/sync/cardholders', {});
    }

    async triggerCardSync(): Promise<unknown> {
        this.logger.log('Triggering card sync on remote AC server');
        return this.post('/api/sync/cards', {});
    }

    async fetchAllCards(cardholderIdNumber?: string): Promise<RemoteCardDto[]> {
        const params = cardholderIdNumber ? { cardholderIdNumber } : undefined;
        const response = await this.get<{ value: RemoteCardDto[]; Count: number } | RemoteCardDto[]>('/api/cardholders/cards', params);
        // The C# service wraps results in { value: [...], Count: N }
        if (Array.isArray(response)) {
            return response;
        }
        return response.value ?? [];
    }
}

export interface RemoteCardDto {
    amadeusUid: string;
    cardNumber: string | null;
    cardholderUid: string | null;
    cardholderIdNumber: string | null;
    status: string | null;
    fromDateValidUtc: string | null;
    toDateValidUtc: string | null;
    isFromDateActive: boolean;
    isToDateActive: boolean;
}

import { Injectable, Logger } from '@nestjs/common';
import { AcControllerService } from './ac-controller.service';
import { DoorService } from './door.service';
import { ExtensionService } from './extension.service';
import { DoorIoService } from './door-io.service';
import { ExtensionIoService } from './extension-io.service';
import { AccessLevelService } from './access-level.service';
import { AccessControlApiService } from './ac-api.service';
import { AuditService } from '../../audit/audit.service';
import { UsersGateway } from '../../websocket/gateways/users.gateway';
import { WsEvent } from '../../websocket/enums/ws-events.enum';
import { createHash } from 'crypto';

export interface RemoteController {
    name: string;
    type?: number | string;
    ip?: string;
    port?: number | string;
    model?: string;
    active?: boolean | string | number;
    externalId?: string;
    doors?: RemoteDoor[];
    extensions?: RemoteExtension[];
}

export interface RemoteDoor {
    name: string;
    doorsIndex?: number | string;
    entryType?: number | string;
    externalId?: string;
    doorIos?: RemoteIo[];
}

export interface RemoteExtension {
    name: string;
    type?: number | string;
    extensionIndex?: number | string;
    externalId?: string;
    extensionIos?: RemoteIo[];
}

export interface RemoteIo {
    name: string;
    type?: number | string;
    ioIndex?: number | string;
    ioState?: number | string;
    externalId?: string;
}

export interface ImportCallbackPayload {
    controllers: RemoteController[];
}

export interface AccessLevelCallbackPayload {
    accessLevels: RemoteAccessLevel[];
}

export interface RemoteAccessLevel {
    name: string;
    active?: boolean;
    visitorAccess?: boolean;
    externalId?: string;
}

export interface ImportResult {
    created: number;
    updated: number;
    skipped: number;
    errors: string[];
}

export interface ControllerImportResult extends ImportResult {
    items: Array<{ name: string; type?: number; ip?: string; port?: number; model?: string; externalId?: string }>;
}

export interface AccessLevelImportResult extends ImportResult {
    items: Array<{ name: string; active: boolean; visitorAccess: boolean; externalId?: string }>;
}

@Injectable()
export class ImportService {
    private readonly logger = new Logger(ImportService.name);

    constructor(
        private readonly acApiService: AccessControlApiService,
        private readonly controllerService: AcControllerService,
        private readonly doorService: DoorService,
        private readonly extensionService: ExtensionService,
        private readonly doorIoService: DoorIoService,
        private readonly extensionIoService: ExtensionIoService,
        private readonly accessLevelService: AccessLevelService,
        private readonly auditService: AuditService,
        private readonly usersGateway: UsersGateway,
    ) { }

    /**
     * Triggers an import on the remote access-control server and processes
     * the returned data immediately (synchronous request/response pattern).
     */
    async triggerRemoteImport(): Promise<ControllerImportResult> {
        this.usersGateway.broadcastToAll(WsEvent.AccessControlControllersImportProgress, {
            phase: 'fetching',
            message: 'Fetching controllers from remote server...',
            current: 0,
            total: 0,
        });

        try {
            const payload = await this.acApiService.triggerFullImport();

            this.usersGateway.broadcastToAll(WsEvent.AccessControlControllersImportProgress, {
                phase: 'processing',
                message: 'Processing controllers...',
                current: 0,
                total: payload?.controllers?.length ?? 0,
            });

            const result = await this.processCallback(payload);

            this.usersGateway.broadcastToAll(WsEvent.AccessControlControllersImportCompleted, {
                created: result.created,
                updated: result.updated,
                skipped: result.skipped,
                total: result.items.length,
                items: result.items,
            });

            return result;
        } catch (err: any) {
            this.usersGateway.broadcastToAll(WsEvent.AccessControlControllersImportFailed, {
                message: err.message ?? 'Import failed',
            });
            throw err;
        }
    }

    /**
     * Processes the callback payload from the remote access-control server.
     * Saves all controllers, doors, extensions, and their IOs into the local database.
     */
    async processCallback(payload: ImportCallbackPayload): Promise<ControllerImportResult> {
        const controllers = payload?.controllers;

        if (!Array.isArray(controllers) || controllers.length === 0) {
            this.logger.warn('Import callback received with no controllers');
            return { created: 0, updated: 0, skipped: 0, errors: ['No controllers in callback payload'], items: [] };
        }

        this.logger.log(`Processing import callback with ${controllers.length} controllers`);
        const result: ControllerImportResult = { created: 0, updated: 0, skipped: 0, errors: [], items: [] };
        const total = controllers.length;

        for (let i = 0; i < controllers.length; i++) {
            const row = controllers[i];
            try {
                if (!row.name) {
                    result.errors.push(`Controller ${i + 1}: name is required`);
                    result.skipped++;
                    continue;
                }

                const controllerExternalId = this.resolveExternalId('controller', row.externalId, [
                    row.name,
                    row.type,
                    row.ip,
                    row.port,
                    row.model,
                ]);

                const normalizedControllerActive = this.normalizeOptionalBoolean(
                    row.active,
                    'controller.active',
                    row.externalId,
                );

                const { entity: ctrl, action: ctrlAction } = await this.controllerService.upsertByExternalId({
                    name: row.name,
                    type: this.normalizeInteger(row.type, 0, 'controller.type', row.externalId),
                    ip: row.ip,
                    port: this.normalizeInteger(row.port, 0, 'controller.port', row.externalId),
                    model: row.model,
                    externalId: controllerExternalId,
                    ...(normalizedControllerActive !== undefined ? { isActive: normalizedControllerActive } : {}),
                });

                // Upsert doors and their IOs
                if (row.doors?.length) {
                    for (const d of row.doors) {
                        try {
                            if (!d?.name) {
                                const message = `Controller ${i + 1} Door: name is required`;
                                this.logger.warn(`Import door failed: ${message}`);
                                result.errors.push(message);
                                continue;
                            }

                            const doorExternalId = this.resolveExternalId('door', d.externalId, [
                                controllerExternalId,
                                d.name,
                                d.doorsIndex,
                                d.entryType,
                            ]);

                            const { entity: door } = await this.doorService.upsertByExternalId({
                                controllerId: ctrl.id,
                                name: d.name,
                                doorsIndex: this.normalizeInteger(d.doorsIndex, 0, 'door.doorsIndex', d.externalId),
                                entryType: this.normalizeInteger(d.entryType, 0, 'door.entryType', d.externalId),
                                externalId: doorExternalId,
                            }, { disableOnCreate: true });

                            if (d.doorIos?.length) {
                                for (const io of d.doorIos) {
                                    try {
                                        if (!io?.name) {
                                            const message = `Controller ${i + 1} Door "${d.name}" IO: name is required`;
                                            this.logger.warn(`Import door IO failed: ${message}`);
                                            result.errors.push(message);
                                            continue;
                                        }

                                        const ioExternalId = this.resolveExternalId('door-io', io.externalId, [
                                            doorExternalId,
                                            io.name,
                                            io.ioIndex,
                                            io.type,
                                        ]);

                                        await this.doorIoService.upsertByExternalId({
                                            doorId: door.id,
                                            name: io.name,
                                            type: this.normalizeIoType(io.type, io.externalId),
                                            ioIndex: this.normalizeInteger(io.ioIndex, 0, 'doorIo.ioIndex', io.externalId),
                                            ioState: this.normalizeInteger(io.ioState, 0, 'doorIo.ioState', io.externalId),
                                            externalId: ioExternalId,
                                        });
                                    } catch (ioErr: any) {
                                        const message = `Controller ${i + 1} Door "${d.name}" IO "${io.name}" (${io.externalId ?? 'no externalId'}): ${ioErr.message}`;
                                        this.logger.warn(`Import door IO failed: ${message}`);
                                        result.errors.push(message);
                                    }
                                }
                            }
                        } catch (doorErr: any) {
                            const message = `Controller ${i + 1} Door "${d?.name ?? 'unnamed'}" (${d?.externalId ?? 'no externalId'}): ${doorErr.message}`;
                            this.logger.warn(`Import door failed: ${message}`);
                            result.errors.push(message);
                        }
                    }
                }

                // Upsert extensions and their IOs
                if (row.extensions?.length) {
                    for (const e of row.extensions) {
                        try {
                            if (!e?.name) {
                                const message = `Controller ${i + 1} Extension: name is required`;
                                this.logger.warn(`Import extension failed: ${message}`);
                                result.errors.push(message);
                                continue;
                            }

                            const extensionExternalId = this.resolveExternalId('extension', e.externalId, [
                                controllerExternalId,
                                e.name,
                                e.type,
                                e.extensionIndex,
                            ]);

                            const { entity: ext } = await this.extensionService.upsertByExternalId({
                                controllerId: ctrl.id,
                                name: e.name,
                                type: this.normalizeInteger(e.type, 0, 'extension.type', e.externalId),
                                extensionIndex: this.normalizeInteger(e.extensionIndex, 0, 'extension.extensionIndex', e.externalId),
                                externalId: extensionExternalId,
                            });

                            if (e.extensionIos?.length) {
                                for (const io of e.extensionIos) {
                                    try {
                                        if (!io?.name) {
                                            const message = `Controller ${i + 1} Extension "${e.name}" IO: name is required`;
                                            this.logger.warn(`Import extension IO failed: ${message}`);
                                            result.errors.push(message);
                                            continue;
                                        }

                                        const ioExternalId = this.resolveExternalId('extension-io', io.externalId, [
                                            extensionExternalId,
                                            io.name,
                                            io.ioIndex,
                                            io.type,
                                        ]);

                                        await this.extensionIoService.upsertByExternalId({
                                            extensionId: ext.id,
                                            name: io.name,
                                            type: this.normalizeIoType(io.type, io.externalId),
                                            ioIndex: this.normalizeInteger(io.ioIndex, 0, 'extensionIo.ioIndex', io.externalId),
                                            ioState: this.normalizeInteger(io.ioState, 0, 'extensionIo.ioState', io.externalId),
                                            externalId: ioExternalId,
                                        });
                                    } catch (ioErr: any) {
                                        const message = `Controller ${i + 1} Extension "${e.name}" IO "${io.name}" (${io.externalId ?? 'no externalId'}): ${ioErr.message}`;
                                        this.logger.warn(`Import extension IO failed: ${message}`);
                                        result.errors.push(message);
                                    }
                                }
                            }
                        } catch (extErr: any) {
                            const message = `Controller ${i + 1} Extension "${e?.name ?? 'unnamed'}" (${e?.externalId ?? 'no externalId'}): ${extErr.message}`;
                            this.logger.warn(`Import extension failed: ${message}`);
                            result.errors.push(message);
                        }
                    }
                }

                result.items.push({
                    name: row.name,
                    type: this.normalizeInteger(row.type, 0, 'controller.type', row.externalId),
                    ip: row.ip,
                    port: this.normalizeInteger(row.port, 0, 'controller.port', row.externalId),
                    model: row.model,
                    externalId: controllerExternalId,
                });
                if (ctrlAction === 'created') {
                    result.created++;
                } else {
                    result.updated++;
                }

                this.usersGateway.broadcastToAll(WsEvent.AccessControlControllersImportProgress, {
                    phase: 'processing',
                    message: `Processed ${i + 1} of ${total}`,
                    current: i + 1,
                    total,
                });
            } catch (err: any) {
                this.logger.warn(`Import controller ${i + 1} failed: ${err.message}`);
                result.errors.push(`Controller ${i + 1}: ${err.message}`);
                result.skipped++;
            }
        }

        this.logger.log(`Import callback processed: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`);

        this.auditService.log({
            module: 'access-control',
            action: 'IMPORT',
            entity: 'AcController',
            description: `Import callback: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`,
            metadata: result,
        }).catch(() => { });

        return result;
    }

    /**
     * Triggers an access-level import on the remote access-control server
     * and processes the returned data immediately.
     */
    async triggerAccessLevelImport(): Promise<AccessLevelImportResult> {
        this.usersGateway.broadcastToAll(WsEvent.AccessControlAccessLevelsImportProgress, {
            phase: 'fetching',
            message: 'Fetching access levels from remote server...',
            current: 0,
            total: 0,
        });

        try {
            const payload = await this.acApiService.triggerAccessLevelImport();

            this.usersGateway.broadcastToAll(WsEvent.AccessControlAccessLevelsImportProgress, {
                phase: 'processing',
                message: 'Processing access levels...',
                current: 0,
                total: payload?.accessLevels?.length ?? 0,
            });

            const result = await this.processAccessLevelCallback(payload);

            this.usersGateway.broadcastToAll(WsEvent.AccessControlAccessLevelsImportCompleted, {
                created: result.created,
                updated: result.updated,
                skipped: result.skipped,
                total: result.items.length,
                items: result.items,
            });

            return result;
        } catch (err: any) {
            this.usersGateway.broadcastToAll(WsEvent.AccessControlAccessLevelsImportFailed, {
                message: err.message ?? 'Import failed',
            });
            throw err;
        }
    }

    /**
     * Processes the access-level callback payload from the remote server.
     */
    async processAccessLevelCallback(payload: AccessLevelCallbackPayload): Promise<AccessLevelImportResult> {
        const accessLevels = payload?.accessLevels;

        if (!Array.isArray(accessLevels) || accessLevels.length === 0) {
            this.logger.warn('Access-level import callback received with no data');
            return { created: 0, updated: 0, skipped: 0, errors: ['No access levels in callback payload'], items: [] };
        }

        this.logger.log(`Processing access-level import callback with ${accessLevels.length} items`);
        const result: AccessLevelImportResult = { created: 0, updated: 0, skipped: 0, errors: [], items: [] };
        const total = accessLevels.length;

        for (let i = 0; i < accessLevels.length; i++) {
            const row = accessLevels[i];
            try {
                if (!row.name) {
                    result.errors.push(`AccessLevel ${i + 1}: name is required`);
                    result.skipped++;
                    continue;
                }

                const { action: alAction } = await this.accessLevelService.upsertByExternalId({
                    name: row.name,
                    active: row.active,
                    visitorAccess: row.visitorAccess,
                    externalId: row.externalId,
                });

                result.items.push({
                    name: row.name,
                    active: row.active ?? true,
                    visitorAccess: row.visitorAccess ?? false,
                    externalId: row.externalId,
                });
                if (alAction === 'created') {
                    result.created++;
                } else {
                    result.updated++;
                }

                this.usersGateway.broadcastToAll(WsEvent.AccessControlAccessLevelsImportProgress, {
                    phase: 'processing',
                    message: `Processed ${i + 1} of ${total}`,
                    current: i + 1,
                    total,
                });
            } catch (err: any) {
                this.logger.warn(`Import access level ${i + 1} failed: ${err.message}`);
                result.errors.push(`AccessLevel ${i + 1}: ${err.message}`);
                result.skipped++;
            }
        }

        this.logger.log(`Access-level import callback processed: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`);

        this.auditService.log({
            module: 'access-control',
            action: 'IMPORT',
            entity: 'AccessLevel',
            description: `Access-level import: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`,
            metadata: result,
        }).catch(() => { });

        return result;
    }

    private normalizeIoType(type: number | string | undefined, externalId?: string): number {
        if (type === undefined || type === null) {
            return 0;
        }

        if (typeof type === 'number' && Number.isFinite(type)) {
            return type;
        }

        const raw = String(type).trim();
        if (raw.length === 0) {
            return 0;
        }

        const asNumber = Number(raw);
        if (!Number.isNaN(asNumber) && Number.isFinite(asNumber)) {
            return asNumber;
        }

        switch (raw.toLowerCase()) {
            case 'closed':
                return 1;
            case 'open':
                return 2;
            case 'twostates':
            case 'two-states':
            case 'unknown':
                return 0;
            default:
                this.logger.warn(
                    'Unknown IO type "{Type}" for externalId {ExternalId}. Defaulting to 0.',
                    raw,
                    externalId ?? 'n/a',
                );
                return 0;
        }
    }

    private normalizeInteger(
        value: number | string | undefined,
        defaultValue: number,
        fieldName: string,
        externalId?: string,
    ): number {
        if (value === undefined || value === null) {
            return defaultValue;
        }

        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }

        const raw = String(value).trim();
        if (!raw.length) {
            return defaultValue;
        }

        const parsed = Number(raw);
        if (Number.isFinite(parsed)) {
            return parsed;
        }

        this.logger.warn(
            'Invalid numeric value "{Value}" for {Field} (externalId: {ExternalId}). Defaulting to {DefaultValue}.',
            raw,
            fieldName,
            externalId ?? 'n/a',
            defaultValue,
        );
        return defaultValue;
    }

    private normalizeOptionalBoolean(
        value: boolean | number | string | undefined,
        fieldName: string,
        externalId?: string,
    ): boolean | undefined {
        if (value === undefined || value === null) {
            return undefined;
        }

        if (typeof value === 'boolean') {
            return value;
        }

        if (typeof value === 'number' && Number.isFinite(value)) {
            return value !== 0;
        }

        const raw = String(value).trim().toLowerCase();
        if (!raw.length) {
            return undefined;
        }

        if (['true', '1', 'yes', 'y', 'on', 'enabled', 'active'].includes(raw)) {
            return true;
        }

        if (['false', '0', 'no', 'n', 'off', 'disabled', 'inactive'].includes(raw)) {
            return false;
        }

        this.logger.warn(
            'Invalid boolean value "{Value}" for {Field} (externalId: {ExternalId}). Ignoring.',
            raw,
            fieldName,
            externalId ?? 'n/a',
        );
        return undefined;
    }

    private normalizeExternalId(externalId: string | undefined): string | undefined {
        if (externalId === undefined || externalId === null) {
            return undefined;
        }

        const normalized = String(externalId).trim();
        return normalized.length > 0 ? normalized : undefined;
    }

    private resolveExternalId(
        entityType: string,
        externalId: string | undefined,
        fingerprintParts: Array<string | number | undefined>,
    ): string {
        const normalized = this.normalizeExternalId(externalId);
        if (normalized) {
            return normalized;
        }

        const fingerprint = fingerprintParts
            .map((part) => String(part ?? ''))
            .join('|');
        const hash = createHash('sha1').update(`${entityType}|${fingerprint}`).digest('hex');

        return `gen:${entityType}:${hash}`;
    }
}

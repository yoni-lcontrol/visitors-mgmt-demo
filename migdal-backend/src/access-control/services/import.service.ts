import { Injectable, Logger } from '@nestjs/common';
import { AcControllerService } from './ac-controller.service';
import { DoorService } from './door.service';
import { ExtensionService } from './extension.service';
import { DoorIoService } from './door-io.service';
import { ExtensionIoService } from './extension-io.service';
import { AccessLevelService } from './access-level.service';
import { AccessControlApiService } from './ac-api.service';
import { AuditService } from '../../audit/audit.service';

export interface RemoteController {
    name: string;
    type?: number;
    ip?: string;
    port?: number;
    model?: string;
    externalId?: string;
    doors?: RemoteDoor[];
    extensions?: RemoteExtension[];
}

export interface RemoteDoor {
    name: string;
    doorsIndex?: number;
    entryType?: number;
    externalId?: string;
    doorIos?: RemoteIo[];
}

export interface RemoteExtension {
    name: string;
    type?: number;
    extensionIndex?: number;
    externalId?: string;
    extensionIos?: RemoteIo[];
}

export interface RemoteIo {
    name: string;
    type?: number;
    ioIndex?: number;
    ioState?: number;
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
}

export interface ImportResult {
    imported: number;
    skipped: number;
    errors: string[];
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
    ) { }

    /**
     * Triggers an import request on the remote access-control server.
     * The remote server will later call back to our callback endpoint with the data.
     * This method returns immediately without waiting for the import data.
     */
    async triggerRemoteImport(): Promise<void> {
        await this.acApiService.triggerFullImport();
    }

    /**
     * Processes the callback payload from the remote access-control server.
     * Saves all controllers, doors, extensions, and their IOs into the local database.
     */
    async processCallback(payload: ImportCallbackPayload): Promise<ImportResult> {
        const controllers = payload?.controllers;

        if (!Array.isArray(controllers) || controllers.length === 0) {
            this.logger.warn('Import callback received with no controllers');
            return { imported: 0, skipped: 0, errors: ['No controllers in callback payload'] };
        }

        this.logger.log(`Processing import callback with ${controllers.length} controllers`);
        const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

        for (let i = 0; i < controllers.length; i++) {
            const row = controllers[i];
            try {
                if (!row.name) {
                    result.errors.push(`Controller ${i + 1}: name is required`);
                    result.skipped++;
                    continue;
                }

                const ctrl = await this.controllerService.create({
                    name: row.name,
                    type: row.type,
                    ip: row.ip,
                    port: row.port,
                    model: row.model,
                    externalId: row.externalId,
                });

                // Create doors and their IOs
                if (row.doors?.length) {
                    for (const d of row.doors) {
                        const door = await this.doorService.create({
                            controllerId: ctrl.id,
                            name: d.name,
                            doorsIndex: d.doorsIndex,
                            entryType: d.entryType,
                            externalId: d.externalId,
                        });
                        if (d.doorIos?.length) {
                            for (const io of d.doorIos) {
                                await this.doorIoService.create({
                                    doorId: door.id,
                                    name: io.name,
                                    type: io.type,
                                    ioIndex: io.ioIndex,
                                    ioState: io.ioState,
                                    externalId: io.externalId,
                                });
                            }
                        }
                    }
                }

                // Create extensions and their IOs
                if (row.extensions?.length) {
                    for (const e of row.extensions) {
                        const ext = await this.extensionService.create({
                            controllerId: ctrl.id,
                            name: e.name,
                            type: e.type,
                            extensionIndex: e.extensionIndex,
                            externalId: e.externalId,
                        });
                        if (e.extensionIos?.length) {
                            for (const io of e.extensionIos) {
                                await this.extensionIoService.create({
                                    extensionId: ext.id,
                                    name: io.name,
                                    type: io.type,
                                    ioIndex: io.ioIndex,
                                    ioState: io.ioState,
                                    externalId: io.externalId,
                                });
                            }
                        }
                    }
                }

                result.imported++;
            } catch (err: any) {
                this.logger.warn(`Import controller ${i + 1} failed: ${err.message}`);
                result.errors.push(`Controller ${i + 1}: ${err.message}`);
                result.skipped++;
            }
        }

        this.logger.log(`Import callback processed: ${result.imported} imported, ${result.skipped} skipped`);

        this.auditService.log({
            module: 'access-control',
            action: 'IMPORT',
            entity: 'AcController',
            description: `Import callback: ${result.imported} controllers imported, ${result.skipped} skipped`,
            metadata: result,
        }).catch(() => { });

        return result;
    }

    /**
     * Triggers an access-level import request on the remote access-control server.
     */
    async triggerAccessLevelImport(): Promise<void> {
        await this.acApiService.triggerAccessLevelImport();
    }

    /**
     * Processes the access-level callback payload from the remote server.
     */
    async processAccessLevelCallback(payload: AccessLevelCallbackPayload): Promise<ImportResult> {
        const accessLevels = payload?.accessLevels;

        if (!Array.isArray(accessLevels) || accessLevels.length === 0) {
            this.logger.warn('Access-level import callback received with no data');
            return { imported: 0, skipped: 0, errors: ['No access levels in callback payload'] };
        }

        this.logger.log(`Processing access-level import callback with ${accessLevels.length} items`);
        const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

        for (let i = 0; i < accessLevels.length; i++) {
            const row = accessLevels[i];
            try {
                if (!row.name) {
                    result.errors.push(`AccessLevel ${i + 1}: name is required`);
                    result.skipped++;
                    continue;
                }

                await this.accessLevelService.create({
                    name: row.name,
                    active: row.active,
                    visitorAccess: row.visitorAccess,
                });

                result.imported++;
            } catch (err: any) {
                this.logger.warn(`Import access level ${i + 1} failed: ${err.message}`);
                result.errors.push(`AccessLevel ${i + 1}: ${err.message}`);
                result.skipped++;
            }
        }

        this.logger.log(`Access-level import callback processed: ${result.imported} imported, ${result.skipped} skipped`);

        this.auditService.log({
            module: 'access-control',
            action: 'IMPORT',
            entity: 'AccessLevel',
            description: `Access-level import callback: ${result.imported} imported, ${result.skipped} skipped`,
            metadata: result,
        }).catch(() => { });

        return result;
    }
}

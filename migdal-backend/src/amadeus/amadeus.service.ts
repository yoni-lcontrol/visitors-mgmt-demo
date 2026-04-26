import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AcController } from '../access-control/entities/ac-controller.entity';
import { Door } from '../access-control/entities/door.entity';
import { DoorIo } from '../access-control/entities/door-io.entity';
import { Extension } from '../access-control/entities/extension.entity';
import { ExtensionIo } from '../access-control/entities/extension-io.entity';
import {
    AmadeusControllerResponseDto,
    AmadeusDoorResponseDto,
    AmadeusDoorIoResponseDto,
    AmadeusExtensionResponseDto,
    AmadeusExtensionIoResponseDto,
} from './dto/amadeus-equipment-response.dto';
import { SyncResultResponseDto } from './dto/sync-result-response.dto';

@Injectable()
export class AmadeusService {
    private readonly logger = new Logger(AmadeusService.name);

    constructor(
        @InjectRepository(AcController)
        private readonly controllerRepo: Repository<AcController>,
        @InjectRepository(Door)
        private readonly doorRepo: Repository<Door>,
        @InjectRepository(DoorIo)
        private readonly doorIoRepo: Repository<DoorIo>,
        @InjectRepository(Extension)
        private readonly extensionRepo: Repository<Extension>,
        @InjectRepository(ExtensionIo)
        private readonly extensionIoRepo: Repository<ExtensionIo>,
    ) { }

    async getControllers(): Promise<AmadeusControllerResponseDto[]> {
        this.logger.log('Fetching controllers for Amadeus');
        const controllers = await this.controllerRepo.find();

        return controllers.map((ctrl) => ({
            id: ctrl.id,
            externalId: ctrl.externalId ?? null,
            amadeusUid: null,
            name: ctrl.name,
            isActive: ctrl.isActive,
        }));
    }

    async getDoors(): Promise<AmadeusDoorResponseDto[]> {
        this.logger.log('Fetching doors for Amadeus');
        const doors = await this.doorRepo.find({ relations: ['controller'] });

        return doors.map((door) => ({
            id: door.id,
            externalId: door.externalId ?? null,
            amadeusUid: null,
            name: door.name,
            controllerExternalId: door.controller?.externalId ?? null,
        }));
    }

    async getDoorIos(): Promise<AmadeusDoorIoResponseDto[]> {
        this.logger.log('Fetching door IOs for Amadeus');
        const doorIos = await this.doorIoRepo
            .createQueryBuilder('dio')
            .leftJoinAndSelect('dio.door', 'door')
            .leftJoinAndSelect('door.controller', 'ctrl')
            .getMany();

        return doorIos.map((dio) => ({
            id: dio.id,
            externalId: dio.externalId ?? null,
            amadeusUid: null,
            name: dio.name,
            ioType: dio.type != null ? String(dio.type) : null,
            direction: null,
            controllerExternalId: dio.door?.controller?.externalId ?? null,
        }));
    }

    async getExtensions(): Promise<AmadeusExtensionResponseDto[]> {
        this.logger.log('Fetching extensions for Amadeus');
        const extensions = await this.extensionRepo.find({ relations: ['controller'] });

        return extensions.map((ext) => ({
            id: ext.id,
            externalId: ext.externalId ?? null,
            amadeusUid: null,
            name: ext.name,
            controllerExternalId: ext.controller?.externalId ?? null,
        }));
    }

    async getExtensionIos(): Promise<AmadeusExtensionIoResponseDto[]> {
        this.logger.log('Fetching extension IOs for Amadeus');
        const extensionIos = await this.extensionIoRepo
            .createQueryBuilder('eio')
            .leftJoinAndSelect('eio.extension', 'ext')
            .leftJoinAndSelect('ext.controller', 'ctrl')
            .getMany();

        return extensionIos.map((eio) => ({
            id: eio.id,
            externalId: eio.externalId ?? null,
            amadeusUid: null,
            name: eio.name,
            ioType: eio.type != null ? String(eio.type) : null,
            direction: null,
            extensionExternalId: eio.extension?.externalId ?? null,
            controllerExternalId: eio.extension?.controller?.externalId ?? null,
        }));
    }

    async triggerFullSync(): Promise<SyncResultResponseDto> {
        this.logger.log('Full sync triggered by Amadeus service');

        const startedUtc = new Date();

        // Count current equipment for the sync response
        const [controllerCount, doorCount, extensionCount] = await Promise.all([
            this.controllerRepo.count(),
            this.doorRepo.count(),
            this.extensionRepo.count(),
        ]);

        const totalReceived = controllerCount + doorCount + extensionCount;

        this.logger.log(
            `Full sync acknowledged: ${controllerCount} controllers, ${doorCount} doors, ${extensionCount} extensions`,
        );

        return {
            success: true,
            operation: 'FullStartup',
            startedUtc,
            completedUtc: new Date(),
            totalReceived,
            created: 0,
            updated: 0,
            unchanged: totalReceived,
            skipped: 0,
            failed: 0,
            errorMessage: null,
        };
    }
}

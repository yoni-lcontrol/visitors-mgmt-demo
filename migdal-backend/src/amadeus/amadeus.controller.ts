import {
    Controller,
    Get,
    Post,
    HttpCode,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { AmadeusService } from './amadeus.service';
import {
    AmadeusControllerResponseDto,
    AmadeusDoorResponseDto,
    AmadeusDoorIoResponseDto,
    AmadeusExtensionResponseDto,
    AmadeusExtensionIoResponseDto,
} from './dto/amadeus-equipment-response.dto';
import { SyncResultResponseDto } from './dto/sync-result-response.dto';

@ApiTags('Amadeus M2M')
@Controller()
export class AmadeusController {
    private readonly logger = new Logger(AmadeusController.name);

    constructor(private readonly amadeusService: AmadeusService) { }

    @Get('controllers')
    @Public()
    @ApiOperation({ summary: 'List all controllers (flat, for Amadeus equipment sync)' })
    async getControllers(): Promise<AmadeusControllerResponseDto[]> {
        this.logger.log('Amadeus requesting controllers list');
        return this.amadeusService.getControllers();
    }

    @Get('doors')
    @Public()
    @ApiOperation({ summary: 'List all doors (flat, for Amadeus equipment sync)' })
    async getDoors(): Promise<AmadeusDoorResponseDto[]> {
        this.logger.log('Amadeus requesting doors list');
        return this.amadeusService.getDoors();
    }

    @Get('door-ios')
    @Public()
    @ApiOperation({ summary: 'List all door IOs (flat, for Amadeus equipment sync)' })
    async getDoorIos(): Promise<AmadeusDoorIoResponseDto[]> {
        this.logger.log('Amadeus requesting door IOs list');
        return this.amadeusService.getDoorIos();
    }

    @Get('extensions')
    @Public()
    @ApiOperation({ summary: 'List all extensions (flat, for Amadeus equipment sync)' })
    async getExtensions(): Promise<AmadeusExtensionResponseDto[]> {
        this.logger.log('Amadeus requesting extensions list');
        return this.amadeusService.getExtensions();
    }

    @Get('extension-ios')
    @Public()
    @ApiOperation({ summary: 'List all extension IOs (flat, for Amadeus equipment sync)' })
    async getExtensionIos(): Promise<AmadeusExtensionIoResponseDto[]> {
        this.logger.log('Amadeus requesting extension IOs list');
        return this.amadeusService.getExtensionIos();
    }

    @Post('sync/full')
    @Public()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Acknowledge full sync from Amadeus service' })
    async triggerFullSync(): Promise<SyncResultResponseDto> {
        this.logger.log('Amadeus full sync request received');
        return this.amadeusService.triggerFullSync();
    }
}

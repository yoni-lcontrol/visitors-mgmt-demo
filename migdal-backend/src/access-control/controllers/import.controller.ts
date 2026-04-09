import {
    Controller,
    Post,
    Body,
    HttpCode,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ImportService, ImportCallbackPayload, AccessLevelCallbackPayload } from '../services/import.service';

@ApiTags('Access Control - Import')
@Controller('access-control/import')
export class ImportController {
    private readonly logger = new Logger(ImportController.name);

    constructor(private readonly importService: ImportService) { }

    @Post('callback')
    @Public()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Callback endpoint for remote access control server to deliver import data' })
    async handleCallback(@Body() payload: ImportCallbackPayload) {
        this.logger.log('Received import callback from remote server');
        return this.importService.processCallback(payload);
    }

    @Post('access-levels/callback')
    @Public()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Callback endpoint for remote server to deliver access levels data' })
    async handleAccessLevelCallback(@Body() payload: AccessLevelCallbackPayload) {
        this.logger.log('Received access-level import callback from remote server');
        return this.importService.processAccessLevelCallback(payload);
    }
}

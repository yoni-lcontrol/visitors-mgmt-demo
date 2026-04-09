import {
    Controller,
    Get,
    Query,
    Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { sendExcelResponse } from '../common/utils/excel.util';
import { VisitorLogService } from './visitor-log.service';
import { EntranceExitLogQueryDto } from './dto/entrance-exit-log-query.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionKey } from '../common/enums/permission-key.enum';

@ApiTags('Visitors - Logs')
@ApiBearerAuth()
@Controller('visitors/logs')
export class VisitorLogController {
    constructor(private readonly visitorLogService: VisitorLogService) { }

    @Get('entrance-exit')
    @RequirePermissions(PermissionKey.VisitsRead)
    @ApiOperation({ summary: 'List visitor entrance/exit logs (paginated)' })
    findEntranceExitLogs(@Query() query: EntranceExitLogQueryDto) {
        return this.visitorLogService.findEntranceExitLogs(query);
    }

    @Get('entrance-exit/export')
    @RequirePermissions(PermissionKey.VisitsRead)
    @ApiOperation({ summary: 'Export filtered visitor entrance/exit logs to Excel' })
    async exportEntranceExitLogs(
        @Query() query: EntranceExitLogQueryDto,
        @Res() res: Response,
    ) {
        const file = await this.visitorLogService.exportEntranceExitLogs(query);
        sendExcelResponse(res, file, 'entrance-exit-logs.xlsx');
    }
}

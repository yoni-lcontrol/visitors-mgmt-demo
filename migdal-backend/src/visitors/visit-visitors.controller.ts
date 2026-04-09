import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { VisitStatusService } from './visit-status.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionKey } from '../common/enums/permission-key.enum';
import { ParseUUIDPipe } from '../common/pipes/parse-uuid.pipe';

@ApiTags('Visit Visitors')
@ApiBearerAuth()
@Controller('visit-visitors')
export class VisitVisitorsController {
    constructor(private readonly statusService: VisitStatusService) { }

    @Get(':visitVisitorId/history')
    @RequirePermissions(PermissionKey.VisitsRead)
    @ApiOperation({ summary: 'Get access log history for a specific visit visitor' })
    getHistory(@Param('visitVisitorId', ParseUUIDPipe) visitVisitorId: string) {
        return this.statusService.getVisitVisitorHistory(visitVisitorId);
    }
}

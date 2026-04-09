import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { VisitStatusService } from './visit-status.service';
import { CreateVisitorAccessLogDto } from './dto/create-visitor-access-log.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionKey } from '../common/enums/permission-key.enum';

@ApiTags('Visitor Access Logs')
@ApiBearerAuth()
@Controller('visitor-access-logs')
export class VisitorAccessLogController {
    constructor(private readonly statusService: VisitStatusService) { }

    @Post()
    @RequirePermissions(PermissionKey.VisitsUpdate)
    @ApiOperation({ summary: 'Register a visitor access event (Arrived/CheckedIn/CheckedOut)' })
    create(
        @Body() dto: CreateVisitorAccessLogDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.statusService.createAccessLog(dto, currentUserId);
    }
}

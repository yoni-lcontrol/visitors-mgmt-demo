import { Controller, Get, Patch, Param, Query, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BlacklistOverrideService } from './blacklist-override.service';
import { BlacklistOverrideQueryDto } from './dto/blacklist-override-query.dto';
import { ReviewBlacklistOverrideDto } from './dto/review-blacklist-override.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionKey } from '../common/enums/permission-key.enum';
import { ParseUUIDPipe } from '../common/pipes/parse-uuid.pipe';

@ApiTags('Blacklist Override Requests')
@ApiBearerAuth()
@Controller('blacklist-override-requests')
export class BlacklistOverrideController {
    constructor(private readonly overrideService: BlacklistOverrideService) {}

    @Get()
    @RequirePermissions(PermissionKey.BlacklistApprove)
    @ApiOperation({ summary: 'List blacklist override requests (paginated)' })
    findAll(@Query() query: BlacklistOverrideQueryDto) {
        return this.overrideService.findAll(query);
    }

    @Get('pending-count')
    @RequirePermissions(PermissionKey.BlacklistApprove)
    @ApiOperation({ summary: 'Get count of pending blacklist override requests' })
    getPendingCount() {
        return this.overrideService.getPendingCount();
    }

    @Patch(':id/review')
    @RequirePermissions(PermissionKey.BlacklistApprove)
    @ApiOperation({ summary: 'Approve or deny a blacklist override request' })
    review(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: ReviewBlacklistOverrideDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.overrideService.review(id, dto, currentUserId);
    }
}

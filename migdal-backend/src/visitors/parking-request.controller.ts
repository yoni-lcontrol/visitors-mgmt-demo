import { Controller, Get, Patch, Param, Query, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ParkingRequestService } from './parking-request.service';
import { ParkingRequestQueryDto } from './dto/parking-request-query.dto';
import { ReviewParkingRequestDto } from './dto/review-parking-request.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionKey } from '../common/enums/permission-key.enum';
import { ParseUUIDPipe } from '../common/pipes/parse-uuid.pipe';

@ApiTags('Parking Requests')
@ApiBearerAuth()
@Controller('parking-requests')
export class ParkingRequestController {
    constructor(private readonly parkingRequestService: ParkingRequestService) {}

    @Get()
    @RequirePermissions(PermissionKey.ParkingApprove)
    @ApiOperation({ summary: 'List parking requests (paginated)' })
    findAll(@Query() query: ParkingRequestQueryDto) {
        return this.parkingRequestService.findAll(query);
    }

    @Get('pending-count')
    @RequirePermissions(PermissionKey.ParkingApprove)
    @ApiOperation({ summary: 'Get count of pending parking requests' })
    getPendingCount() {
        return this.parkingRequestService.getPendingCount();
    }

    @Patch(':id/review')
    @RequirePermissions(PermissionKey.ParkingApprove)
    @ApiOperation({ summary: 'Approve or deny a parking request' })
    review(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: ReviewParkingRequestDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.parkingRequestService.review(id, dto, currentUserId);
    }
}

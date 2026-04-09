import { Controller, Get, Post, Patch, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DoorIoService } from '../services/door-io.service';
import { CreateDoorIoDto } from '../dto/create-door-io.dto';
import { UpdateDoorIoDto } from '../dto/update-door-io.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PermissionKey } from '../../common/enums/permission-key.enum';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';

@ApiTags('Access Control - Door IOs')
@ApiBearerAuth()
@Controller('access-control/door-ios')
export class DoorIoController {
    constructor(private readonly doorIoService: DoorIoService) { }

    @Get('by-door/:doorId')
    @RequirePermissions(PermissionKey.AccessControlRead)
    @ApiOperation({ summary: 'List IOs by door' })
    findByDoor(@Param('doorId', ParseUUIDPipe) doorId: string) {
        return this.doorIoService.findByDoor(doorId);
    }

    @Get(':id')
    @RequirePermissions(PermissionKey.AccessControlRead)
    @ApiOperation({ summary: 'Get door IO by ID' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.doorIoService.findById(id);
    }

    @Post()
    @RequirePermissions(PermissionKey.AccessControlCreate)
    @ApiOperation({ summary: 'Create a door IO' })
    create(
        @Body() dto: CreateDoorIoDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.doorIoService.create(dto, currentUserId);
    }

    @Patch(':id')
    @RequirePermissions(PermissionKey.AccessControlUpdate)
    @ApiOperation({ summary: 'Update a door IO' })
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateDoorIoDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.doorIoService.update(id, dto, currentUserId);
    }

    @Delete(':id')
    @RequirePermissions(PermissionKey.AccessControlDelete)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete a door IO' })
    remove(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.doorIoService.remove(id, currentUserId);
    }
}

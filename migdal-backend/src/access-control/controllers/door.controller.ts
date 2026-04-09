import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Res, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { DoorService } from '../services/door.service';
import { sendExcelResponse } from '../../common/utils/excel.util';
import { CreateDoorDto } from '../dto/create-door.dto';
import { UpdateDoorDto } from '../dto/update-door.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PermissionKey } from '../../common/enums/permission-key.enum';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@ApiTags('Access Control - Doors')
@ApiBearerAuth()
@Controller('access-control/doors')
export class DoorController {
    constructor(private readonly doorService: DoorService) { }

    @Get()
    @RequirePermissions(PermissionKey.AccessControlRead)
    @ApiOperation({ summary: 'List all doors (paginated)' })
    findAll(@Query() query: PaginationQueryDto) {
        return this.doorService.findAll(query);
    }

    @Get('export')
    @RequirePermissions(PermissionKey.AccessControlRead)
    @ApiOperation({ summary: 'Export doors as Excel' })
    async export(
        @Query() query: PaginationQueryDto,
        @Res() res: Response,
    ) {
        const file = await this.doorService.exportToExcel(query);
        sendExcelResponse(res, file, 'doors.xlsx');
    }

    @Get('by-controller/:controllerId')
    @RequirePermissions(PermissionKey.AccessControlRead)
    @ApiOperation({ summary: 'List doors by controller' })
    findByController(@Param('controllerId', ParseUUIDPipe) controllerId: string) {
        return this.doorService.findByController(controllerId);
    }

    @Get(':id')
    @RequirePermissions(PermissionKey.AccessControlRead)
    @ApiOperation({ summary: 'Get door by ID' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.doorService.findById(id);
    }

    @Post()
    @RequirePermissions(PermissionKey.AccessControlCreate)
    @ApiOperation({ summary: 'Create a door' })
    create(
        @Body() dto: CreateDoorDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.doorService.create(dto, currentUserId);
    }

    @Patch(':id')
    @RequirePermissions(PermissionKey.AccessControlUpdate)
    @ApiOperation({ summary: 'Update a door' })
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateDoorDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.doorService.update(id, dto, currentUserId);
    }

    @Delete(':id')
    @RequirePermissions(PermissionKey.AccessControlDelete)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete a door' })
    remove(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.doorService.remove(id, currentUserId);
    }
}

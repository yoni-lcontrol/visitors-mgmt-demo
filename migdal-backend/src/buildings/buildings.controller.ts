import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BuildingsService } from './buildings.service';
import { CreateBuildingDto } from './dto/create-building.dto';
import { UpdateBuildingDto } from './dto/update-building.dto';
import { BuildingQueryDto } from './dto/building-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionKey } from '../common/enums/permission-key.enum';
import { ParseUUIDPipe } from '../common/pipes/parse-uuid.pipe';

@ApiTags('Buildings')
@ApiBearerAuth()
@Controller('buildings')
export class BuildingsController {
    constructor(private readonly buildingsService: BuildingsService) { }

    @Get()
    @RequirePermissions(PermissionKey.BuildingsRead)
    @ApiOperation({ summary: 'List all buildings (paginated)' })
    findAll(@Query() query: BuildingQueryDto) {
        return this.buildingsService.findAll(query);
    }

    @Get('access-levels')
    @RequirePermissions(PermissionKey.BuildingsRead)
    @ApiOperation({ summary: 'List active access levels for building assignment' })
    findAccessLevels() {
        return this.buildingsService.findAccessLevels();
    }

    @Get(':id')
    @RequirePermissions(PermissionKey.BuildingsRead)
    @ApiOperation({ summary: 'Get building by ID' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.buildingsService.findById(id);
    }

    @Post()
    @RequirePermissions(PermissionKey.BuildingsCreate)
    @ApiOperation({ summary: 'Create a building' })
    create(
        @Body() dto: CreateBuildingDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.buildingsService.create(dto, currentUserId);
    }

    @Patch(':id')
    @RequirePermissions(PermissionKey.BuildingsUpdate)
    @ApiOperation({ summary: 'Update a building' })
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateBuildingDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.buildingsService.update(id, dto, currentUserId);
    }
}

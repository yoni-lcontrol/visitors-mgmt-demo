import {
    Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdConfigurationService } from './ad-configuration.service';
import { AdSearchService } from './ad-search.service';
import { CreateAdConfigurationDto } from './dto/create-ad-configuration.dto';
import { UpdateAdConfigurationDto } from './dto/update-ad-configuration.dto';
import { AdSearchQueryDto } from './dto/ad-search-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionKey } from '../common/enums/permission-key.enum';
import { ParseUUIDPipe } from '../common/pipes/parse-uuid.pipe';

@ApiTags('AD Configuration')
@ApiBearerAuth()
@Controller('settings/ad-configurations')
export class AdConfigurationController {
    constructor(
        private readonly service: AdConfigurationService,
        private readonly adSearch: AdSearchService,
    ) { }

    @Get('search-people')
    @RequirePermissions(PermissionKey.VisitsRead)
    @ApiOperation({ summary: 'Search people in Active Directory' })
    searchPeople(@Query() dto: AdSearchQueryDto) {
        return this.adSearch.searchPeopleHttp(dto.query);
    }

    @Get()
    @RequirePermissions(PermissionKey.SettingsRead)
    @ApiOperation({ summary: 'List all AD configurations' })
    findAll() {
        return this.service.findAll();
    }

    @Get(':id')
    @RequirePermissions(PermissionKey.SettingsRead)
    @ApiOperation({ summary: 'Get AD configuration by ID' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.service.findById(id);
    }

    @Post()
    @RequirePermissions(PermissionKey.SettingsUpdate)
    @ApiOperation({ summary: 'Create AD configuration' })
    create(
        @Body() dto: CreateAdConfigurationDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.service.create(dto, currentUserId);
    }

    @Patch(':id')
    @RequirePermissions(PermissionKey.SettingsUpdate)
    @ApiOperation({ summary: 'Update AD configuration' })
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateAdConfigurationDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.service.update(id, dto, currentUserId);
    }

    @Delete(':id')
    @RequirePermissions(PermissionKey.SettingsUpdate)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Soft-delete AD configuration' })
    remove(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.service.remove(id, currentUserId);
    }
}

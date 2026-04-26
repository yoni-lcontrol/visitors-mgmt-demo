import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdGroupRoleMappingsService } from './ad-group-role-mappings.service';
import { CreateAdGroupRoleMappingDto } from './dto/create-ad-group-role-mapping.dto';
import { UpdateAdGroupRoleMappingDto } from './dto/update-ad-group-role-mapping.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionKey } from '../common/enums/permission-key.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('AD Group Role Mappings')
@ApiBearerAuth()
@Controller('ad-group-role-mappings')
export class AdGroupRoleMappingsController {
    constructor(private readonly mappingsService: AdGroupRoleMappingsService) { }

    @Get()
    @RequirePermissions(PermissionKey.SettingsRead)
    @ApiOperation({ summary: 'List all AD group to role mappings' })
    findAll() {
        return this.mappingsService.findAll();
    }

    @Post()
    @RequirePermissions(PermissionKey.SettingsUpdate)
    @ApiOperation({ summary: 'Create AD group to role mapping' })
    create(
        @Body() dto: CreateAdGroupRoleMappingDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.mappingsService.create(dto, currentUserId);
    }

    @Patch(':id')
    @RequirePermissions(PermissionKey.SettingsUpdate)
    @ApiOperation({ summary: 'Update AD group to role mapping' })
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateAdGroupRoleMappingDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.mappingsService.update(id, dto, currentUserId);
    }

    @Delete(':id')
    @RequirePermissions(PermissionKey.SettingsUpdate)
    @ApiOperation({ summary: 'Delete AD group to role mapping' })
    remove(
        @Param('id', ParseIntPipe) id: number,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.mappingsService.remove(id, currentUserId);
    }
}

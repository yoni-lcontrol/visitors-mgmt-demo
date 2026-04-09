import { Controller, Get, Post, Patch, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ExtensionIoService } from '../services/extension-io.service';
import { CreateExtensionIoDto } from '../dto/create-extension-io.dto';
import { UpdateExtensionIoDto } from '../dto/update-extension-io.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PermissionKey } from '../../common/enums/permission-key.enum';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';

@ApiTags('Access Control - Extension IOs')
@ApiBearerAuth()
@Controller('access-control/extension-ios')
export class ExtensionIoController {
    constructor(private readonly extensionIoService: ExtensionIoService) { }

    @Get('by-extension/:extensionId')
    @RequirePermissions(PermissionKey.AccessControlRead)
    @ApiOperation({ summary: 'List IOs by extension' })
    findByExtension(@Param('extensionId', ParseUUIDPipe) extensionId: string) {
        return this.extensionIoService.findByExtension(extensionId);
    }

    @Get(':id')
    @RequirePermissions(PermissionKey.AccessControlRead)
    @ApiOperation({ summary: 'Get extension IO by ID' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.extensionIoService.findById(id);
    }

    @Post()
    @RequirePermissions(PermissionKey.AccessControlCreate)
    @ApiOperation({ summary: 'Create an extension IO' })
    create(
        @Body() dto: CreateExtensionIoDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.extensionIoService.create(dto, currentUserId);
    }

    @Patch(':id')
    @RequirePermissions(PermissionKey.AccessControlUpdate)
    @ApiOperation({ summary: 'Update an extension IO' })
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateExtensionIoDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.extensionIoService.update(id, dto, currentUserId);
    }

    @Delete(':id')
    @RequirePermissions(PermissionKey.AccessControlDelete)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete an extension IO' })
    remove(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.extensionIoService.remove(id, currentUserId);
    }
}

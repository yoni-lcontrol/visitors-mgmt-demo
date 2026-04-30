import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    HttpCode,
    HttpStatus,
    Res,
    UseInterceptors,
    ClassSerializerInterceptor,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { sendExcelResponse } from '../../common/utils/excel.util';
import { AcControllerService } from '../services/ac-controller.service';
import { ImportService } from '../services/import.service';
import { CreateControllerDto } from '../dto/create-controller.dto';
import { UpdateControllerDto } from '../dto/update-controller.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PermissionKey } from '../../common/enums/permission-key.enum';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';

@ApiTags('Access Control - Controllers')
@ApiBearerAuth()
@UseInterceptors(ClassSerializerInterceptor)
@Controller('access-control/controllers')
export class AcControllerController {
    constructor(
        private readonly acControllerService: AcControllerService,
        private readonly importService: ImportService,
    ) { }

    @Get()
    @RequirePermissions(PermissionKey.AccessControlRead)
    @ApiOperation({ summary: 'List all controllers (paginated)' })
    findAll(@Query() query: PaginationQueryDto) {
        return this.acControllerService.findAll(query);
    }

    @Get('export')
    @RequirePermissions(PermissionKey.AccessControlRead)
    @ApiOperation({ summary: 'Export controllers as Excel' })
    async export(
        @Query() query: PaginationQueryDto,
        @Res() res: Response,
    ) {
        const file = await this.acControllerService.exportToExcel(query);
        sendExcelResponse(res, file, 'controllers.xlsx');
    }

    @Get(':id')
    @RequirePermissions(PermissionKey.AccessControlRead)
    @ApiOperation({ summary: 'Get controller by ID with doors & extensions' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.acControllerService.findById(id);
    }

    @Post()
    @RequirePermissions(PermissionKey.AccessControlCreate)
    @ApiOperation({ summary: 'Create a new controller' })
    create(
        @Body() dto: CreateControllerDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.acControllerService.create(dto, currentUserId);
    }

    @Patch(':id')
    @RequirePermissions(PermissionKey.AccessControlUpdate)
    @ApiOperation({ summary: 'Update controller' })
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateControllerDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.acControllerService.update(id, dto, currentUserId);
    }

    @Delete(':id')
    @RequirePermissions(PermissionKey.AccessControlDelete)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete controller (cascade deletes children)' })
    remove(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.acControllerService.remove(id, currentUserId);
    }

    @Post('import')
    @RequirePermissions(PermissionKey.AccessControlImport)
    @ApiOperation({ summary: 'Import data from remote access control server' })
    async importData() {
        const result = await this.importService.triggerRemoteImport();
        return {
            message: `Import completed: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`,
            created: result.created,
            updated: result.updated,
            skipped: result.skipped,
            items: result.items,
            errors: result.errors,
        };
    }
}

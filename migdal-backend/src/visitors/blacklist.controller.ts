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
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { sendExcelResponse } from '../common/utils/excel.util';
import { BlacklistService } from './blacklist.service';
import { CreateBlacklistDto } from './dto/create-blacklist.dto';
import { UpdateBlacklistDto } from './dto/update-blacklist.dto';
import { BlacklistQueryDto } from './dto/blacklist-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionKey } from '../common/enums/permission-key.enum';
import { ParseUUIDPipe } from '../common/pipes/parse-uuid.pipe';

@ApiTags('Visitors - Blacklist')
@ApiBearerAuth()
@Controller('visitors/blacklist')
export class BlacklistController {
    constructor(private readonly blacklistService: BlacklistService) { }

    @Get()
    @RequirePermissions(PermissionKey.BlacklistRead)
    @ApiOperation({ summary: 'List blacklist entries (paginated)' })
    findAll(@Query() query: BlacklistQueryDto) {
        return this.blacklistService.findAll(query, query.type);
    }

    @Get('export')
    @RequirePermissions(PermissionKey.BlacklistRead)
    @ApiOperation({ summary: 'Export blacklist entries as Excel' })
    async export(
        @Query() query: BlacklistQueryDto,
        @Res() res: Response,
    ) {
        const type = query.type ?? 'person';
        const file = await this.blacklistService.exportToExcel(query, type);
        const filename = type === 'vehicle' ? 'vehicle-blacklist.xlsx' : 'person-blacklist.xlsx';
        sendExcelResponse(res, file, filename);
    }

    @Get('check/:idNumber')
    @RequirePermissions(PermissionKey.BlacklistCheck)
    @ApiOperation({ summary: 'Check if a person is currently blacklisted by ID number' })
    async checkBlacklist(@Param('idNumber') idNumber: string) {
        return this.blacklistService.checkBlacklistStatus(idNumber);
    }

    @Get('check-vehicle/:carNumber')
    @RequirePermissions(PermissionKey.BlacklistCheck)
    @ApiOperation({ summary: 'Check if a vehicle is currently blacklisted by car number' })
    async checkVehicleBlacklist(@Param('carNumber') carNumber: string) {
        return this.blacklistService.checkVehicleBlacklistStatus(carNumber);
    }

    @Get(':id')
    @RequirePermissions(PermissionKey.BlacklistRead)
    @ApiOperation({ summary: 'Get blacklist entry by ID' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.blacklistService.findById(id);
    }

    @Post()
    @RequirePermissions(PermissionKey.BlacklistCreate)
    @ApiOperation({ summary: 'Add entry to blacklist' })
    create(
        @Body() dto: CreateBlacklistDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.blacklistService.create(dto, currentUserId);
    }

    @Patch(':id')
    @RequirePermissions(PermissionKey.BlacklistUpdate)
    @ApiOperation({ summary: 'Update blacklist entry' })
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateBlacklistDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.blacklistService.update(id, dto, currentUserId);
    }

    @Delete(':id')
    @RequirePermissions(PermissionKey.BlacklistDelete)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Remove entry from blacklist' })
    remove(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.blacklistService.remove(id, currentUserId);
    }
}

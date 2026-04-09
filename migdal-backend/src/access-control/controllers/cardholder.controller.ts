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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CardholderService } from '../services/cardholder.service';
import { CreateCardholderDto } from '../dto/create-cardholder.dto';
import { UpdateCardholderDto } from '../dto/update-cardholder.dto';
import { CardholderQueryDto } from '../dto/cardholder-query.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PermissionKey } from '../../common/enums/permission-key.enum';

@ApiTags('Access Control - Cardholders')
@ApiBearerAuth()
@Controller('access-control/cardholders')
export class CardholderController {
    constructor(private readonly cardholderService: CardholderService) { }

    @Get()
    @RequirePermissions(PermissionKey.AccessControlRead)
    @ApiOperation({ summary: 'Download cardholders from remote AC server' })
    findAll(@Query() query: CardholderQueryDto) {
        return this.cardholderService.findAll(query);
    }

    @Get(':id')
    @RequirePermissions(PermissionKey.AccessControlRead)
    @ApiOperation({ summary: 'Get a single cardholder from remote AC server' })
    findOne(@Param('id') id: string) {
        return this.cardholderService.findOne(id);
    }

    @Post()
    @RequirePermissions(PermissionKey.AccessControlCreate)
    @ApiOperation({ summary: 'Create cardholder on remote AC server' })
    create(
        @Body() dto: CreateCardholderDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.cardholderService.create(dto, currentUserId);
    }

    @Post('batch')
    @RequirePermissions(PermissionKey.AccessControlCreate)
    @ApiOperation({ summary: 'Batch create cardholders on remote AC server' })
    createBatch(
        @Body() dtos: CreateCardholderDto[],
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.cardholderService.createBatch(dtos, currentUserId);
    }

    @Patch(':id')
    @RequirePermissions(PermissionKey.AccessControlUpdate)
    @ApiOperation({ summary: 'Update cardholder on remote AC server' })
    update(
        @Param('id') id: string,
        @Body() dto: UpdateCardholderDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.cardholderService.update(id, dto, currentUserId);
    }

    @Delete(':id')
    @RequirePermissions(PermissionKey.AccessControlDelete)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete cardholder on remote AC server' })
    remove(
        @Param('id') id: string,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.cardholderService.remove(id, currentUserId);
    }

    @Post('batch-delete')
    @RequirePermissions(PermissionKey.AccessControlDelete)
    @ApiOperation({ summary: 'Batch delete cardholders on remote AC server' })
    removeBatch(
        @Body() body: { ids: string[] },
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.cardholderService.removeBatch(body.ids, currentUserId);
    }
}

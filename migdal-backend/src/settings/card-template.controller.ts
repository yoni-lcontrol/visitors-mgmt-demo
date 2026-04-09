import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    HttpCode,
    HttpStatus,
    ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CardTemplateService } from './card-template.service';
import { CreateCardTemplateDto } from './dto/create-card-template.dto';
import { UpdateCardTemplateDto } from './dto/update-card-template.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionKey } from '../common/enums/permission-key.enum';

@ApiTags('Card Templates')
@Controller('settings/card-templates')
export class CardTemplateController {
    constructor(
        private readonly cardTemplateService: CardTemplateService,
    ) { }

    @Get()
    @ApiBearerAuth()
    @RequirePermissions(PermissionKey.SettingsCardTemplatesRead)
    @ApiOperation({ summary: 'List all card templates' })
    findAll() {
        return this.cardTemplateService.findAll();
    }

    @Get(':id')
    @ApiBearerAuth()
    @RequirePermissions(PermissionKey.SettingsCardTemplatesRead)
    @ApiOperation({ summary: 'Get card template by id' })
    findById(@Param('id', new ParseUUIDPipe()) id: string) {
        return this.cardTemplateService.findById(id);
    }

    @Post()
    @ApiBearerAuth()
    @RequirePermissions(PermissionKey.SettingsCardTemplatesCreate)
    @ApiOperation({ summary: 'Create a new card template' })
    create(
        @Body() dto: CreateCardTemplateDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.cardTemplateService.create(dto, currentUserId);
    }

    @Patch(':id')
    @ApiBearerAuth()
    @RequirePermissions(PermissionKey.SettingsCardTemplatesUpdate)
    @ApiOperation({ summary: 'Update card template' })
    update(
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() dto: UpdateCardTemplateDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.cardTemplateService.update(id, dto, currentUserId);
    }

    @Delete(':id')
    @ApiBearerAuth()
    @RequirePermissions(PermissionKey.SettingsCardTemplatesDelete)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Soft-delete card template' })
    remove(
        @Param('id', new ParseUUIDPipe()) id: string,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.cardTemplateService.remove(id, currentUserId);
    }

    @Post(':id/test-print')
    @ApiBearerAuth()
    @RequirePermissions(PermissionKey.VisitsPrintCard)
    @HttpCode(HttpStatus.ACCEPTED)
    @ApiOperation({ summary: 'Send a test print of the card template to the user\'s bound printer' })
    testPrint(
        @Param('id', new ParseUUIDPipe()) id: string,
        @CurrentUser('sub') userId: string,
    ) {
        return this.cardTemplateService.testPrint(id, userId);
    }
}

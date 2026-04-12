import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { UpsertEmailTemplateDto } from './upsert-email-template.dto';

export class BulkUpsertEmailTemplatesDto {
    @ApiProperty({ type: [UpsertEmailTemplateDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpsertEmailTemplateDto)
    templates!: UpsertEmailTemplateDto[];
}

import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { UpsertSmsTemplateDto } from './upsert-sms-template.dto';

export class BulkUpsertSmsTemplatesDto {
    @ApiProperty({ type: [UpsertSmsTemplateDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpsertSmsTemplateDto)
    templates!: UpsertSmsTemplateDto[];
}

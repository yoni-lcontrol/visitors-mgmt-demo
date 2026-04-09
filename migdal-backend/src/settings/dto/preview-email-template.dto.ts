import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NOTIFICATION_EVENTS } from '../enums/notification-event.enum';

export class PreviewEmailTemplateDto {
    @ApiProperty({ example: 'visit_created', enum: NOTIFICATION_EVENTS })
    @IsString()
    @IsNotEmpty()
    @IsIn(NOTIFICATION_EVENTS)
    event!: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    subject?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    bodyHtml?: string;
}

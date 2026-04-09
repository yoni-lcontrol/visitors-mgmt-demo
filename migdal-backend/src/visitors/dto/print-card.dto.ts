import { IsOptional, IsString, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PrintCardDto {
    @ApiPropertyOptional({ description: 'Card template ID to use for printing' })
    @IsOptional()
    @IsString()
    cardTemplateId?: string;

    @ApiPropertyOptional({ description: 'Additional print options' })
    @IsOptional()
    @IsObject()
    printOptions?: Record<string, unknown>;
}

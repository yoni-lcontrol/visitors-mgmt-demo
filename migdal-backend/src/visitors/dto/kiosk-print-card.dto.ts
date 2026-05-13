import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class KioskPrintCardDto {
    @ApiProperty({ description: 'Workstation code the kiosk is bound to' })
    @IsString()
    @IsNotEmpty()
    workstationCode!: string;

    @ApiProperty({ description: 'Visit ID' })
    @IsString()
    @IsNotEmpty()
    visitId!: string;

    @ApiProperty({ description: 'Visitor ID' })
    @IsString()
    @IsNotEmpty()
    visitorId!: string;

    @ApiPropertyOptional({ description: 'Card template ID (optional, uses workstation default if omitted)' })
    @IsString()
    @IsOptional()
    cardTemplateId?: string;
}

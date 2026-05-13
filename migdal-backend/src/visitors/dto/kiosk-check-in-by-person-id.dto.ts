import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class KioskArriveByPersonIdDto {
    @ApiProperty({ description: 'Visit ID' })
    @IsString()
    @IsNotEmpty()
    visitId!: string;

    @ApiProperty({ description: 'Visitor ID' })
    @IsString()
    @IsNotEmpty()
    visitorId!: string;

    @ApiPropertyOptional({ description: 'Site ID' })
    @IsString()
    @IsOptional()
    siteId?: string;

    @ApiProperty({ description: 'Person ID (identity number)' })
    @IsString()
    @IsNotEmpty()
    personId!: string;

    @ApiPropertyOptional({ description: 'Workstation code for printing' })
    @IsString()
    @IsOptional()
    workstationCode?: string;
}

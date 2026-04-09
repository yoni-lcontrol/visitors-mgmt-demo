import { IsString, IsNotEmpty, IsOptional, MaxLength, Matches, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWorkstationDto {
    @ApiProperty({ description: 'Unique workstation code', example: 'WS-RECEPTION-01' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    @Matches(/^[A-Za-z0-9\-_]+$/, { message: 'Code must contain only letters, numbers, hyphens, and underscores' })
    code!: string;

    @ApiProperty({ description: 'Display name', example: 'Reception Desk 1' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    displayName!: string;

    @ApiPropertyOptional({ description: 'Description' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    description?: string;

    @ApiPropertyOptional({ description: 'Site identifier' })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    siteId?: string;

    @ApiPropertyOptional({ description: 'Default card template ID for visitor badge printing' })
    @IsOptional()
    @ValidateIf((_o, value) => value !== null && value !== '')
    @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, { message: 'defaultCardTemplateId must be a valid GUID' })
    defaultCardTemplateId?: string;
}

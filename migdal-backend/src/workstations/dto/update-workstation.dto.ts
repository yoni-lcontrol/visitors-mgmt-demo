import { IsString, IsOptional, MaxLength, IsBoolean, Matches, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateWorkstationDto {
    @ApiPropertyOptional({ description: 'Display name' })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    displayName?: string;

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

    @ApiPropertyOptional({ description: 'Active status' })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @ApiPropertyOptional({ description: 'Default card template ID for visitor badge printing (null to clear)' })
    @IsOptional()
    @ValidateIf((_o, value) => value !== null && value !== '')
    @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, { message: 'defaultCardTemplateId must be a valid GUID' })
    defaultCardTemplateId?: string | null;
}

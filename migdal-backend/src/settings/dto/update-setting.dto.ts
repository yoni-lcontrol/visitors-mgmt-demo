import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSettingDto {
    @ApiPropertyOptional({ example: 'New Value' })
    @IsOptional()
    @IsString()
    value?: string;

    @ApiPropertyOptional({ example: 'Updated Label' })
    @IsOptional()
    @IsString()
    label?: string;

    @ApiPropertyOptional({ example: 'Updated description' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    isPublic?: boolean;
}

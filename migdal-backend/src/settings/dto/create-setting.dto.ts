import { IsNotEmpty, IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSettingDto {
    @ApiProperty({ example: 'site.name' })
    @IsString()
    @IsNotEmpty()
    key!: string;

    @ApiProperty({ example: 'Migdal Platform' })
    @IsString()
    @IsNotEmpty()
    value!: string;

    @ApiPropertyOptional({ example: 'string', enum: ['string', 'number', 'boolean', 'json'] })
    @IsOptional()
    @IsString()
    type?: string;

    @ApiProperty({ example: 'general' })
    @IsString()
    @IsNotEmpty()
    group!: string;

    @ApiProperty({ example: 'Site Name' })
    @IsString()
    @IsNotEmpty()
    label!: string;

    @ApiPropertyOptional({ example: 'The public name of the site' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ example: false })
    @IsOptional()
    @IsBoolean()
    isPublic?: boolean;
}

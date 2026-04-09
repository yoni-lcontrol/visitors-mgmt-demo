import {
    IsString,
    IsOptional,
    IsInt,
    IsIn,
    Min,
    Max,
    MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCardTemplateDto {
    @ApiPropertyOptional({ example: 'Updated Template Name' })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    name?: string;

    @ApiPropertyOptional({ example: 'Updated description' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    description?: string;

    @ApiPropertyOptional({ example: 54 })
    @IsOptional()
    @IsInt()
    @Min(20)
    @Max(300)
    cardWidthMm?: number;

    @ApiPropertyOptional({ example: 86 })
    @IsOptional()
    @IsInt()
    @Min(20)
    @Max(300)
    cardHeightMm?: number;

    @ApiPropertyOptional({ example: 'landscape', enum: ['landscape', 'portrait'] })
    @IsOptional()
    @IsString()
    @IsIn(['landscape', 'portrait'])
    orientation?: string;

    @ApiPropertyOptional({
        description: 'JSON string representing the array of card elements',
    })
    @IsOptional()
    @IsString()
    elementsJson?: string;

    @ApiPropertyOptional({ example: '#ffffff' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    backgroundColor?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    backgroundImageUrl?: string;
}

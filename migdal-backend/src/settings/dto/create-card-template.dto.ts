import {
    IsNotEmpty,
    IsString,
    IsOptional,
    IsInt,
    IsIn,
    Min,
    Max,
    MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCardTemplateDto {
    @ApiProperty({ example: 'Default Visitor Card' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    name!: string;

    @ApiPropertyOptional({ example: 'Standard visitor badge template' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    description?: string;

    @ApiPropertyOptional({ example: 54, default: 54 })
    @IsOptional()
    @IsInt()
    @Min(20)
    @Max(300)
    cardWidthMm?: number;

    @ApiPropertyOptional({ example: 86, default: 86 })
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

    @ApiProperty({
        example: '[]',
        description: 'JSON string representing the array of card elements',
    })
    @IsString()
    @IsNotEmpty()
    elementsJson!: string;

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

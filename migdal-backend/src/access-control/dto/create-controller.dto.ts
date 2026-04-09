import { IsNotEmpty, IsString, IsOptional, IsInt, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateControllerDto {
    @ApiPropertyOptional({ example: 0 })
    @IsOptional()
    @IsInt()
    type?: number;

    @ApiPropertyOptional({ example: 'AC-2000' })
    @IsOptional()
    @IsString()
    model?: string;

    @ApiProperty({ example: 'Main Entrance Controller' })
    @IsString()
    @IsNotEmpty()
    name!: string;

    @ApiPropertyOptional({ example: '192.168.1.100' })
    @IsOptional()
    @IsString()
    ip?: string;

    @ApiPropertyOptional({ example: 3000 })
    @IsOptional()
    @IsInt()
    port?: number;

    @ApiPropertyOptional({ example: 'EXT-001' })
    @IsOptional()
    @IsString()
    externalId?: string;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

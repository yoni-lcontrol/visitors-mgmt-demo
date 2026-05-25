import { IsNotEmpty, IsString, IsOptional, IsBoolean, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCardholderDto {
    @ApiProperty({ example: 'John' })
    @IsString()
    @IsNotEmpty()
    firstName!: string;

    @ApiProperty({ example: 'Doe' })
    @IsString()
    @IsNotEmpty()
    lastName!: string;

    @ApiProperty({ example: '123456789' })
    @IsString()
    @IsNotEmpty()
    personId!: string;

    @ApiPropertyOptional({ example: 'CARD-001' })
    @IsOptional()
    @IsString()
    cardNumber?: string;

    @ApiPropertyOptional({ example: ['Lobby', 'Floor 2'] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    accessLevelNames?: string[];

    @ApiPropertyOptional({ example: '1234' })
    @IsOptional()
    @IsString()
    pin?: string;

    @ApiPropertyOptional({ example: '2026-04-03T00:00:00Z' })
    @IsOptional()
    @IsString()
    fromDate?: string;

    @ApiPropertyOptional({ example: '2026-12-31T23:59:59Z' })
    @IsOptional()
    @IsString()
    toDate?: string;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    isVisitor?: boolean;

    @ApiPropertyOptional({ example: '12-345-67', description: 'Vehicle license plate number' })
    @IsOptional()
    @IsString()
    licensePlate?: string;
}

import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsArray, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddAmadeusUserDto {
    @ApiProperty({ example: '123456789', description: 'Cardholder ID number' })
    @IsString()
    @IsNotEmpty()
    cardholderIdNumber!: string;

    @ApiProperty({ example: 'John', description: 'First name' })
    @IsString()
    @IsNotEmpty()
    firstName!: string;

    @ApiProperty({ example: 'Doe', description: 'Last name' })
    @IsString()
    @IsNotEmpty()
    lastName!: string;

    @ApiPropertyOptional({ example: 'VIP guest', description: 'Description' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ description: 'Security group API key' })
    @IsOptional()
    @IsString()
    securityGroupApiKey?: string;

    @ApiPropertyOptional({ description: 'Access group API keys', type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    accessGroupApiKeys?: string[];

    @ApiPropertyOptional({ example: '2026-01-01T00:00:00Z', description: 'Valid from date' })
    @IsOptional()
    @IsDateString()
    fromDateValid?: string;

    @ApiPropertyOptional({ example: '2026-12-31T23:59:59Z', description: 'Valid to date' })
    @IsOptional()
    @IsDateString()
    toDateValid?: string;

    @ApiPropertyOptional({ description: 'Whether from-date restriction is active' })
    @IsOptional()
    @IsBoolean()
    isFromDateActive?: boolean;

    @ApiPropertyOptional({ description: 'Whether to-date restriction is active' })
    @IsOptional()
    @IsBoolean()
    isToDateActive?: boolean;

    @ApiPropertyOptional({ example: '12-345-67', description: 'Vehicle license plate number' })
    @IsOptional()
    @IsString()
    licensePlate?: string;
}

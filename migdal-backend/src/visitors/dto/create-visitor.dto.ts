import {
    IsNotEmpty,
    IsString,
    IsOptional,
    IsEmail,
    Matches,
    IsEnum,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VehicleType } from '../enums/vehicle-type.enum';

export class CreateVisitorDto {
    @ApiProperty({ example: '12345678' })
    @IsString()
    @IsNotEmpty()
    @Matches(/^\d+$/, { message: 'personId must contain only digits' })
    personId!: string;

    @ApiProperty({ example: 'Jane' })
    @IsString()
    @IsNotEmpty()
    firstName!: string;

    @ApiProperty({ example: 'Smith' })
    @IsString()
    @IsNotEmpty()
    lastName!: string;

    @ApiPropertyOptional({ example: 'jane@example.com' })
    @Transform(({ value }) => (value === '' ? undefined : value))
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiProperty({ example: '+972501234567' })
    @IsString()
    @IsNotEmpty()
    phone!: string;

    @ApiPropertyOptional({ example: '12-345-67' })
    @IsOptional()
    @IsString()
    carNumber?: string;

    @ApiPropertyOptional({ enum: VehicleType, example: VehicleType.Private })
    @IsOptional()
    @IsEnum(VehicleType)
    vehicleType?: VehicleType;
}

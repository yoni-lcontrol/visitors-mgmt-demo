import {
    IsNotEmpty,
    IsOptional,
    IsString,
    IsEmail,
    IsBoolean,
    IsEnum,
    ValidateIf,
    Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GUID_REGEX } from '../../common/constants/regex.constants';
import { VehicleType } from '../enums/vehicle-type.enum';

export class VisitVisitorItemDto {
    @ApiProperty({ example: 'John' })
    @IsString()
    @IsNotEmpty()
    firstName!: string;

    @ApiProperty({ example: 'Doe' })
    @IsString()
    @IsNotEmpty()
    lastName!: string;

    @ApiPropertyOptional({ example: 'john@example.com' })
    @Transform(({ value }) => (value === '' ? undefined : value))
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiProperty({ example: '+972501234567' })
    @IsString()
    @IsNotEmpty()
    phone!: string;

    @ApiProperty({ example: '123456789' })
    @IsString()
    @IsNotEmpty()
    @Matches(/^\d+$/, { message: 'personId must contain only digits' })
    personId!: string;

    @ApiPropertyOptional({ example: false, description: 'Whether the visitor is coming with a vehicle' })
    @IsOptional()
    @IsBoolean()
    hasVehicle?: boolean;

    @ApiPropertyOptional({ example: '12-345-67' })
    @ValidateIf((o) => o.hasVehicle === true)
    @IsString()
    @IsNotEmpty({ message: 'carNumber is required when hasVehicle is true' })
    carNumber?: string;

    @ApiPropertyOptional({ enum: VehicleType, example: VehicleType.Private })
    @ValidateIf((o) => o.hasVehicle === true)
    @IsEnum(VehicleType, { message: 'vehicleType must be a valid vehicle type' })
    @IsNotEmpty({ message: 'vehicleType is required when hasVehicle is true' })
    vehicleType?: VehicleType;

    @ApiProperty({ description: 'Access level UUID' })
    @Matches(GUID_REGEX, { message: 'accessLevelId must be a valid GUID' })
    @IsNotEmpty()
    accessLevelId!: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    notes?: string;

    @ApiPropertyOptional({ example: false, description: 'Request a parking space (only when hasVehicle is true)' })
    @IsOptional()
    @IsBoolean()
    requestParking?: boolean;
}

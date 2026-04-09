import {
    IsNotEmpty,
    IsString,
    IsOptional,
    IsDateString,
    IsBoolean,
    IsArray,
    Matches,
    ValidateIf,
    IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GUID_REGEX } from '../../common/constants/regex.constants';
import { VehicleType } from '../enums/vehicle-type.enum';

export class CreateBlacklistDto {
    @ApiProperty({ example: 'person', enum: ['person', 'vehicle'] })
    @IsString()
    @IsIn(['person', 'vehicle'])
    blacklistType!: 'person' | 'vehicle';

    @ApiPropertyOptional({ example: 'John' })
    @ValidateIf((o) => o.blacklistType === 'person')
    @IsString()
    @IsNotEmpty()
    firstName?: string;

    @ApiPropertyOptional({ example: 'Doe' })
    @ValidateIf((o) => o.blacklistType === 'person')
    @IsString()
    @IsNotEmpty()
    lastName?: string;

    @ApiPropertyOptional({ example: '123456789' })
    @ValidateIf((o) => o.blacklistType === 'person')
    @IsString()
    @IsNotEmpty()
    @Matches(/^\d+$/, { message: 'idNumber must contain only digits' })
    idNumber?: string;

    @ApiPropertyOptional({ example: '0501234567' })
    @ValidateIf((o) => o.blacklistType === 'person')
    @IsOptional()
    @IsString()
    phoneNumber?: string;

    @ApiPropertyOptional({ example: '12-345-67' })
    @ValidateIf((o) => o.blacklistType === 'vehicle')
    @IsString()
    @IsNotEmpty()
    carNumber?: string;

    @ApiPropertyOptional({ example: 'private', enum: VehicleType })
    @ValidateIf((o) => o.blacklistType === 'vehicle')
    @IsString()
    @IsNotEmpty()
    @IsIn(Object.values(VehicleType))
    vehicleType?: string;

    @ApiProperty({ example: 'Security violation' })
    @IsString()
    @IsNotEmpty()
    reason!: string;

    @ApiProperty({ example: true, description: 'True = permanent blacklist, false = date range' })
    @IsBoolean()
    isPermanent!: boolean;

    @ApiPropertyOptional({ example: '2025-06-01' })
    @ValidateIf((o) => !o.isPermanent)
    @IsDateString()
    startDate?: string;

    @ApiPropertyOptional({ example: '2026-06-01' })
    @ValidateIf((o) => !o.isPermanent)
    @IsDateString()
    endDate?: string;

    @ApiPropertyOptional({ example: 'Additional notes' })
    @IsOptional()
    @IsString()
    notes?: string;

    @ApiPropertyOptional({ example: ['user-uuid-1'], type: [String] })
    @IsOptional()
    @IsArray()
    @Matches(GUID_REGEX, { each: true, message: 'each value in notifyUserIds must be a valid UUID' })
    notifyUserIds?: string[];
}

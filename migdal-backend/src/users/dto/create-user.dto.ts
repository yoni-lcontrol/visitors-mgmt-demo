import { IsNotEmpty, IsString, MinLength, IsOptional, IsEmail, Matches, IsArray } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GUID_REGEX } from '../../common/constants/regex.constants';

export class CreateUserDto {
    @ApiProperty({ example: 'john.doe' })
    @IsString()
    @IsNotEmpty()
    username!: string;

    @ApiProperty({ example: 'SecurePass@123' })
    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    password!: string;

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

    @ApiPropertyOptional({ example: '0501234567' })
    @IsOptional()
    @Transform(({ value }) => (value === '' ? undefined : value))
    @IsString()
    @Matches(/^\d+$/, { message: 'phone must contain only digits' })
    phone?: string;

    @ApiProperty({ example: '123456789' })
    @IsString()
    @IsNotEmpty()
    @Matches(/^\d+$/, { message: 'idNumber must contain only digits' })
    idNumber!: string;

    @ApiPropertyOptional({ example: 'EMP001' })
    @IsOptional()
    @IsString()
    employeeId?: string;

    @ApiPropertyOptional({ example: 'ABC-123' })
    @IsOptional()
    @IsString()
    licensePlate?: string;

    @ApiPropertyOptional({ example: 'role-uuid-1' })
    @IsOptional()
    @IsString()
    roleId?: string;

    @ApiPropertyOptional({ description: 'Array of role IDs to assign', type: [String] })
    @IsOptional()
    @IsArray()
    @Matches(GUID_REGEX, { each: true, message: 'each value in roleIds must be a GUID' })
    roleIds?: string[];
}

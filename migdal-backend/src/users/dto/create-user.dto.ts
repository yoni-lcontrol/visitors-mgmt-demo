import { IsNotEmpty, IsString, MinLength, IsOptional, IsEmail, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
    @ApiProperty({ example: 'john.doe' })
    @IsString()
    @IsNotEmpty()
    username!: string;

    @ApiPropertyOptional({ example: 'SecurePass@123' })
    @Transform(({ value }) => (value === '' ? undefined : value))
    @IsOptional()
    @IsString()
    @MinLength(8)
    password?: string;

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

    @ApiPropertyOptional({ example: ['role-uuid-1'], type: [String] })
    @IsOptional()
    @IsString({ each: true })
    roleIds?: string[];
}

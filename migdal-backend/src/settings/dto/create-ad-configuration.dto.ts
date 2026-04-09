import { IsNotEmpty, IsString, IsOptional, IsInt, IsBoolean, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAdConfigurationDto {
    @ApiProperty({ example: 'Corporate AD' })
    @IsString() @IsNotEmpty()
    name!: string;

    @ApiProperty({ example: 'corp.example.com' })
    @IsString() @IsNotEmpty()
    domain!: string;

    @ApiProperty({ example: 'ldap://dc01.corp.example.com' })
    @IsString() @IsNotEmpty()
    ldapUrl!: string;

    @ApiPropertyOptional({ example: 'DC=corp,DC=example,DC=com' })
    @IsOptional() @IsString()
    baseDn?: string;

    @ApiProperty({ example: 'svc-account' })
    @IsString() @IsNotEmpty()
    username!: string;

    @ApiProperty({ example: 'P@ssw0rd!' })
    @IsString() @IsNotEmpty()
    password!: string;

    @ApiPropertyOptional({ example: 389 })
    @IsOptional() @IsInt() @Min(1) @Max(65535)
    port?: number;

    @ApiPropertyOptional({ example: false })
    @IsOptional() @IsBoolean()
    useSsl?: boolean;

    @ApiPropertyOptional({ example: 'Main corporate directory' })
    @IsOptional() @IsString()
    description?: string;
}

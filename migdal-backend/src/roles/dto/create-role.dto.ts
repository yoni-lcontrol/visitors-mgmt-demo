import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoleDto {
    @ApiProperty({ example: 'SecurityAdmin' })
    @IsString()
    @IsNotEmpty()
    name!: string;

    @ApiPropertyOptional({ example: 'Manages security settings and access control' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ example: ['perm-uuid-1'], type: [String] })
    @IsOptional()
    @IsString({ each: true })
    permissionIds?: string[];
}

import { IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignPermissionsDto {
    @ApiProperty({ example: ['perm-uuid-1', 'perm-uuid-2'], type: [String] })
    @IsArray()
    @IsString({ each: true })
    permissionIds!: string[];
}

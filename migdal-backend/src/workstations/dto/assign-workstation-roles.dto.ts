import { IsArray, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class AssignWorkstationRolesDto {
    @ApiProperty({ description: 'Array of role IDs to assign', type: [String] })
    @IsArray()
    @Matches(UUID_REGEX, { each: true, message: 'each value in roleIds must be a UUID' })
    roleIds!: string[];
}

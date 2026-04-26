import { IsArray, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { GUID_REGEX } from '../../common/constants/regex.constants';

export class AssignUserRolesDto {
    @ApiProperty({ description: 'Array of role IDs to assign', type: [String] })
    @IsArray()
    @Matches(GUID_REGEX, { each: true, message: 'each value in roleIds must be a GUID' })
    roleIds!: string[];
}

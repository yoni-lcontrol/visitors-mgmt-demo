import { IsArray, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class AssignWorkstationUsersDto {
    @ApiProperty({ description: 'Array of user IDs to assign', type: [String] })
    @IsArray()
    @Matches(UUID_REGEX, { each: true, message: 'each value in userIds must be a UUID' })
    userIds!: string[];
}

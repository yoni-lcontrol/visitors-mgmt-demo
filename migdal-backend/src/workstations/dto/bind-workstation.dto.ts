import { IsNotEmpty, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class BindWorkstationDto {
    @ApiProperty({ description: 'Workstation ID to bind to' })
    @IsNotEmpty()
    @Matches(UUID_REGEX, { message: 'workstationId must be a valid UUID' })
    workstationId!: string;
}

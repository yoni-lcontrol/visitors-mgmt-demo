import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DeleteAmadeusUserDto {
    @ApiProperty({ example: 'abc-123-uid', description: 'Amadeus UID of the cardholder to delete' })
    @IsString()
    @IsNotEmpty()
    amadeusUid!: string;
}

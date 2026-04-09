import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EntraLoginDto {
    @ApiProperty({ description: 'Microsoft Entra ID token received from MSAL' })
    @IsString()
    @IsNotEmpty()
    idToken!: string;
}

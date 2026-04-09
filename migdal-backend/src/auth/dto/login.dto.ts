import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
    @ApiProperty({ example: 'admin' })
    @IsString()
    @IsNotEmpty()
    username!: string;

    @ApiProperty({ example: 'Admin@123456' })
    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    password!: string;
}

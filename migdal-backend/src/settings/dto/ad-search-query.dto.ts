import { IsString, MinLength } from 'class-validator';

export class AdSearchQueryDto {
    @IsString()
    @MinLength(2)
    query!: string;
}

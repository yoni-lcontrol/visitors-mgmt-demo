import { IsOptional, IsString, IsIn, IsInt, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { BlacklistOverrideStatus } from '../enums/blacklist-override-status.enum';

export class BlacklistOverrideQueryDto {
    @IsOptional()
    @IsIn([BlacklistOverrideStatus.Pending, BlacklistOverrideStatus.Approved, BlacklistOverrideStatus.Denied])
    status?: BlacklistOverrideStatus;

    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsString()
    filters?: string;

    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    @IsInt()
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    @IsInt()
    @Min(1)
    limit?: number = 20;

    @IsOptional()
    @IsString()
    sortBy?: string;

    @IsOptional()
    @IsIn(['ASC', 'DESC'])
    sortOrder?: 'ASC' | 'DESC';
}

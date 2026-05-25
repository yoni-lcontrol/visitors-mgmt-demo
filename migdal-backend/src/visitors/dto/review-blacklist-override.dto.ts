import { IsIn, IsOptional, IsString } from 'class-validator';
import { BlacklistOverrideStatus } from '../enums/blacklist-override-status.enum';

export class ReviewBlacklistOverrideDto {
    @IsIn([BlacklistOverrideStatus.Approved, BlacklistOverrideStatus.Denied])
    status!: BlacklistOverrideStatus;

    @IsOptional()
    @IsString()
    reviewNote?: string;
}

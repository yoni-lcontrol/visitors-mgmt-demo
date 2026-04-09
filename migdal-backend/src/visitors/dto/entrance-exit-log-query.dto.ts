import { IsOptional, IsString, IsInt, Min, Max, IsIn, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../common/constants/app.constants';

export class EntranceExitLogQueryDto {
    @ApiPropertyOptional({ description: 'Filter from date (ISO 8601)', example: '2026-01-01' })
    @Transform(({ value }) => (value === '' ? undefined : value))
    @IsOptional()
    @IsDateString()
    dateFrom?: string;

    @ApiPropertyOptional({ description: 'Filter to date (ISO 8601)', example: '2026-12-31' })
    @Transform(({ value }) => (value === '' ? undefined : value))
    @IsOptional()
    @IsDateString()
    dateTo?: string;

    @ApiPropertyOptional({ description: 'Filter by status: arrived, checked-in, checked-out' })
    @IsOptional()
    @IsIn(['arrived', 'checked-in', 'checked-out'])
    status?: string;

    @ApiPropertyOptional({ description: 'Filter by person ID' })
    @IsOptional()
    @IsString()
    personId?: string;

    @ApiPropertyOptional({ description: 'Filter by first name' })
    @IsOptional()
    @IsString()
    firstName?: string;

    @ApiPropertyOptional({ description: 'Filter by last name' })
    @IsOptional()
    @IsString()
    lastName?: string;

    @ApiPropertyOptional({ description: 'Filter by phone' })
    @IsOptional()
    @IsString()
    phone?: string;

    @ApiPropertyOptional({ description: 'Filter by email' })
    @IsOptional()
    @IsString()
    email?: string;

    @ApiPropertyOptional({ description: 'Free text search across visitor name, person ID, phone, email' })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ default: 1, minimum: 1 })
    @IsOptional()
    @IsInt()
    @Min(1)
    page: number = 1;

    @ApiPropertyOptional({ default: DEFAULT_PAGE_SIZE, maximum: MAX_PAGE_SIZE })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(MAX_PAGE_SIZE)
    limit: number = DEFAULT_PAGE_SIZE;

    @ApiPropertyOptional({
        description: 'Sort by field',
        enum: ['checkedInAtUtc', 'checkedOutAtUtc', 'arrivedAtUtc', 'lastEventTimeUtc', 'firstName', 'lastName', 'personId', 'currentStatus'],
    })
    @IsOptional()
    @IsString()
    sortBy?: string;

    @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
    @IsOptional()
    @IsIn(['ASC', 'DESC'])
    sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

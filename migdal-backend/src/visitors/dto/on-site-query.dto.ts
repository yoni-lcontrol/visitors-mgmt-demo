import { IsOptional, IsString, IsInt, Min, Max, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../common/constants/app.constants';

export class OnSiteQueryDto {
    @ApiPropertyOptional({ description: 'Date to query on-site visitors for (YYYY-MM-DD). Defaults to today.' })
    @IsOptional()
    @IsString()
    date?: string;

    @ApiPropertyOptional({ description: 'Filter by site ID' })
    @IsOptional()
    @IsString()
    siteId?: string;

    @ApiPropertyOptional({ description: 'Filter by status: arrived, checked-in, or both (default)' })
    @IsOptional()
    @IsIn(['arrived', 'checked-in'])
    status?: string;

    @ApiPropertyOptional({ description: 'Search across visitor name, visit title' })
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

    @ApiPropertyOptional({ description: 'Sort by field', enum: ['visitorName', 'visitTitle', 'arrivedAt', 'status'] })
    @IsOptional()
    @IsString()
    sortBy?: string;

    @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
    @IsOptional()
    @IsIn(['ASC', 'DESC'])
    sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

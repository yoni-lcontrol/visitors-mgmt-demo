import { IsOptional, IsIn, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export type TimeFilter = 'today' | 'future' | 'history';
export type SearchField = 'all' | 'title' | 'visitor' | 'escort' | 'requester' | 'building' | 'personId';

export class VisitsQueryDto extends PaginationQueryDto {
    @ApiPropertyOptional({
        enum: ['today', 'future', 'history'],
        description: 'Filter visits by time category',
    })
    @IsOptional()
    @IsIn(['today', 'future', 'history'])
    timeFilter?: TimeFilter;

    @ApiPropertyOptional({
        enum: ['all', 'title', 'visitor', 'escort', 'requester', 'building', 'personId'],
        description: 'Which field to search in (default: all)',
    })
    @IsOptional()
    @IsString()
    @IsIn(['all', 'title', 'visitor', 'escort', 'requester', 'building', 'personId'])
    searchField?: SearchField;
}

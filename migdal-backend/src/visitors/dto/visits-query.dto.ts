import { IsOptional, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export type TimeFilter = 'today' | 'future' | 'history';

export class VisitsQueryDto extends PaginationQueryDto {
    @ApiPropertyOptional({
        enum: ['today', 'future', 'history'],
        description: 'Filter visits by time category',
    })
    @IsOptional()
    @IsIn(['today', 'future', 'history'])
    timeFilter?: TimeFilter;
}

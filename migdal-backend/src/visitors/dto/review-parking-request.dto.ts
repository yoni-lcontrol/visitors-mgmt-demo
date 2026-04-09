import { IsIn, IsOptional, IsString } from 'class-validator';
import { ParkingRequestStatus } from '../enums/parking-request-status.enum';

export class ReviewParkingRequestDto {
    @IsIn([ParkingRequestStatus.Approved, ParkingRequestStatus.Denied])
    status!: ParkingRequestStatus;

    @IsOptional()
    @IsString()
    reviewNote?: string;
}

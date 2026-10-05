import {
  IsUUID,
  IsString,
  Length,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsIn,
  Matches,
} from 'class-validator';

export class CreateInquiryDto {
  @IsUUID() businessId: string;
  @IsUUID() requestId: string;
  @IsOptional() @IsUUID() packageId?: string;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) eventDate: string;
  @IsString() @Length(2, 250) location: string;
  @IsInt() @Min(1) @Max(100000) guestCount: number;
  @IsString() @Length(10, 3000) requirements: string;
}
export class RespondInquiryDto {
  @IsUUID() requestId: string;
  @IsIn(['REPLIED', 'NEEDS_DETAILS', 'DECLINED']) action:
    'REPLIED' | 'NEEDS_DETAILS' | 'DECLINED';
  @IsString() @Length(1, 2000) text: string;
}

import {
  IsUUID,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
export class CreateBookingDto {
  @IsUUID()
  packageId: string;
  @IsDateString()
  date: string;
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}

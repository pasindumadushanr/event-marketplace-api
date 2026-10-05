import { IsEmail, IsIn, MaxLength } from 'class-validator';
export class NewsletterDto {
  @IsEmail()
  @MaxLength(254)
  email: string;
  @IsIn([true])
  consent: boolean;
}

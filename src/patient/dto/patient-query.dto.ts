import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, Matches } from 'class-validator';
import { blankToUndefined, toPhoneDigits } from '../normalize';

/** Filters for `GET /patients`. Validated rather than best-effort parsed: a filter the server
 *  cannot understand must fail loudly, because silently ignoring it returns every patient — which
 *  reads as "no such record exists" to whoever asked. */
export class PatientQueryDto {
  @Transform(({ value }) => blankToUndefined(value))
  @IsOptional()
  @IsString()
  @Length(1, 50)
  last_name?: string;

  @Transform(({ value }) => blankToUndefined(value))
  @IsOptional()
  @Matches(/^(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\/\d{1,2}\/\d{4})$/, {
    message: 'date_of_birth filter must be MM/DD/YYYY or YYYY-MM-DD',
  })
  date_of_birth?: string;

  @Transform(({ value }) => toPhoneDigits(value))
  @IsOptional()
  @Matches(/^\d{10}$/, {
    message: 'phone_number filter must be a 10-digit U.S. phone number',
  })
  phone_number?: string;
}

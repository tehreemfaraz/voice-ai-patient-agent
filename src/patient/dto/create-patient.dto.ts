import { Sex } from '../../../generated/prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { US_STATE_CODES, toStateCode } from '../us-states';
import { IsPastCalendarDate } from '../validators';
import {
  blankToUndefined,
  parseCalendarDate,
  toPhoneDigits,
  toSex,
} from '../normalize';

const NAME_REGEX = /^[A-Za-z'-]{1,50}$/;
const US_PHONE_REGEX = /^\d{10}$/;
const ZIP_REGEX = /^\d{5}(-\d{4})?$/;

/**
 * The single source of truth for patient field validation. Both the REST controller and the voice
 * agent's tool calls validate through this class, so a rule can never be enforced on one path and
 * missed on the other. Each `@Transform` normalizes the many shapes a value legitimately arrives in
 * (see `../normalize.ts`); each validator then produces a message specific enough for the voice
 * agent to re-prompt for exactly the field that was wrong.
 */
export class CreatePatientDto {
  @Transform(({ value }) => blankToUndefined(value))
  @Matches(NAME_REGEX, {
    message:
      'first_name must be 1-50 alphabetic characters, hyphens or apostrophes',
  })
  first_name: string;

  @Transform(({ value }) => blankToUndefined(value))
  @Matches(NAME_REGEX, {
    message:
      'last_name must be 1-50 alphabetic characters, hyphens or apostrophes',
  })
  last_name: string;

  @Transform(({ value }) => parseCalendarDate(value))
  @IsPastCalendarDate()
  date_of_birth: Date;

  @Transform(({ value }) => toSex(value))
  @IsEnum(Sex, {
    message: 'sex must be one of Male, Female, Other, Decline to Answer',
  })
  sex: Sex;

  @Transform(({ value }) => toPhoneDigits(value))
  @Matches(US_PHONE_REGEX, {
    message: 'phone_number must be a valid 10-digit U.S. phone number',
  })
  phone_number: string;

  @Transform(({ value }) => blankToUndefined(value))
  @IsOptional()
  @IsEmail({}, { message: 'email must be a valid email address' })
  @Length(1, 255)
  email?: string;

  @Transform(({ value }) => blankToUndefined(value))
  @IsString()
  @Length(1, 200)
  address_line_1: string;

  @Transform(({ value }) => blankToUndefined(value))
  @IsOptional()
  @IsString()
  @Length(1, 200)
  address_line_2?: string;

  @Transform(({ value }) => blankToUndefined(value))
  @IsString()
  @Length(1, 100)
  city: string;

  @Transform(({ value }) => toStateCode(value))
  @IsIn(US_STATE_CODES, {
    message: 'state must be a valid 2-letter U.S. state abbreviation',
  })
  state: string;

  @Transform(({ value }) => blankToUndefined(value))
  @Matches(ZIP_REGEX, {
    message: 'zip_code must be a 5-digit or ZIP+4 U.S. format',
  })
  zip_code: string;

  @Transform(({ value }) => blankToUndefined(value))
  @IsOptional()
  @IsString()
  @Length(1, 100)
  insurance_provider?: string;

  @Transform(({ value }) => blankToUndefined(value))
  @IsOptional()
  @Matches(/^[A-Za-z0-9]{1,30}$/, {
    message: 'insurance_member_id must be alphanumeric',
  })
  insurance_member_id?: string;

  // The brief's "Default: English" is enforced by the column default, not here. A DTO-level default
  // would be inherited by `UpdatePatientDto` via `PartialType` and would silently reset a patient's
  // language to English on any partial update that didn't mention it.
  @Transform(({ value }) => blankToUndefined(value))
  @IsOptional()
  @IsString()
  @Length(1, 50)
  preferred_language?: string;

  @Transform(({ value }) => blankToUndefined(value))
  @IsOptional()
  @IsString()
  @Length(1, 100)
  emergency_contact_name?: string;

  @Transform(({ value }) => toPhoneDigits(value))
  @IsOptional()
  @Matches(US_PHONE_REGEX, {
    message:
      'emergency_contact_phone must be a valid 10-digit U.S. phone number',
  })
  emergency_contact_phone?: string;
}

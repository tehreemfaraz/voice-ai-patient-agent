import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Validates a date of birth as one constraint rather than a separate `@IsDate` + `@MaxDate` pair.
 *
 * The pair reports *both* messages for a nonsense date, so "February 30th" came back as "date of
 * birth cannot be in the future" — which the voice agent would then read to a caller whose birthday
 * is nowhere near the future. One constraint means exactly one message, and it is the true one.
 */
@ValidatorConstraint({ name: 'isPastCalendarDate' })
class IsPastCalendarDateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return (
      value instanceof Date &&
      !Number.isNaN(value.getTime()) &&
      value.getTime() <= Date.now()
    );
  }

  defaultMessage(args: ValidationArguments): string {
    const value: unknown = args.value;
    const isRealDate = value instanceof Date && !Number.isNaN(value.getTime());
    return isRealDate
      ? `${args.property} cannot be in the future`
      : `${args.property} must be a valid date (MM/DD/YYYY)`;
  }
}

export function IsPastCalendarDate(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      validator: IsPastCalendarDateConstraint,
    });
  };
}

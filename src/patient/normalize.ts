import { Sex } from '../../generated/prisma/enums';

//Optional fields arrive as "" when a caller declines them; treat blank as "not provided"
export function blankToUndefined(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return value.trim() === '' ? undefined : value.trim();
}

//Reduces a phone number to the 10 U.S. digits we store, dropping punctuation the caller spoke or the client formatted, plus a leading country code
export function toPhoneDigits(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const digits = value.replace(/\D/g, '');
  if (!digits) return undefined;
  return digits.length === 11 && digits.startsWith('1')
    ? digits.slice(1)
    : digits;
}

/** Accepts "Decline to Answer" (the brief's spelling) as well as the `DeclineToAnswer` enum member. */
export function toSex(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const key = value.toLowerCase().replace(/[^a-z]/g, '');
  const match: Record<string, Sex> = {
    male: Sex.Male,
    female: Sex.Female,
    other: Sex.Other,
    declinetoanswer: Sex.DeclineToAnswer,
    decline: Sex.DeclineToAnswer,
    prefernottosay: Sex.DeclineToAnswer,
  };
  return match[key] ?? value;
}

//Parses a date of birth as a timezone-free calendar date.
export function parseCalendarDate(value: unknown): unknown {
  if (value instanceof Date) return value;
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const parts =
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(trimmed) ??
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);

  if (parts) {
    // The MM/DD/YYYY branch captures month first; the YYYY-MM-DD branch captures year first.
    const [year, month, day] = /^\d{4}/.test(trimmed)
      ? [+parts[1], +parts[2], +parts[3]]
      : [+parts[3], +parts[1], +parts[2]];

    const date = new Date(Date.UTC(year, month - 1, day));
    // Date.UTC rolls overflow forward (Feb 30 -> Mar 2); reject rather than silently shift.
    const rolledOver =
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day;
    return rolledOver ? new Date(NaN) : date;
  }

  return new Date(trimmed);
}

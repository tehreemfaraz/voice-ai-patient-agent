import {
  blankToUndefined,
  parseCalendarDate,
  toPhoneDigits,
  toSex,
} from './normalize';
import { toStateCode } from './us-states';

describe('normalize', () => {
  describe('parseCalendarDate', () => {
    // The bug these guard: `new Date('05/14/1990')` resolves in the server's local zone, so west of
    // UTC the stored instant is 1990-05-13T19:00Z — the patient's birthday, off by one day.
    it.each([
      ['05/14/1990', '1990-05-14'],
      ['5/14/1990', '1990-05-14'],
      ['1990-05-14', '1990-05-14'],
      ['1990-5-14', '1990-05-14'],
      ['01/01/2000', '2000-01-01'],
      ['12/31/1999', '1999-12-31'],
    ])('parses %s to %s at UTC midnight', (input, expected) => {
      const parsed = parseCalendarDate(input) as Date;
      expect(parsed.toISOString()).toBe(`${expected}T00:00:00.000Z`);
    });

    it.each(['02/30/1990', '13/01/1990', '00/10/1990', '1990-02-30'])(
      'rejects the impossible date %s instead of rolling it forward',
      (input) => {
        expect(Number.isNaN((parseCalendarDate(input) as Date).getTime())).toBe(
          true,
        );
      },
    );

    it('rejects free text', () => {
      expect(
        Number.isNaN((parseCalendarDate('yesterday') as Date).getTime()),
      ).toBe(true);
    });

    it('passes an existing Date through untouched', () => {
      const date = new Date('1990-05-14T00:00:00.000Z');
      expect(parseCalendarDate(date)).toBe(date);
    });

    it('treats blank as not provided', () => {
      expect(parseCalendarDate('   ')).toBeUndefined();
    });
  });

  describe('toPhoneDigits', () => {
    it.each([
      ['(512) 555-1234', '5125551234'],
      ['512-555-1234', '5125551234'],
      ['512.555.1234', '5125551234'],
      ['1-512-555-1234', '5125551234'],
      ['+1 (512) 555-1234', '5125551234'],
      ['5125551234', '5125551234'],
    ])('reduces %s to %s', (input, expected) => {
      expect(toPhoneDigits(input)).toBe(expected);
    });

    it('leaves a wrong-length number wrong, so the field validator reports it', () => {
      expect(toPhoneDigits('555')).toBe('555');
      expect(toPhoneDigits('25125551234')).toBe('25125551234');
    });

    it('treats blank as not provided', () => {
      expect(toPhoneDigits('')).toBeUndefined();
    });
  });

  describe('toStateCode', () => {
    it.each([
      ['TX', 'TX'],
      ['tx', 'TX'],
      ['Texas', 'TX'],
      ['texas', 'TX'],
      ['new york', 'NY'],
      ['New Hampshire', 'NH'],
      ['Washington DC', 'DC'],
    ])('resolves %s to %s', (input, expected) => {
      expect(toStateCode(input)).toBe(expected);
    });

    it('passes an unknown value through for the validator to reject', () => {
      expect(toStateCode('Ontario')).toBe('ONTARIO');
    });
  });

  describe('toSex', () => {
    it.each([
      ['Male', 'Male'],
      ['female', 'Female'],
      ['Decline to Answer', 'DeclineToAnswer'],
      ['DeclineToAnswer', 'DeclineToAnswer'],
      ['decline-to-answer', 'DeclineToAnswer'],
    ])('maps %s to %s', (input, expected) => {
      expect(toSex(input)).toBe(expected);
    });

    it('passes an unknown value through for the validator to reject', () => {
      expect(toSex('Unknown')).toBe('Unknown');
    });
  });

  describe('blankToUndefined', () => {
    it('converts blank strings to undefined and trims the rest', () => {
      expect(blankToUndefined('')).toBeUndefined();
      expect(blankToUndefined('   ')).toBeUndefined();
      expect(blankToUndefined('  Austin  ')).toBe('Austin');
    });
  });
});

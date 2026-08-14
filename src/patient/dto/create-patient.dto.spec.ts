import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePatientDto } from './create-patient.dto';

/**
 * Exercises the DTO through exactly the calls `VoiceService` makes, so these tests cover the path a
 * real phone call takes — no server, no database. The inputs are shaped the way an LLM fills a tool
 * call from speech: punctuated phone numbers, spoken state names, MM/DD/YYYY dates, and empty
 * strings for the optional fields the caller declined.
 */
async function check(overrides: Record<string, unknown> = {}) {
  const dto = plainToInstance(CreatePatientDto, {
    first_name: 'Maria',
    last_name: 'Davis',
    date_of_birth: '03/09/1985',
    sex: 'Female',
    phone_number: '5125551234',
    address_line_1: '9 Elm St',
    city: 'Austin',
    state: 'TX',
    zip_code: '78704',
    ...overrides,
  });
  const errors = await validate(dto, { whitelist: true });
  return {
    dto,
    messages: errors.flatMap((e) => Object.values(e.constraints ?? {})),
  };
}

describe('CreatePatientDto', () => {
  it('accepts a well-formed registration', async () => {
    const { messages } = await check();
    expect(messages).toEqual([]);
  });

  it('accepts what a voice agent realistically sends and normalizes it for storage', async () => {
    const { dto, messages } = await check({
      date_of_birth: '03/09/1985',
      sex: 'Decline to Answer',
      phone_number: '(512) 555-7788',
      state: 'Texas',
      email: '',
      address_line_2: '',
      insurance_provider: '',
      emergency_contact_phone: '',
    });

    expect(messages).toEqual([]);
    expect(dto.phone_number).toBe('5125557788');
    expect(dto.state).toBe('TX');
    expect(dto.sex).toBe('DeclineToAnswer');
    expect(dto.date_of_birth.toISOString()).toBe('1985-03-09T00:00:00.000Z');
    // Declined optional fields must be absent, not empty strings, or they fail validation and the
    // agent re-prompts the caller for something they already declined.
    expect(dto.email).toBeUndefined();
    expect(dto.address_line_2).toBeUndefined();
    expect(dto.emergency_contact_phone).toBeUndefined();
  });

  it('leaves preferred_language unset so the column default applies', async () => {
    const { dto } = await check();
    expect(dto.preferred_language).toBeUndefined();
  });

  describe('rejections name the field the agent must re-prompt for', () => {
    it.each([
      ['first_name', { first_name: 'John3' }],
      ['first_name', { first_name: 'A'.repeat(51) }],
      ['last_name', { last_name: '' }],
      ['date_of_birth', { date_of_birth: '2099-01-01' }],
      ['date_of_birth', { date_of_birth: 'sometime in the eighties' }],
      ['sex', { sex: 'Unknown' }],
      ['phone_number', { phone_number: '555' }],
      ['email', { email: 'not-an-email' }],
      ['city', { city: '' }],
      ['state', { state: 'Ontario' }],
      ['zip_code', { zip_code: '7870' }],
      ['insurance_member_id', { insurance_member_id: 'BC-123!' }],
      ['emergency_contact_phone', { emergency_contact_phone: '123' }],
    ])('rejects %s', async (field, overrides) => {
      const { messages } = await check(overrides);
      expect(messages.length).toBeGreaterThan(0);
      expect(messages.join(' ')).toContain(field);
    });
  });

  it('reports an impossible date as invalid rather than "in the future"', async () => {
    const { messages } = await check({ date_of_birth: '02/30/1985' });
    expect(messages).toEqual([
      'date_of_birth must be a valid date (MM/DD/YYYY)',
    ]);
  });

  it('reports every bad field at once, so the agent can fix them in one pass', async () => {
    const { messages } = await check({
      phone_number: '55',
      state: 'ZZ',
      zip_code: 'abcde',
    });
    expect(messages.join(' ')).toContain('phone_number');
    expect(messages.join(' ')).toContain('state');
    expect(messages.join(' ')).toContain('zip_code');
  });
});

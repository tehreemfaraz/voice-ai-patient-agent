import {
  ArgumentsHost,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

// The filter logs the stack of every 5xx by design; muting it keeps `npm test` output readable
// instead of printing a scary-looking trace next to a passing test.
beforeEach(() => {
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

interface Envelope {
  data: null;
  error: { statusCode: number; message: string | string[] };
}

function mockHost() {
  const json = jest.fn<void, [Envelope]>();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  const payload = () => json.mock.calls[0][0];
  return { host, status, json, payload };
}

describe('HttpExceptionFilter', () => {
  // The brief lists 500 among the required status codes, and it is the one code the end-to-end
  // suite cannot provoke on demand — an unexpected failure is by definition not something a request
  // can ask for. Covering the filter directly is what makes the claim honest.
  it('maps an unexpected error to 500 in the standard envelope', () => {
    const { host, status, json } = mockHost();
    new HttpExceptionFilter().catch(new Error('connection terminated'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      data: null,
      error: { statusCode: 500, message: 'Internal server error' },
    });
  });

  it('does not leak the underlying failure to the client on a 500', () => {
    const { host, payload } = mockHost();
    new HttpExceptionFilter().catch(
      new Error('password authentication failed for user "postgres"'),
      host,
    );

    expect(JSON.stringify(payload())).not.toContain('password');
  });

  it('preserves the status and message of a deliberate HttpException', () => {
    const { host, status, json } = mockHost();
    new HttpExceptionFilter().catch(
      new NotFoundException('Patient x not found'),
      host,
    );

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      data: null,
      error: { statusCode: 404, message: 'Patient x not found' },
    });
  });

  it('passes a per-field validation message array through intact', () => {
    const { host, payload } = mockHost();
    const messages = [
      'phone_number must be a valid 10-digit U.S. phone number',
    ];
    new HttpExceptionFilter().catch(new BadRequestException(messages), host);

    expect(payload().error.message).toEqual(messages);
  });
});

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { map, Observable } from 'rxjs';

/**
 * Wraps every successful REST response in the { data, error } envelope required by the spec.
 * Skipped for two prefixes: /voice/*, whose responses must match Vapi's own webhook/tool-call
 * schema rather than our API envelope, and /dashboard, which serves an HTML page.
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  private static readonly UNWRAPPED = ['/voice', '/dashboard'];

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    if (
      ResponseInterceptor.UNWRAPPED.some((p) => request.path?.startsWith(p))
    ) {
      return next.handle();
    }
    return next
      .handle()
      .pipe(map((data: unknown) => ({ data: data ?? null, error: null })));
  }
}

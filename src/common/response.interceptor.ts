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
 * Skipped for /voice/* routes: those responses must match Vapi's own webhook/tool-call schema,
 * not our API envelope.
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.path?.startsWith('/voice')) {
      return next.handle();
    }
    return next
      .handle()
      .pipe(map((data: unknown) => ({ data: data ?? null, error: null })));
  }
}

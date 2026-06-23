import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

@Injectable()
@Catch(UnauthorizedException)
export class GoogleOAuthExceptionFilter implements ExceptionFilter {
  constructor(private readonly config: ConfigService) {}

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const path = (req.originalUrl ?? req.url ?? '').split('?')[0];

    if (path === '/api/auth/google/callback') {
      const front = this.config
        .getOrThrow<string>('FRONTEND_URL')
        .replace(/\/$/, '');
      const message =
        typeof exception.getResponse() === 'object' &&
        exception.getResponse() !== null &&
        'message' in (exception.getResponse() as object)
          ? String((exception.getResponse() as { message?: unknown }).message)
          : exception.message;
      res.redirect(
        `${front}/auth/callback?error=${encodeURIComponent(message || 'google_auth_failed')}`,
      );
      return;
    }

    const status = exception.getStatus();
    res.status(status).json(exception.getResponse());
  }
}

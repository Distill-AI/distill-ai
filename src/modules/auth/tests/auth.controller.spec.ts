import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from '@common/filters/http-exception.filter';
import { LoggerContextService } from '@common/logger/logger-context.service';
import { CustomHttpException } from '@common/exceptions/custom-http.exception';
import * as SYS_MSG from '@constants/system-messages';
import { AuthController } from '../auth.controller';
import type { AuthService } from '../services/auth.service';

function setup() {
  const login = vi.fn().mockImplementation(() => {
    throw new CustomHttpException(SYS_MSG.AUTH_LOGIN_NOT_IMPLEMENTED, HttpStatus.NOT_IMPLEMENTED);
  });
  const controller = new AuthController({ login } as unknown as AuthService);
  return { controller, login };
}

function makeHost(
  request: { method: string; url: string },
  response: { status: ReturnType<typeof vi.fn> },
) {
  return {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
}

describe('AuthController.login', () => {
  it('reaches the client as 501, not the @HttpCode(OK) decorator default, when auth is enabled', async () => {
    const { controller } = setup();

    let thrown: unknown;
    try {
      await controller.login({ email: 'a@b.com', password: 'x' });
    } catch (error) {
      thrown = error;
    }

    const filter = new HttpExceptionFilter(new LoggerContextService());
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const response = { status, headersSent: false };
    const host = makeHost({ method: 'POST', url: '/api/v1/auth/login' }, response);

    filter.catch(thrown, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_IMPLEMENTED);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: HttpStatus.NOT_IMPLEMENTED }),
    );
  });
});

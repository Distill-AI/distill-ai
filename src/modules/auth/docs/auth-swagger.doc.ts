import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiBody,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import * as SYS_MSG from '@constants/system-messages';
import { LoginRequestDto } from '../dtos/login.request.dto';
import { LoginResponseDto, UserProfileDto } from './auth-response.dto';

const errorSchema = (statusCode: HttpStatus, error: string, message: string) => ({
  example: {
    success: false,
    statusCode,
    error,
    message,
    path: '/api/v1/auth',
    timestamp: '2026-06-19T00:00:00.000Z',
  },
});

export function LoginDocs() {
  return applyDecorators(
    ApiTags('Auth'),
    ApiOperation({ summary: 'Authenticate user and return JWT token' }),
    ApiBody({ type: LoginRequestDto }),
    ApiExtraModels(LoginResponseDto),
    ApiOkResponse({
      description: SYS_MSG.AUTH_LOGIN_SUCCESS,
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          statusCode: { type: 'number', example: HttpStatus.OK },
          message: { type: 'string', example: SYS_MSG.AUTH_LOGIN_SUCCESS },
          data: { $ref: getSchemaPath(LoginResponseDto) },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Invalid credentials',
      schema: errorSchema(HttpStatus.UNAUTHORIZED, 'Unauthorized', 'Invalid credentials'),
    }),
  );
}

export function ProfileDocs() {
  return applyDecorators(
    ApiTags('Auth'),
    ApiOperation({ summary: 'Get current user profile' }),
    ApiExtraModels(UserProfileDto),
    ApiOkResponse({
      description: SYS_MSG.AUTH_PROFILE_FETCHED,
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          statusCode: { type: 'number', example: HttpStatus.OK },
          message: { type: 'string', example: SYS_MSG.AUTH_PROFILE_FETCHED },
          data: { $ref: getSchemaPath(UserProfileDto) },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Missing or invalid token',
      schema: errorSchema(HttpStatus.UNAUTHORIZED, 'Unauthorized', SYS_MSG.AUTH_UNAUTHORIZED),
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Insufficient permissions',
      schema: errorSchema(HttpStatus.FORBIDDEN, 'Forbidden', SYS_MSG.AUTH_FORBIDDEN),
    }),
  );
}

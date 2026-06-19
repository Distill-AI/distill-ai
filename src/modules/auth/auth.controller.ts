import { Body, Controller, Get, HttpStatus, Post, Req } from '@nestjs/common';
import { AuthService } from './services/auth.service';
import { LoginRequestDto } from './dtos/login.request.dto';
import * as SYS_MSG from '@constants/system-messages';
import { LoginDocs, ProfileDocs } from './docs/auth-swagger.doc';
import { Roles } from './decorators/roles.decorator';
import { Role } from './enums/role.enum';
import type { AuthUser } from './interfaces/';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @LoginDocs()
  async login(@Body() dto: LoginRequestDto) {
    const result = await this.authService.login(dto.email, dto.password);
    return { statusCode: HttpStatus.OK, message: SYS_MSG.AUTH_LOGIN_SUCCESS, data: result };
  }

  @Get('profile')
  @Roles(Role.ADMIN, Role.ESTIMATOR, Role.VIEWER)
  @ProfileDocs()
  profile(@Req() req: { user?: AuthUser }) {
    return { statusCode: HttpStatus.OK, message: SYS_MSG.AUTH_PROFILE_FETCHED, data: req.user! };
  }
}

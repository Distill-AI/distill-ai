import { ApiProperty } from '@nestjs/swagger';

export class LoginResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ description: 'Token lifetime in seconds', example: 3600 })
  expiresIn!: number;

  @ApiProperty()
  tokenType!: string;
}

import { ApiProperty } from '@nestjs/swagger';

export { LoginResponseDto } from '../dtos/login.response.dto';

export class UserProfileDto {
  @ApiProperty({ example: 'u1' })
  userId!: string;

  @ApiProperty({ example: 'org1' })
  orgId!: string;

  @ApiProperty({ example: ['admin', 'estimator'], description: 'User roles' })
  roles!: string[];

  @ApiProperty({ example: 'user@example.com' })
  email!: string;
}

import { IsEnum } from 'class-validator';
import { UserStatus } from '../../users/user.entity';

export class AdminStatusDto {
  @IsEnum(UserStatus)
  status!: UserStatus;
}

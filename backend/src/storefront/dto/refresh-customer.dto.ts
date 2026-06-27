import { IsString, IsNotEmpty } from 'class-validator';

export class RefreshCustomerDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

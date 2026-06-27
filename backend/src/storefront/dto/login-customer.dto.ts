import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class LoginCustomerDto {
  @IsString()
  @Matches(/^0\d{9,10}$/, {
    message: 'Số điện thoại không hợp lệ',
  })
  phone: string;

  @IsString()
  @MinLength(6)
  @MaxLength(64)
  password: string;
}

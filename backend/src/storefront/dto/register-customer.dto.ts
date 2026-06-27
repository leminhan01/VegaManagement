import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterCustomerDto {
  /** Số điện thoại VN (bắt đầu bằng 0, 10-11 chữ số) */
  @IsString()
  @Matches(/^0\d{9,10}$/, {
    message: 'Số điện thoại không hợp lệ (VD: 0901234567)',
  })
  phone: string;

  @IsString()
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  @MaxLength(64)
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Tên không được để trống' })
  @MaxLength(255)
  name: string;
}

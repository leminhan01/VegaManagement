import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Thêm sản phẩm vào giỏ hàng của một phiên chat. Quantity được cộng dồn nếu
 * sản phẩm đã có trong giỏ.
 */
export class AddCartItemDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsInt()
  @Min(1, { message: 'Số lượng phải lớn hơn 0' })
  quantity: number;
}

/**
 * Cập nhật số lượng của một sản phẩm trong giỏ. quantity <= 0 sẽ xóa sản phẩm.
 * productId truyền qua path param.
 */
export class UpdateCartItemDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsInt()
  @Min(0, { message: 'Số lượng không được âm' })
  quantity: number;
}

/**
 * Tạo đơn hàng từ giỏ hàng của phiên chat (chatbot checkout). Thanh toán COD.
 * Customer được find-or-create theo số điện thoại.
 */
export class BotCreateOrderDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsNotEmpty({ message: 'Tên khách hàng không được để trống' })
  @MaxLength(200)
  customerName: string;

  @IsString()
  @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
  @MaxLength(32)
  customerPhone: string;

  @IsString()
  @IsNotEmpty({ message: 'Địa chỉ giao hàng không được để trống' })
  @MaxLength(500)
  shippingAddress: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

/** Chỉ truyền sessionId (dùng cho GET/DELETE qua query). */
export class SessionQueryDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;
}

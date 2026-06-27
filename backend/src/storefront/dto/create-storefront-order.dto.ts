import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class StorefrontOrderItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsInt()
  @Min(1, { message: 'Số lượng phải lớn hơn 0' })
  quantity: number;
}

/**
 * DTO tạo đơn từ storefront. KHÔNG chứa customerId (lấy từ JWT) và discount
 * (khách không được tự giảm giá). MVP chỉ cho phép thanh toán COD.
 */
export class CreateStorefrontOrderDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Đơn hàng phải có ít nhất 1 sản phẩm' })
  @ValidateNested({ each: true })
  @Type(() => StorefrontOrderItemDto)
  items: StorefrontOrderItemDto[];

  @IsString()
  @IsNotEmpty({ message: 'Địa chỉ giao hàng không được để trống' })
  @MaxLength(500)
  shippingAddress: string;

  @IsString()
  @IsNotEmpty({ message: 'Số điện thoại nhận hàng không được để trống' })
  @MaxLength(32)
  shippingPhone: string;

  @IsIn(['COD'], { message: 'Hiện chỉ hỗ trợ thanh toán khi nhận hàng (COD)' })
  paymentMethod: 'COD';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

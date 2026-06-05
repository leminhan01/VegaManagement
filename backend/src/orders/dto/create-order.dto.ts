import {
  IsString,
  IsArray,
  IsEnum,
  IsOptional,
  IsNotEmpty,
  ValidateNested,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';

class OrderItemInput {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @Type(() => Number)
  @Min(1)
  quantity: number;
}

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Đơn hàng phải có ít nhất 1 sản phẩm.' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemInput)
  items: OrderItemInput[];

  @IsString()
  @IsNotEmpty()
  shippingAddress: string;

  @IsString()
  @IsNotEmpty()
  shippingPhone: string;

  @IsEnum(PaymentMethod, {
    message: `Phương thức thanh toán không hợp lệ. Giá trị hợp lệ: ${Object.values(PaymentMethod).join(', ')}`,
  })
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsString()
  note?: string;
}

import { IsEnum, IsNotEmpty } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class UpdateStatusDto {
  @IsEnum(OrderStatus, {
    message: `Trạng thái không hợp lệ. Giá trị hợp lệ: ${Object.values(OrderStatus).join(', ')}`,
  })
  @IsNotEmpty()
  status: OrderStatus;
}

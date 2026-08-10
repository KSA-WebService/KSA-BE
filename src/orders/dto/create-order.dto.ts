import { IsInt, IsUUID, Min } from 'class-validator';

export class CreateOrderDto {
  @IsUUID('4')
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

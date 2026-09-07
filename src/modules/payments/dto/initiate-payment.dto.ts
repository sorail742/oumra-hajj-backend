import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsPositive, IsUUID } from 'class-validator';
import { PaymentMethod } from '../../../common/enums/payment-method.enum';

export class InitiatePaymentDto {
  @ApiProperty()
  @IsUUID()
  bookingId!: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsMongoId, IsNumber, IsPositive } from 'class-validator';
import { PaymentMethod } from '../schemas/payment.schema';

export class InitiatePaymentDto {
  @ApiProperty()
  @IsMongoId()
  bookingId!: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;
}

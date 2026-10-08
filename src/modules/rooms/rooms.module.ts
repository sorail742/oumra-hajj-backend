import { Module } from '@nestjs/common';
import { AgenciesModule } from '../agencies/agencies.module';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

@Module({
  imports: [AgenciesModule],
  controllers: [RoomsController],
  providers: [RoomsService],
})
export class RoomsModule {}

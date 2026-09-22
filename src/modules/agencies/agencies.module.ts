import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { UsersModule } from '../users/users.module';
import { AgenciesController } from './agencies.controller';
import { AgenciesService } from './agencies.service';

@Module({
  imports: [UsersModule, StorageModule],
  controllers: [AgenciesController],
  providers: [AgenciesService],
  exports: [AgenciesService],
})
export class AgenciesModule {}

import { Module } from '@nestjs/common';
import { AgenciesModule } from '../agencies/agencies.module';
import { BookingsModule } from '../bookings/bookings.module';
import { PackagesModule } from '../packages/packages.module';
import { StorageModule } from '../storage/storage.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [AgenciesModule, BookingsModule, PackagesModule, StorageModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}

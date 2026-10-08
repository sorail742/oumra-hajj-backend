import { Module } from '@nestjs/common';
import { AgenciesModule } from '../agencies/agencies.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { DirectoryController } from './directory.controller';
import { DirectoryService } from './directory.service';

@Module({
  imports: [AgenciesModule, ReviewsModule],
  controllers: [DirectoryController],
  providers: [DirectoryService],
})
export class DirectoryModule {}

import { Module } from '@nestjs/common';
import { TokenEventsController } from './token-events.controller';
import { TokenEventsService } from './token-events.service';

@Module({
  controllers: [TokenEventsController],
  providers: [TokenEventsService],
})
export class TokenEventsModule {}

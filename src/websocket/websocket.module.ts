import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { StreamingGateway } from './websocket.gateway';
import { StreamEventsService } from './events.service';
import { StreamMonitorService } from './stream-monitor.service';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
  ],
  providers: [
    StreamingGateway,
    StreamEventsService,
    StreamMonitorService,
  ],
  exports: [
    StreamingGateway,
    StreamEventsService,
    StreamMonitorService,
  ],
})
export class WebSocketModule {}

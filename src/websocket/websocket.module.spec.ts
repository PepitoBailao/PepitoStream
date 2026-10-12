import { Test, TestingModule } from '@nestjs/testing';
import { WebSocketModule } from './websocket.module';
import { StreamingGateway } from './websocket.gateway';
import { StreamEventsService } from './events.service';
import { StreamMonitorService } from './stream-monitor.service';

describe('WebSocketModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [WebSocketModule],
    }).compile();
  });

  it('should compile the module', () => {
    expect(module).toBeDefined();
  });

  it('should provide StreamingGateway', () => {
    const gateway = module.get<StreamingGateway>(StreamingGateway);
    expect(gateway).toBeDefined();
  });

  it('should provide StreamEventsService', () => {
    const service = module.get<StreamEventsService>(StreamEventsService);
    expect(service).toBeDefined();
  });

  it('should provide StreamMonitorService', () => {
    const service = module.get<StreamMonitorService>(StreamMonitorService);
    expect(service).toBeDefined();
  });
});

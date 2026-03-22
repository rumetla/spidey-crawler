import { Global, Module } from '@nestjs/common';
import { SSEService } from './sse.service';

@Global()
@Module({
  providers: [SSEService],
  exports: [SSEService],
})
export class SSEModule {}

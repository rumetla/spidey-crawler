import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { SSEEvent, SSEEventType } from '../common/interfaces';

@Injectable()
export class SSEService {
  private readonly logger = new Logger(SSEService.name);
  private readonly eventBus = new Subject<SSEEvent>();

  /** Emit an event to all connected SSE clients */
  emit(type: SSEEventType, data: SSEEvent['data']): void {
    const event: SSEEvent = {
      type,
      data,
      timestamp: Date.now(),
    };
    this.eventBus.next(event);
  }

  /** Subscribe to the SSE event stream (used by the controller) */
  subscribe(): Observable<SSEEvent> {
    return this.eventBus.asObservable();
  }

  /** Convenience: emit a log message */
  log(level: 'info' | 'warn' | 'error', message: string): void {
    this.emit('log', { level, message, timestamp: Date.now() });
  }
}

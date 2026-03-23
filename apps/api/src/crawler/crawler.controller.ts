import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Sse,
  ParseIntPipe,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { CrawlerService } from './crawler.service';
import { SSEService } from '../sse/sse.service';
import { CreateJobDto, SSEEvent } from '../common/interfaces';

@Controller('api/crawl')
export class CrawlerController {
  constructor(
    private readonly crawler: CrawlerService,
    private readonly sse: SSEService,
  ) {}

  @Post()
  createJob(@Body() dto: CreateJobDto) {
    if (!dto.originUrl) {
      throw new HttpException('originUrl is required', HttpStatus.BAD_REQUEST);
    }

    try {
      new URL(dto.originUrl);
    } catch {
      throw new HttpException('Invalid URL format', HttpStatus.BAD_REQUEST);
    }

    const job = this.crawler.startJob(
      dto.originUrl,
      dto.maxDepth ?? 2,
      dto.maxWorkers ?? 4,
      dto.maxQueueSize ?? 1000,
      dto.sameDomain ?? false,
    );

    return { jobId: job.id, status: job.status };
  }

  @Sse('events')
  events(): Observable<MessageEvent> {
    return this.sse.subscribe().pipe(
      map((event: SSEEvent) => {
        return {
          data: JSON.stringify(event),
          type: event.type,
        } as MessageEvent;
      }),
    );
  }

  @Get(':id')
  getJob(@Param('id', ParseIntPipe) id: number) {
    const job = this.crawler.getJob(id);
    if (!job) {
      throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
    }
    return job;
  }

  @Delete(':id')
  cancelJob(@Param('id', ParseIntPipe) id: number) {
    this.crawler.cancelJob(id);
    return { cancelled: true };
  }
}

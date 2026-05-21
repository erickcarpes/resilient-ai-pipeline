import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Res,
} from '@nestjs/common';
import { type Response } from 'express';
import { MeetingsService } from './meetings.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import {
  MeetingStatusDto,
  MeetingSubmittedDto,
} from './dto/meeting-response.dto';
import { AppLogger } from '@pipeline/shared';

@Controller('meetings')
export class MeetingsController {
  private readonly logger: AppLogger;
  constructor(
    private readonly meetingsService: MeetingsService,
    baseLogger: AppLogger,
  ) {
    this.logger = baseLogger.child({
      component: 'meetings.controller',
    });
  }

  /**
   * POST /meetings
   * Submit a meeting for pipeline processing.
   * Returns 202 ACCEPTED — processing is async.
   *
   * Idempotent: providing the same meetingId returns the existing state (200).
   */
  @Post()
  async submit(
    @Body() dto: CreateMeetingDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MeetingSubmittedDto> {
    const requestedId = dto.meetingId ?? 'auto';
    this.logger.info({
      event: 'MEETING_CREATE_REQUESTED',
      meetingId: requestedId,
    });
    const result = await this.meetingsService.submit(dto);
    if (result.isDuplicate) {
      res.status(HttpStatus.OK);
    } else {
      res.status(HttpStatus.ACCEPTED);
    }
    return result;
  }

  /**
   * GET /meetings/:id
   * Returns the current state of a meeting and its pipeline results.
   * Poll this endpoint after POST to track processing progress.
   *
   * ParseUUIDPipe validates the ID format before hitting the service.
   */
  @Get(':id')
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MeetingStatusDto> {
    return this.meetingsService.findById(id);
  }

  /**
   * POST /meetings/load-test/:count
   * Utility endpoint to dispatch multiple meetings at once to test resilience
   * and observability.
   */
  @Post('load-test/:count')
  @HttpCode(HttpStatus.ACCEPTED)
  async loadTest(@Param('count', ParseIntPipe) count: number) {
    const num = Math.min(count, 100); // Cap at 100 for safety
    const promises = [];

    for (let i = 0; i < num; i++) {
      promises.push(
        this.meetingsService.submit({
          title: `Load Test Meeting ${i + 1}`,
          participants: ['Alice', 'Bob'],
          rawAudioText: `This is a generated payload for load testing. Iteration ${i}. We need to talk about system performance and observability.`,
        }),
      );
    }

    await Promise.all(promises);
    return { message: `Successfully queued ${num} meetings for load testing.` };
  }
}

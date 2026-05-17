import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { MeetingStatusDto, MeetingSubmittedDto } from './dto/meeting-response.dto';

@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  /**
   * POST /meetings
   * Submit a meeting for pipeline processing.
   * Returns 202 ACCEPTED — processing is async.
   *
   * Idempotent: providing the same meetingId returns the existing state (200).
   */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async submit(@Body() dto: CreateMeetingDto): Promise<MeetingSubmittedDto> {
    return this.meetingsService.submit(dto);
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
}

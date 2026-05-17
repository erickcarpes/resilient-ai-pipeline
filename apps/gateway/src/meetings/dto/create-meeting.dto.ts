// =============================================================================
// CREATE MEETING DTO — Request validation
// =============================================================================
// DTOs (Data Transfer Objects) are the "border guards" of your API.
// They validate and shape incoming data BEFORE it reaches business logic.
//
// class-validator decorators define the rules.
// class-transformer converts plain JSON to class instances (needed for validation).
// NestJS's ValidationPipe (set in main.ts) enforces these rules automatically.
//
// WHY NOT validate in the service? Because validation is an infrastructure concern,
// not a business concern. The service should only handle valid data.
// =============================================================================

import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ArrayMinSize,
  MaxLength,
} from 'class-validator';

export class CreateMeetingDto {
  /**
   * Optional client-provided idempotency key.
   * If provided and a meeting with this ID already exists,
   * the gateway returns the existing meeting state (HTTP 200) instead
   * of creating a new one. This is HTTP-level idempotency.
   *
   * If omitted, a UUID is auto-generated.
   */
  @IsOptional()
  @IsUUID()
  meetingId?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  /**
   * At least one participant is required.
   * Each participant must be a non-empty string.
   */
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  participants: string[];

  /**
   * Simulated audio content (in real system: S3 URL or base64 audio).
   * Minimum 10 chars to avoid trivially empty meetings.
   */
  @IsString()
  @MinLength(10)
  rawAudioText: string;
}

import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Trim } from '../common/trim';
import { PlannedExerciseDto } from '../workouts/dto/planned-workout.dto';

const DATE = /^(19|20)\d{2}-\d{2}-\d{2}$/;
const DATE_MESSAGE = 'must be a calendar date (yyyy-mm-dd)';

/** The most that can be scheduled in one go: a week repeated for four weeks, every day. */
export const MAX_SCHEDULE_ITEMS = 28;

export class ScheduleItemDto {
  @Matches(DATE, { message: `date ${DATE_MESSAGE}` })
  @IsDateString({ strict: true })
  date: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(255)
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => PlannedExerciseDto)
  exercises: PlannedExerciseDto[];
}

export class CreateScheduleDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SCHEDULE_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => ScheduleItemDto)
  items: ScheduleItemDto[];
}

export class MoveScheduleDto {
  @Matches(DATE, { message: `date ${DATE_MESSAGE}` })
  @IsDateString({ strict: true })
  date: string;
}

export class ScheduleRangeDto {
  @Matches(DATE, { message: `from ${DATE_MESSAGE}` })
  @IsDateString({ strict: true })
  from: string;

  @Matches(DATE, { message: `to ${DATE_MESSAGE}` })
  @IsDateString({ strict: true })
  to: string;
}

export class StartScheduleDto {
  /** The caller's local date: the workout is created on this day. */
  @IsOptional()
  @Matches(DATE, { message: `today ${DATE_MESSAGE}` })
  @IsDateString({ strict: true })
  today?: string;
}

import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Trim } from '../common/trim';

/** What a plan can be asked to focus on; the coach gets the muscles each one means. */
export const PLAN_FOCUSES = [
  'legs',
  'push',
  'pull',
  'upper',
  'lower',
  'full_body',
] as const;
export type PlanFocus = (typeof PLAN_FOCUSES)[number];

/** Longest wish the lifter can type for one plan. */
export const PLAN_NOTE_MAX = 120;

export class AnalyseDto {
  /** The caller's local date; decides which week is "this week". */
  @IsOptional()
  @Matches(/^(19|20)\d{2}-\d{2}-\d{2}$/, { message: 'today must be YYYY-MM-DD' })
  @IsDateString({ strict: true })
  today?: string;

  /** Language the analysis is written in. */
  @IsOptional()
  @IsIn(['en', 'nl'])
  locale?: 'en' | 'nl';
}

/** The lifter's wish for this one plan: a focus and a short note, both optional. */
export class PlanRequestDto extends AnalyseDto {
  @IsOptional()
  @IsIn(PLAN_FOCUSES)
  focus?: PlanFocus;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(PLAN_NOTE_MAX)
  note?: string;
}

export class SuggestWorkoutDto extends PlanRequestDto {
  /** The day the workout is for (scheduling ahead); the next session when left out. */
  @IsOptional()
  @Matches(/^(19|20)\d{2}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  @IsDateString({ strict: true })
  date?: string;
}

export class SuggestWeekDto extends PlanRequestDto {
  /** How many days the user wants to train that week. */
  @IsInt()
  @Min(1)
  @Max(7)
  days: number;
}

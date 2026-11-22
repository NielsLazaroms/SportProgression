import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Trim } from '../common/trim';
import { KNOWN_MUSCLE_GROUPS } from '../exercise-definitions/default-exercises';
import { GoalKind } from './goal.entity';

const DATE = /^(19|20)\d{2}-\d{2}-\d{2}$/;
const isLift = (o: SaveGoalDto) => o.kind === GoalKind.LIFT;
const isMuscle = (o: SaveGoalDto) => o.kind === GoalKind.MUSCLE;

/** Creates or replaces a goal. Fields of the other kind are ignored. */
export class SaveGoalDto {
  @IsIn(Object.values(GoalKind))
  kind: GoalKind;

  @ValidateIf(isLift)
  @IsInt()
  exerciseDefinitionId?: number;

  /** For a bodyweight exercise: extra weight on top of body weight (0 for none). */
  @ValidateIf(isLift)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(2000)
  targetWeightKg?: number;

  @ValidateIf(isLift)
  @IsInt()
  @Min(1)
  @Max(1000)
  targetReps?: number;

  @ValidateIf(isMuscle)
  @IsIn(KNOWN_MUSCLE_GROUPS)
  muscleGroup?: string;

  @ValidateIf(isMuscle)
  @IsInt()
  @Min(1)
  @Max(60)
  targetSetsPerWeek?: number;

  @IsOptional()
  @Matches(DATE, { message: 'targetDate must be YYYY-MM-DD' })
  @IsDateString({ strict: true })
  targetDate?: string | null;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(200)
  note?: string | null;
}

export class GoalsQueryDto {
  /** The caller's local date: decides "this week" and the days left. */
  @IsOptional()
  @Matches(DATE, { message: 'today must be YYYY-MM-DD' })
  @IsDateString({ strict: true })
  today?: string;
}

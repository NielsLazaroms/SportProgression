import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Trim } from '../../common/trim';
import { CreateWorkoutDto } from './create-workout.dto';

export class PlannedExerciseDto {
  @IsInt()
  exerciseDefinitionId: number;

  @IsInt()
  @Min(1)
  @Max(20)
  targetSets: number;

  @IsInt()
  @Min(1)
  @Max(1000)
  targetReps: number;

  /** Suggested working weight (extra weight for bodyweight exercises). */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(2000)
  targetWeightKg?: number;

  /** Same number on neighbouring exercises = one superset. */
  @IsOptional()
  @IsInt()
  @Min(1)
  supersetGroup?: number | null;

  /** The planner's reason for this exercise; shown apart from the user's notes. */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(255)
  planNote?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(255)
  notes?: string;
}

/** A new workout that already has its exercises and targets (no sets yet). */
export class PlannedWorkoutDto extends CreateWorkoutDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => PlannedExerciseDto)
  exercises: PlannedExerciseDto[];
}

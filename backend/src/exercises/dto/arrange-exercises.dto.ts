import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';

export class ArrangedExerciseDto {
  @IsInt()
  id: number;

  /** Same number on neighbouring exercises = one superset. */
  @IsOptional()
  @IsInt()
  @Min(1)
  supersetGroup?: number | null;
}

/** The workout's exercises in their new order, with superset grouping. */
export class ArrangeExercisesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ArrangedExerciseDto)
  exercises: ArrangedExerciseDto[];
}

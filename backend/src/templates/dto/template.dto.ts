import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Trim } from '../../common/trim';

export class TemplateExerciseDto {
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

  /** Same number on neighbouring exercises = one superset. */
  @IsOptional()
  @IsInt()
  @Min(1)
  supersetGroup?: number | null;
}

export class SaveTemplateDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  /** In order. Replaces the template's whole exercise list. */
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => TemplateExerciseDto)
  exercises: TemplateExerciseDto[];
}

export class TemplateFromWorkoutDto {
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;
}

export class StartTemplateDto {
  @IsOptional()
  @Matches(/^(19|20)\d{2}-\d{2}-\d{2}$/, {
    message: 'date must be a calendar date (yyyy-mm-dd)',
  })
  date?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(255)
  description?: string;
}

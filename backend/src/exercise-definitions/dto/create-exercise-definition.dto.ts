import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Trim } from '../../common/trim';
import { ApiProperty } from '@nestjs/swagger';
import { ExerciseType } from '../exercise-definition.entity';

export class CreateExerciseDefinitionDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @ApiProperty({ example: 'Bench Press' })
  name: string;

  // StrengthExercise (default) or BodyweightExercise, where the weight of a
  // set means EXTRA weight on top of the lifter's own body weight.
  @IsOptional()
  @IsEnum(ExerciseType)
  @ApiProperty({ example: ExerciseType.STRENGTH, enum: ExerciseType, required: false })
  type?: ExerciseType;

  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @ApiProperty({ example: 'Chest' })
  muscleGroup: string;
}

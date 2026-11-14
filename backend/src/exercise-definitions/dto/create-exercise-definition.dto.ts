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

  // The app currently only tracks strength ("power") exercises; type defaults
  // to STRENGTH when omitted.
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

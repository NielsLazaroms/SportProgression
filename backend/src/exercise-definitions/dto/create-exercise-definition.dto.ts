import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ExerciseType } from '../exercise-definition.entity';

export class CreateExerciseDefinitionDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'Bench Press' })
  name: string;

  // The app currently only tracks strength ("power") exercises; type defaults
  // to STRENGTH when omitted.
  @IsOptional()
  @IsEnum(ExerciseType)
  @ApiProperty({ example: ExerciseType.STRENGTH, enum: ExerciseType, required: false })
  type?: ExerciseType = ExerciseType.STRENGTH;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'Chest' })
  muscleGroup: string;
}

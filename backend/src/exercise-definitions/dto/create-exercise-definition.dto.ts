import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ExerciseType } from '../exercise-definition.entity';

export class CreateExerciseDefinitionDto {
  @IsString()
  @ApiProperty({ example: 'Bench Press' })
  name: string;

  @IsEnum(ExerciseType)
  @ApiProperty({ example: ExerciseType.STRENGTH, enum: ExerciseType })
  type: ExerciseType;

  @IsOptional()
  @IsString()
  @ApiProperty({ example: 'Chest', required: false })
  muscleGroup?: string;
}

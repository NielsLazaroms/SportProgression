import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ExerciseType } from '../exercise.entity';

export class CreateExerciseDto {
  @IsEnum(ExerciseType)
  @ApiProperty({ example: ExerciseType.STRENGTH, enum: ExerciseType })
  type: ExerciseType;

  @IsString()
  @ApiProperty({ example: 'Bench Press' })
  name: string;

  @IsInt()
  @Min(1)
  @ApiProperty({ example: 1 })
  orderInWorkout: number;

  @IsOptional()
  @IsString()
  @ApiProperty({ example: 'Go heavy today', required: false })
  notes?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    example: 'Chest',
    required: false,
    description: 'Required when type is STRENGTH',
  })
  muscleGroup?: string;
}

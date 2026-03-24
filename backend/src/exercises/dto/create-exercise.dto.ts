import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWorkoutExerciseDto {
  @IsInt()
  @ApiProperty({
    example: 1,
    description: 'ID from the exercise definitions catalog',
  })
  exerciseDefinitionId: number;

  @IsInt()
  @Min(1)
  @ApiProperty({ example: 1 })
  orderInWorkout: number;

  @IsOptional()
  @IsString()
  @ApiProperty({ example: 'Go heavy today', required: false })
  notes?: string;
}

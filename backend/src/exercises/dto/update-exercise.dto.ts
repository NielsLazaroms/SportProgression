import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateWorkoutExerciseDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @ApiProperty({ example: 1, required: false })
  orderInWorkout?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @ApiProperty({ example: 'Go heavy today', required: false })
  notes?: string;
}

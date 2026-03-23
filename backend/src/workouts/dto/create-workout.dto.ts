import { IsDateString, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWorkoutDto {
  @IsDateString()
  @ApiProperty({ example: '2024-01-01' })
  date: string;

  @IsString()
  @ApiProperty({ example: 'Push Day' })
  name: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ example: 'Upper body focus', required: false })
  description?: string;
}

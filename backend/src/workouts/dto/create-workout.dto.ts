import { IsDateString, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWorkoutDto {
  @IsDateString()
  @ApiProperty({ example: '2024-01-01' })
  date: string;

  @IsString()
  @ApiProperty({ example: 'Some note' })
  note: string;
}

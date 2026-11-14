import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Trim } from '../../common/trim';

export class CreateWorkoutDto {
  // A plain calendar day (yyyy-mm-dd) in a sane range; strict rejects
  // impossible dates such as 2026-02-31.
  @Matches(/^(19|20)\d{2}-\d{2}-\d{2}$/, {
    message: 'date must be a calendar date (yyyy-mm-dd)',
  })
  @IsDateString({ strict: true })
  @ApiProperty({ example: '2024-01-01' })
  date: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @ApiProperty({ example: 'Push Day' })
  name: string;

  @Trim()
  @IsString()
  @MaxLength(255)
  @IsOptional()
  @ApiProperty({ example: 'Upper body focus', required: false })
  description?: string;
}

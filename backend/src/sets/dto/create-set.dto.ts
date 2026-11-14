import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSetDto {
  @IsInt()
  @Min(1)
  @ApiProperty({ example: 1 })
  setOrder: number;

  // Bounds catch typos (e.g. 1825 kg) before they poison records and charts.
  @IsInt()
  @Min(1)
  @Max(1000)
  @ApiProperty({ example: 10 })
  repsAmount: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(2000)
  @ApiProperty({ example: 80.5 })
  weightKg: number;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ example: false, required: false })
  isWarmup?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @ApiProperty({ example: 'Felt easy', required: false })
  notes?: string;
}

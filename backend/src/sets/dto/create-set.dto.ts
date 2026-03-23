import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSetDto {
  @IsInt()
  @Min(1)
  @ApiProperty({ example: 1 })
  setOrder: number;

  @IsInt()
  @Min(0)
  @ApiProperty({ example: 10 })
  repsAmount: number;

  @IsNumber()
  @Min(0)
  @ApiProperty({ example: 80.5 })
  weightKg: number;

  @IsOptional()
  @IsString()
  @ApiProperty({ example: 'Felt easy', required: false })
  notes?: string;
}

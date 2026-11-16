import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Trim } from '../common/trim';

export class GymEquipmentDto {
  /** Keys of the standard equipment the gym has, plus names of other machines. */
  @IsArray()
  @ArrayMaxSize(60)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  equipment: string[];

  /** What the user calls their gym. Left as it is when not sent; empty clears it. */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(60)
  name?: string;
}

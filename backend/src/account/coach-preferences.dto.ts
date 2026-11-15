import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Trim } from '../common/trim';

/** What the user wants the AI coach to take into account when planning. */
export class CoachPreferencesDto {
  /** Preferred training days, 1 = Monday ... 7 = Sunday. */
  @IsArray()
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  trainingDays: number[];

  /** Free text on how plans should look. */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(300)
  note?: string;
}

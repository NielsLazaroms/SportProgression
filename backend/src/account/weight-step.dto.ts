import { IsNumber, Max, Min } from 'class-validator';

/** Smallest and largest step for the weight + and - buttons, in kg. */
export const WEIGHT_STEP_MIN = 0.1;
export const WEIGHT_STEP_MAX = 50;

/**
 * The app offers 1, 2, 2.5 and 5 kg, plus any other step the user types in
 * ("Custom"), with at most two decimals.
 */
export class WeightStepDto {
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(WEIGHT_STEP_MIN)
  @Max(WEIGHT_STEP_MAX)
  weightStepKg: number;
}

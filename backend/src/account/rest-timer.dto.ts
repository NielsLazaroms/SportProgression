import { IsInt, Max, Min } from 'class-validator';

/** Longest rest the timer counts down, in seconds. */
export const REST_TIMER_MAX = 600;

/**
 * How long the rest countdown after a logged set runs, in seconds.
 * 0 means the timer is off (the default).
 */
export class RestTimerDto {
  @IsInt()
  @Min(0)
  @Max(REST_TIMER_MAX)
  restTimerSeconds: number;
}

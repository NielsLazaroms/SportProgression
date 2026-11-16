import { IsDateString, IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

export class AnalyseDto {
  /** The caller's local date; decides which week is "this week". */
  @IsOptional()
  @Matches(/^(19|20)\d{2}-\d{2}-\d{2}$/, { message: 'today must be YYYY-MM-DD' })
  @IsDateString({ strict: true })
  today?: string;

  /** Language the analysis is written in. */
  @IsOptional()
  @IsIn(['en', 'nl'])
  locale?: 'en' | 'nl';
}

export class SuggestWorkoutDto extends AnalyseDto {
  /** The day the workout is for (scheduling ahead); the next session when left out. */
  @IsOptional()
  @Matches(/^(19|20)\d{2}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  @IsDateString({ strict: true })
  date?: string;
}

export class SuggestWeekDto extends AnalyseDto {
  /** How many days the user wants to train that week. */
  @IsInt()
  @Min(1)
  @Max(7)
  days: number;
}

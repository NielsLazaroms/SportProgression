import { ArrayMaxSize, IsArray, IsString, MaxLength } from 'class-validator';

export class IgnoredMuscleGroupsDto {
  /** Names of the muscle groups the user does not train on purpose. */
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  ignored: string[];
}

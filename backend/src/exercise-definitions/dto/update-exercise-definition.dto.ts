import { PartialType } from '@nestjs/swagger';
import { CreateExerciseDefinitionDto } from './create-exercise-definition.dto';

export class UpdateExerciseDefinitionDto extends PartialType(
  CreateExerciseDefinitionDto,
) {}

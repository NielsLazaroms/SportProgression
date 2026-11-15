import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ExerciseDefinitionsService } from './exercise-definitions.service';
import { CreateExerciseDefinitionDto } from './dto/create-exercise-definition.dto';
import { UpdateExerciseDefinitionDto } from './dto/update-exercise-definition.dto';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ExerciseDefinition } from './exercise-definition.entity';
import { AuthGuard } from '@nestjs/passport';

/**
 * What clients get to see of a catalog entry. The catalog is shared between
 * all users, so the creator's account id is never exposed: only whether the
 * entry belongs to the caller (and may therefore be edited or deleted).
 */
function toPublic(def: ExerciseDefinition, userId: string) {
  const { createdByUserId, createdByUser, workoutExercises, ...rest } = def;
  void createdByUser;
  void workoutExercises;
  return { ...rest, mine: !!createdByUserId && createdByUserId === userId };
}

@ApiTags('Exercise Definitions')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('exercise-definitions')
export class ExerciseDefinitionsController {
  constructor(private readonly service: ExerciseDefinitionsService) {}

  @ApiOperation({ summary: 'Get all available exercise definitions' })
  @ApiOkResponse({ type: [ExerciseDefinition] })
  @Get()
  async findAll(@Req() req) {
    const all = await this.service.findAll();
    return all.map((d) => toPublic(d, req.user.userId));
  }

  @ApiOperation({ summary: 'Get a specific exercise definition' })
  @ApiParam({
    name: 'id',
    description: 'The unique identifier of the exercise definition',
  })
  @ApiOkResponse({ type: ExerciseDefinition })
  @ApiNotFoundResponse({ description: 'Exercise definition not found' })
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return toPublic(await this.service.findOne(id), req.user.userId);
  }

  @ApiOperation({ summary: 'Create a new exercise definition' })
  @ApiOkResponse({ type: ExerciseDefinition })
  @Post()
  async create(@Body() dto: CreateExerciseDefinitionDto, @Req() req) {
    return toPublic(
      await this.service.create(dto, req.user.userId),
      req.user.userId,
    );
  }

  @ApiOperation({ summary: 'Update an exercise definition' })
  @ApiParam({
    name: 'id',
    description: 'The unique identifier of the exercise definition',
  })
  @ApiOkResponse({ type: ExerciseDefinition })
  @ApiNotFoundResponse({ description: 'Exercise definition not found' })
  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateExerciseDefinitionDto,
    @Req() req,
  ) {
    return toPublic(
      await this.service.update(id, dto, req.user.userId),
      req.user.userId,
    );
  }

  @ApiOperation({ summary: 'Delete an exercise definition' })
  @ApiParam({
    name: 'id',
    description: 'The unique identifier of the exercise definition',
  })
  @ApiOkResponse({
    description: 'The exercise definition has been successfully deleted',
  })
  @ApiNotFoundResponse({ description: 'Exercise definition not found' })
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.service.remove(id, req.user.userId);
  }
}

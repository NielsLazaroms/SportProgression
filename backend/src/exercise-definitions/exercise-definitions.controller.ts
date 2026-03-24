import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
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

@ApiTags('Exercise Definitions')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('exercise-definitions')
export class ExerciseDefinitionsController {
  constructor(private readonly service: ExerciseDefinitionsService) {}

  @ApiOperation({ summary: 'Get all available exercise definitions' })
  @ApiOkResponse({ type: [ExerciseDefinition] })
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @ApiOperation({ summary: 'Get a specific exercise definition' })
  @ApiParam({
    name: 'id',
    description: 'The unique identifier of the exercise definition',
  })
  @ApiOkResponse({ type: ExerciseDefinition })
  @ApiNotFoundResponse({ description: 'Exercise definition not found' })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @ApiOperation({ summary: 'Create a new exercise definition' })
  @ApiOkResponse({ type: ExerciseDefinition })
  @Post()
  create(@Body() dto: CreateExerciseDefinitionDto) {
    return this.service.create(dto);
  }

  @ApiOperation({ summary: 'Update an exercise definition' })
  @ApiParam({
    name: 'id',
    description: 'The unique identifier of the exercise definition',
  })
  @ApiOkResponse({ type: ExerciseDefinition })
  @ApiNotFoundResponse({ description: 'Exercise definition not found' })
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateExerciseDefinitionDto,
  ) {
    return this.service.update(id, dto);
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
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}

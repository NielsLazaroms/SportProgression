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
import { ExercisesService } from './exercises.service';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { UpdateExerciseDto } from './dto/update-exercise.dto';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Exercise } from './exercise.entity';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Exercises')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('workouts/:workoutId/exercises')
export class ExercisesController {
  constructor(private readonly exercisesService: ExercisesService) {}

  @ApiOperation({ summary: 'Get all exercises for a workout' })
  @ApiParam({
    name: 'workoutId',
    description: 'The unique identifier of the workout',
  })
  @ApiOkResponse({ type: [Exercise] })
  @Get()
  findAll(@Param('workoutId') workoutId: string) {
    return this.exercisesService.findAll(workoutId);
  }

  @ApiOperation({ summary: 'Get a specific exercise by ID' })
  @ApiParam({
    name: 'workoutId',
    description: 'The unique identifier of the workout',
  })
  @ApiParam({
    name: 'id',
    description: 'The unique identifier of the exercise',
  })
  @ApiOkResponse({ type: Exercise })
  @ApiNotFoundResponse({ description: 'Exercise not found' })
  @Get(':id')
  findOne(
    @Param('workoutId') workoutId: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.exercisesService.findOne(id, workoutId);
  }

  @ApiOperation({ summary: 'Create a new exercise for a workout' })
  @ApiParam({
    name: 'workoutId',
    description: 'The unique identifier of the workout',
  })
  @ApiOkResponse({ type: Exercise })
  @Post()
  create(
    @Param('workoutId') workoutId: string,
    @Body() dto: CreateExerciseDto,
  ) {
    return this.exercisesService.create(dto, workoutId);
  }

  @ApiOperation({ summary: 'Update an existing exercise' })
  @ApiParam({
    name: 'workoutId',
    description: 'The unique identifier of the workout',
  })
  @ApiParam({
    name: 'id',
    description: 'The unique identifier of the exercise',
  })
  @ApiOkResponse({ type: Exercise })
  @ApiNotFoundResponse({ description: 'Exercise not found' })
  @Patch(':id')
  update(
    @Param('workoutId') workoutId: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateExerciseDto,
  ) {
    return this.exercisesService.update(id, dto, workoutId);
  }

  @ApiOperation({ summary: 'Delete an exercise' })
  @ApiParam({
    name: 'workoutId',
    description: 'The unique identifier of the workout',
  })
  @ApiParam({
    name: 'id',
    description: 'The unique identifier of the exercise',
  })
  @ApiOkResponse({ description: 'The exercise has been successfully deleted' })
  @ApiNotFoundResponse({ description: 'Exercise not found' })
  @Delete(':id')
  remove(
    @Param('workoutId') workoutId: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.exercisesService.remove(id, workoutId);
  }
}

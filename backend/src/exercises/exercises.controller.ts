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
import { CreateWorkoutExerciseDto } from './dto/create-exercise.dto';
import { UpdateWorkoutExerciseDto } from './dto/update-exercise.dto';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { WorkoutExercise } from './workout-exercise.entity';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Workout Exercises')
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
  @ApiOkResponse({ type: [WorkoutExercise] })
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
    description: 'The unique identifier of the workout exercise',
  })
  @ApiOkResponse({ type: WorkoutExercise })
  @ApiNotFoundResponse({ description: 'Exercise not found' })
  @Get(':id')
  findOne(
    @Param('workoutId') workoutId: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.exercisesService.findOne(id, workoutId);
  }

  @ApiOperation({ summary: 'Log an exercise to a workout' })
  @ApiParam({
    name: 'workoutId',
    description: 'The unique identifier of the workout',
  })
  @ApiOkResponse({ type: WorkoutExercise })
  @Post()
  create(
    @Param('workoutId') workoutId: string,
    @Body() dto: CreateWorkoutExerciseDto,
  ) {
    return this.exercisesService.create(dto, workoutId);
  }

  @ApiOperation({ summary: 'Update a logged exercise' })
  @ApiParam({
    name: 'workoutId',
    description: 'The unique identifier of the workout',
  })
  @ApiParam({
    name: 'id',
    description: 'The unique identifier of the workout exercise',
  })
  @ApiOkResponse({ type: WorkoutExercise })
  @ApiNotFoundResponse({ description: 'Exercise not found' })
  @Patch(':id')
  update(
    @Param('workoutId') workoutId: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWorkoutExerciseDto,
  ) {
    return this.exercisesService.update(id, dto, workoutId);
  }

  @ApiOperation({ summary: 'Delete a logged exercise' })
  @ApiParam({
    name: 'workoutId',
    description: 'The unique identifier of the workout',
  })
  @ApiParam({
    name: 'id',
    description: 'The unique identifier of the workout exercise',
  })
  @ApiOkResponse({
    description: 'The exercise has been successfully deleted',
  })
  @ApiNotFoundResponse({ description: 'Exercise not found' })
  @Delete(':id')
  remove(
    @Param('workoutId') workoutId: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.exercisesService.remove(id, workoutId);
  }
}

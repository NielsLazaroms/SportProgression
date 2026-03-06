import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { WorkoutsService } from './workouts.service';
import { CreateWorkoutDto } from './dto/create-workout.dto';
import { UpdateWorkoutDto } from './dto/update-workout.dto';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Workout } from './workouts.entity';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Workouts')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('workouts')
export class WorkoutsController {
  constructor(private readonly workoutsService: WorkoutsService) {}

  @ApiOperation({ summary: 'Get all workouts' })
  @ApiOkResponse({ type: [Workout] })
  @Get()
  findAll() {
    return this.workoutsService.findAll();
  }

  @ApiOperation({ summary: 'Get a specific workout by ID' })
  @ApiParam({ name: 'id', description: 'The unique identifier of the workout' })
  @ApiOkResponse({ type: Workout })
  @ApiNotFoundResponse({ description: 'Workout not found' })
  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.workoutsService.findOne(id);
  }

  @ApiOperation({ summary: 'Create a new workout' })
  @ApiOkResponse({ type: Workout })
  @Post()
  create(@Body() dto: CreateWorkoutDto) {
    return this.workoutsService.create(dto);
  }

  @ApiOperation({ summary: 'Update an existing workout' })
  @ApiParam({ name: 'id', description: 'The unique identifier of the workout' })
  @ApiOkResponse({ type: Workout })
  @ApiNotFoundResponse({ description: 'Workout not found' })
  @Patch(':id')
  update(@Param('id') id: number, @Body() dto: UpdateWorkoutDto) {
    return this.workoutsService.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete a workout' })
  @ApiParam({ name: 'id', description: 'The unique identifier of the workout' })
  @ApiOkResponse({ description: 'The workout has been successfully deleted' })
  @ApiNotFoundResponse({ description: 'Workout not found' })
  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.workoutsService.remove(id);
  }
}

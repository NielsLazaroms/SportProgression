import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
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
  findAll(@Req() req) {
    return this.workoutsService.findAll(req.user.userId);
  }

  @ApiOperation({ summary: 'Get a specific workout by ID' })
  @ApiParam({ name: 'id', description: 'The unique identifier of the workout' })
  @ApiOkResponse({ type: Workout })
  @ApiNotFoundResponse({ description: 'Workout not found' })
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req) {
    return this.workoutsService.findOne(id, req.user.userId);
  }

  @ApiOperation({ summary: 'Create a new workout' })
  @ApiOkResponse({ type: Workout })
  @Post()
  create(@Body() dto: CreateWorkoutDto, @Req() req) {
    return this.workoutsService.create(dto, req.user.userId);
  }

  @ApiOperation({ summary: 'Update an existing workout' })
  @ApiParam({ name: 'id', description: 'The unique identifier of the workout' })
  @ApiOkResponse({ type: Workout })
  @ApiNotFoundResponse({ description: 'Workout not found' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWorkoutDto, @Req() req) {
    return this.workoutsService.update(id, dto, req.user.userId);
  }

  @ApiOperation({ summary: 'Delete a workout' })
  @ApiParam({ name: 'id', description: 'The unique identifier of the workout' })
  @ApiOkResponse({ description: 'The workout has been successfully deleted' })
  @ApiNotFoundResponse({ description: 'Workout not found' })
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req) {
    return this.workoutsService.remove(id, req.user.userId);
  }
}

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
import { SetsService } from './sets.service';
import { CreateSetDto } from './dto/create-set.dto';
import { UpdateSetDto } from './dto/update-set.dto';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ExerciseSet } from './set.entity';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Sets')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('exercises/:exerciseId/sets')
export class SetsController {
  constructor(private readonly setsService: SetsService) {}

  @ApiOperation({ summary: 'Get all sets for an exercise' })
  @ApiParam({
    name: 'exerciseId',
    description: 'The unique identifier of the exercise',
  })
  @ApiOkResponse({ type: [ExerciseSet] })
  @Get()
  findAll(@Param('exerciseId', ParseIntPipe) exerciseId: number) {
    return this.setsService.findAll(exerciseId);
  }

  @ApiOperation({ summary: 'Get a specific set by ID' })
  @ApiParam({
    name: 'exerciseId',
    description: 'The unique identifier of the exercise',
  })
  @ApiParam({ name: 'id', description: 'The unique identifier of the set' })
  @ApiOkResponse({ type: ExerciseSet })
  @ApiNotFoundResponse({ description: 'Set not found' })
  @Get(':id')
  findOne(
    @Param('exerciseId', ParseIntPipe) exerciseId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.setsService.findOne(id, exerciseId);
  }

  @ApiOperation({ summary: 'Create a new set for an exercise' })
  @ApiParam({
    name: 'exerciseId',
    description: 'The unique identifier of the exercise',
  })
  @ApiOkResponse({ type: ExerciseSet })
  @Post()
  create(
    @Param('exerciseId', ParseIntPipe) exerciseId: number,
    @Body() dto: CreateSetDto,
  ) {
    return this.setsService.create(dto, exerciseId);
  }

  @ApiOperation({ summary: 'Update an existing set' })
  @ApiParam({
    name: 'exerciseId',
    description: 'The unique identifier of the exercise',
  })
  @ApiParam({ name: 'id', description: 'The unique identifier of the set' })
  @ApiOkResponse({ type: ExerciseSet })
  @ApiNotFoundResponse({ description: 'Set not found' })
  @Patch(':id')
  update(
    @Param('exerciseId', ParseIntPipe) exerciseId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSetDto,
  ) {
    return this.setsService.update(id, dto, exerciseId);
  }

  @ApiOperation({ summary: 'Delete a set' })
  @ApiParam({
    name: 'exerciseId',
    description: 'The unique identifier of the exercise',
  })
  @ApiParam({ name: 'id', description: 'The unique identifier of the set' })
  @ApiOkResponse({ description: 'The set has been successfully deleted' })
  @ApiNotFoundResponse({ description: 'Set not found' })
  @Delete(':id')
  remove(
    @Param('exerciseId', ParseIntPipe) exerciseId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.setsService.remove(id, exerciseId);
  }
}

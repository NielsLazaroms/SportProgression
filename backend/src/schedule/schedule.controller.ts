import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateScheduleDto,
  MoveScheduleDto,
  ScheduleRangeDto,
  StartScheduleDto,
} from './schedule.dto';
import { ScheduleService } from './schedule.service';

@ApiTags('Schedule')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('schedule')
export class ScheduleController {
  constructor(private readonly schedule: ScheduleService) {}

  @ApiOperation({
    summary: 'Workouts planned between two dates (at most 62 days apart)',
  })
  @Get()
  list(@Req() req, @Query() range: ScheduleRangeDto) {
    return this.schedule.list(req.user.userId, range.from, range.to);
  }

  @ApiOperation({ summary: 'Put one or more workouts on days' })
  @Post()
  create(@Req() req, @Body() dto: CreateScheduleDto) {
    return this.schedule.create(req.user.userId, dto.items);
  }

  @ApiOperation({ summary: 'Move a planned workout to another day' })
  @Patch(':id')
  move(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req,
    @Body() dto: MoveScheduleDto,
  ) {
    return this.schedule.move(id, req.user.userId, dto.date);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string, @Req() req) {
    return this.schedule.remove(id, req.user.userId);
  }

  @ApiOperation({
    summary: 'Start a planned workout today; returns the workout',
  })
  @Post(':id/start')
  start(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req,
    @Body() dto: StartScheduleDto,
  ) {
    return this.schedule.start(id, req.user.userId, dto.today);
  }
}

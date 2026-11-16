import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GoalsQueryDto, SaveGoalDto } from './goal.dto';
import { GoalsService } from './goals.service';

@ApiTags('Goals')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('goals')
export class GoalsController {
  constructor(private readonly goals: GoalsService) {}

  @ApiOperation({
    summary:
      'All goals of the signed-in user, with progress from the logged sets',
  })
  @Get()
  findAll(@Req() req, @Query() query: GoalsQueryDto) {
    return this.goals.list(req.user.userId, query.today);
  }

  @ApiOperation({
    summary: 'Add a lift goal or a muscle group goal; returns all goals',
  })
  @Post()
  async create(
    @Body() dto: SaveGoalDto,
    @Req() req,
    @Query() query: GoalsQueryDto,
  ) {
    await this.goals.create(dto, req.user.userId);
    return this.goals.list(req.user.userId, query.today);
  }

  @ApiOperation({ summary: 'Replace a goal' })
  @Put(':id')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SaveGoalDto,
    @Req() req,
    @Query() query: GoalsQueryDto,
  ) {
    await this.goals.update(id, dto, req.user.userId);
    return this.goals.list(req.user.userId, query.today);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string, @Req() req) {
    return this.goals.remove(id, req.user.userId);
  }
}

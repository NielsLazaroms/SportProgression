import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ProgressService } from './progress.service';

@ApiTags('Progress')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @ApiOperation({
    summary:
      'Dashboard: totals, weekly consistency, per-exercise overview and recent records',
  })
  @Get('summary')
  summary(@Req() req, @Query('today') today?: string) {
    return this.progressService.summary(req.user.userId, today);
  }

  @ApiOperation({
    summary: 'Chronological history and all-time records for one exercise',
  })
  @ApiParam({ name: 'definitionId', description: 'Exercise definition id' })
  @Get('exercises/:definitionId')
  exerciseHistory(
    @Param('definitionId', ParseIntPipe) definitionId: number,
    @Req() req,
  ) {
    return this.progressService.exerciseHistory(definitionId, req.user.userId);
  }
}

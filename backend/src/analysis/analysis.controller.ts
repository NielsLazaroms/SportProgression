import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AiAccessGuard } from './ai-access.guard';
import { AnalyseDto, SuggestWeekDto, SuggestWorkoutDto } from './analysis.dto';
import { AnalysisService } from './analysis.service';

/**
 * AI analysis of the user's own training, written by Claude. Only runs when
 * the user asks for it, and every call costs money, so it has its own tight
 * limit of 10 requests per hour per account for each action. Only users with
 * the AI role get in at all.
 */
@ApiTags('Analysis')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), AiAccessGuard)
@Throttle({ default: { limit: 10, ttl: 60 * 60 * 1000 } })
@Controller('analysis')
export class AnalysisController {
  constructor(private readonly analysis: AnalysisService) {}

  // Only reads what was saved, so it gets a far looser limit than the paid calls.
  @ApiOperation({ summary: "The saved analysis of this week (404 when none)" })
  @Throttle({ default: { limit: 300, ttl: 60 * 60 * 1000 } })
  @Get('week')
  savedWeek(@Req() req, @Query() dto: AnalyseDto) {
    return this.analysis.savedWeekAnalysis(req.user.userId, dto.today);
  }

  @ApiOperation({
    summary: "Analyse this week's workouts and save it over the earlier one",
  })
  @HttpCode(200)
  @Post('week')
  week(@Req() req, @Body() dto: AnalyseDto) {
    return this.analysis.analyseWeek(req.user.userId, dto.today, dto.locale);
  }

  // Only reads what was saved, so it gets a far looser limit than the paid calls.
  @ApiOperation({ summary: 'The saved analysis of one workout (404 when none)' })
  @Throttle({ default: { limit: 300, ttl: 60 * 60 * 1000 } })
  @Get('workouts/:id')
  savedWorkout(@Req() req, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.analysis.savedWorkoutAnalysis(req.user.userId, id);
  }

  @ApiOperation({
    summary: 'Analyse one workout, once: later calls return the saved analysis',
  })
  @HttpCode(200)
  @Post('workouts/:id')
  workout(
    @Req() req,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AnalyseDto,
  ) {
    return this.analysis.analyseWorkout(req.user.userId, id, dto.locale);
  }

  @ApiOperation({ summary: 'Suggest the next workout' })
  @HttpCode(200)
  @Post('suggest/workout')
  suggestWorkout(@Req() req, @Body() dto: SuggestWorkoutDto) {
    return this.analysis.suggestWorkout(
      req.user.userId,
      dto.today,
      dto.locale,
      dto.date,
      { focus: dto.focus, note: dto.note },
    );
  }

  @ApiOperation({ summary: 'Suggest a whole training week' })
  @HttpCode(200)
  @Post('suggest/week')
  suggestWeek(@Req() req, @Body() dto: SuggestWeekDto) {
    return this.analysis.suggestWeek(
      req.user.userId,
      dto.days,
      dto.today,
      dto.locale,
      { focus: dto.focus, note: dto.note },
    );
  }
}

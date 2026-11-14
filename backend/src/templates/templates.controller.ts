import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TemplatesService } from './templates.service';
import {
  SaveTemplateDto,
  StartTemplateDto,
  TemplateFromWorkoutDto,
} from './dto/template.dto';

@ApiTags('Templates')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @ApiOperation({ summary: 'All workout templates of the signed-in user' })
  @Get()
  findAll(@Req() req) {
    return this.templates.findAll(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req) {
    return this.templates.findOne(id, req.user.userId);
  }

  @ApiOperation({ summary: 'Create a template (name + exercises with targets)' })
  @Post()
  create(@Body() dto: SaveTemplateDto, @Req() req) {
    return this.templates.create(dto, req.user.userId);
  }

  @ApiOperation({ summary: 'Save a workout as a template' })
  @Post('from-workout/:workoutId')
  fromWorkout(
    @Param('workoutId') workoutId: string,
    @Body() dto: TemplateFromWorkoutDto,
    @Req() req,
  ) {
    return this.templates.createFromWorkout(
      workoutId,
      req.user.userId,
      dto.name,
    );
  }

  @ApiOperation({ summary: 'Start a workout from a template' })
  @Post(':id/start')
  start(@Param('id') id: string, @Body() dto: StartTemplateDto, @Req() req) {
    return this.templates.start(id, dto, req.user.userId);
  }

  @ApiOperation({ summary: 'Replace a template (name and exercise list)' })
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: SaveTemplateDto, @Req() req) {
    return this.templates.update(id, dto, req.user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req) {
    return this.templates.remove(id, req.user.userId);
  }
}

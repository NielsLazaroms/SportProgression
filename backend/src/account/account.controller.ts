import { Body, Controller, Delete, Get, Put, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AccountService } from './account.service';
import { CoachPreferencesDto } from './coach-preferences.dto';
import { IgnoredMuscleGroupsDto } from './ignored-muscle-groups.dto';
import { GymEquipmentDto } from './gym-equipment.dto';
import { WeightStepDto } from './weight-step.dto';

@ApiTags('Account')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('account')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @ApiOperation({ summary: 'Download everything stored about the signed-in user' })
  @Get('export')
  export(@Req() req) {
    return this.account.export(req.user.userId);
  }

  @ApiOperation({ summary: 'Muscle groups and whether the user trains each one' })
  @Get('muscle-groups')
  muscleGroups(@Req() req) {
    return this.account.muscleGroups(req.user.userId);
  }

  @ApiOperation({ summary: 'Choose which muscle groups the analysis should leave alone' })
  @Put('muscle-groups')
  setMuscleGroups(@Req() req, @Body() dto: IgnoredMuscleGroupsDto) {
    return this.account.setIgnoredMuscleGroups(req.user.userId, dto.ignored);
  }

  @ApiOperation({ summary: 'Preferred training days and the note for the AI coach' })
  @Get('coach-preferences')
  coachPreferences(@Req() req) {
    return this.account.coachPreferences(req.user.userId);
  }

  @ApiOperation({ summary: 'Save preferred training days and the note for the AI coach' })
  @Put('coach-preferences')
  setCoachPreferences(@Req() req, @Body() dto: CoachPreferencesDto) {
    return this.account.setCoachPreferences(req.user.userId, dto.trainingDays, dto.note);
  }

  @ApiOperation({ summary: 'Set how much the weight + and - buttons change the weight' })
  @Put('weight-step')
  setWeightStep(@Req() req, @Body() dto: WeightStepDto) {
    return this.account.setWeightStep(req.user.userId, dto.weightStepKg);
  }

  @ApiOperation({ summary: 'Equipment and machines the user\'s gym has, for the AI coach' })
  @Get('equipment')
  gymEquipment(@Req() req) {
    return this.account.gymEquipment(req.user.userId);
  }

  @ApiOperation({ summary: 'Save the equipment and machines the user\'s gym has' })
  @Put('equipment')
  setGymEquipment(@Req() req, @Body() dto: GymEquipmentDto) {
    return this.account.setGymEquipment(req.user.userId, dto.equipment, dto.name);
  }

  @ApiOperation({ summary: 'Permanently delete the account and all its data' })
  @Delete()
  async remove(@Req() req, @Res() res: Response) {
    const result = await this.account.delete(req.user.userId);
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });
    return res.json(result);
  }
}

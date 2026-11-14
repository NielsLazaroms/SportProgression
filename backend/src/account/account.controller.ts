import { Controller, Delete, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AccountService } from './account.service';

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

  @ApiOperation({ summary: 'Permanently delete the account and all its data' })
  @Delete()
  async remove(@Req() req, @Res() res: Response) {
    const result = await this.account.delete(req.user.userId);
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });
    return res.json(result);
  }
}

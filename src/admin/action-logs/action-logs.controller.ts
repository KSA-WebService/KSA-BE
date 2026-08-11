import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';

import { AdminGuard } from '../../auth/admin.guard';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { ActionLogsService } from './action-logs.service';
import { GetAdminActionLogsQueryDto } from './dto/get-admin-action-logs-query.dto';
import { GetAdminActionLogParamDto } from './dto/get-admin-action-log-param.dto';

@Controller('admin/action-logs')
@UseGuards(SupabaseAuthGuard, AdminGuard)
export class ActionLogsController {
  constructor(private readonly actionLogsService: ActionLogsService) {}

  @Get()
  getActionLogs(@Query() query: GetAdminActionLogsQueryDto) {
    return this.actionLogsService.getActionLogs(query);
  }

  @Get(':logId')
  getActionLogDetail(@Param() params: GetAdminActionLogParamDto) {
    return this.actionLogsService.getActionLogDetail(params.logId);
  }
}

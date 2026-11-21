import { Module } from '@nestjs/common';
import { ThrottlerModule,ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { DbService } from './db/db.service';
import { AuthGuard } from './auth/auth.guard';
import { AuthController } from './auth/auth.controller';
import { UsersController } from './users/users.controller';
import { KeysController } from './keys/keys.controller';
import { PqcController } from './keys/pqc.controller';
import { FilesController } from './files/files.controller';
import { ActivityController } from './activity/activity.controller';
import { DashboardController } from './dashboard/dashboard.controller';
import { WorkspacesController } from './workspaces/workspaces.controller';
import { AdminController } from './admin/admin.controller';
import { HealthController } from './common/health.controller';
import { SecurityController } from './security/security.controller';
import { AccessGovernanceController } from './security/access-governance.controller';
import { SecurityMonitorService } from './security/security-monitor.service';
@Module({
 imports:[ThrottlerModule.forRoot([{ttl:60000,limit:120}])],
 controllers:[AuthController,UsersController,KeysController,PqcController,FilesController,ActivityController,DashboardController,WorkspacesController,AdminController,HealthController,SecurityController,AccessGovernanceController],
 providers:[DbService,AuthGuard,SecurityMonitorService,{provide:APP_GUARD,useClass:ThrottlerGuard}]
})
export class AppModule{}

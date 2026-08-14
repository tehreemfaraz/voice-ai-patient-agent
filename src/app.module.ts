import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { PatientModule } from './patient/patient.module';
import { VoiceModule } from './voice/voice.module';
import { DashboardController } from './dashboard/dashboard.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    PatientModule,
    VoiceModule,
  ],
  controllers: [AppController, DashboardController],
  providers: [AppService],
})
export class AppModule {}

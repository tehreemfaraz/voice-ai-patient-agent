import { Module } from '@nestjs/common';
import { VoiceController } from './voice.controller';
import { VoiceService } from './voice.service';
import { PatientModule } from '../patient/patient.module';

@Module({
  imports: [PatientModule],
  controllers: [VoiceController],
  providers: [VoiceService],
})
export class VoiceModule {}

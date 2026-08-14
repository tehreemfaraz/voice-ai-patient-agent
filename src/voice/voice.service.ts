import { HttpException, Injectable, Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PatientService } from '../patient/patient.service';
import { CreatePatientDto } from '../patient/dto/create-patient.dto';
import { UpdatePatientDto } from '../patient/dto/update-patient.dto';

interface VapiToolCall {
  id: string;
  function: { name: string; arguments: Record<string, unknown> };
}

/**
 * Bridges the Vapi voice assistant to the Patient API. Vapi handles telephony, STT, TTS and the
 * LLM conversation itself; it calls back into these "server tools" mid-call to read/write patient
 * data, so the agent's confirmation and error messages always reflect what's really in the database.
 */
@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);

  constructor(private readonly patientService: PatientService) {}

  async handleToolCall(toolCall: VapiToolCall): Promise<unknown> {
    const { name, arguments: args } = toolCall.function;
    this.logger.log(`Tool call: ${name} ${JSON.stringify(args)}`);

    try {
      switch (name) {
        case 'check_existing_patient':
          return await this.checkExistingPatient(args.phone_number as string);
        case 'register_patient':
          return await this.registerPatient(args);
        case 'update_patient':
          return await this.updatePatient(args.patient_id as string, args);
        default:
          return { success: false, message: `Unknown tool: ${name}` };
      }
    } catch (error) {
      // Log the real error (stack, Prisma details) for us, but never hand it back to the
      // assistant: whatever we return here is text the LLM may read aloud to the caller, so
      // raw driver errors would leak file paths and source snippets over the phone. Only
      // deliberate, caller-safe messages (our HttpExceptions) are passed through.
      this.logger.error(
        `Tool call ${name} failed: ${error instanceof Error ? error.stack : String(error)}`,
      );
      const message =
        error instanceof HttpException
          ? error.message
          : "I'm having trouble saving that right now. Please try again in a moment.";
      return { success: false, message };
    }
  }

  private async checkExistingPatient(phoneNumber: string) {
    if (!phoneNumber) return { found: false };
    const patient = await this.patientService.findByPhone(phoneNumber);
    if (!patient) return { found: false };
    return {
      found: true,
      patient_id: patient.patient_id,
      first_name: patient.first_name,
      last_name: patient.last_name,
    };
  }

  private async registerPatient(args: Record<string, unknown>) {
    const dto = plainToInstance(CreatePatientDto, args);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: false,
    });
    if (errors.length > 0) {
      return { success: false, message: this.formatValidationErrors(errors) };
    }

    const patient = await this.patientService.create(dto);
    this.logger.log(
      `Patient registered via voice call: ${JSON.stringify(patient)}`,
    );
    return { success: true, patient_id: patient.patient_id };
  }

  private async updatePatient(
    patientId: string,
    args: Record<string, unknown>,
  ) {
    if (!patientId) {
      return {
        success: false,
        message: 'patient_id is required to update a record',
      };
    }

    const dto = plainToInstance(UpdatePatientDto, args);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: false,
    });
    if (errors.length > 0) {
      return { success: false, message: this.formatValidationErrors(errors) };
    }

    const patient = await this.patientService.update(patientId, dto);
    this.logger.log(
      `Patient updated via voice call: ${JSON.stringify(patient)}`,
    );
    return { success: true, patient_id: patient.patient_id };
  }

  private formatValidationErrors(
    errors: Array<{ constraints?: Record<string, string> }>,
  ) {
    return errors
      .flatMap((error) => Object.values(error.constraints ?? {}))
      .join('; ');
  }

  /** Vapi's end-of-call-report carries the full transcript/summary; log it per the observability requirement. */
  logEndOfCall(payload: unknown) {
    this.logger.log(`Call ended: ${JSON.stringify(payload)}`);
  }
}

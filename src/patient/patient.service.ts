import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { PatientQueryDto } from './dto/patient-query.dto';
import { parseCalendarDate, toPhoneDigits } from './normalize';

@Injectable()
export class PatientService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PatientQueryDto) {
    const { last_name, date_of_birth, phone_number } = query;

    const where: Record<string, unknown> = { deleted_at: null };
    if (last_name) {
      where.last_name = { equals: last_name, mode: 'insensitive' };
    }
    if (phone_number) {
      // Already reduced to 10 digits by the query DTO, so it matches the stored form.
      where.phone_number = phone_number;
    }
    if (date_of_birth) {
      // Parsed by the same helper the DTO uses, so a date written as MM/DD/YYYY is found by a
      // filter written either way. The DTO has already rejected anything unparseable.
      where.date_of_birth = parseCalendarDate(date_of_birth);
    }

    return this.prisma.patient.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { patient_id: id, deleted_at: null },
    });
    if (!patient) {
      throw new NotFoundException(`Patient ${id} not found`);
    }
    return patient;
  }

  /** Used by the voice agent to detect a returning caller before creating a duplicate record.
   *  Takes a raw string because it is called with whatever the caller said, before any DTO. */
  async findByPhone(phoneNumber: string) {
    const digits = toPhoneDigits(phoneNumber);
    if (typeof digits !== 'string') return null;
    return this.prisma.patient.findFirst({
      where: { phone_number: digits, deleted_at: null },
    });
  }

  // create/update take already-validated DTOs: phone digits, state code and the calendar date were
  // normalized by the DTO's transforms, so there is nothing left to massage here.
  async create(dto: CreatePatientDto) {
    return this.prisma.patient.create({ data: dto });
  }

  async update(id: string, dto: UpdatePatientDto) {
    await this.findOne(id);
    return this.prisma.patient.update({
      where: { patient_id: id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.patient.update({
      where: { patient_id: id },
      data: { deleted_at: new Date() },
    });
  }
}

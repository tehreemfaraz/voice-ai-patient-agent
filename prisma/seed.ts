import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  await prisma.patient.upsert({
    where: { patient_id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      patient_id: '00000000-0000-0000-0000-000000000001',
      first_name: 'Jane',
      last_name: 'Doe',
      date_of_birth: new Date('1990-05-14'),
      sex: 'Female',
      phone_number: '5551234567',
      email: 'jane.doe@example.com',
      address_line_1: '123 Main St',
      city: 'Austin',
      state: 'TX',
      zip_code: '78701',
      preferred_language: 'English',
    },
  });

  await prisma.patient.upsert({
    where: { patient_id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      patient_id: '00000000-0000-0000-0000-000000000002',
      first_name: 'John',
      last_name: 'Smith',
      date_of_birth: new Date('1985-11-02'),
      sex: 'Male',
      phone_number: '5559876543',
      address_line_1: '456 Oak Ave',
      address_line_2: 'Apt 2B',
      city: 'Denver',
      state: 'CO',
      zip_code: '80202',
      insurance_provider: 'Blue Cross',
      insurance_member_id: 'BC123456',
      preferred_language: 'English',
    },
  });

  console.log('Seed complete.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

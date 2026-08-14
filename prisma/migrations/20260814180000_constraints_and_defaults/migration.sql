-- Tightens the Patient table so the brief's data-model constraints are enforced by the database
-- itself: column widths matching the DTO validation rules, a real DATE for date_of_birth, a native
-- UUID primary key, and the "Default: English" rule for preferred_language.
--
-- Hand-edited from `prisma migrate diff`: the generated script dropped and recreated patient_id to
-- change its type, which would have discarded every existing patient's identifier. The USING cast
-- below converts the existing TEXT uuids in place instead.

-- date_of_birth is a calendar date, not an instant. Storing it as TIMESTAMP meant a birth date
-- parsed in a non-UTC server zone could land on the previous day.
ALTER TABLE "Patient" ALTER COLUMN "date_of_birth" SET DATA TYPE DATE USING "date_of_birth"::date;

ALTER TABLE "Patient" ALTER COLUMN "patient_id" SET DATA TYPE UUID USING "patient_id"::uuid;

ALTER TABLE "Patient"
  ALTER COLUMN "first_name" SET DATA TYPE VARCHAR(50),
  ALTER COLUMN "last_name" SET DATA TYPE VARCHAR(50),
  ALTER COLUMN "phone_number" SET DATA TYPE VARCHAR(10),
  ALTER COLUMN "email" SET DATA TYPE VARCHAR(255),
  ALTER COLUMN "address_line_1" SET DATA TYPE VARCHAR(200),
  ALTER COLUMN "address_line_2" SET DATA TYPE VARCHAR(200),
  ALTER COLUMN "city" SET DATA TYPE VARCHAR(100),
  ALTER COLUMN "state" SET DATA TYPE CHAR(2),
  ALTER COLUMN "zip_code" SET DATA TYPE VARCHAR(10),
  ALTER COLUMN "insurance_provider" SET DATA TYPE VARCHAR(100),
  ALTER COLUMN "insurance_member_id" SET DATA TYPE VARCHAR(30),
  ALTER COLUMN "preferred_language" SET DATA TYPE VARCHAR(50),
  ALTER COLUMN "emergency_contact_name" SET DATA TYPE VARCHAR(100),
  ALTER COLUMN "emergency_contact_phone" SET DATA TYPE VARCHAR(10);

ALTER TABLE "Patient" ALTER COLUMN "preferred_language" SET DEFAULT 'English';

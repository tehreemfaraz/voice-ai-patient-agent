-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('Male', 'Female', 'Other', 'DeclineToAnswer');

-- CreateTable
CREATE TABLE "Patient" (
    "patient_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "date_of_birth" TIMESTAMP(3) NOT NULL,
    "sex" "Sex" NOT NULL,
    "phone_number" TEXT NOT NULL,
    "email" TEXT,
    "address_line_1" TEXT NOT NULL,
    "address_line_2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip_code" TEXT NOT NULL,
    "insurance_provider" TEXT,
    "insurance_member_id" TEXT,
    "preferred_language" TEXT,
    "emergency_contact_name" TEXT,
    "emergency_contact_phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("patient_id")
);

-- CreateIndex
CREATE INDEX "Patient_phone_number_idx" ON "Patient"("phone_number");

-- CreateIndex
CREATE INDEX "Patient_last_name_idx" ON "Patient"("last_name");

-- CreateIndex
CREATE INDEX "Patient_date_of_birth_idx" ON "Patient"("date_of_birth");

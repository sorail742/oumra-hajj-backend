-- ADR 0025 : code OTP envoyé par email (EmailJS) en plus du SMS.
ALTER TABLE "otps" ALTER COLUMN "phone" DROP NOT NULL;
ALTER TABLE "otps" ADD COLUMN "email" TEXT;

-- Exactement un destinataire par code.
ALTER TABLE "otps" ADD CONSTRAINT "otps_un_destinataire"
  CHECK (("phone" IS NULL) <> ("email" IS NULL));

CREATE INDEX "otps_email_idx" ON "otps"("email");

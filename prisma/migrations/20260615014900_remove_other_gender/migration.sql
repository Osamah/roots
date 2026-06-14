-- Normalize any existing OTHER values, then remove OTHER from the Gender enum.
UPDATE "Person" SET "gender" = 'UNKNOWN' WHERE "gender"::text = 'OTHER';
ALTER TYPE "Gender" RENAME TO "Gender_old";
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'UNKNOWN');
ALTER TABLE "Person" ALTER COLUMN "gender" DROP DEFAULT;
ALTER TABLE "Person" ALTER COLUMN "gender" TYPE "Gender" USING ("gender"::text::"Gender");
ALTER TABLE "Person" ALTER COLUMN "gender" SET DEFAULT 'UNKNOWN';
DROP TYPE "Gender_old";

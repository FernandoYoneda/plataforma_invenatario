ALTER TABLE "Employee"
ADD COLUMN IF NOT EXISTS "locationId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Employee_locationId_fkey'
  ) THEN
    ALTER TABLE "Employee"
    ADD CONSTRAINT "Employee_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "Location"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Employee_locationId_idx"
ON "Employee"("locationId");

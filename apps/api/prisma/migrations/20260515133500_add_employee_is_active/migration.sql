-- Add soft-delete flag to Employee.
ALTER TABLE "Employee"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

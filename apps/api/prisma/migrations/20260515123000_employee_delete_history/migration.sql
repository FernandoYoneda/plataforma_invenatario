-- Make assignment history survive employee deletion.
ALTER TABLE "Assignment" DROP CONSTRAINT "Assignment_employeeId_fkey";

ALTER TABLE "Assignment" ALTER COLUMN "employeeId" DROP NOT NULL;

ALTER TABLE "Assignment"
ADD CONSTRAINT "Assignment_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

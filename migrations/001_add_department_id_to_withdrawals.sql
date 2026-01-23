-- Add department_id column to hours_withdrawals table
-- This migration adds the missing department_id column that is required for the approvals system

ALTER TABLE hours_withdrawals 
ADD COLUMN department_id VARCHAR(36) AFTER user_id;

-- Update existing records to set department_id based on user's department
-- This assumes users have a department assignment in employee_departments table
UPDATE hours_withdrawals hw
INNER JOIN employee_departments ed ON hw.user_id = ed.user_id
SET hw.department_id = ed.department_id
WHERE hw.department_id IS NULL;

-- Make the column NOT NULL after updating existing records
ALTER TABLE hours_withdrawals 
MODIFY COLUMN department_id VARCHAR(36) NOT NULL;

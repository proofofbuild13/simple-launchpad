-- Add domain column to builder_profiles table
ALTER TABLE builder_profiles
ADD COLUMN IF NOT EXISTS domain VARCHAR(255);

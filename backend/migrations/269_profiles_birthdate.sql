-- Migration 269: Add birthdate column to profiles table
-- Required field for new signups, existing users prompted to add it

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birthdate DATE;

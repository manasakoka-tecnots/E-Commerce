-- Set default value for country column so address inserts don't fail
-- when country is omitted (most users are in India)
ALTER TABLE addresses ALTER COLUMN country SET DEFAULT 'India';

-- Backfill any existing rows that might have empty country
UPDATE addresses SET country = 'India' WHERE country IS NULL OR country = '';

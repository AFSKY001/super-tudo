-- Remove a redundant partial unique index.
-- profiles_username_key already enforces uniqueness on lower(username);
-- PostgreSQL unique indexes allow multiple NULL values, so the partial index
-- adds no integrity guarantee and only increases write/storage overhead.
DROP INDEX IF EXISTS public.profiles_username_unique;

-- Complete the foreign-key index coverage for public evaluation links.
-- Additive and safe for existing evaluation records.
CREATE INDEX IF NOT EXISTS evaluation_public_links_created_by_idx
  ON public.evaluation_public_links (created_by);

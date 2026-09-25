-- Quotations live with the panel's existing SC, order, user and audit entities.
ALTER TABLE public.panel_entities DROP CONSTRAINT IF EXISTS panel_entities_kind_check;
ALTER TABLE public.panel_entities ADD CONSTRAINT panel_entities_kind_check
  CHECK (kind = ANY (ARRAY['sc','order','user','audit','quote']));

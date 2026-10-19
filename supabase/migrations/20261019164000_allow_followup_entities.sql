-- Allow the shared panel store to persist daily follow-up workflows and saved contacts.
ALTER TABLE public.panel_entities DROP CONSTRAINT IF EXISTS panel_entities_kind_check;
ALTER TABLE public.panel_entities ADD CONSTRAINT panel_entities_kind_check
  CHECK (kind = ANY (ARRAY[
    'sc'::text,
    'order'::text,
    'user'::text,
    'audit'::text,
    'quote'::text,
    'followup_item'::text,
    'followup_import'::text,
    'followup_contact'::text
  ]));

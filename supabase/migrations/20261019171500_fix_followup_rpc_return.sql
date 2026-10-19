-- Replace the unsupported jsonb_object_length call and keep the follow-up RPC visible to PostgREST.
CREATE OR REPLACE FUNCTION public.apply_followup_changes(p_followup jsonb DEFAULT '{}'::jsonb, p_actor text DEFAULT ''::text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
declare
  v_now timestamptz := clock_timestamp();
  v_items jsonb := coalesce(p_followup->'items','[]'::jsonb);
  v_imports jsonb := coalesce(p_followup->'imports','[]'::jsonb);
  v_contacts jsonb := coalesce(p_followup->'contacts','{}'::jsonb);
  v_contact_count integer := 0;
begin
  insert into public.panel_entities(kind,entity_key,payload,mutation_at,revision,updated_at,updated_by)
  select 'followup_item', coalesce(nullif(x->>'id',''), concat_ws('|',coalesce(x->>'company',''),coalesce(x->>'order',''),coalesce(x->>'item',''))), x-'_serverVersion', coalesce(nullif(x->>'clientMutationAt','')::timestamptz,v_now), greatest(coalesce(nullif(x->>'_serverVersion','')::bigint,1),1), v_now, p_actor
  from jsonb_array_elements(v_items) x where coalesce(x->>'id',x->>'order','')<>''
  order by coalesce(nullif(x->>'id',''), concat_ws('|',coalesce(x->>'company',''),coalesce(x->>'order',''),coalesce(x->>'item','')))
  on conflict(kind,entity_key) do update set payload=excluded.payload,mutation_at=excluded.mutation_at,revision=public.panel_entities.revision+1,updated_at=v_now,updated_by=p_actor
  where excluded.mutation_at>public.panel_entities.mutation_at and excluded.revision>=public.panel_entities.revision and excluded.payload is distinct from public.panel_entities.payload;

  insert into public.panel_entities(kind,entity_key,payload,mutation_at,updated_at,updated_by)
  select 'followup_import', coalesce(nullif(x->>'id',''),md5(x::text)), x-'_serverVersion', coalesce(nullif(x->>'importedAt','')::timestamptz,v_now), v_now, p_actor
  from jsonb_array_elements(v_imports) x on conflict(kind,entity_key) do nothing;

  insert into public.panel_entities(kind,entity_key,payload,mutation_at,updated_at,updated_by)
  select 'followup_contact', concat(t.contact_type,'|',c.contact_key), c.contact_value || jsonb_build_object('contactType',t.contact_type,'contactKey',c.contact_key), coalesce(nullif(c.contact_value->>'updatedAt','')::timestamptz,v_now), v_now, p_actor
  from (values ('supplier',coalesce(v_contacts->'supplier','{}'::jsonb)),('internal',coalesce(v_contacts->'internal','{}'::jsonb))) as t(contact_type,contact_map)
  cross join lateral jsonb_each(t.contact_map) as c(contact_key,contact_value)
  on conflict(kind,entity_key) do update set payload=excluded.payload,mutation_at=excluded.mutation_at,revision=public.panel_entities.revision+1,updated_at=v_now,updated_by=p_actor
  where excluded.mutation_at>public.panel_entities.mutation_at and excluded.payload is distinct from public.panel_entities.payload;

  select count(*)::integer into v_contact_count
  from (
    select key from jsonb_each(coalesce(v_contacts->'supplier','{}'::jsonb))
    union all
    select key from jsonb_each(coalesce(v_contacts->'internal','{}'::jsonb))
  ) contacts;

  return jsonb_build_object('saved',true,'items',jsonb_array_length(v_items),'imports',jsonb_array_length(v_imports),'contacts',v_contact_count);
end;
$function$;

NOTIFY pgrst, 'reload schema';

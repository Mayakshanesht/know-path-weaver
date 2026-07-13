-- Atomic, admin-only reordering for modules, capsules and capsule content.
--
-- Replaces the previous client-side loop of N sequential UPDATE round-trips,
-- which could fail halfway and leave order_index values duplicated or gapped.
-- The whole reorder now succeeds or fails as one statement.

CREATE OR REPLACE FUNCTION public.reorder_entities(p_entity text, p_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER          -- keep row level security in force for the caller
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- p_entity is matched against a fixed whitelist, never interpolated into SQL.
  CASE p_entity
    WHEN 'learning_paths' THEN
      UPDATE public.learning_paths AS t
      SET order_index = o.idx - 1
      FROM unnest(p_ids) WITH ORDINALITY AS o(id, idx)
      WHERE t.id = o.id;

    WHEN 'capsules' THEN
      UPDATE public.capsules AS t
      SET order_index = o.idx - 1
      FROM unnest(p_ids) WITH ORDINALITY AS o(id, idx)
      WHERE t.id = o.id;

    WHEN 'capsule_content' THEN
      UPDATE public.capsule_content AS t
      SET order_index = o.idx - 1
      FROM unnest(p_ids) WITH ORDINALITY AS o(id, idx)
      WHERE t.id = o.id;

    ELSE
      RAISE EXCEPTION 'invalid entity: %', p_entity;
  END CASE;
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_entities(text, uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reorder_entities(text, uuid[]) TO authenticated;

-- The old helper took untyped JSON and enforced no authorization of its own.
DROP FUNCTION IF EXISTS public.update_content_order(json);

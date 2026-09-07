-- Phase 5b: plpgsql resolves NEW.take_id even in a CASE branch that is not
-- taken, so the Phase 5 counter/event triggers failed on posts. Read the
-- id through jsonb instead. Applied to prod 2026-09-07.
CREATE OR REPLACE FUNCTION public.trg_reactions_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind text := TG_ARGV[0];
  v_col text := CASE WHEN TG_ARGV[0] = 'post' THEN 'post_id' ELSE 'take_id' END;
  v_new jsonb := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  v_old jsonb := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.engagement_bump_reaction(v_kind, (v_new ->> v_col)::uuid, v_new ->> 'reaction_type', 1);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.engagement_bump_reaction(v_kind, (v_old ->> v_col)::uuid, v_old ->> 'reaction_type', -1);
  ELSIF (v_old ->> 'reaction_type') IS DISTINCT FROM (v_new ->> 'reaction_type') THEN
    PERFORM public.engagement_bump_reaction(v_kind, (v_old ->> v_col)::uuid, v_old ->> 'reaction_type', -1);
    PERFORM public.engagement_bump_reaction(v_kind, (v_new ->> v_col)::uuid, v_new ->> 'reaction_type', 1);
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_activity_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind text := TG_ARGV[0];
  v_counter text := TG_ARGV[1];
  v_col text := CASE WHEN TG_ARGV[0] = 'post' THEN 'post_id' ELSE 'take_id' END;
  v_row jsonb := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
BEGIN
  PERFORM public.engagement_bump_counter(v_kind, (v_row ->> v_col)::uuid, v_counter, CASE WHEN TG_OP = 'INSERT' THEN 1 ELSE -1 END);
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_content_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, realtime
AS $$
DECLARE
  v_kind text := TG_ARGV[0];
  v_what text := TG_ARGV[1];
  v_col text := CASE WHEN TG_ARGV[0] = 'post' THEN 'post_id' ELSE 'take_id' END;
  v_row jsonb := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  v_id uuid := ((CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END) ->> (CASE WHEN TG_ARGV[0] = 'post' THEN 'post_id' ELSE 'take_id' END))::uuid;
  v_counts jsonb;
  v_comments int;
  v_payload jsonb;
BEGIN
  IF v_kind = 'post' THEN
    SELECT public.post_reaction_counts_json(v_id), p.comments_count INTO v_counts, v_comments FROM public.posts p WHERE p.id = v_id;
  ELSE
    SELECT public.take_reaction_counts_json(v_id), t.comments_count INTO v_counts, v_comments FROM public.takes t WHERE t.id = v_id;
  END IF;
  IF v_counts IS NULL THEN RETURN NULL; END IF;

  v_payload := jsonb_build_object(
    'kind', v_kind, 'id', v_id, 'what', v_what, 'op', TG_OP,
    'counts', v_counts, 'comments', v_comments,
    'actor_id', v_row ->> 'user_id'
  );
  IF v_what = 'comment' THEN
    v_payload := v_payload || jsonb_build_object(
      'comment_id', v_row ->> 'id',
      'parent_id', v_row ->> 'parent_id'
    );
  END IF;

  PERFORM realtime.send(v_payload, 'content_change', 'content-events:' || v_kind || ':' || v_id::text, false);
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.trg_content_events() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_reactions_count() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_activity_count() FROM PUBLIC, anon, authenticated;

-- Phase 5c (applied to prod 2026-09-07 as 20260911_engagement_phase5c_bump_grants):
-- the counter helpers are trigger-internal; nobody may call them from the API.
REVOKE ALL ON FUNCTION public.engagement_bump_reaction(text, uuid, text, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.engagement_bump_counter(text, uuid, text, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.post_reaction_counts_json(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.take_reaction_counts_json(uuid) FROM PUBLIC, anon;

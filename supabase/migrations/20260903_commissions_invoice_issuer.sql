-- Tax invoice issuer details (2026-09-03, follow-up to 4c)
-- One platform setting, editable from the console, printed in the FROM block
-- of every invoice PDF. The allow-list in admin_update_setting gains a branch;
-- the function is edited in place from its live definition (no retyping).
INSERT INTO public.platform_settings (key, value)
VALUES ('invoice_issuer', '{"name": "PinkQuill", "lines": ["Merchant of record", "www.pinkquill.com"], "tax_note": "No sales tax was charged on this invoice."}'::jsonb)
ON CONFLICT (key) DO NOTHING;

DO $$
DECLARE v_def TEXT; v_oid OID;
BEGIN
  SELECT p.oid INTO v_oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'admin_update_setting';
  IF v_oid IS NULL THEN RAISE EXCEPTION 'admin_update_setting missing'; END IF;
  v_def := pg_get_functiondef(v_oid);
  IF v_def NOT LIKE '%WHEN ''invoice_issuer'' THEN%' THEN
    v_def := replace(v_def,
      E'    ELSE\n      RAISE EXCEPTION ''Setting % cannot be edited from the console'', p_key;',
      E'    WHEN ''invoice_issuer'' THEN\n      IF jsonb_typeof(p_value) <> ''object'' OR jsonb_typeof(p_value->''name'') <> ''string'' OR trim(p_value->>''name'') = '''' THEN RAISE EXCEPTION ''invoice_issuer needs a "name"''; END IF;\n      IF p_value ? ''lines'' AND jsonb_typeof(p_value->''lines'') <> ''array'' THEN RAISE EXCEPTION ''invoice_issuer.lines must be a list of text lines''; END IF;\n      IF p_value ? ''tax_note'' AND jsonb_typeof(p_value->''tax_note'') <> ''string'' THEN RAISE EXCEPTION ''invoice_issuer.tax_note must be text''; END IF;\n    ELSE\n      RAISE EXCEPTION ''Setting % cannot be edited from the console'', p_key;');
    IF v_def NOT LIKE '%WHEN ''invoice_issuer'' THEN%' THEN RAISE EXCEPTION 'could not find the ELSE branch to extend'; END IF;
    EXECUTE v_def;
  END IF;
END $$;

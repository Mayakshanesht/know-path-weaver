-- Minimal local substitutes for Supabase-owned schemas. All application tables,
-- functions, policies and triggers come from the real repository migrations.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA extensions;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
CREATE SCHEMA vault;
CREATE SCHEMA net;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb DEFAULT '{}');
CREATE TABLE auth.identities (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, provider text, identity_data jsonb);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean);
CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text);
CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array($1, '/'); $$;
CREATE TABLE vault.decrypted_secrets (name text, decrypted_secret text);
CREATE TABLE net.test_http_requests (body jsonb);
CREATE FUNCTION net.http_post(url text, headers jsonb, body jsonb) RETURNS bigint LANGUAGE plpgsql AS $$
BEGIN INSERT INTO net.test_http_requests VALUES (body); RETURN 1; END;
$$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;

CREATE FUNCTION public.test_assert(p_ok boolean, p_message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF p_ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assertion failed: %', p_message; END IF; END;
$$;
CREATE FUNCTION public.test_expect_error(p_sql text, p_contains text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_message text;
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF position(p_contains IN v_message) = 0 THEN
      RAISE EXCEPTION 'Expected error containing %, got %', p_contains, v_message;
    END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'Expected statement to fail: %', p_sql;
END;
$$;

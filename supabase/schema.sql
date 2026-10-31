-- Schéma de la base TUVOA (à coller dans Supabase › SQL Editor › Run)

create table if not exists posts (
  id uuid primary key,
  created_at timestamptz not null default now(),
  rubrique text not null default 'actu',
  idea text not null default '',
  title text not null default '',
  source_name text,
  source_url text,
  origin text not null default 'manuel',
  trigger_id text,
  texts jsonb not null default '{}'::jsonb,
  visual jsonb not null default '{}'::jsonb,
  platforms text[] not null default '{}',
  status text not null default 'brouillon',
  scheduled_at timestamptz,
  auto boolean not null default false,
  results jsonb not null default '{}'::jsonb
);
create index if not exists posts_status_idx on posts (status, scheduled_at);
create index if not exists posts_created_idx on posts (created_at desc);

create table if not exists settings (
  id int primary key,
  data jsonb not null default '{}'::jsonb
);

create table if not exists seen_items (
  url text primary key,
  created_at timestamptz not null default now()
);

-- L'application utilise la clé « service_role » côté serveur uniquement.
-- On active la sécurité par ligne sans règle publique : personne d'autre ne peut lire ces tables.
alter table posts enable row level security;
alter table settings enable row level security;
alter table seen_items enable row level security;

-- Les projets Supabase récents n'accordent plus les droits par défaut : seul le serveur de l'app (service_role) y accède.
grant usage on schema public to service_role;
grant select, insert, update, delete on table posts, settings, seen_items to service_role;
revoke all on table posts, settings, seen_items from anon, authenticated;

-- Images importées depuis l'app (tes visuels, photos de fond) : seau public « visuels ».
-- L'app le crée aussi toute seule au premier envoi.
insert into storage.buckets (id, name, public) values ('visuels', 'visuels', true) on conflict (id) do nothing;

-- Veille et publications planifiées toutes les 15 minutes, lancées par Supabase (pg_cron + pg_net).
-- Remplace <ADRESSE> et <CRON_SECRET> (la même valeur que dans Vercel) avant de lancer ce bloc.
-- create extension if not exists pg_cron with schema pg_catalog;
-- create extension if not exists pg_net with schema extensions;
-- select vault.create_secret('<ADRESSE>', 'tuvoa_url');
-- select vault.create_secret('<CRON_SECRET>', 'tuvoa_cron_secret');
-- select cron.schedule('tuvoa-veille', '*/15 * * * *', $$
--   select net.http_get(
--     url := (select decrypted_secret from vault.decrypted_secrets where name = 'tuvoa_url') || '/api/cron',
--     headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'tuvoa_cron_secret')),
--     timeout_milliseconds := 60000);
-- $$);

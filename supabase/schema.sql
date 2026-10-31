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

-- Brèves générées par le LLM à partir d'une publication (une brève par publication).
create table if not exists public.briefs (
  id             bigint generated always as identity primary key,
  publication_id bigint not null unique references public.publications(id) on delete cascade,
  title          text not null,
  body           text not null,
  figures        jsonb not null default '[]',   -- chiffres cités par le LLM (pour la vérification)
  word_count     integer not null,
  model          text not null,
  source_chars   integer not null,              -- taille du texte extrait du document
  verification   jsonb,                         -- rempli à l'étape de vérification des chiffres
  created_at     timestamptz not null default now()
);

alter table public.briefs enable row level security;

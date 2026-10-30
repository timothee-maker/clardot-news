-- Publications réglementées (source : info-financiere.gouv.fr, dataset flux-amf-new-prod)
create extension if not exists pg_trgm;

create table if not exists public.publications (
  id            bigint generated always as identity primary key,
  source_id     text not null unique,          -- uin_idt_uin : clé d'idempotence (upsert)
  published_at  timestamptz not null,          -- uin_dat_amf
  company_name  text not null,                 -- identificationsociete_iso_nom_soc
  isin          text,                          -- identificationsociete_iso_cd_isi
  lei           text,
  country       text,
  title         text,                          -- informationdeposee_inf_tit_inf
  info_type     text,                          -- type_d_information (peut être null)
  info_subtype  text,                          -- sous_type_d_information (peut être null)
  language      text,
  doc_url       text,                          -- url_de_recuperation (PDF)
  is_cac40      boolean not null default false,
  raw           jsonb not null,                -- enregistrement source complet
  ingested_at   timestamptz not null default now()
);

create index if not exists publications_published_at_idx on public.publications (published_at desc);
create index if not exists publications_info_type_idx    on public.publications (info_type);
create index if not exists publications_isin_idx         on public.publications (isin);
create index if not exists publications_company_trgm_idx on public.publications using gin (company_name gin_trgm_ops);

-- RLS activé sans policy : seul le service_role (serveur) accède à la table.
alter table public.publications enable row level security;

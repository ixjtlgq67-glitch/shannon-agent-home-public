-- Shannon product memory.
-- Identity comes from Supabase Auth. Every product table is scoped to auth.uid().
-- Register inserts and proposal status changes happen only inside decide_proposal,
-- which re-checks the quotation against the frozen paragraph.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null,
  save_token text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.declared_uses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  use_id text not null,
  description text not null,
  taste_profile text not null default '',
  enabled boolean not null default true,
  requires_history boolean not null default false,
  unique (user_id, use_id)
);

create table if not exists public.sources (
  user_id uuid not null references auth.users (id) on delete cascade,
  source_id text not null,
  source_version text not null,
  title text not null,
  url text,
  favicon_url text,
  excerpted boolean not null default false,
  origin text not null check (origin in ('url', 'paste')),
  captured_at timestamptz not null default now(),
  primary key (user_id, source_id)
);

create table if not exists public.paragraphs (
  user_id uuid not null references auth.users (id) on delete cascade,
  source_id text not null,
  paragraph_id text not null,
  ordinal integer not null,
  text text not null,
  primary key (user_id, source_id, paragraph_id),
  foreign key (user_id, source_id) references public.sources (user_id, source_id) on delete cascade
);

create table if not exists public.runs (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  source_id text not null,
  status text not null check (status in ('complete', 'incomplete')),
  planned_roles jsonb not null default '[]'::jsonb,
  successful_roles jsonb not null default '[]'::jsonb,
  failed_roles jsonb not null default '[]'::jsonb,
  skipped_roles jsonb not null default '[]'::jsonb,
  call_budget integer not null,
  calls_used integer not null default 0,
  usd_budget numeric not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.proposals (
  user_id uuid not null references auth.users (id) on delete cascade,
  proposal_id text not null,
  run_id text not null references public.runs (id) on delete cascade,
  source_id text not null,
  source_version text not null,
  quote text not null,
  paragraph_id text not null,
  judgment text not null,
  reasoning text not null,
  role_id text not null,
  use_id text,
  model_id text not null,
  prompt_version text not null,
  exploration boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'dropped')),
  drop_reason text,
  created_at timestamptz not null default now(),
  primary key (user_id, proposal_id)
);

create table if not exists public.decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  proposal_id text not null,
  human_name text not null,
  action text not null check (action in ('accept', 'reject')),
  reason text not null default '',
  decided_at timestamptz not null default now(),
  unique (user_id, proposal_id)
);

create table if not exists public.register_entries (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  proposal_id text not null,
  run_id text not null,
  source_id text not null,
  source_title text not null,
  source_version text not null,
  quote text not null,
  paragraph_id text not null,
  judgment text not null,
  reasoning text not null,
  role_id text not null,
  use_id text,
  model_id text not null,
  prompt_version text not null,
  human_name text not null,
  reason text not null default '',
  decided_at timestamptz not null,
  unique (user_id, proposal_id)
);

create table if not exists public.audit_log (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  run_id text,
  kind text not null check (kind in ('rejection', 'quote_dropped', 'role_failed', 'budget', 'storage')),
  summary text not null,
  proposal_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.cost_events (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  run_id text,
  agent_id text not null,
  model_id text not null,
  prompt_version text not null,
  status text not null check (status in ('ok', 'error', 'timeout')),
  input_tokens integer,
  output_tokens integer,
  estimated_cost_usd numeric,
  price_version text,
  latency_ms integer,
  retry_of text,
  created_at timestamptz not null default now()
);

create table if not exists public.concepts (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  run_id text not null,
  name text not null,
  use_ids jsonb not null default '[]'::jsonb,
  paragraph_id text not null,
  reason text not null
);

create table if not exists public.chat_messages (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'shannon')),
  text text not null,
  citations jsonb not null default '[]'::jsonb,
  gaps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists sources_user_url_idx on public.sources (user_id, url) where url is not null;
create index if not exists sources_user_idx on public.sources (user_id, captured_at desc);
create index if not exists proposals_run_idx on public.proposals (user_id, run_id);
create index if not exists register_user_idx on public.register_entries (user_id, decided_at desc);
create index if not exists costs_user_idx on public.cost_events (user_id, created_at);

alter table public.profiles enable row level security;
alter table public.declared_uses enable row level security;
alter table public.sources enable row level security;
alter table public.paragraphs enable row level security;
alter table public.runs enable row level security;
alter table public.proposals enable row level security;
alter table public.decisions enable row level security;
alter table public.register_entries enable row level security;
alter table public.audit_log enable row level security;
alter table public.cost_events enable row level security;
alter table public.concepts enable row level security;
alter table public.chat_messages enable row level security;

create policy profiles_select on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy uses_all on public.declared_uses for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy sources_select on public.sources for select to authenticated using (user_id = auth.uid());
create policy sources_insert on public.sources for insert to authenticated with check (user_id = auth.uid());
create policy sources_delete on public.sources for delete to authenticated using (user_id = auth.uid());

create policy paragraphs_select on public.paragraphs for select to authenticated using (user_id = auth.uid());
create policy paragraphs_insert on public.paragraphs for insert to authenticated with check (user_id = auth.uid());
create policy paragraphs_delete on public.paragraphs for delete to authenticated using (user_id = auth.uid());

create policy runs_select on public.runs for select to authenticated using (user_id = auth.uid());
create policy runs_insert on public.runs for insert to authenticated with check (user_id = auth.uid());
create policy runs_update on public.runs for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy runs_delete on public.runs for delete to authenticated using (user_id = auth.uid());

create policy proposals_select on public.proposals for select to authenticated using (user_id = auth.uid());
create policy proposals_insert on public.proposals for insert to authenticated with check (user_id = auth.uid() and status = 'pending');
create policy proposals_delete on public.proposals for delete to authenticated using (user_id = auth.uid());

create policy decisions_select on public.decisions for select to authenticated using (user_id = auth.uid());
create policy register_select on public.register_entries for select to authenticated using (user_id = auth.uid());

create policy audit_select on public.audit_log for select to authenticated using (user_id = auth.uid());
create policy audit_insert on public.audit_log for insert to authenticated with check (user_id = auth.uid());

create policy costs_select on public.cost_events for select to authenticated using (user_id = auth.uid());
create policy costs_insert on public.cost_events for insert to authenticated with check (user_id = auth.uid());

create policy concepts_select on public.concepts for select to authenticated using (user_id = auth.uid());
create policy concepts_insert on public.concepts for insert to authenticated with check (user_id = auth.uid());
create policy concepts_delete on public.concepts for delete to authenticated using (user_id = auth.uid());

create policy chat_select on public.chat_messages for select to authenticated using (user_id = auth.uid());
create policy chat_insert on public.chat_messages for insert to authenticated with check (user_id = auth.uid());

-- Accept/reject gate. Only a verified session can call it, and only on a pending
-- proposal whose quotation is still inside the frozen paragraph.
create or replace function public.decide_proposal(
  p_proposal_id text,
  p_action text,
  p_reason text,
  p_human_name text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.proposals%rowtype;
  source_title text;
  register_id text;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized user';
  end if;
  if p_action not in ('accept', 'reject') then
    raise exception 'Choose accept or reject';
  end if;
  if length(btrim(coalesce(p_human_name, ''))) = 0 then
    raise exception 'Named human required';
  end if;

  select * into rec
  from public.proposals
  where proposal_id = p_proposal_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Unauthorized user';
  end if;

  if rec.status = p_action or (rec.status = 'accepted' and p_action = 'accept') or (rec.status = 'rejected' and p_action = 'reject') then
    return jsonb_build_object('status', rec.status, 'run_id', rec.run_id, 'idempotent', true);
  end if;
  if rec.status <> 'pending' then
    raise exception 'Decision already finalized';
  end if;

  if not exists (
    select 1 from public.paragraphs pg
    where pg.user_id = rec.user_id
      and pg.source_id = rec.source_id
      and pg.paragraph_id = rec.paragraph_id
      and strpos(pg.text, rec.quote) > 0
      and length(btrim(rec.quote)) > 0
  ) then
    raise exception 'Quote does not match its frozen paragraph';
  end if;

  update public.proposals
  set status = case when p_action = 'accept' then 'accepted' else 'rejected' end
  where user_id = rec.user_id and proposal_id = rec.proposal_id;

  insert into public.decisions (user_id, proposal_id, human_name, action, reason)
  values (auth.uid(), rec.proposal_id, btrim(p_human_name), p_action, coalesce(p_reason, ''));

  if p_action = 'accept' then
    select title into source_title from public.sources
    where user_id = rec.user_id and source_id = rec.source_id;
    register_id := 'reg_' || substr(md5(rec.user_id::text || rec.proposal_id), 1, 16);
    insert into public.register_entries (
      id, user_id, proposal_id, run_id, source_id, source_title, source_version,
      quote, paragraph_id, judgment, reasoning, role_id, use_id, model_id,
      prompt_version, human_name, reason, decided_at
    ) values (
      register_id, auth.uid(), rec.proposal_id, rec.run_id, rec.source_id,
      coalesce(source_title, rec.source_id), rec.source_version, rec.quote, rec.paragraph_id,
      rec.judgment, rec.reasoning, rec.role_id, rec.use_id, rec.model_id,
      rec.prompt_version, btrim(p_human_name), coalesce(p_reason, ''), now()
    );
  else
    insert into public.audit_log (id, user_id, run_id, kind, summary, proposal_id)
    values (
      'aud_' || substr(md5(rec.proposal_id || clock_timestamp()::text), 1, 16),
      auth.uid(), rec.run_id, 'rejection',
      case when length(btrim(coalesce(p_reason, ''))) = 0 then 'Rejected with no note.' else left(btrim(p_reason), 200) end,
      rec.proposal_id
    );
  end if;

  return jsonb_build_object('status', case when p_action = 'accept' then 'accepted' else 'rejected' end, 'run_id', rec.run_id, 'idempotent', false);
end;
$$;

revoke all on function public.decide_proposal(text, text, text, text) from public;
grant execute on function public.decide_proposal(text, text, text, text) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(coalesce(new.email, 'reader'), '@', 1))
  )
  on conflict (id) do nothing;

  insert into public.declared_uses (user_id, use_id, description, taste_profile, enabled, requires_history)
  values
    (new.id, 'practitioner', 'What a practitioner should do with this in work they already have.', '', true, false),
    (new.id, 'economist', 'Costs, incentives, and whether the claim should change a budget.', '', true, false),
    (new.id, 'historian', 'How this sits against judgments this reader has already accepted.', '', true, true)
  on conflict (user_id, use_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into storage.buckets (id, name, public)
values ('frozen-sources', 'frozen-sources', false)
on conflict (id) do nothing;

create policy frozen_sources_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'frozen-sources'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy frozen_sources_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'frozen-sources'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

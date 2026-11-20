-- Shannon product memory. Idempotent: safe to run more than once.
-- Apply this file only. Do not also run the older migration files.
-- Identity comes from Supabase Auth. The server uses the signed-in reader's JWT.
-- No service-role key. A personal save token is resolved by as_save_token, which
-- writes only the rows owned by that token. Register inserts happen only inside
-- decide_proposal, which re-checks the quotation against the frozen paragraph.

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

alter table public.profiles add column if not exists save_token text;
alter table public.sources add column if not exists favicon_url text;
alter table public.sources add column if not exists excerpted boolean not null default false;

create unique index if not exists profiles_save_token_idx on public.profiles (save_token) where save_token is not null;
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

drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_insert on public.profiles;
drop policy if exists profiles_update on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists uses_all on public.declared_uses;
create policy uses_all on public.declared_uses for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists sources_select on public.sources;
drop policy if exists sources_insert on public.sources;
drop policy if exists sources_delete on public.sources;
create policy sources_select on public.sources for select to authenticated using (user_id = auth.uid());
create policy sources_insert on public.sources for insert to authenticated with check (user_id = auth.uid());
create policy sources_delete on public.sources for delete to authenticated using (user_id = auth.uid());

drop policy if exists paragraphs_select on public.paragraphs;
drop policy if exists paragraphs_insert on public.paragraphs;
drop policy if exists paragraphs_delete on public.paragraphs;
create policy paragraphs_select on public.paragraphs for select to authenticated using (user_id = auth.uid());
create policy paragraphs_insert on public.paragraphs for insert to authenticated with check (user_id = auth.uid());
create policy paragraphs_delete on public.paragraphs for delete to authenticated using (user_id = auth.uid());

drop policy if exists runs_select on public.runs;
drop policy if exists runs_insert on public.runs;
drop policy if exists runs_update on public.runs;
drop policy if exists runs_delete on public.runs;
create policy runs_select on public.runs for select to authenticated using (user_id = auth.uid());
create policy runs_insert on public.runs for insert to authenticated with check (user_id = auth.uid());
create policy runs_update on public.runs for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy runs_delete on public.runs for delete to authenticated using (user_id = auth.uid());

drop policy if exists proposals_select on public.proposals;
drop policy if exists proposals_insert on public.proposals;
drop policy if exists proposals_delete on public.proposals;
create policy proposals_select on public.proposals for select to authenticated using (user_id = auth.uid());
create policy proposals_insert on public.proposals for insert to authenticated with check (user_id = auth.uid() and status = 'pending');
create policy proposals_delete on public.proposals for delete to authenticated using (user_id = auth.uid());

drop policy if exists decisions_select on public.decisions;
create policy decisions_select on public.decisions for select to authenticated using (user_id = auth.uid());

drop policy if exists register_select on public.register_entries;
create policy register_select on public.register_entries for select to authenticated using (user_id = auth.uid());

drop policy if exists audit_select on public.audit_log;
drop policy if exists audit_insert on public.audit_log;
create policy audit_select on public.audit_log for select to authenticated using (user_id = auth.uid());
create policy audit_insert on public.audit_log for insert to authenticated with check (user_id = auth.uid());

drop policy if exists costs_select on public.cost_events;
drop policy if exists costs_insert on public.cost_events;
create policy costs_select on public.cost_events for select to authenticated using (user_id = auth.uid());
create policy costs_insert on public.cost_events for insert to authenticated with check (user_id = auth.uid());

drop policy if exists concepts_select on public.concepts;
drop policy if exists concepts_insert on public.concepts;
drop policy if exists concepts_delete on public.concepts;
create policy concepts_select on public.concepts for select to authenticated using (user_id = auth.uid());
create policy concepts_insert on public.concepts for insert to authenticated with check (user_id = auth.uid());
create policy concepts_delete on public.concepts for delete to authenticated using (user_id = auth.uid());

drop policy if exists chat_select on public.chat_messages;
drop policy if exists chat_insert on public.chat_messages;
create policy chat_select on public.chat_messages for select to authenticated using (user_id = auth.uid());
create policy chat_insert on public.chat_messages for insert to authenticated with check (user_id = auth.uid());

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke all on all tables in schema public from anon;

-- Accept/reject gate. Only the signed-in reader can call it, and only on a pending
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

revoke all on function public.decide_proposal(text, text, text, text) from public, anon;
grant execute on function public.decide_proposal(text, text, text, text) to authenticated;

-- Extension saves. The anon key may call this only with a matching save token.
-- The signed-in app does not need it; row-level security covers that path.
create or replace function public.as_save_token(
  p_token text,
  p_action text,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  result jsonb;
begin
  if p_token is null or char_length(p_token) < 16 then
    raise exception 'Unauthorized user';
  end if;
  select id into uid from public.profiles where save_token = p_token;
  if uid is null then
    raise exception 'Unauthorized user';
  end if;
  if p_payload is null then
    p_payload := '{}'::jsonb;
  end if;

  if p_action = 'profile' then
    select jsonb_build_object(
      'id', p.id,
      'email', p.email,
      'displayName', p.display_name,
      'emailVerified', true
    ) into result
    from public.profiles p where p.id = uid;
    return result;
  elsif p_action = 'list_uses' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'use_id', use_id,
      'description', description,
      'taste_profile', taste_profile,
      'enabled', enabled,
      'requires_history', requires_history
    ) order by use_id), '[]'::jsonb) into result
    from public.declared_uses where user_id = uid;
    return result;
  elsif p_action = 'list_sources' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', s.user_id,
      'source_id', s.source_id,
      'source_version', s.source_version,
      'title', s.title,
      'url', s.url,
      'origin', s.origin,
      'captured_at', s.captured_at,
      'favicon_url', s.favicon_url,
      'excerpted', s.excerpted,
      'paragraphs', coalesce((
        select jsonb_agg(jsonb_build_object('id', pg.paragraph_id, 'text', pg.text) order by pg.ordinal)
        from public.paragraphs pg
        where pg.user_id = s.user_id and pg.source_id = s.source_id
      ), '[]'::jsonb)
    ) order by s.captured_at desc), '[]'::jsonb) into result
    from public.sources s where s.user_id = uid;
    return result;
  elsif p_action = 'list_runs' then
    select coalesce(jsonb_agg(to_jsonb(r) order by r.started_at desc), '[]'::jsonb) into result
    from public.runs r where r.user_id = uid;
    return result;
  elsif p_action = 'list_register' then
    select coalesce(jsonb_agg(to_jsonb(r) order by r.decided_at desc), '[]'::jsonb) into result
    from public.register_entries r where r.user_id = uid;
    return result;
  elsif p_action = 'count_non_skeptic' then
    select to_jsonb(count(*)) into result
    from public.proposals
    where user_id = uid and role_id <> 'skeptic' and status <> 'dropped';
    return result;
  elsif p_action = 'create_source' then
    begin
      insert into public.sources (
        user_id, source_id, source_version, title, url, origin, captured_at, favicon_url, excerpted
      )
      select
        uid, x.source_id, x.source_version, x.title, x.url, x.origin,
        coalesce(x.captured_at, now()), x.favicon_url, coalesce(x.excerpted, false)
      from jsonb_to_record(p_payload) as x(
        source_id text, source_version text, title text, url text, origin text,
        captured_at timestamptz, favicon_url text, excerpted boolean
      );
      insert into public.paragraphs (user_id, source_id, paragraph_id, ordinal, text)
      select uid, p_payload->>'source_id', pg.id, item.ordinality::integer, pg."text"
      from jsonb_array_elements(p_payload->'paragraphs') with ordinality as item(value, ordinality)
      cross join lateral jsonb_to_record(item.value) as pg(id text, "text" text);
    exception when unique_violation then
      raise exception 'You already saved this page. It is in your library.';
    end;
    return '{}'::jsonb;
  elsif p_action = 'create_run' then
    insert into public.runs (
      id, user_id, source_id, status, planned_roles, successful_roles, failed_roles, skipped_roles,
      call_budget, calls_used, usd_budget, started_at, finished_at
    )
    select
      x.id, uid, x.source_id, x.status,
      coalesce(x.planned_roles, '[]'::jsonb),
      coalesce(x.successful_roles, '[]'::jsonb),
      coalesce(x.failed_roles, '[]'::jsonb),
      coalesce(x.skipped_roles, '[]'::jsonb),
      x.call_budget, coalesce(x.calls_used, 0), x.usd_budget, coalesce(x.started_at, now()), x.finished_at
    from jsonb_to_record(p_payload) as x(
      id text, source_id text, status text,
      planned_roles jsonb, successful_roles jsonb, failed_roles jsonb, skipped_roles jsonb,
      call_budget integer, calls_used integer, usd_budget numeric, started_at timestamptz, finished_at timestamptz
    );
    return '{}'::jsonb;
  elsif p_action = 'update_run' then
    update public.runs r set
      status = case when p_payload->'patch' ? 'status' then p_payload->'patch'->>'status' else r.status end,
      planned_roles = case when p_payload->'patch' ? 'planned_roles' then p_payload->'patch'->'planned_roles' else r.planned_roles end,
      successful_roles = case when p_payload->'patch' ? 'successful_roles' then p_payload->'patch'->'successful_roles' else r.successful_roles end,
      failed_roles = case when p_payload->'patch' ? 'failed_roles' then p_payload->'patch'->'failed_roles' else r.failed_roles end,
      skipped_roles = case when p_payload->'patch' ? 'skipped_roles' then p_payload->'patch'->'skipped_roles' else r.skipped_roles end,
      call_budget = case when p_payload->'patch' ? 'call_budget' then (p_payload->'patch'->>'call_budget')::integer else r.call_budget end,
      calls_used = case when p_payload->'patch' ? 'calls_used' then (p_payload->'patch'->>'calls_used')::integer else r.calls_used end,
      usd_budget = case when p_payload->'patch' ? 'usd_budget' then (p_payload->'patch'->>'usd_budget')::numeric else r.usd_budget end,
      finished_at = case when p_payload->'patch' ? 'finished_at' then (p_payload->'patch'->>'finished_at')::timestamptz else r.finished_at end
    where r.user_id = uid and r.id = p_payload->>'run_id';
    return '{}'::jsonb;
  elsif p_action = 'insert_proposals' then
    insert into public.proposals (
      user_id, proposal_id, run_id, source_id, source_version, quote, paragraph_id,
      judgment, reasoning, role_id, use_id, model_id, prompt_version, exploration,
      status, drop_reason, created_at
    )
    select
      uid, x.proposal_id, x.run_id, x.source_id, x.source_version, x.quote, x.paragraph_id,
      x.judgment, x.reasoning, x.role_id, x.use_id, x.model_id, x.prompt_version,
      coalesce(x.exploration, false), 'pending', null, coalesce(x.created_at, now())
    from jsonb_to_recordset(p_payload) as x(
      proposal_id text, run_id text, source_id text, source_version text, quote text, paragraph_id text,
      judgment text, reasoning text, role_id text, use_id text, model_id text, prompt_version text,
      exploration boolean, created_at timestamptz
    );
    return '{}'::jsonb;
  elsif p_action = 'insert_audit' then
    insert into public.audit_log (id, user_id, run_id, kind, summary, proposal_id, created_at)
    select x.id, uid, x.run_id, x.kind, x.summary, x.proposal_id, coalesce(x.created_at, now())
    from jsonb_to_recordset(p_payload) as x(
      id text, run_id text, kind text, summary text, proposal_id text, created_at timestamptz
    );
    return '{}'::jsonb;
  elsif p_action = 'insert_costs' then
    insert into public.cost_events (
      id, user_id, run_id, agent_id, model_id, prompt_version, status,
      input_tokens, output_tokens, estimated_cost_usd, price_version, latency_ms, retry_of, created_at
    )
    select
      x.id, uid, x.run_id, x.agent_id, x.model_id, x.prompt_version, x.status,
      x.input_tokens, x.output_tokens, x.estimated_cost_usd, x.price_version, x.latency_ms, x.retry_of,
      coalesce(x.created_at, now())
    from jsonb_to_recordset(p_payload) as x(
      id text, run_id text, agent_id text, model_id text, prompt_version text, status text,
      input_tokens integer, output_tokens integer, estimated_cost_usd numeric, price_version text,
      latency_ms integer, retry_of text, created_at timestamptz
    );
    return '{}'::jsonb;
  elsif p_action = 'insert_concepts' then
    insert into public.concepts (id, user_id, run_id, name, use_ids, paragraph_id, reason)
    select x.id, uid, x.run_id, x.name, coalesce(x.use_ids, '[]'::jsonb), x.paragraph_id, x.reason
    from jsonb_to_recordset(p_payload) as x(
      id text, run_id text, name text, use_ids jsonb, paragraph_id text, reason text
    );
    return '{}'::jsonb;
  else
    raise exception 'Unknown save action';
  end if;
end;
$$;

revoke all on function public.as_save_token(text, text, jsonb) from public;
grant execute on function public.as_save_token(text, text, jsonb) to anon, authenticated;

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

drop policy if exists frozen_sources_read on storage.objects;
drop policy if exists frozen_sources_insert on storage.objects;
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

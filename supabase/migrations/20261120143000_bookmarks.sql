-- Bookmark library fields and delete rights for readers removing a saved site.
-- Accepted register rows are not deleted with the site.

create unique index if not exists sources_user_url_idx on public.sources (user_id, url) where url is not null;

alter table public.sources add column if not exists favicon_url text;
alter table public.sources add column if not exists excerpted boolean not null default false;

drop policy if exists sources_delete on public.sources;
create policy sources_delete on public.sources for delete to authenticated using (user_id = auth.uid());

drop policy if exists paragraphs_delete on public.paragraphs;
create policy paragraphs_delete on public.paragraphs for delete to authenticated using (user_id = auth.uid());

drop policy if exists runs_delete on public.runs;
create policy runs_delete on public.runs for delete to authenticated using (user_id = auth.uid());

drop policy if exists proposals_delete on public.proposals;
create policy proposals_delete on public.proposals for delete to authenticated using (user_id = auth.uid());

drop policy if exists concepts_delete on public.concepts;
create policy concepts_delete on public.concepts for delete to authenticated using (user_id = auth.uid());

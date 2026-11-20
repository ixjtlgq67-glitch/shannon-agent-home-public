alter table public.profiles add column if not exists save_token text;
create unique index if not exists profiles_save_token_idx on public.profiles (save_token) where save_token is not null;

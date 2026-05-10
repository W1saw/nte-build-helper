-- Whitelist пользователей. Применяется ПОСЛЕ миграции 0001.
-- Чтобы добавить друзей — вставить новые строки и заново выполнить.
-- Применение: Supabase Dashboard → SQL Editor.

insert into public.allowed_users (email) values
  ('mysticchaos0@gmail.com')
on conflict (email) do nothing;

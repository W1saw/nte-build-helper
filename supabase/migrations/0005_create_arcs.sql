-- Создание таблицы arcs (Дуги — оружие персонажей в NTE).
-- Применяется в Supabase Dashboard → SQL Editor.
--
-- Каждая Дуга принадлежит одному из 5 типов: Когнитивный, Инстинктивный,
-- Сдерживающий, Соединительный, Эмотивный. Персонаж может использовать только
-- Дугу совпадающего с его arc_type типа.

create table public.arcs (
  id                uuid primary key default gen_random_uuid(),
  name_ru           text not null unique,
  name_en           text,
  arc_type          text not null,
  main_stat_pool    jsonb,
  sub_stat_pool     jsonb,
  passive_text_ru   text,
  rarity            text,
  notes             text,
  created_at        timestamptz not null default now()
);

create index arcs_arc_type_idx on public.arcs(arc_type);

-- RLS — read/write для whitelist'нутых юзеров (паттерн как у других каталог-таблиц)
alter table public.arcs enable row level security;

create policy "arcs read whitelist"
  on public.arcs for select to authenticated using (public.is_allowed_user());
create policy "arcs write whitelist"
  on public.arcs for all to authenticated
  using (public.is_allowed_user()) with check (public.is_allowed_user());

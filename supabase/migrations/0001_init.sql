-- NTE Build Helper — initial schema
-- Создан 10.05.2026. См. projects/nte-build-helper/STATUS.md → раздел "Схема БД".
-- Для применения: либо через Supabase Dashboard → SQL Editor, либо через `supabase db push`.

-- ═══════════════════════════════════════════════════════════════════════════
-- Расширения
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";  -- для gen_random_uuid()
create extension if not exists "vector";    -- для эмбеддингов (Этап 3, RAG)

-- ═══════════════════════════════════════════════════════════════════════════
-- Whitelist пользователей
-- ═══════════════════════════════════════════════════════════════════════════

create table public.allowed_users (
  email      text primary key,
  added_at   timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- Каталог игры (характеристики, сеты, формы, картриджи, модули)
-- ═══════════════════════════════════════════════════════════════════════════

create table public.characters (
  id            uuid primary key default gen_random_uuid(),
  name_ru       text not null unique,
  name_en       text,
  role          text,
  anima_type    text,
  base_stats    jsonb,
  avatar_url    text,
  notes         text,
  created_at    timestamptz not null default now()
);

-- Формы тетрис-фигур.
-- Тип = количество клеток (II=2, III=3, IV=4). Тип V в игре отсутствует.
create table public.shapes (
  id            text primary key,                   -- "II_h", "III_L1", "IV_square", ...
  type_roman    text not null check (type_roman in ('II', 'III', 'IV')),
  cell_count    int not null check (cell_count between 2 and 4),
  pattern       jsonb not null,                     -- координаты клеток [[0,0],[0,1],...]
  name_ru       text,
  icon_url      text
);

-- Сеты.
-- damage_type_ru выводится из текста 2pc-бонуса (не из главного стата картриджа,
-- который рандомный). Может быть NULL для сетов без буста типа урона.
create table public.sets (
  id              uuid primary key default gen_random_uuid(),
  name_ru         text not null unique,
  name_en         text,
  damage_type_ru  text,
  bonus_2pc_ru    text,
  bonus_4pc_ru    text,
  notes           text
);

-- 4 формы модулей, нужные для активации 4pc-бонуса конкретного сета.
-- Position 1..4 фиксирует порядок 4-х иконок в блоке "Улучшение картриджа".
create table public.set_required_shapes (
  set_id    uuid not null references public.sets(id) on delete cascade,
  position  int not null check (position between 1 and 4),
  shape_id  text not null references public.shapes(id),
  primary key (set_id, position)
);

-- Картриджи (каталог: какие бывают). Главный стат — РАНДОМНЫЙ ролл из main_stat_pool.
create table public.cartridges (
  id                uuid primary key default gen_random_uuid(),
  set_id            uuid not null references public.sets(id) on delete cascade,
  name_ru           text not null,
  main_stat_pool    jsonb,
  sub_stat_pool     jsonb,
  rarity            text,
  notes             text,
  created_at        timestamptz not null default now()
);

-- Модули (каталог).
create table public.modules (
  id                  uuid primary key default gen_random_uuid(),
  shape_id            text not null references public.shapes(id),
  type_roman          text not null,                  -- денормализовано из shape для фильтров
  main_stat_options   jsonb,
  sub_stat_pool       jsonb,
  has_passive         boolean not null default false,
  passive_text_ru     text,
  rarity              text,
  notes               text,
  created_at          timestamptz not null default now()
);

create index modules_shape_id_idx on public.modules(shape_id);
create index modules_type_idx on public.modules(type_roman);
create index cartridges_set_id_idx on public.cartridges(set_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- Глоссарий RU↔EN — источник истины русских терминов из скринов
-- ═══════════════════════════════════════════════════════════════════════════

create table public.glossary (
  id            uuid primary key default gen_random_uuid(),
  term_ru       text not null,
  term_en       text,
  category      text not null,                        -- character | set | cartridge | module | shape | stat | mechanic
  source        text,                                 -- screenshot_id или url
  confirmed     boolean not null default false,       -- true если из скрина
  created_at    timestamptz not null default now(),
  unique (term_ru, category)
);

create index glossary_term_ru_idx on public.glossary(term_ru);
create index glossary_term_en_idx on public.glossary(term_en);

-- ═══════════════════════════════════════════════════════════════════════════
-- Гайды для RAG (Этап 3) — эмбеддинги OpenAI text-embedding-3-small (1536 dim)
-- ═══════════════════════════════════════════════════════════════════════════

create table public.guides (
  id            uuid primary key default gen_random_uuid(),
  source_url    text not null,
  chunk_index   int not null default 0,
  chunk         text not null,
  embedding     vector(1536),
  lang          text not null default 'en',
  fetched_at    timestamptz not null default now(),
  unique (source_url, chunk_index)
);

create index guides_embedding_idx on public.guides
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ═══════════════════════════════════════════════════════════════════════════
-- Скрины (загрузки в Storage bucket `screenshots/`)
-- ═══════════════════════════════════════════════════════════════════════════

create table public.screenshots (
  id            uuid primary key default gen_random_uuid(),
  storage_path  text not null,
  parsed_data   jsonb,
  processed_at  timestamptz,
  notes         text,
  uploaded_by   uuid references auth.users(id),
  created_at    timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS-политики
-- ═══════════════════════════════════════════════════════════════════════════
-- Логика: писать в любую таблицу может только аутентифицированный пользователь,
-- чей email находится в allowed_users. Чтение доступно тем же.
-- Service-role (server-side admin) обходит RLS автоматически.

alter table public.allowed_users enable row level security;
alter table public.characters enable row level security;
alter table public.shapes enable row level security;
alter table public.sets enable row level security;
alter table public.set_required_shapes enable row level security;
alter table public.cartridges enable row level security;
alter table public.modules enable row level security;
alter table public.glossary enable row level security;
alter table public.guides enable row level security;
alter table public.screenshots enable row level security;

-- Helper: проверка что текущий юзер в whitelist.
create or replace function public.is_allowed_user()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.allowed_users
    where email = (auth.jwt() ->> 'email')::text
  );
$$;

-- allowed_users: каждый видит только свою строку (read-only через RLS;
-- запись только service-role).
create policy "allowed_users self read"
  on public.allowed_users for select
  to authenticated
  using (email = (auth.jwt() ->> 'email')::text);

-- Каталог + глоссарий + гайды — read/write для whitelist'нутых юзеров.
create policy "catalog read whitelist"
  on public.characters for select to authenticated using (public.is_allowed_user());
create policy "catalog write whitelist"
  on public.characters for all to authenticated
  using (public.is_allowed_user()) with check (public.is_allowed_user());

create policy "shapes read whitelist"
  on public.shapes for select to authenticated using (public.is_allowed_user());
create policy "shapes write whitelist"
  on public.shapes for all to authenticated
  using (public.is_allowed_user()) with check (public.is_allowed_user());

create policy "sets read whitelist"
  on public.sets for select to authenticated using (public.is_allowed_user());
create policy "sets write whitelist"
  on public.sets for all to authenticated
  using (public.is_allowed_user()) with check (public.is_allowed_user());

create policy "set_required_shapes read whitelist"
  on public.set_required_shapes for select to authenticated using (public.is_allowed_user());
create policy "set_required_shapes write whitelist"
  on public.set_required_shapes for all to authenticated
  using (public.is_allowed_user()) with check (public.is_allowed_user());

create policy "cartridges read whitelist"
  on public.cartridges for select to authenticated using (public.is_allowed_user());
create policy "cartridges write whitelist"
  on public.cartridges for all to authenticated
  using (public.is_allowed_user()) with check (public.is_allowed_user());

create policy "modules read whitelist"
  on public.modules for select to authenticated using (public.is_allowed_user());
create policy "modules write whitelist"
  on public.modules for all to authenticated
  using (public.is_allowed_user()) with check (public.is_allowed_user());

create policy "glossary read whitelist"
  on public.glossary for select to authenticated using (public.is_allowed_user());
create policy "glossary write whitelist"
  on public.glossary for all to authenticated
  using (public.is_allowed_user()) with check (public.is_allowed_user());

create policy "guides read whitelist"
  on public.guides for select to authenticated using (public.is_allowed_user());
create policy "guides write whitelist"
  on public.guides for all to authenticated
  using (public.is_allowed_user()) with check (public.is_allowed_user());

create policy "screenshots read whitelist"
  on public.screenshots for select to authenticated using (public.is_allowed_user());
create policy "screenshots write whitelist"
  on public.screenshots for all to authenticated
  using (public.is_allowed_user()) with check (public.is_allowed_user());

-- ═══════════════════════════════════════════════════════════════════════════
-- Сидинг каталога форм (по скрину "По форме" из STATUS.md)
-- Тип II — 2 формы, тип III — 6 форм, тип IV — 4 формы.
-- pattern — координаты клеток в локальной сетке формы.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.shapes (id, type_roman, cell_count, pattern, name_ru) values
  -- Тип II (2 клетки)
  ('II_h',         'II',  2, '[[0,0],[0,1]]'::jsonb,                             'домино горизонтальное'),
  ('II_v',         'II',  2, '[[0,0],[1,0]]'::jsonb,                             'домино вертикальное'),

  -- Тип III (3 клетки)
  ('III_line_h',   'III', 3, '[[0,0],[0,1],[0,2]]'::jsonb,                       'I-тромино горизонтальное'),
  ('III_line_v',   'III', 3, '[[0,0],[1,0],[2,0]]'::jsonb,                       'I-тромино вертикальное'),
  ('III_L_NE',     'III', 3, '[[0,0],[1,0],[1,1]]'::jsonb,                       'L-тромино (правый низ)'),
  ('III_L_NW',     'III', 3, '[[0,1],[1,0],[1,1]]'::jsonb,                       'L-тромино (левый низ)'),
  ('III_L_SE',     'III', 3, '[[0,0],[0,1],[1,1]]'::jsonb,                       'L-тромино (правый верх)'),
  ('III_L_SW',     'III', 3, '[[0,0],[0,1],[1,0]]'::jsonb,                       'L-тромино (левый верх)'),

  -- Тип IV (4 клетки)
  ('IV_line_h',    'IV',  4, '[[0,0],[0,1],[0,2],[0,3]]'::jsonb,                 'I-тетромино горизонтальное'),
  ('IV_line_v',    'IV',  4, '[[0,0],[1,0],[2,0],[3,0]]'::jsonb,                 'I-тетромино вертикальное'),
  ('IV_square',    'IV',  4, '[[0,0],[0,1],[1,0],[1,1]]'::jsonb,                 'квадрат 2×2'),
  ('IV_L',         'IV',  4, '[[0,0],[1,0],[2,0],[2,1]]'::jsonb,                 'L-тетромино');

-- ═══════════════════════════════════════════════════════════════════════════
-- Сидинг сетов (12 видимых на 10.05.2026 в инвентаре Артёма).
-- Точные 2pc/4pc, damage_type, required_shapes — заполняются по скринам каждого
-- сета в Этапе 2 через Vision-пайплайн. Сейчас только имена.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.sets (name_ru, damage_type_ru, bonus_2pc_ru) values
  ('Диабло',                     null, null),
  ('Багрянец: Две бабочки',      null, null),
  ('Королевский страж',          null, null),
  ('Мини-мега приключение',      null, null),
  ('Светлячки и лес',            'анима',  'урон анимы +10%'),
  ('Уличный боец',               null, null),
  ('Кредо теней',                null, null),
  ('Скоростной ёж',              null, null),
  ('Кровь демона: Проклятие',    null, null),
  ('Утраченное сияние',          'космос', 'урон космоса +10%'),
  ('Ночная таверна Теи',         null, null),
  ('Тихое поместье',             null, null);

-- ═══════════════════════════════════════════════════════════════════════════
-- Сидинг глоссария — терминология из скринов 10.05.2026
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.glossary (term_ru, category, confirmed, source) values
  ('Консоль',                    'mechanic', true, 'screen-2026-05-10-cartridge'),
  ('Картридж',                   'mechanic', true, 'screen-2026-05-10-cartridge'),
  ('Модуль',                     'mechanic', true, 'screen-2026-05-10-module'),
  ('Улучшение картриджа',        'mechanic', true, 'screen-2026-05-10-cartridge'),
  ('Эпический',                  'mechanic', true, 'screen-2026-05-10-cartridge'),
  ('Легендарный',                'mechanic', true, 'screen-2026-05-10-cartridge'),
  ('Атака',                      'stat',     true, 'screen-2026-05-10-cartridge'),
  ('ОЗ',                         'stat',     true, 'screen-2026-05-10-cartridge'),
  ('Защита',                     'stat',     true, 'screen-2026-05-10-shapes'),
  ('Урон',                       'stat',     true, 'screen-2026-05-10-module'),
  ('Крит. урон',                 'stat',     true, 'screen-2026-05-10-cartridge'),
  ('Шанс крит. удара',           'stat',     true, 'screen-2026-05-10-module'),
  ('Бонус к урону анимы',        'stat',     true, 'screen-2026-05-10-cartridge'),
  ('Интенсивность разрушения',   'stat',     true, 'screen-2026-05-10-cartridge-2'),
  ('Эссентия',                   'stat',     true, 'screen-2026-05-10-cartridge-2'),
  ('Урон анимы',                 'mechanic', true, 'screen-2026-05-10-cartridge'),
  ('Урон космоса',               'mechanic', true, 'screen-2026-05-10-cartridge-2');

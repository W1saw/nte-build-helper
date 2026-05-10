# NTE Build Helper

Личный AI-помощник по сборкам экипировки для Neverness To Everness.

Подробный план, архитектура, схема БД и open-вопросы — в [STATUS.md](./STATUS.md).

## Стек

- Next.js 16 (App Router) на Vercel
- Supabase (Postgres + pgvector + Storage + Auth)
- Gemini 2.5 Pro (советы + Vision)
- Tailwind 4

## Локальный запуск (опционально)

```bash
npm install
cp .env.example .env.local
# заполнить .env.local своими ключами Supabase + Gemini
npm run dev
```

## Применение миграции

В Supabase Dashboard → SQL Editor → вставить и выполнить по очереди:

1. [supabase/migrations/0001_init.sql](./supabase/migrations/0001_init.sql) — схема + сидинг форм/сетов/глоссария
2. [supabase/seed.sql](./supabase/seed.sql) — whitelist e-mail-ов

## Деплой

Push в `master` → Vercel сам деплоит. Env-переменные в Vercel Project Settings:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`

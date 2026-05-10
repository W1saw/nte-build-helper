-- Добавление полей archetype и rank к персонажам.
-- Применяется в Supabase Dashboard → SQL Editor.
--
-- Контекст: 10.05.2026 при ручном сидинге персонажей выяснилось что в NTE есть
-- ещё 2 свойства: archetype (Когнитивный/Инстинктивный/Сдерживающий/Соединительный/Эмотивный)
-- и rank (S, A). Влияют на советы по билдам.

alter table public.characters add column if not exists archetype text;
alter table public.characters add column if not exists rank text;

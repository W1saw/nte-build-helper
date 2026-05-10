// Промпты и схемы структурированного вывода для каждого типа скрина NTE.
// Документация Gemini structured output: https://ai.google.dev/gemini-api/docs/structured-output

import type { GeminiSchema } from "./gemini";

// ═══════════════════════════════════════════════════════════════════════════
// Карточка сета (картриджа) — например «Утраченное сияние +20»
// ═══════════════════════════════════════════════════════════════════════════

export type ParsedSetCard = {
  set_name_ru: string;
  cartridge_level: number; // обычно "+20" → 20
  damage_type_ru: string | null; // "анима", "космос", null
  observed_main_stat: { name: string; value: string };
  observed_sub_stats: Array<{ name: string; value: string }>;
  bonus_2pc_ru: string;
  bonus_4pc_ru: string;
  required_shapes_descriptions: string[]; // 4 элемента: словесное описание каждой формы
};

export const SET_CARD_PROMPT = `Ты обрабатываешь скрин из игры Neverness To Everness (NTE), русская локализация.
На картинке — детальная карточка картриджа (предмет экипировки) с панелью атрибутов справа.

Извлеки СТРОГО следующие поля:

1. **set_name_ru** — название сета на русском (например «Утраченное сияние», «Светлячки и лес»). Берётся из заголовка карточки (рядом с числом «+20»).

2. **cartridge_level** — число после «+» в заголовке (обычно 20).

3. **damage_type_ru** — тип урона ИЗ ТЕКСТА БОНУСА «Эпический (2):» в блоке «Улучшение картриджа». Если бонус вида «урон анимы +10%» → "анима". «урон космоса +10%» → "космос". Если бонус не про тип урона (например «Атака +10%») → null.

4. **observed_main_stat** — содержимое блока «Главные атрибуты» (обычно одна строка вида «Атака — 37.50%», «Бонус к урону анимы — 37.50%»). Возьми название стата и значение как строки. ВАЖНО: верхний главный стат — рандомный ролл, не свойство сета. Просто запиши что видишь.

5. **observed_sub_stats** — массив из блока «Доп. атрибуты» (обычно 4 строки). Каждый элемент — {name, value}.

6. **bonus_2pc_ru** — текст после «Эпический (2):» в блоке «Улучшение картриджа».

7. **bonus_4pc_ru** — текст после «Легендарный (4):». Если на скрине обрезан — верни сколько видно.

8. **required_shapes_descriptions** — массив из 4 строк. В блоке «Улучшение картриджа» 5 иконок: первая (обычно крупнее) — иконка сета, дальше идут 4 маленькие иконки тетрис-фигур. Для каждой из 4 фигур опиши форму словами на русском, например: «горизонтальное домино (2 клетки в ряд)», «L-тромино (3 клетки уголком)», «I-тетромино вертикальное (4 клетки в столбик)», «квадрат 2×2», и т.д. Используй слова «домино», «тромино», «тетромино» + ориентация / форма. Порядок — слева направо.

Если какое-то поле не видно — верни пустую строку для текстов или null. Не выдумывай.`;

export const SET_CARD_SCHEMA: GeminiSchema = {
  type: "object",
  properties: {
    set_name_ru: { type: "string" },
    cartridge_level: { type: "integer" },
    damage_type_ru: { type: "string", nullable: true },
    observed_main_stat: {
      type: "object",
      properties: {
        name: { type: "string" },
        value: { type: "string" },
      },
      required: ["name", "value"],
    },
    observed_sub_stats: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          value: { type: "string" },
        },
        required: ["name", "value"],
      },
    },
    bonus_2pc_ru: { type: "string" },
    bonus_4pc_ru: { type: "string" },
    required_shapes_descriptions: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "set_name_ru",
    "cartridge_level",
    "damage_type_ru",
    "observed_main_stat",
    "observed_sub_stats",
    "bonus_2pc_ru",
    "bonus_4pc_ru",
    "required_shapes_descriptions",
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// Экран персонажа / списка персонажей
// ═══════════════════════════════════════════════════════════════════════════

export type ParsedCharacter = {
  name_ru: string;
  role: string | null;
  anima_type: string | null;
  description: string | null;
};

export const CHARACTER_PROMPT = `Ты обрабатываешь скрин из игры Neverness To Everness (NTE), русская локализация.
На картинке — карточка персонажа (или экран команды).

Если на картинке несколько персонажей — извлеки ОДНОГО, самого крупного / выделенного / в центре. Если непонятно кто главный — верни первого в верхнем левом углу.

Извлеки:

1. **name_ru** — имя персонажа на русском.

2. **role** — роль в команде, если видно (например «Атакующий», «Поддержка», «Танк», «Целитель»). Если не видно — null.

3. **anima_type** — тип урона/стихия персонажа, если видно (например «анима», «космос», «огонь», «вода»). Если не видно — null.

4. **description** — короткое описание из tooltip'а или подзаголовка, если есть. Иначе null.

Не выдумывай. Если поле не видно — null.`;

export const CHARACTER_SCHEMA: GeminiSchema = {
  type: "object",
  properties: {
    name_ru: { type: "string" },
    role: { type: "string", nullable: true },
    anima_type: { type: "string", nullable: true },
    description: { type: "string", nullable: true },
  },
  required: ["name_ru", "role", "anima_type", "description"],
};

// ═══════════════════════════════════════════════════════════════════════════
// Карточка Дуги (Arc) — оружие персонажа
// ═══════════════════════════════════════════════════════════════════════════

export type ParsedArc = {
  name_ru: string;
  arc_type: string | null; // Когнитивный | Инстинктивный | Сдерживающий | Соединительный | Эмотивный
  rarity: string | null; // S | A | B | ...
  observed_main_stat: { name: string; value: string };
  observed_sub_stats: Array<{ name: string; value: string }>;
  passive_text_ru: string | null;
};

export const ARC_PROMPT = `Ты обрабатываешь скрин из игры Neverness To Everness (NTE), русская локализация.
На картинке — детальная карточка Дуги (Arc), оружия персонажа.

Извлеки СТРОГО следующие поля:

1. **name_ru** — название Дуги на русском (заголовок карточки).

2. **arc_type** — тип Дуги, один из 5: «Когнитивный», «Инстинктивный», «Сдерживающий», «Соединительный», «Эмотивный». Указан где-то в карточке (иногда иконкой + подписью). Если не видно — null.

3. **rarity** — ранг/редкость Дуги: «S», «A», «B». Обычно отображается рядом с названием. Если не видно — null.

4. **observed_main_stat** — главный атрибут {name, value}. Например «Атака: 1500», «Бонус к урону: 30%».

5. **observed_sub_stats** — массив доп.атрибутов (обычно 4 строки). Каждый — {name, value}.

6. **passive_text_ru** — полный текст пассивки/уникального эффекта Дуги. Скопируй максимально близко к оригиналу. Если пассивки нет или не видна — null.

Не выдумывай. Если поле не видно — null или пустая строка для текстов.`;

export const ARC_SCHEMA: GeminiSchema = {
  type: "object",
  properties: {
    name_ru: { type: "string" },
    arc_type: { type: "string", nullable: true },
    rarity: { type: "string", nullable: true },
    observed_main_stat: {
      type: "object",
      properties: {
        name: { type: "string" },
        value: { type: "string" },
      },
      required: ["name", "value"],
    },
    observed_sub_stats: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          value: { type: "string" },
        },
        required: ["name", "value"],
      },
    },
    passive_text_ru: { type: "string", nullable: true },
  },
  required: [
    "name_ru",
    "arc_type",
    "rarity",
    "observed_main_stat",
    "observed_sub_stats",
    "passive_text_ru",
  ],
};

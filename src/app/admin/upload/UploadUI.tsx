"use client";

import { useState } from "react";
import {
  parseScreenshot,
  saveCharacter,
  saveSetCard,
  type ScreenType,
} from "./actions";
import type {
  ParsedCharacter,
  ParsedSetCard,
} from "@/lib/vision-prompts";

type Shape = {
  id: string;
  type_roman: string;
  cell_count: number;
  name_ru: string | null;
};

type ParsedState =
  | { kind: "set_card"; data: ParsedSetCard }
  | { kind: "character"; data: ParsedCharacter };

export function UploadUI({ shapes }: { shapes: Shape[] }) {
  const [type, setType] = useState<ScreenType>("set_card");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setError(null);
    setSaved(null);
    setParsed(null);
    if (!f) {
      setFile(null);
      setPreviewUrl(null);
      return;
    }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }

  async function onParse() {
    if (!file) return;
    setParsing(true);
    setError(null);
    setSaved(null);

    const fd = new FormData();
    fd.set("image", file);
    fd.set("type", type);

    const result = await parseScreenshot(fd);
    setParsing(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setParsed({ kind: result.data.type, data: result.data.data } as ParsedState);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* ── Левая колонка: тип + drop zone ───────────────────────────────── */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700">
            Тип скрина
          </label>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value as ScreenType);
              setParsed(null);
              setError(null);
            }}
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:ring-neutral-900"
          >
            <option value="set_card">Карточка сета (картриджа)</option>
            <option value="character">Карточка персонажа</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700">
            Файл (PNG / JPEG до 10 МБ)
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={onFileSelected}
            className="mt-1 block w-full text-sm text-neutral-700 file:mr-4 file:rounded-md file:border-0 file:bg-neutral-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-neutral-700"
          />
        </div>

        {previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="preview"
            className="max-h-96 w-full rounded-md border border-neutral-200 object-contain"
          />
        )}

        <button
          type="button"
          onClick={onParse}
          disabled={!file || parsing}
          className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {parsing ? "Распознаю через Gemini Vision..." : "Распознать"}
        </button>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {saved && (
          <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {saved}
          </div>
        )}
      </div>

      {/* ── Правая колонка: форма ревью ───────────────────────────────────── */}
      <div>
        {!parsed && (
          <div className="rounded-md border border-dashed border-neutral-300 px-4 py-12 text-center text-sm text-neutral-500">
            Здесь появится форма для ревью после распознавания.
          </div>
        )}
        {parsed?.kind === "set_card" && (
          <SetCardReviewForm
            initial={parsed.data}
            shapes={shapes}
            onSaved={(msg) => setSaved(msg)}
            onError={(msg) => setError(msg)}
          />
        )}
        {parsed?.kind === "character" && (
          <CharacterReviewForm
            initial={parsed.data}
            onSaved={(msg) => setSaved(msg)}
            onError={(msg) => setError(msg)}
          />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Форма ревью карточки сета
// ═══════════════════════════════════════════════════════════════════════════

function SetCardReviewForm({
  initial,
  shapes,
  onSaved,
  onError,
}: {
  initial: ParsedSetCard;
  shapes: Shape[];
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [setName, setSetName] = useState(initial.set_name_ru);
  const [damageType, setDamageType] = useState(initial.damage_type_ru ?? "");
  const [bonus2pc, setBonus2pc] = useState(initial.bonus_2pc_ru);
  const [bonus4pc, setBonus4pc] = useState(initial.bonus_4pc_ru);
  const [shape1, setShape1] = useState("");
  const [shape2, setShape2] = useState("");
  const [shape3, setShape3] = useState("");
  const [shape4, setShape4] = useState("");
  const [saving, setSaving] = useState(false);

  const descriptions = initial.required_shapes_descriptions;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!shape1 || !shape2 || !shape3 || !shape4) {
      onError("Выбери все 4 формы.");
      return;
    }
    if (!setName.trim()) {
      onError("Имя сета не может быть пустым.");
      return;
    }
    setSaving(true);
    const result = await saveSetCard({
      set_name_ru: setName.trim(),
      damage_type_ru: damageType.trim() || null,
      bonus_2pc_ru: bonus2pc.trim(),
      bonus_4pc_ru: bonus4pc.trim(),
      required_shape_ids: [shape1, shape2, shape3, shape4],
      observed_main_stat: initial.observed_main_stat,
      observed_sub_stats: initial.observed_sub_stats,
    });
    setSaving(false);
    if (result.ok) {
      onSaved(`Сет «${setName}» сохранён (id ${result.setId.slice(0, 8)}...).`);
    } else {
      onError(result.error);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-md border border-neutral-200 bg-white p-4">
      <h2 className="text-lg font-semibold">Ревью карточки сета</h2>

      <Field label="Имя сета (RU)">
        <input
          type="text"
          value={setName}
          onChange={(e) => setSetName(e.target.value)}
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </Field>

      <Field label="Тип урона (из 2pc-бонуса; пусто если бонус не про тип)">
        <input
          type="text"
          value={damageType}
          onChange={(e) => setDamageType(e.target.value)}
          placeholder="например анима, космос, огонь..."
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </Field>

      <Field label="Эпический (2):">
        <input
          type="text"
          value={bonus2pc}
          onChange={(e) => setBonus2pc(e.target.value)}
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </Field>

      <Field label="Легендарный (4):">
        <textarea
          value={bonus4pc}
          onChange={(e) => setBonus4pc(e.target.value)}
          rows={3}
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </Field>

      <div>
        <h3 className="text-sm font-medium text-neutral-700">
          4 формы модулей (для 4pc-бонуса)
        </h3>
        <p className="mt-1 text-xs text-neutral-500">
          Vision дал словесное описание — выбери совпадающую форму из каталога.
        </p>
        <div className="mt-2 space-y-2">
          {[shape1, shape2, shape3, shape4].map((value, idx) => (
            <ShapeSelector
              key={idx}
              position={idx + 1}
              description={descriptions[idx] ?? "(описание не получено)"}
              value={value}
              onChange={(v) => {
                if (idx === 0) setShape1(v);
                if (idx === 1) setShape2(v);
                if (idx === 2) setShape3(v);
                if (idx === 3) setShape4(v);
              }}
              shapes={shapes}
            />
          ))}
        </div>
      </div>

      <div className="rounded-md bg-neutral-50 p-3 text-xs text-neutral-600">
        <div className="font-medium text-neutral-700">
          Наблюдаемые статы (записываются как пример, не в схему сета):
        </div>
        <div className="mt-1">
          Главный: {initial.observed_main_stat.name} = {initial.observed_main_stat.value}
        </div>
        <div className="mt-1">
          Доп: {initial.observed_sub_stats.map((s) => `${s.name} ${s.value}`).join(", ")}
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
      >
        {saving ? "Сохраняю..." : "Сохранить"}
      </button>
    </form>
  );
}

function ShapeSelector({
  position,
  description,
  value,
  onChange,
  shapes,
}: {
  position: number;
  description: string;
  value: string;
  onChange: (v: string) => void;
  shapes: Shape[];
}) {
  return (
    <div className="rounded-md border border-neutral-200 p-2">
      <div className="text-xs text-neutral-500">
        Позиция {position}: <span className="text-neutral-700">{description}</span>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
      >
        <option value="">— выбрать форму —</option>
        {shapes.map((s) => (
          <option key={s.id} value={s.id}>
            тип {s.type_roman} ({s.cell_count} кл.) — {s.name_ru ?? s.id}
          </option>
        ))}
      </select>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Форма ревью персонажа
// ═══════════════════════════════════════════════════════════════════════════

function CharacterReviewForm({
  initial,
  onSaved,
  onError,
}: {
  initial: ParsedCharacter;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState(initial.name_ru);
  const [role, setRole] = useState(initial.role ?? "");
  const [animaType, setAnimaType] = useState(initial.anima_type ?? "");
  const [notes, setNotes] = useState(initial.description ?? "");
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      onError("Имя персонажа не может быть пустым.");
      return;
    }
    setSaving(true);
    const result = await saveCharacter({
      name_ru: name.trim(),
      role: role.trim() || null,
      anima_type: animaType.trim() || null,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (result.ok) {
      onSaved(`Персонаж «${name}» сохранён.`);
    } else {
      onError(result.error);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-md border border-neutral-200 bg-white p-4">
      <h2 className="text-lg font-semibold">Ревью персонажа</h2>

      <Field label="Имя (RU)">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </Field>

      <Field label="Роль">
        <input
          type="text"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="Атакующий / Поддержка / Танк / ..."
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </Field>

      <Field label="Тип урона / стихия">
        <input
          type="text"
          value={animaType}
          onChange={(e) => setAnimaType(e.target.value)}
          placeholder="анима / космос / ..."
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </Field>

      <Field label="Заметки">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </Field>

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
      >
        {saving ? "Сохраняю..." : "Сохранить"}
      </button>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-medium text-neutral-700">
      {label}
      {children}
    </label>
  );
}

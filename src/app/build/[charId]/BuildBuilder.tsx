"use client";

import { useState } from "react";

export type SetRow = {
  id: string;
  name_ru: string;
  damage_type_ru: string | null;
  bonus_2pc_ru: string | null;
  bonus_4pc_ru: string | null;
};

export type SetRequiredShape = {
  set_id: string;
  position: number;
  shape_id: string;
};

export type Shape = {
  id: string;
  type_roman: string;
  cell_count: number;
  name_ru: string | null;
  pattern: number[][];
};

export function BuildBuilder({
  character,
  sets,
  requiredShapes,
  shapes,
}: {
  character: {
    id: string;
    name_ru: string;
    arc_type: string | null;
  };
  sets: SetRow[];
  requiredShapes: SetRequiredShape[];
  shapes: Shape[];
}) {
  const [selectedSetId, setSelectedSetId] = useState<string>("");
  const selectedSet = sets.find((s) => s.id === selectedSetId);
  const setShapes = requiredShapes
    .filter((rs) => rs.set_id === selectedSetId)
    .sort((a, b) => a.position - b.position);

  const shapeById = new Map(shapes.map((s) => [s.id, s]));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      {/* ── Левая колонка: сборка ────────────────────────────────────────── */}
      <div className="space-y-6">
        <section className="rounded-md border border-neutral-200 bg-white p-5">
          <h2 className="text-base font-semibold">Картридж (сет)</h2>
          <select
            value={selectedSetId}
            onChange={(e) => setSelectedSetId(e.target.value)}
            className="mt-3 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:ring-neutral-900"
          >
            <option value="">— выбери сет —</option>
            {sets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name_ru}
                {s.damage_type_ru ? ` · ${s.damage_type_ru}` : ""}
              </option>
            ))}
          </select>

          {selectedSet && (
            <div className="mt-4 space-y-2 rounded-md bg-neutral-50 p-3 text-sm">
              {selectedSet.bonus_2pc_ru && (
                <div>
                  <span className="font-medium text-neutral-700">Эпический (2):</span>{" "}
                  <span className="text-neutral-800">{selectedSet.bonus_2pc_ru}</span>
                </div>
              )}
              {selectedSet.bonus_4pc_ru && (
                <div>
                  <span className="font-medium text-neutral-700">Легендарный (4):</span>{" "}
                  <span className="text-neutral-800">{selectedSet.bonus_4pc_ru}</span>
                </div>
              )}
            </div>
          )}
        </section>

        {selectedSet && setShapes.length === 4 && (
          <section className="rounded-md border border-neutral-200 bg-white p-5">
            <h2 className="text-base font-semibold">
              4 сетовых модуля{" "}
              <span className="text-sm font-normal text-neutral-500">
                для активации 4-piece бонуса
              </span>
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              Эти 4 формы должны быть среди 8 модулей в твоём картридже. Позиция в тетрис-сетке не важна.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {setShapes.map((rs) => {
                const shape = shapeById.get(rs.shape_id);
                return (
                  <SlotCard
                    key={rs.position}
                    label={`Слот ${rs.position}`}
                    shape={shape}
                    accent="set"
                  />
                );
              })}
            </div>
          </section>
        )}

        {selectedSet && (
          <section className="rounded-md border border-neutral-200 bg-white p-5">
            <h2 className="text-base font-semibold">
              4 свободных модуля{" "}
              <span className="text-sm font-normal text-neutral-500">любая форма</span>
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              Заполни любыми модулями — главное чтобы все 8 уместились в тетрис-сетку картриджа.
              Бери максимальные статы под роль персонажа.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <SlotCard key={i} label={`Свободный ${i}`} shape={undefined} accent="free" />
              ))}
            </div>
          </section>
        )}

        {!selectedSet && (
          <div className="rounded-md border border-dashed border-neutral-300 px-6 py-12 text-center text-sm text-neutral-500">
            Выбери картридж — появятся 4 сетовых слота с конкретными формами.
          </div>
        )}
      </div>

      {/* ── Правая колонка: совет ИИ ─────────────────────────────────────── */}
      <aside className="space-y-4">
        <section className="rounded-md border border-neutral-200 bg-white p-5">
          <h2 className="text-base font-semibold">Совет ИИ</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Стрим-ответ от Gemini 2.5 Pro появится здесь. Он учтёт персонажа,
            выбранный сет и базу гайдов.
          </p>
          <button
            type="button"
            disabled
            className="mt-4 w-full rounded-md bg-neutral-300 px-4 py-2 text-sm font-medium text-white cursor-not-allowed"
            title="Появится в Этапе 3 (RAG + Gemini)"
          >
            Получить совет (Этап 3)
          </button>
          {character.arc_type && (
            <p className="mt-3 text-xs text-neutral-500">
              {character.name_ru} использует Дугу типа{" "}
              <span className="font-medium text-neutral-700">{character.arc_type}</span>.
              Слот для Дуги добавим в Этапе 2.5 (когда заведём каталог).
            </p>
          )}
        </section>
      </aside>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Карточка слота (отображает форму модуля)
// ═══════════════════════════════════════════════════════════════════════════

function SlotCard({
  label,
  shape,
  accent,
}: {
  label: string;
  shape: Shape | undefined;
  accent: "set" | "free";
}) {
  const accentClasses =
    accent === "set"
      ? "border-amber-300 bg-amber-50"
      : "border-neutral-200 bg-neutral-50";
  return (
    <div className={`rounded-md border p-3 ${accentClasses}`}>
      <div className="text-xs font-medium text-neutral-500">{label}</div>
      <div className="mt-2 flex h-16 items-center justify-center">
        {shape ? <ShapeGrid pattern={shape.pattern} /> : <FreeSlotPlaceholder />}
      </div>
      <div className="mt-2 text-center text-[11px] text-neutral-700">
        {shape
          ? `тип ${shape.type_roman} · ${shape.name_ru ?? shape.id}`
          : "любая форма"}
      </div>
    </div>
  );
}

function ShapeGrid({ pattern }: { pattern: number[][] }) {
  if (!pattern || pattern.length === 0) return null;
  const maxRow = Math.max(...pattern.map(([r]) => r)) + 1;
  const maxCol = Math.max(...pattern.map(([, c]) => c)) + 1;
  const filled = new Set(pattern.map(([r, c]) => `${r}-${c}`));
  const cellSize = 12;

  return (
    <div
      className="inline-grid gap-[2px] rounded bg-neutral-300 p-[2px]"
      style={{
        gridTemplateColumns: `repeat(${maxCol}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${maxRow}, ${cellSize}px)`,
      }}
    >
      {Array.from({ length: maxRow }, (_, r) =>
        Array.from({ length: maxCol }, (_, c) => (
          <div
            key={`${r}-${c}`}
            className={
              filled.has(`${r}-${c}`)
                ? "rounded-[1px] bg-amber-500"
                : "bg-transparent"
            }
            style={{ width: cellSize, height: cellSize }}
          />
        )),
      )}
    </div>
  );
}

function FreeSlotPlaceholder() {
  return (
    <div className="text-3xl text-neutral-300">?</div>
  );
}

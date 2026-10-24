import React from "react";
import { ExpeditionLoot } from "../../models/expedition";
import { Toad } from "../../models/Toad";
import { Items, itemsFull } from "../../models/user";
import { CurrencyIcon } from "../shared/CurrencyIcon";
import { ToadAvatar } from "../shared/ToadAvatar";

interface LootTile {
  id: string;
  name: string;
  amount: number;
  icon: React.ReactNode;
  /** Цвет рамки и свечения карточки */
  tone: string;
  hint: string;
}

/** Рамка предмета по редкости: в сетке добычи сразу видно, что нашла команда */
const ITEM_RARITY_TONE: Record<string, string> = {
  common: "border-slate-400/40 ",
  uncommon: "border-emerald-400/50 ",
  rare: "border-sky-400/50",
  epic: "border-violet-400/50 ",
  legendary: "border-amber-300/60",
};

const formatAmount = (amount: number): string =>
  Number.isInteger(amount) ? `${amount}` : `${Math.round(amount * 10) / 10}`;

/**
 * Добыча похода в виде сетки карточек.
 *
 * Заменяет длинную текстовую строку «Добыча: …» на карточки с иконкой,
 * количеством и названием — итог похода видно с первого взгляда. Тон карточки
 * подсказывает тип находки: зелёный — биомасса, голубой — Кваксы, розовый —
 * образцы, фиолетовый — астро, а предметы окрашены по редкости.
 */
export const ExpeditionLootGrid: React.FC<{
  loot: ExpeditionLoot;
  /**
   * Пропуска КОНТУРа, начисленные за поход. Лежат отдельно от `loot`: попадают
   * на склад сразу при возврате команды и в биомассу не перерабатываются.
   * В старых сейвах поля нет — тогда карточки пропуска просто не будет.
   */
  contourPasses?: number;
  /**
   * Именная жаба из лутбокса, закреплённая за глубиной сектора. Нужна, чтобы
   * особый образец показывался своим спрайтом, а не общей иконкой 🧬.
   */
  sampleToad?: Partial<Toad>;
  /** Подпись над сеткой */
  title?: string;
  className?: string;
}> = ({
  loot,
  contourPasses,
  sampleToad,
  title = "Добыча похода",
  className = "",
}) => {
  const tiles: LootTile[] = [];

  if (loot.biomass > 0) {
    tiles.push({
      id: "biomass",
      name: "Биомасса",
      amount: loot.biomass,
      icon: <span className="text-xl leading-none">🧪</span>,
      tone: "border-emerald-400/50 ",
      hint: "Биомасса — топливо колонии и корм для жаб",
    });
  }

  if (loot.tokens > 0) {
    tiles.push({
      id: "tokens",
      name: "Кваксы",
      amount: loot.tokens,
      icon: <CurrencyIcon currency="tokens" className="h-6 w-6" />,
      tone: "border-cyan-400/50 ",
      hint: "Основная валюта колонии",
    });
  }

  if (loot.astro_quax > 0) {
    tiles.push({
      id: "astro",
      name: "Астро-кваксы",
      amount: loot.astro_quax,
      icon: <CurrencyIcon currency="astro_quax" className="h-6 w-6" />,
      tone: "border-fuchsia-400/50 ",
      hint: "Премиальная космическая валюта",
    });
  }

  if ((contourPasses ?? 0) > 0) {
    const pass = itemsFull[Items.contourPass];

    tiles.push({
      id: "contour-pass",
      name: pass.name,
      amount: contourPasses ?? 0,
      icon: (
        <img
          src={pass.icon}
          alt={pass.name}
          className="h-6 w-6 object-contain"
          draggable={false}
        />
      ),
      tone: ITEM_RARITY_TONE[pass.rarity] ?? "border-amber-400/40 ",
      hint: pass.description,
    });
  }

  if (loot.samples > 0) {
    tiles.push({
      id: "samples",
      name: "Образцы",
      amount: loot.samples,
      icon: <span className="text-xl leading-none">🧬</span>,
      tone: "border-pink-400/50 ",
      hint: "Живые образцы",
    });
  }

  if ((loot.lootboxSamples ?? 0) > 0) {
    tiles.push({
      id: "lootbox-samples",
      name: sampleToad?.name ?? "Особый образец",
      amount: loot.lootboxSamples ?? 0,
      icon: sampleToad ? (
        <ToadAvatar toad={sampleToad as Toad} size={6} />
      ) : (
        <span className="text-xl leading-none">🐸</span>
      ),
      tone: "border-amber-300/60",
      hint: "Жаба из лутбокса: при разборе добычи поселится в биопод",
    });
  }

  Object.entries(loot.items ?? {}).forEach(([key, amount]) => {
    if (!amount || amount <= 0) {
      return;
    }

    const item = itemsFull[key as Items];

    tiles.push({
      id: key,
      name: item?.name ?? key,
      amount,
      icon: item ? (
        <img
          src={item.icon}
          alt={item.name}
          className="h-6 w-6 object-contain"
          draggable={false}
        />
      ) : (
        <span className="text-xl leading-none">📦</span>
      ),
      tone: ITEM_RARITY_TONE[item?.rarity ?? ""] ?? "border-amber-400/40 ",
      hint: item?.description ?? "Предмет со склада колонии",
    });
  });

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-amber-300/35 bg-gradient-to-br from-amber-500/15 via-emerald-500/10 to-cyan-500/15 p-2.5 shadow-[0_0_18px_-18px_rgba(251,191,36,0.9)] ${className}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-amber-300/20 blur-2xl"
      />

      <div className="relative flex items-center justify-between gap-2">
        <span className="text-2xs font-bold uppercase tracking-[0.16em] text-amber-200">
          {title}
        </span>
        <span className="rounded-md border border-amber-300/30 bg-slate-950/60 px-1.5 py-0.5 text-3xs font-semibold text-amber-100/80">
          {tiles.length} поз.
        </span>
      </div>

      {tiles.length === 0 ? (
        <p className="relative mt-2 rounded-xl border border-dashed border-slate-500/40 bg-slate-950/40 px-2 py-3 text-center text-2xs italic text-slate-400">
          Добычи собрать не удалось
        </p>
      ) : (
        <div className="relative mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
          {tiles.map((tile) => (
            <div
              key={tile.id}
              title={tile.hint}
              className={`relative flex min-w-0 flex-col items-center gap-1 rounded-xl border bg-slate-950/65 px-1 py-1.5 text-center ${tile.tone}`}
            >
              <span className="absolute right-1 top-1 rounded bg-slate-950/80 px-1 text-3xs font-extrabold leading-tight tabular-nums text-white">
                ×{formatAmount(tile.amount)}
              </span>
              <span className="mt-1 flex h-7 w-7 items-center justify-center leading-none">
                {tile.icon}
              </span>
              <span className="w-full truncate text-3xs font-semibold text-slate-200">
                {tile.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExpeditionLootGrid;

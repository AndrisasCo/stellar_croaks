import {
  LOOTBOX_RARITY_CHANCES,
  LootboxRarity,
  UNIQUE_TOADS_BY_RARITY,
} from "../../../../models/Toad/lootbox";
import {
  HudPanel,
  HudTone,
  SectionTitle,
} from "../../../shared/DataGrid";
import { ToadAvatar } from "../../../shared/ToadAvatar";

/** Шанс тира для подписи: целые — без дробной части, редкие тиры — с одной цифрой */
const formatChance = (rarity: LootboxRarity): string => {
  const chance = LOOTBOX_RARITY_CHANCES[rarity];

  return `${Number.isInteger(chance) ? chance : chance.toFixed(1)}%`;
};

/** Тиры показываем от частых к редким: цвет остаётся тем же, что у редкости в игре. */
const RARITY_SECTIONS: {
  rarity: LootboxRarity;
  title: string;
  tone: HudTone;
  wide?: boolean;
}[] = [
  { rarity: LootboxRarity.common, title: "Обычные", tone: "emerald" },
  { rarity: LootboxRarity.uncommon, title: "Необычные", tone: "sky" },
  { rarity: LootboxRarity.rare, title: "Редкие", tone: "violet" },
  { rarity: LootboxRarity.epic, title: "Эпические", tone: "amber" },
  {
    rarity: LootboxRarity.legendary,
    title: "Легендарные",
    tone: "rose",
    wide: true,
  },
];

export const LootboxDetails: React.FC = () => {
  return (
    <div className="pb-4">
      {/* Карточка поставки: изображение и технический код вместо простого заголовка */}
      <div className="mb-3 flex items-center gap-3 border border-amber-400/25 bg-slate-950/50 p-3">
        <img
          src="assets/lootbox.webp"
          alt="Жаббокс"
          className="h-24 w-24 shrink-0 object-contain"
        />
        <div className="min-w-0">
          <div className="ui-kicker">SUPPLY DROP</div>
          <h2 className="brand-text mt-0.5 text-2xl font-bold">Жаббокс</h2>
          <p className="mt-1 text-2xs leading-snug text-slate-400">
            Контейнер с уникальными жабами. Редкость фиксируется в момент
            открытия.
          </p>
        </div>
      </div>

      <p className="mb-3 text-sm text-slate-200">
        В лутбоксе можно получить уникальных жаб разной редкости.
      </p>

      <HudPanel tone="amber" className="mb-3 px-3 py-2">
        <p className="flex items-start gap-2 text-2xs leading-snug text-amber-200">
          <span
            aria-hidden="true"
            className="mt-1.5 h-1 w-1 shrink-0 bg-amber-300"
          />
          <span>
            Базовые шансы указаны без гарантий: счётчик неудач даёт редкую жабу
            не позже 10-го открытия, а эпическую — не позже 50-го.
          </span>
        </p>
      </HudPanel>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {RARITY_SECTIONS.map((section) => (
          <HudPanel
            key={section.rarity}
            tone={section.tone}
            className={`p-2.5 ${section.wide ? "md:col-span-2" : ""}`}
          >
            <SectionTitle aside={formatChance(section.rarity)}>
              {section.title}
            </SectionTitle>
            <div className="flex flex-wrap gap-2">
              {UNIQUE_TOADS_BY_RARITY[section.rarity].map((toad, idx) => (
                <ToadAvatar
                  key={`${toad.name}-${idx}`}
                  size={15}
                  toad={toad}
                />
              ))}
            </div>
          </HudPanel>
        ))}
      </div>
    </div>
  );
};

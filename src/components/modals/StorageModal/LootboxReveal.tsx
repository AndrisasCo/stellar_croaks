import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { InfoIcons } from "../../../assets/icons";
import {
  getPersonalityLabel,
  getRarityConfig,
  getToadTypeLabel,
  Toad,
} from "../../../models/Toad";
import { LootboxRarity } from "../../../models/Toad/lootbox";
import { Scene } from "../../../models/scene";
import { getDissolveYield } from "../../../utils/dissolve-manager";
import { getSceneFreeSlots } from "../../../utils/housing";
import { ToadAvatar } from "../../shared/ToadAvatar";
import { ToadGender } from "../../shared/ToadGender";
import { StatCard } from "../ToadInfoModal/StatCard";
import { ConfettiAnimation } from "./animations";

/**
 * Итог открытия лутбокса: маленькое окно поверх «Склада» с новой жабой.
 *
 * Жаба ещё не создана в колонии. Игрок выбирает биопод (по умолчанию — первый
 * свободный) и либо селит её, либо распыляет на биомассу, если диссоциатор готов.
 * Окно нельзя закрыть мимо кнопок: иначе лутбокс был бы уже потрачен, а жаба —
 * потеряна. Escape тоже блокируется, чтобы не закрыть родительскую модалку.
 */
interface LootboxRevealProps {
  toad: Toad;
  rarity: LootboxRarity;
  /** Биоподы со свободными местами; первый уже выбран по умолчанию */
  scenes: Scene[];
  defaultSceneId: number;
  /** Диссоциатор построен и под током */
  dissociatorReady: boolean;
  onPlace: (sceneId: number) => void;
  onDissolve: () => void;
}

/** Внешний вид награды по тиру лутбокса */
const RARITY_STYLES: Record<
  LootboxRarity,
  {
    label: string;
    icon: string;
    chip: string;
    frame: string;
    confetti: number;
  }
> = {
  [LootboxRarity.common]: {
    label: "Обычная",
    icon: "🎁",
    chip: "border-slate-500/40 bg-slate-800/80 text-slate-200",
    frame: "border-slate-500/40 from-slate-700/40 to-slate-800/20",
    confetti: 1,
  },
  [LootboxRarity.uncommon]: {
    label: "Необычная",
    icon: "🦋",
    chip: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
    frame: "border-emerald-400/40 from-emerald-500/20 to-cyan-500/10",
    confetti: 1.2,
  },
  [LootboxRarity.rare]: {
    label: "Редкая",
    icon: "✨",
    chip: "border-cyan-400/40 bg-cyan-500/10 text-cyan-200",
    frame: "border-cyan-400/40 from-cyan-500/20 to-blue-500/10",
    confetti: 1.5,
  },
  [LootboxRarity.epic]: {
    label: "Эпическая",
    icon: "☄️",
    chip: "border-purple-400/40 bg-purple-500/10 text-purple-200",
    frame: "border-purple-400/40 from-purple-500/20 to-fuchsia-500/10",
    confetti: 2,
  },
  [LootboxRarity.legendary]: {
    label: "Легендарная",
    icon: "🐲",
    chip: "border-amber-400/40 bg-amber-500/10 text-amber-200",
    frame: "border-amber-400/40 from-amber-500/20 to-orange-500/10",
    confetti: 3,
  },
};

export const LootboxReveal = ({
  toad,
  rarity,
  scenes,
  defaultSceneId,
  dissociatorReady,
  onPlace,
  onDissolve,
}: LootboxRevealProps) => {
  const [selectedSceneId, setSelectedSceneId] = useState(defaultSceneId);
  const rarityStyle = RARITY_STYLES[rarity];
  const rarityConfig = getRarityConfig(toad.genes.rarity);
  const dissolveYield = getDissolveYield(toad);

  /**
   * Список биоподов мог обновиться, пока окно открыто. Если выбранного больше нет,
   * берём первый свободный, чтобы кнопка не отправила жабу в занятый биопод.
   */
  const activeSceneId = scenes.some((scene) => scene.id === selectedSceneId)
    ? selectedSceneId
    : scenes[0]?.id;
  const activeScene = scenes.find((scene) => scene.id === activeSceneId);

  // Лутбокс уже потрачен: окно закрывается только выбором места или разбором
  useEffect(() => {
    const blockEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener("keydown", blockEscape, true);
    return () => document.removeEventListener("keydown", blockEscape, true);
  }, []);

  return createPortal(
    <>
      <ConfettiAnimation
        trigger={1}
        intensity={rarityStyle.confetti}
        layerClassName="z-[130]"
      />

      <div
        className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lootbox-reveal-title"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ui-panel-raised max-h-[92vh] w-full max-w-sm overflow-y-auto p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <div className="ui-kicker">Лутбокс открыт</div>
              <h2
                id="lootbox-reveal-title"
                className="text-lg font-bold text-white"
              >
                Новая жаба!
              </h2>
            </div>
            <span className={`ui-chip shrink-0 ${rarityStyle.chip}`}>
              {rarityStyle.icon} {rarityStyle.label}
            </span>
          </div>

          <div
            className={`mx-auto mb-3 w-fit rounded-2xl border bg-gradient-to-br p-2 ${rarityStyle.frame}`}
          >
            <ToadAvatar toad={toad} size={24} />
          </div>

          <div className="mb-1 text-center">
            <div className="text-base font-bold text-white">
              {toad.name || "Безымянная жаба"}
            </div>
            <div className="mt-0.5 flex items-center justify-center gap-1.5 text-2xs text-slate-300">
              <span className="inline-flex items-center">
                <ToadGender gender={toad.sex} />
              </span>
              <span>{getToadTypeLabel(toad.type)}</span>
              <span className="text-slate-500">·</span>
              <span>поколение {toad.generation}</span>
            </div>
          </div>

          <div className="mb-3 flex justify-center">
            <span className="ui-chip text-slate-300">
              🧠 {getPersonalityLabel(toad.genes.personality)}
            </span>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2">
            <StatCard
              icon={InfoIcons.rarity}
              label="Качество"
              value={`${rarityConfig.label} (${toad.genes.rarity.toFixed(1)})`}
              colorClass={rarityConfig.color}
            />
            <StatCard
              icon={<span>💞</span>}
              label="Плодовитость"
              value={`${toad.genes.fertility.toFixed(1)}x`}
              colorClass={
                toad.genes.fertility > 1 ? "text-green-400" : "text-red-400"
              }
            />
            <StatCard
              icon={<span>🍽️</span>}
              label="Аппетит"
              value={`${toad.genes.hungerRate.toFixed(1)}x`}
              colorClass={
                toad.genes.hungerRate < 1 ? "text-green-400" : "text-red-400"
              }
            />
            <StatCard
              icon={InfoIcons.weight}
              label="Вес"
              value={toad.genes.weight.toFixed(2)}
              colorClass="text-blue-400"
            />
            <StatCard
              icon={InfoIcons.speed}
              label="Скорость"
              value={toad.genes.speed.toFixed(2)}
              colorClass="text-blue-400"
            />
            <StatCard
              icon={<span>🧪</span>}
              label="В биомассу"
              value={`+${dissolveYield}`}
              colorClass="text-amber-300"
            />
          </div>

          <div className="mb-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="ui-kicker">Куда поселить</span>
              <span className="text-2xs text-slate-400">
                {activeScene
                  ? `Свободно: ${getSceneFreeSlots(activeScene)}`
                  : "Нет свободных мест"}
              </span>
            </div>
            <select
              value={activeSceneId ?? ""}
              onChange={(event) =>
                setSelectedSceneId(Number(event.target.value))
              }
              disabled={scenes.length === 0}
              className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-200 focus:border-cyan-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Биопод для новой жабы"
            >
              {scenes.map((scene) => (
                <option key={scene.id} value={scene.id}>
                  {scene.name || `Биопод #${scene.id}`} · свободно{" "}
                  {getSceneFreeSlots(scene)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              className="ui-button-primary w-full py-3 text-base"
              disabled={activeSceneId === undefined}
              onClick={() =>
                activeSceneId !== undefined && onPlace(activeSceneId)
              }
            >
              Поместить в биопод
            </button>

            <button
              type="button"
              className="ui-button-danger w-full py-3"
              disabled={!dissociatorReady}
              onClick={onDissolve}
              title={
                dissociatorReady
                  ? "Разобрать жабу на биомассу"
                  : "Нужен построенный и запитанный диссоциатор"
              }
            >
              ♻️ Распылить на биомассу
              <span className="rounded-md bg-black/25 px-1.5 py-0.5 text-2xs">
                +{dissolveYield} 🧪
              </span>
            </button>

            {!dissociatorReady && (
              <p className="ui-hint text-center">
                Диссоциатор не построен или обесточен — распыление недоступно.
              </p>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
};

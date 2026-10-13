import { RoomUpgrades } from "../models/colony";
import { AUTO_FEED_HUNGER } from "./auto-feeder";

/**
 * Каталог апгрейдов комнаты: их ставит модалка улучшения (ядро карты → «Улучшение комнаты»).
 *
 * Апгрейд в игре один — автокормушка: она не удешевляет корм, а избавляет от ручного
 * кормления (жабы комнаты едят со склада сами, см. `utils/auto-feeder.ts`). Прежние
 * улучшения вольера — вместимость (+10 за Кваксы), ускоренный рост, ускоренная беременность
 * и «умное распределение корма» — легаси и удалены: каталог остался единственным местом,
 * где видно, что игрок вообще может улучшить в комнате.
 */
export interface RoomUpgradeOption {
  /** Название апгрейда для карточки. */
  title: string;
  icon: string;
  description: string;
  /** Цена в Кваксах 🔷 — как у остальных покупок на карте колонии. */
  cost: number;
  /** Что покупка записывает комнате (`ColonyState.upgrades`). */
  upgrade: RoomUpgrades;
}

export const ROOM_UPGRADES: RoomUpgradeOption[] = [
  {
    title: "Автокормушка",
    icon: "🍎",
    description: `Пока на складе есть корм, кормушка кормит жаб комнаты сама — как только голод падает до ${AUTO_FEED_HUNGER} % (на этом же голоде жаба переходит на голодный минимум выработки). Корм уходит со склада: один корм на жабу.`,
    cost: 1000,
    upgrade: { autoFeeder: true },
  },
];

/** Стоит ли у комнаты этот апгрейд: все поля покупки уже выставлены. */
export const hasUpgrade = (
  upgrades: RoomUpgrades,
  upgrade: RoomUpgrades,
): boolean =>
  (Object.keys(upgrade) as (keyof RoomUpgrades)[]).every((key) =>
    Boolean(upgrades[key]),
  );

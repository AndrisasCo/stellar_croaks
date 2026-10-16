import { RoomUpgrades } from "../models/colony";
import { AUTO_FEED_HUNGER } from "./auto-feeder";

/**
 * Каталог апгрейдов сектора: их ставит модалка улучшения (ядро карты → «Улучшение сектора»).
 *
 * Апгрейд в игре один — автокормушка: она не удешевляет корм, а избавляет от ручного
 * кормления (жабы сектора едят со склада сами, см. `utils/auto-feeder.ts`). Прежние
 * улучшения биопода — вместимость (+10 за Кваксы), ускоренный рост, ускоренная беременность
 * и «умное распределение корма» — легаси и удалены: каталог остался единственным местом,
 * где видно, что игрок вообще может улучшить в секторе.
 */
export interface RoomUpgradeOption {
  /** Название апгрейда для карточки. */
  title: string;
  icon: string;
  description: string;
  /** Цена в Кваксах 🔷 — как у остальных покупок на карте колонии. */
  cost: number;
  /** Что покупка записывает секторе (`ColonyState.upgrades`). */
  upgrade: RoomUpgrades;
}

export const ROOM_UPGRADES: RoomUpgradeOption[] = [
  {
    title: "Автокормушка",
    icon: "🍎",
    description: `Пока на складе есть корм, кормушка распределяет корм на жаб сектора автоматически: как только голод падает до ${AUTO_FEED_HUNGER} %.`,
    cost: 100,
    upgrade: { autoFeeder: true },
  },
];

/** Стоит ли у сектора этот апгрейд: все поля покупки уже выставлены. */
export const hasUpgrade = (
  upgrades: RoomUpgrades,
  upgrade: RoomUpgrades,
): boolean =>
  (Object.keys(upgrade) as (keyof RoomUpgrades)[]).every((key) =>
    Boolean(upgrades[key]),
  );

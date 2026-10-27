import {
  ColonyRoomKind,
  RoomUpgradeKey,
  RoomUpgrades,
} from "../models/colony";
import { PRODUCTION_MIN_HUNGER } from "./gamification-config";

/**
 * Каталог апгрейдов сектора: их ставит вкладка «О секторе» любой модалки сектора
 * (`modals/RoomDataTab.tsx`).
 *
 * Апгрейды избавляют от ручной работы, а не удешевляют её:
 *  - автокормушка кормит жаб сектора со склада (`utils/auto-feeder.ts`);
 *  - репатриатор в Медотсеке отправляет выздоровевших жаб домой (`utils/repatriator.ts`);
 *  - карантин-уловитель забирает заболевших жаб на свободные койки
 *    (`utils/quarantine-catcher.ts`).
 *
 * Прежние улучшения биопода — вместимость (+10 за Кваксы), ускоренный рост, ускоренная
 * беременность и «умное распределение корма» — легаси и удалены: каталог остался единственным
 * местом, где видно, что игрок вообще может улучшить в секторе.
 *
 * У каждого апгрейда есть переключатель: после покупки он включён, но игрок может выключить
 * его, не теряя покупку. В сейве это два поля — `<ключ>` (куплен) и `<ключ>Enabled`
 * (работает), см. `models/colony.ts` → `RoomUpgrades`.
 */
export interface RoomUpgradeOption {
  /** Ключ апгрейда в `RoomUpgrades`: по нему же лежит покупка. */
  key: RoomUpgradeKey;
  /** Название апгрейда для карточки. */
  title: string;
  icon: string;
  description: string;
  /** Цена в Кваксах 🔷 — как у остальных покупок на карте колонии. */
  cost: number;
  /** Виды секторов, где апгрейд показывается и может быть куплен. */
  roomKinds: ColonyRoomKind[];
  /** Что покупка записывает секторе (`ColonyState.upgrades`). */
  upgrade: RoomUpgrades;
}

/** Поле-выключатель каждого апгрейда: выключенная покупка остаётся в сейве. */
export const ROOM_UPGRADE_ENABLED_KEYS: Record<
  RoomUpgradeKey,
  keyof RoomUpgrades
> = {
  autoFeeder: "autoFeederEnabled",
  repatriator: "repatriatorEnabled",
  quarantineCatcher: "quarantineCatcherEnabled",
};

export const ROOM_UPGRADES: RoomUpgradeOption[] = [
  {
    key: "autoFeeder",
    title: "Автокормушка",
    icon: "🍎",
    description: `Пока на складе есть корм, кормушка распределяет корм на жаб сектора автоматически: как только голод падает до ${PRODUCTION_MIN_HUNGER} %.`,
    cost: 100,
    roomKinds: ["aviary", "breeding", "power", "scout", "hospital"],
    upgrade: { autoFeeder: true },
  },
  {
    key: "repatriator",
    title: "Репатриатор",
    icon: "🛬",
    description:
      "Медотсек сам отправляет выздоровевших жаб домой: без болезней и с полным HP они больше не занимают койку, а койка достаётся следующему пациенту.",
    cost: 150,
    roomKinds: ["hospital"],
    upgrade: { repatriator: true },
  },
  {
    key: "quarantineCatcher",
    title: "Карантин-уловитель",
    icon: "🪤",
    description:
      "Медотсек сам забирает заболевших жаб колонии на свободные койки. HP не важен: уловитель реагирует только на болезнь и не трогает раненых без болезни.",
    cost: 200,
    roomKinds: ["hospital"],
    upgrade: { quarantineCatcher: true },
  },
];

/** Апгрейды, доступные сектору этого вида (пустой список — улучшать нечего). */
export const getRoomUpgradeOptions = (
  kind: string | null | undefined,
): RoomUpgradeOption[] =>
  kind == null
    ? []
    : ROOM_UPGRADES.filter((option) =>
        option.roomKinds.some((roomKind) => roomKind === kind),
      );

/** Куплен ли у сектора этот апгрейд: покупка не зависит от выключателя. */
export const hasUpgrade = (
  upgrades: RoomUpgrades,
  key: RoomUpgradeKey,
): boolean => Boolean(upgrades[key]);

/**
 * Работает ли апгрейд прямо сейчас.
 *
 * Старые сейвы поля `Enabled` не знают — для них купленный апгрейд включён. Выключенным
 * он считается только при явном `false`.
 */
export const isUpgradeActive = (
  upgrades: RoomUpgrades,
  key: RoomUpgradeKey,
): boolean =>
  hasUpgrade(upgrades, key) &&
  upgrades[ROOM_UPGRADE_ENABLED_KEYS[key]] !== false;

/** Что записать секторе при покупке: сам апгрейд сразу включён. */
export const getUpgradePurchasePatch = (
  option: RoomUpgradeOption,
): RoomUpgrades => ({
  ...option.upgrade,
  ...getUpgradeTogglePatch(option.key, true),
});

/** Что записать секторе при переключении купленного апгрейда. */
export const getUpgradeTogglePatch = (
  key: RoomUpgradeKey,
  enabled: boolean,
): RoomUpgrades =>
  ({ [ROOM_UPGRADE_ENABLED_KEYS[key]]: enabled }) as RoomUpgrades;

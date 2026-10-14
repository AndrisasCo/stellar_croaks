export interface Scene {
  created_at: string;
  description: string | null;
  gradient: number | null;
  id: number;
  name: string | null;
  price: number | null;
  texture: string | null;
  /**
   * @deprecated Легаси-бонусы биопода. Апгрейды сектора живут в `ColonyState.upgrades`
   * (`utils/room-upgrades.ts`), а автокормушку, купленную биоподу в старой версии игры,
   * дочитывает `getRoomUpgrades` (`backend/colony.ts`) — поле не пишется и однажды уйдёт.
   */
  bonuses?: { autoFeeder?: number };
  capacity: number;
  /** Число родильных слотов купола (постройка «Репродуктор»), по умолчанию NEST_BASE_SLOTS */
  nestSlots?: number;
}

export const INITIAL_CAPACITY = 12;

export const DEFAULT_SCENE: Scene = {
  id: 1,
  name: "Био Под",
  gradient: 0,
  price: 0,
  description: "",
  created_at: new Date().toISOString(),
  texture: null,
  capacity: INITIAL_CAPACITY,
};

export const GRADIENTS = [
  [
    { offset: 0, color: 0x047857 }, // emerald-900
    { offset: 0.4, color: 0x065f46 },
    { offset: 0.7, color: 0x065f46 },
    { offset: 1, color: 0x064e3b },
  ],
  [
    { offset: 0, color: 0x1a3a2a }, // Темный сосново-зеленый
    { offset: 0.3, color: 0x2d5540 }, // Глубокий лесной зеленый
    { offset: 0.6, color: 0x3a7054 }, // Средний сосновый
    { offset: 1, color: 0x4d8b68 }, // Светлый хвойный
  ],
];

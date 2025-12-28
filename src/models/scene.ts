import { getGameState } from "../backend/localStorage";

export interface Scene {
  created_at: string;
  description: string | null;
  gradient: number | null;
  id: number;
  name: string | null;
  price: number | null;
  texture: string | null;
  bonuses?: Record<BonusType, number>;
  capacity: number;
}

export const INITIAL_CAPACITY = 20;
export const MAX_CAPACITY = 50;

export const DEFAULT_SCENE: Scene = {
  id: 1,
  name: "Жабье болото",
  gradient: 0,
  price: 0,
  description: "Первое болото для ваших жаб",
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

export enum BonusType {
  grow = "grow",
  pregnancy = "pregnancy",
  autoFeeder = "autoFeeder",
}

// Бонусы вольера
export const bonuses = [
  {
    type: BonusType.grow,
    name: "Ускоренный рост",
    levels: [
      { level: 1, bonus: 5, cost: 30 },
      { level: 2, bonus: 10, cost: 70 },
      { level: 3, bonus: 20, cost: 150 },
    ],
  },
  {
    type: BonusType.pregnancy,
    name: "Ускоренная беременность",
    levels: [
      { level: 1, bonus: 5, cost: 50 },
      { level: 2, bonus: 10, cost: 100 },
      { level: 3, bonus: 20, cost: 200 },
    ],
  },
];

const bonusMap = {
  [BonusType.pregnancy]: [5, 10, 20],
  [BonusType.grow]: [5, 10, 20],
};

export const getBoostByScene = (
  scene_id: number | null,
  bonusType: BonusType
) => {
  if (!scene_id) {
    return 1;
  }
  const currentScene = getGameState().scenes.find((s) => s.id === scene_id);

  if (!currentScene || !currentScene.bonuses?.[bonusType]) {
    return 1;
  }

  const boost = currentScene.bonuses[bonusType];

  return bonusMap[bonusType][boost - 1] / 100 + 1;
};

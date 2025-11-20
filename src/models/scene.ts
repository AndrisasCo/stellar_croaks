export interface Scene {
  created_at: string;
  description: string | null;
  gradient: number | null;
  id: number;
  is_owned: boolean | null;
  name: string | null;
  price: number | null;
  texture: string | null;
  type: string | null;
  capacity: number;
}

export const DEFAULT_SCENE: Scene = {
  id: 1,
  name: "Жабье болото",
  gradient: 0,
  price: 0,
  is_owned: true,
  description: "Первое болото для ваших жаб",
  created_at: new Date().toISOString(),
  texture: null,
  type: null,
  capacity: 50,
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

// export const SCENES: Scene[] = [
//   {
//     id: 0,
//     name: "Жабье болото",
//     type: "",
//     description: "",
//     isActive: true,
//     colorGradient: [
//       { offset: 0, color: 0x047857 }, // emerald-900
//       { offset: 0.4, color: 0x065f46 },
//       { offset: 0.7, color: 0x065f46 },
//       { offset: 1, color: 0x064e3b },
//     ],
//     texture: null,
//     toadsId: ["1", "2", "3", "4", "5"],
//     price: 0,
//     isOwned: true,
//   },
//   {
//     id: 1,
//     name: "Сосновый лес",
//     type: "",
//     description: "",
//     isActive: false,
//     colorGradient: [
//       { offset: 0, color: 0x1a3a2a }, // Темный сосново-зеленый
//       { offset: 0.3, color: 0x2d5540 }, // Глубокий лесной зеленый
//       { offset: 0.6, color: 0x3a7054 }, // Средний сосновый
//       { offset: 1, color: 0x4d8b68 }, // Светлый хвойный
//     ],
//     texture: null,
//     toadsId: ["6", "7", "8", "9"],
//     price: 0,
//     isOwned: true,
//   },
// ];

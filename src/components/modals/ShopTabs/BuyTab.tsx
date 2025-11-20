import { createToad, updateUser } from "../../../backend";
import { getGameState } from "../../../backend/localStorage";
import { triggerNotification } from "../../../hooks/use-notification";
import { useSoundEffects } from "../../../hooks/use-sound-effects";
import {
  calculateSellPrice,
  getRarityConfig,
  Toad,
} from "../../../models/toad";
import { CURRENCY_CONFIG, TYPE_ICONS } from "../../../utils/constants";
import { useToads } from "../../ToadContext";

const BuyTab: React.FC = () => {
  const { currentScene, account } = useToads();
  const { playBuy } = useSoundEffects();
  const { tokens = 0, storage = { food: 0 } } = account || {};

  const FOOD_PRICE = 10;

  const handleBuyToad = async (toad: Toad) => {
    playBuy();

    const allToadsOnScene =
      getGameState().toads.filter(
        (t) => !t.is_off && t.scene_id === currentScene.id
      ).length + 1;

    if (currentScene.capacity < allToadsOnScene) {
      createToad({ ...toad, scene_id: null });
      triggerNotification(
        "Превышен лимит жаб на вольер, новая жаба была помещена на склад."
      );

      return;
    }

    createToad({ ...toad, scene_id: currentScene?.id });
    updateUser({ tokens: tokens - calculateBuyPrice(toad) });
  };

  const handleBuyItem = async () => {
    playBuy();
    updateUser({
      tokens: tokens - FOOD_PRICE,
      storage: { food: (storage?.food || 0) + 10 },
    });
  };

  const calculateBuyPrice = (toad: Toad) =>
    Math.ceil(calculateSellPrice(toad) * 2.5);

  const getDynamicToads = () => {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    const minutes = now.getMinutes();

    const commonToadsForSale: Partial<Toad>[] = [
      {
        name: "Зеленая жаба",
        type: "common",
        generation: 1,
        sex: minutes % 2 > 0 ? "male" : "female",
        stage: "adult",
        scene_id: null,
        state: {
          hunger: 30 + (hour % 20),
        },
        pregnancy: null,
        genes: {
          colors: ["#5D8C59", "#6B8C42"],
          pattern: "smooth",
          weight: 18 + (day % 6),
          speed: 0.4 + (hour % 3) * 0.1,
          rarity: 1.0 + (hour % 4) * 0.02,
          hungerRate: 1.0 + (day % 3) * 0.1,
          fertility: 1.0 + (hour % 4) * 0.1,
          personality: null,
        },
      },
      {
        name: "Коричневая жаба",
        type: "common",
        generation: 1,
        sex: hour % 2 ? "male" : "female",
        stage: "adult",
        scene_id: null,
        state: {
          hunger: 25 + (day % 15),
        },
        pregnancy: null,
        genes: {
          colors: ["#8B4513", "#A0522D"],
          pattern: "smooth",
          weight: 15 + (hour % 8),
          speed: 0.35 + (day % 4) * 0.05,
          rarity: 1.1 + (hour % 5) * 0.01,
          hungerRate: 0.9 + (hour % 3) * 0.1,
          fertility: 1.2 + (day % 3) * 0.1,
          personality: null,
        },
      },
      {
        name: "Пятнистая жаба",
        type: "common",
        generation: 1,
        sex: minutes % 8 > 3 ? "female" : "male",
        stage: "adult",
        scene_id: null,
        state: {
          hunger: 35 + (hour % 25),
        },
        pregnancy: null,
        genes: {
          colors: ["#5D8C59", "#4A4A4A"],
          pattern: "spotted",
          weight: 17 + (day % 5),
          speed: 0.45 + (hour % 4) * 0.05,
          rarity: 1.2 + (hour % 3) * 0.03,
          hungerRate: 1.1 + (day % 2) * 0.1,
          fertility: 1.3 + (hour % 3) * 0.1,
          personality: null,
        },
      },
      {
        name: "Лесная жаба",
        type: "common",
        generation: 1,
        sex: minutes % 5 ? "male" : "female",
        stage: "toadpole",
        scene_id: null,
        state: {
          hunger: 28 + (day % 18),
        },
        pregnancy: null,
        genes: {
          colors: ["#4A7C59", "#5D8C42"],
          pattern: "smooth",
          weight: 20 + (hour % 7),
          speed: 0.38 + (day % 3) * 0.06,
          rarity: 1.05 + (day % 5) * 0.02,
          hungerRate: 0.8 + (hour % 4) * 0.1,
          fertility: 1.1 + (day % 4) * 0.1,
          personality: null,
        },
      },
      {
        name: "Болотная жаба",
        type: "common",
        generation: 1,
        sex: minutes % 3 ? "male" : "female",
        stage: "toadpole",
        scene_id: null,
        state: {
          hunger: 32 + (hour % 22),
        },
        pregnancy: null,
        genes: {
          colors: ["#6B8C59", "#4A7C42"],
          pattern: "smooth",
          weight: 11 + (day % 6),
          speed: 0.42 + (hour % 5) * 0.04,
          rarity: 1.08 + (hour % 4) * 0.02,
          hungerRate: 1.2 + (day % 2) * 0.1,
          fertility: 0.9 + (hour % 5) * 0.1,
          personality: null,
        },
      },
    ];

    return commonToadsForSale;
  };

  const commonToadsForSale = getDynamicToads();

  return (
    <div className="space-y-4 pb-4">
      {/* Корм */}
      <div>
        <h3 className="text-white font-semibold mb-3 text-lg">Корм</h3>
        <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-full border-2 border-green-400 bg-gray-900">
                <span className="text-xl">🍎</span>
              </div>
              <div>
                <p className="text-white font-medium text-base">Жабий корм</p>
                <p className="text-gray-400 text-sm mt-1">х10 порций</p>
              </div>
            </div>
            <button
              onClick={handleBuyItem}
              disabled={tokens < FOOD_PRICE}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors min-w-[90px]  text-white ${
                tokens >= FOOD_PRICE
                  ? "bg-green-600 hover:bg-green-500 text-white"
                  : "bg-gray-600 text-gray-400 cursor-not-allowed"
              }`}
            >
              {FOOD_PRICE} {CURRENCY_CONFIG.tokens.icon}
            </button>
          </div>
        </div>
      </div>

      {/* Доступные жабы */}
      <div>
        <h3 className="text-white font-semibold mb-3 text-lg">
          Доступные жабы
        </h3>
        <div className="space-y-3">
          {commonToadsForSale.map((toad, index) => (
            <div
              key={index}
              className="bg-gray-800 rounded-2xl p-4 border border-gray-700"
            >
              <div className="flex flex-col gap-3">
                {/* Верхняя часть с аватаркой и кнопкой */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full border-2 border-green-400"
                      style={{ backgroundColor: toad.genes?.colors[0] }}
                    />
                    <div>
                      <p className="text-white font-medium text-base">
                        {toad.name}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
                        <span>
                          {TYPE_ICONS[toad.sex as keyof typeof TYPE_ICONS]}
                        </span>
                        <span>•</span>
                        <span>
                          {toad.stage === "adult" ? "Взрослый" : "Головастик"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleBuyToad(toad as Toad)}
                    disabled={tokens < calculateBuyPrice(toad as Toad)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors min-w-[90px] ${
                      tokens >= calculateBuyPrice(toad as Toad)
                        ? "bg-green-600 hover:bg-green-500 text-white"
                        : "bg-gray-600 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    {calculateBuyPrice(toad as Toad)}{" "}
                    {CURRENCY_CONFIG.tokens.icon}
                  </button>
                </div>

                {/* Характеристики */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="text-gray-400">
                    <span className="text-gray-500">Размер:</span>{" "}
                    {toad.genes?.weight.toFixed(1)}
                  </div>
                  <div className="text-gray-400">
                    <span className="text-gray-500">Скорость:</span>{" "}
                    {toad.genes?.speed.toFixed(1)}
                  </div>
                  <div className="text-green-400">
                    <span className="text-gray-500">Редкость:</span>{" "}
                    {toad.genes?.rarity.toFixed(1)}
                  </div>
                  <div className="text-gray-400">
                    <span className="text-gray-500">Сытость:</span>{" "}
                    {toad.state?.hunger}/100
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BuyTab;

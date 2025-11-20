import React from "react";
import { RARITY_CONFIG, RARITY_GROUPS_TRESHOLD, Toad } from "../../models/toad";
import { TYPE_ICONS } from "../../utils/constants";
import Modal from "../shared/Modal";
import { PregnancyIcon } from "../../assets/icons";
import { updateToadById } from "../../backend";
import { useSoundEffects } from "../../hooks/use-sound-effects";

interface ToadListModalProps {
  isOpen: boolean;
  onClose: () => void;
  toads: Toad[];
  onToadSelect: (toadId: number) => void;
}

const ToadListModal: React.FC<ToadListModalProps> = ({
  isOpen,
  onClose,
  toads,
  onToadSelect,
}) => {
  const { playClick } = useSoundEffects();

  const handleToadClick = (toad: Toad) => {
    onToadSelect(toad.id);
    onClose();
  };

  // Функция для перемещения жабы на склад
  const toStorage = async (toadId: number, event: React.MouseEvent) => {
    event.stopPropagation(); // Предотвращаем срабатывание клика по карточке
    playClick();

    try {
      await updateToadById(toadId, { scene_id: null });
      // Можно добавить уведомление об успехе или обновить состояние
      console.log(`Жаба ${toadId} перемещена на склад`);
    } catch (error) {
      console.error("Ошибка при перемещении жабы на склад:", error);
    }
  };

  if (!isOpen) return null;

  // Группируем жаб по всем типам редкости
  const groupedToads = {
    common: toads.filter(
      (toad) => toad.genes.rarity < RARITY_GROUPS_TRESHOLD.uncommon
    ),
    uncommon: toads.filter(
      (toad) =>
        toad.genes.rarity >= RARITY_GROUPS_TRESHOLD.uncommon &&
        toad.genes.rarity < RARITY_GROUPS_TRESHOLD.rare
    ),
    rare: toads.filter(
      (toad) =>
        toad.genes.rarity >= RARITY_GROUPS_TRESHOLD.rare &&
        toad.genes.rarity < RARITY_GROUPS_TRESHOLD.epic
    ),
    epic: toads.filter(
      (toad) =>
        toad.genes.rarity >= RARITY_GROUPS_TRESHOLD.epic &&
        toad.genes.rarity < RARITY_GROUPS_TRESHOLD.legendary
    ),
    legendary: toads.filter(
      (toad) => toad.genes.rarity >= RARITY_GROUPS_TRESHOLD.legendary
    ),
  };

  const icon = (
    <svg
      className="w-6 h-6 text-green-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M4 6h16M4 12h16M4 18h16"
      />
    </svg>
  );

  // Иконка голода
  const HungerIcon = ({ level }: { level: number }) => {
    const getHungerColor = (level: number) => {
      if (level >= 80) return "text-green-400";
      if (level >= 50) return "text-yellow-400";
      if (level >= 20) return "text-orange-400";
      return "text-red-400";
    };

    const getHungerIcon = (level: number) => {
      if (level >= 80) return "🤤";
      if (level >= 50) return "😐";
      if (level >= 20) return "😟";
      return "😵";
    };

    return (
      <div className={`flex items-center gap-1 ${getHungerColor(level)}`}>
        <span className="text-xs">{getHungerIcon(level)}</span>
        <span className="text-[10px] font-medium">{level}%</span>
      </div>
    );
  };

  // Иконка головастика
  const tadpoleIcon = (
    <svg
      width="64"
      height="64"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-3 h-3 text-white"
    >
      <path
        d="M32 12C28 12 24 16 24 22V36C24 38 26 40 28 40C28 44 30 46 32 46C34 46 36 44 36 40C38 40 40 38 40 36V22C40 16 36 12 32 12Z"
        stroke="white"
        strokeWidth="4"
      />
      <path d="M24 30H40" stroke="white" strokeWidth="2" />
    </svg>
  );

  const ToadItem = ({
    groupedToads,
    rarity,
  }: {
    groupedToads: Toad[];
    rarity: keyof typeof RARITY_CONFIG;
  }) => (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className={`${RARITY_CONFIG[rarity].color} text-lg`}>
          {RARITY_CONFIG[rarity].icon}
        </span>
        <h3 className={`${RARITY_CONFIG[rarity].color} font-bold text-sm`}>
          {RARITY_CONFIG[rarity].label}
        </h3>
        <span className={`${RARITY_CONFIG[rarity].color} text-sm font-medium`}>
          {groupedToads.length}
        </span>
      </div>
      <div className="space-y-2">
        {groupedToads.map((toad) => {
          return (
            <div
              key={toad.id}
              onClick={() => handleToadClick(toad)}
              className={`bg-gradient-to-r ${RARITY_CONFIG[rarity].bgColor} rounded-xl p-4 border transition-colors cursor-pointer opacity-90 relative group`}
            >
              <button
                onClick={(e) => toStorage(toad.id, e)}
                className="absolute flex justify-center gap-3 items-center top-3 right-3 bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-lg"
                title="Поместить на склад"
              >
                На склад
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
              </button>
              <div className="flex items-center gap-3 pr-8">
                {" "}
                {/* Добавляем отступ справа для кнопки */}
                <div className="relative">
                  <div
                    className={`rounded-full border-2 ${
                      RARITY_CONFIG[rarity].borderColor
                    } shadow-lg ${
                      toad.stage === "toadpole" ? "w-10 h-10" : "w-12 h-12"
                    }`}
                    style={{ backgroundColor: toad.genes.colors[0] }}
                  />
                  {toad.pregnancy?.isPregnant && (
                    <div className="absolute -top-1 -right-1 bg-pink-500 rounded-full p-1 shadow-lg">
                      <PregnancyIcon />
                    </div>
                  )}
                  {toad.stage === "toadpole" && (
                    <div className="absolute -bottom-1 -left-1 bg-blue-500 rounded-full p-1 shadow-lg">
                      {tadpoleIcon}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-bold text-sm truncate">
                      {toad.name}
                    </span>
                    <div className="flex items-center gap-1">
                      {/* Отображение пола с цветом */}
                      <span
                        className={`text-xs ${
                          toad.sex === "male"
                            ? "text-blue-400"
                            : toad.sex === "female"
                            ? "text-pink-400"
                            : "text-gray-400"
                        }`}
                        title={
                          toad.sex === "male"
                            ? "Самец"
                            : toad.sex === "female"
                            ? "Самка"
                            : "Бесполый"
                        }
                      >
                        {TYPE_ICONS[toad.sex as keyof typeof TYPE_ICONS]}
                      </span>
                      {toad.pregnancy?.isPregnant && <PregnancyIcon />}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs mb-1">
                    <span className={`${RARITY_CONFIG[rarity].color}`}>
                      {toad.genes.rarity.toFixed(1)}
                    </span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-300">
                      Поколение {toad.generation}
                    </span>
                    {toad.stage === "toadpole" && (
                      <span className="text-blue-400 font-medium">
                        Головастик
                      </span>
                    )}
                  </div>
                  {/* Индикатор голода */}
                  <div className="flex text-xs items-center justify-between gap-4">
                    <HungerIcon level={toad.state.hunger} />
                    {/* Прогресс-бар голода */}
                    <div className="w-full h-1.5 bg-gray-600 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          toad.state.hunger >= 80
                            ? "bg-green-500"
                            : toad.state.hunger >= 50
                            ? "bg-yellow-500"
                            : toad.state.hunger >= 20
                            ? "bg-orange-500"
                            : "bg-red-500"
                        }`}
                        style={{ width: `${toad.state.hunger}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // Общая статистика по голоду
  const hungerStats = {
    wellFed: toads.filter((t) => t.state.hunger >= 80).length,
    normal: toads.filter((t) => t.state.hunger >= 50 && t.state.hunger < 80)
      .length,
    hungry: toads.filter((t) => t.state.hunger >= 20 && t.state.hunger < 50)
      .length,
    starving: toads.filter((t) => t.state.hunger < 20).length,
  };

  return (
    <Modal onClose={onClose} isOpen={isOpen} icon={icon} title={"Все жабы"}>
      {/* Контент с прокруткой */}
      <div className="overflow-y-auto h-[calc(80vh-60px)]">
        {/* Легендарные жабы */}
        {groupedToads.legendary.length > 0 && (
          <ToadItem groupedToads={groupedToads.legendary} rarity="legendary" />
        )}
        {groupedToads.epic.length > 0 && (
          <ToadItem groupedToads={groupedToads.epic} rarity="epic" />
        )}
        {groupedToads.rare.length > 0 && (
          <ToadItem groupedToads={groupedToads.rare} rarity="rare" />
        )}
        {groupedToads.uncommon.length > 0 && (
          <ToadItem groupedToads={groupedToads.uncommon} rarity="uncommon" />
        )}
        {groupedToads.common.length > 0 && (
          <ToadItem groupedToads={groupedToads.common} rarity="common" />
        )}

        {/* Если жаб нет */}
        {toads.length === 0 && (
          <div className="text-center py-8">
            <div className="text-gray-400 text-4xl mb-3">🐸</div>
            <p className="text-gray-400 text-sm">Пока нет жаб в коллекции</p>
          </div>
        )}
      </div>

      {/* Подвал с статистикой */}
      <div className="border-t border-gray-700/50 p-4 bg-gray-900/50">
        <div className="grid grid-cols-5 gap-2 text-center text-xs mb-3">
          <div>
            <div className="text-green-400 font-bold">
              {groupedToads.common.length}
            </div>
            <div className="text-gray-400 text-[10px]">Обычные</div>
          </div>
          <div>
            <div className="text-blue-400 font-bold">
              {groupedToads.uncommon.length}
            </div>
            <div className="text-gray-400 text-[10px]">Необычные</div>
          </div>
          <div>
            <div className="text-purple-400 font-bold">
              {groupedToads.rare.length}
            </div>
            <div className="text-gray-400 text-[10px]">Редкие</div>
          </div>
          <div>
            <div className="text-orange-400 font-bold">
              {groupedToads.epic.length}
            </div>
            <div className="text-gray-400 text-[10px]">Эпические</div>
          </div>
          <div>
            <div className="text-yellow-400 font-bold">
              {groupedToads.legendary.length}
            </div>
            <div className="text-gray-400 text-[10px]">Легендарные</div>
          </div>
        </div>

        {/* Статистика голода */}
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <div>
            <div className="text-green-400 font-bold">
              {hungerStats.wellFed}
            </div>
            <div className="text-gray-400 text-[10px]">Сытые</div>
          </div>
          <div>
            <div className="text-yellow-400 font-bold">
              {hungerStats.normal}
            </div>
            <div className="text-gray-400 text-[10px]">Норма</div>
          </div>
          <div>
            <div className="text-orange-400 font-bold">
              {hungerStats.hungry}
            </div>
            <div className="text-gray-400 text-[10px]">Голодные</div>
          </div>
          <div>
            <div className="text-red-400 font-bold">{hungerStats.starving}</div>
            <div className="text-gray-400 text-[10px]">Голодают</div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ToadListModal;

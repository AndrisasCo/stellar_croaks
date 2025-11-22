import React from "react";
import { useToads } from "../ToadContext";
import Modal from "../shared/Modal";

interface SceneInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SceneInfoModal: React.FC<SceneInfoModalProps> = ({ isOpen, onClose }) => {
  const { currentScene, toads } = useToads();

  if (!isOpen || !currentScene) return null;

  const icon = (
    <svg
      className="w-6 h-6 text-blue-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  );

  // Статистика по жабам на сцене
  const toadStats = {
    total: toads.length,
    male: toads.filter((t) => t.stage === "adult" && t.sex === "male").length,
    female: toads.filter((t) => t.stage === "adult" && t.sex === "female")
      .length,
    neuter: toads.filter((t) => t.stage === "adult" && t.sex === "neuter")
      .length,

    toadpole: toads.filter((t) => t.stage === "toadpole").length,
    pregnant: toads.filter((t) => t.pregnancy?.isPregnant).length,
  };

  // Средние характеристики
  const averageStats = {
    rarity:
      toads.length > 0
        ? (
            toads.reduce((sum, t) => sum + t.genes.rarity, 0) / toads.length
          ).toFixed(1)
        : "0.0",
    weight:
      toads.length > 0
        ? (
            toads.reduce((sum, t) => sum + t.genes.weight, 0) / toads.length
          ).toFixed(1)
        : "0.0",
    speed:
      toads.length > 0
        ? (
            toads.reduce((sum, t) => sum + t.genes.speed, 0) / toads.length
          ).toFixed(1)
        : "0.0",
  };

  const StatItem = ({
    label,
    value,
    color = "text-white",
    icon,
  }: {
    label: string;
    value: string | number;
    color?: string;
    icon?: React.ReactNode;
  }) => (
    <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg border border-gray-600/50">
      <div className="flex items-center gap-2">
        {icon && <span className="text-gray-400">{icon}</span>}
        <span className="text-gray-300 text-sm">{label}</span>
      </div>
      <span className={`${color} font-medium text-sm`}>{value}</span>
    </div>
  );

  return (
    <Modal
      onClose={onClose}
      isOpen={isOpen}
      icon={icon}
      title="Статистика вольера"
    >
      {/* Основная информация о сцене */}
      <div className="space-y-3 mb-6">
        <StatItem
          label="Название вольера"
          value={currentScene.name}
          icon={
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
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
          }
        />

        {/* <StatItem
          label="Статус"
          value="Активна"
          color="text-green-400"
          icon={
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
                d="M5 13l4 4L19 7"
              />
            </svg>
          }
        /> */}

        {/* <StatItem
          label="Редкость сцены"
          value="Обычная"
          color="text-purple-400"
          icon={
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
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
              />
            </svg>
          }
        /> */}
      </div>

      {/* Статистика по жабам */}
      <div className="mb-4">
        <h4 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
          <svg
            className="w-4 h-4 text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          Население жаб
        </h4>
        <div className="space-y-2">
          <StatItem
            label="Всего жаб"
            value={toadStats.total}
            color="text-white"
          />

          <div className="grid grid-cols-3 gap-2">
            <StatItem
              label="Самцы"
              value={toadStats.male}
              color="text-blue-400"
            />
            <StatItem
              label="Самки"
              value={toadStats.female}
              color="text-pink-400"
            />
            <StatItem
              label="Бесполые"
              value={toadStats.neuter}
              color="text-gray-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <StatItem
              label="Головастики"
              value={toadStats.toadpole}
              color="text-cyan-400"
            />
            <StatItem
              label="Беременные"
              value={toadStats.pregnant}
              color="text-pink-400"
            />
          </div>
        </div>
      </div>

      {/* Средние характеристики */}
      <div>
        <h4 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
          <svg
            className="w-4 h-4 text-yellow-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          Средние показатели
        </h4>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-gray-700/50 rounded-lg p-3 text-center border border-gray-600/50">
            <div className="text-purple-400 text-lg font-bold">
              {averageStats.rarity}
            </div>
            <div className="text-gray-400 text-[10px] mt-1">Редкость</div>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-3 text-center border border-gray-600/50">
            <div className="text-blue-400 text-lg font-bold">
              {averageStats.weight}
            </div>
            <div className="text-gray-400 text-[10px] mt-1">Размер</div>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-3 text-center border border-gray-600/50">
            <div className="text-green-400 text-lg font-bold">
              {averageStats.speed}
            </div>
            <div className="text-gray-400 text-[10px] mt-1">Скорость</div>
          </div>
        </div>
      </div>

      {/* Подвал с общей информацией */}
      <div className="border-t border-gray-700/50 mt-6 pt-4">
        <div className="text-center text-gray-400 text-xs">
          Обновлено: {new Date().toLocaleTimeString()}
        </div>
      </div>
    </Modal>
  );
};

export default SceneInfoModal;

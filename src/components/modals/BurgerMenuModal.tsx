import { MenuIcons } from "../../assets/icons";
import Modal from "../shared/Modal";

// Дублируем ключи из родительского стейта для типизации (или можно вынести в отдельный types.ts)
type UiKey =
  | "isSettingsOpen"
  | "isMenuOpen"
  | "isShopOpen"
  | "isStorageOpen"
  | "isLeaderboardOpen"
  | "isTutorialOpen"
  | "isAchievementsOpen"
  | "isGalleryOpen"
  | "isLoading";

interface BurgerMenuProps {
  toggleModal: (key: UiKey, value: boolean) => void;
}

type MenuId = "gallery" | "stats" | "leaderboard" | "tutorial" | "settings";

// Иконка настроек
const SettingsIcon = (
  <svg
    className="w-6 h-6"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);

const MENU_ITEMS: {
  id: MenuId;
  icon: JSX.Element;
  label: string;
  desc: string;
  color: string;
  targetKey: UiKey; // Добавил поле targetKey для прямой связи
}[] = [
  {
    id: "gallery",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
        />
      </svg>
    ),
    label: "Жабопедия",
    desc: "Коллекция всех видов жаб",
    color: "bg-purple-900/50 border-purple-500/50",
    targetKey: "isGalleryOpen",
  },
  {
    id: "stats",
    icon: MenuIcons.stats,
    label: "Достижения",
    desc: "Ваши достижения и прогресс",
    color: "bg-yellow-900/50 border-yellow-500/50",
    targetKey: "isAchievementsOpen",
  },
  {
    id: "leaderboard",
    icon: MenuIcons.leaderboard,
    label: "Лидерборд",
    desc: "Сравнение с другими игроками",
    color: "bg-blue-900/50 border-blue-500/50",
    targetKey: "isLeaderboardOpen",
  },
  {
    id: "tutorial",
    icon: MenuIcons.collection,
    label: "Обучение",
    desc: "Ваш путеводитель в мире жабоводства",
    color: "bg-teal-900/50 border-teal-500/50",
    targetKey: "isTutorialOpen",
  },
  {
    id: "settings",
    icon: SettingsIcon,
    label: "Настройки",
    desc: "Звук, музыка и другие опции",
    color: "bg-gray-900/50 border-gray-500/50",
    targetKey: "isSettingsOpen",
  },
];

export const BurgerMenu = ({ toggleModal }: BurgerMenuProps) => {
  const handleMenuClick = (targetKey: UiKey) => {
    toggleModal("isMenuOpen", false);

    toggleModal(targetKey, true);
  };

  return (
    <Modal
      onClose={() => toggleModal("isMenuOpen", false)}
      title="Меню"
      isOpen={true}
    >
      <div className="mb-3 flex flex-col gap-3">
        {MENU_ITEMS.map((item, index) => (
          <button
            key={item.id}
            onClick={() => handleMenuClick(item.targetKey)}
            className={`w-full ${item.color} rounded-xl py-4 px-2 shadow-lg border-2 hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-95 group`}
            style={{
              animationDelay: `${index * 70}ms`,
              animation: "slideInUp 0.4s ease-out forwards",
            }}
          >
            <div className="flex items-center space-x-3">
              <div className="text-green-400 group-hover:text-green-300 transition-colors duration-300">
                {item.icon}
              </div>
              <div className="text-left flex-1">
                <div className="text-sm font-bold text-white group-hover:text-green-200 transition-colors duration-300">
                  {item.label}
                </div>
                <div className="text-[10px] text-gray-400 group-hover:text-gray-300 transition-colors duration-300">
                  {item.desc}
                </div>
              </div>
              <div className="text-gray-500 group-hover:text-green-400 transition-colors duration-300 text-lg">
                ›
              </div>
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={() => toggleModal("isMenuOpen", false)}
        className="w-full mt-auto bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white py-3 rounded-xl transition-all duration-300 transform hover:scale-105 active:scale-95 border border-gray-600 font-bold"
      >
        Закрыть
      </button>
    </Modal>
  );
};

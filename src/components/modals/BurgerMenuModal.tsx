import { MenuIcons } from "../../assets/icons";
import { useModal } from "../ModalContext";
import Modal from "../shared/Header";
import AchivementsModal from "./AchivementsModal";
import ExpeditionModal from "./ExpeditionModal";
import LeaderboardModal from "./LeaderboardModal";
import SettingsModal from "./SettingsModal";
import { ToadGalleryModal } from "./ToadGalleryModal";
import TutorialModal from "./TutorialModal";

type MenuId =
  | "expedition"
  | "gallery"
  | "stats"
  | "leaderboard"
  | "tutorial"
  | "settings";

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
  target: JSX.Element;
}[] = [
  {
    id: "expedition",
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
          d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
        />
      </svg>
    ),
    label: "Разведка",
    desc: "Походы команд за Периметр",
    color: "bg-amber-900/50 border-amber-500/50",
    target: <ExpeditionModal />,
  },
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
    target: <ToadGalleryModal />,
  },
  {
    id: "stats",
    icon: MenuIcons.stats,
    label: "Достижения",
    desc: "Ваши достижения и прогресс",
    color: "bg-yellow-900/50 border-yellow-500/50",
    target: <AchivementsModal />,
  },
  {
    id: "leaderboard",
    icon: MenuIcons.leaderboard,
    label: "Лидерборд",
    desc: "Сравнение с другими игроками",
    color: "bg-blue-900/50 border-blue-500/50",
    target: <LeaderboardModal />,
  },
  {
    id: "tutorial",
    icon: MenuIcons.collection,
    label: "Обучение",
    desc: "Ваш путеводитель в мире жабоводства",
    color: "bg-teal-900/50 border-teal-500/50",
    target: <TutorialModal />,
  },
  {
    id: "settings",
    icon: SettingsIcon,
    label: "Настройки",
    desc: "Звук, музыка и другие опции",
    color: "bg-gray-900/50 border-gray-500/50",
    target: <SettingsModal />,
  },
];

export const BurgerMenu = () => {
  const { openModal } = useModal();

  return (
    <Modal title="Меню">
      <div className="mb-3 flex flex-col gap-3">
        {MENU_ITEMS.map((item, index) => (
          <button
            key={item.id}
            onClick={() => openModal(() => item.target)}
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
                <div className="text-2xs text-gray-300 group-hover:text-gray-200 transition-colors duration-300">
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
    </Modal>
  );
};

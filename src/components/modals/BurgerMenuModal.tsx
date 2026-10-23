import { MenuIcons } from "../../assets/icons";
import { detectPlatformName } from "../../platform";
import { ColonyRoomKind } from "../../models/colony";
import { useColony } from "../../hooks/use-colony";
import { useNotifications } from "../../hooks/use-notification";
import { isRoomKindBuilt } from "../HexMap/colony-build";
import { useModal } from "../ModalContext";
import Modal from "../shared/Header";
import AchivementsModal from "./AchivementsModal";
import AuthModal from "./AuthModal";
import ExpeditionModal from "./ExpeditionModal";
import LeaderboardModal from "./LeaderboardModal";
import LoreArchiveModal from "./LoreArchiveModal";
import SettingsModal from "./SettingsModal";
import ShopMenu from "./ShopMenu";
import StorageModal from "./StorageModal";
import { ToadGalleryModal } from "./ToadGalleryModal";
import TutorialModal from "./TutorialModal";

type MenuId =
  | "shop"
  | "storage"
  | "expedition"
  | "gallery"
  | "stats"
  | "leaderboard"
  | "tutorial"
  | "lore"
  | "settings"
  | "auth";

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
  /** Цвет иконки: единственный акцент пункта, сама карточка всегда одной поверхности. */
  color: string;
  target: JSX.Element;
  /**
   * Сектор, без которого пункт меню закрыт. «Рынок» открывается только после того,
   * как на карте колонии построен «Торговая Капсула»: до постройки торговли в колонии нет.
   */
  requiresRoom?: ColonyRoomKind;
  /** Подсказка вместо описания, пока нужный сектор не построен. */
  lockedDesc?: string;
}[] = [
  // Рынок и склад по-прежнему доступны из меню, но «Рынок» открывается только когда
  // на карте колонии построен «Торговая Капсула» (`requiresRoom`): без сектора торговли нет.
  {
    id: "shop",
    icon: MenuIcons.shop,
    label: "Рынок",
    desc: "Жабы, предметы и улучшения",
    color: "text-fuchsia-300",
    target: <ShopMenu />,
    requiresRoom: "shop",
    lockedDesc: "Сначала постройте «Торговая Капсула» на карте колонии",
  },
  {
    id: "storage",
    icon: MenuIcons.collection,
    label: "Склад",
    desc: "Ресурсы и запасы колонии",
    color: "text-emerald-300",
    target: <StorageModal />,
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
    color: "text-purple-300",
    target: <ToadGalleryModal />,
  },
  {
    id: "stats",
    icon: MenuIcons.stats,
    label: "Достижения",
    desc: "Ваши достижения и прогресс",
    color: "text-yellow-300",
    target: <AchivementsModal />,
  },
  {
    id: "leaderboard",
    icon: MenuIcons.leaderboard,
    label: "Лидерборд",
    desc: "Сравнение с другими игроками",
    color: "text-blue-300",
    target: <LeaderboardModal />,
  },
  {
    id: "tutorial",
    icon: MenuIcons.collection,
    label: "Обучение",
    desc: "Полный справочник: карта, жабы и экономика",
    color: "text-teal-300",
    target: <TutorialModal />,
  },
  {
    id: "lore",
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
          d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
        />
      </svg>
    ),
    label: "Архив КВАЗа",
    desc: "Восстановленные записи станции «Титан-9»",
    color: "text-cyan-300",
    target: <LoreArchiveModal />,
  },
  {
    id: "settings",
    icon: SettingsIcon,
    label: "Настройки",
    desc: "Звук, музыка и другие опции",
    color: "text-slate-300",
    target: <SettingsModal />,
  },
  {
    // Вход по почте — только для браузера: в Telegram личность уже подтверждена
    // подписью `initData`, и аккаунт там заводить нечего (см. backend/auth.ts).
    id: "auth",
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
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
    ),
    label: "Аккаунт",
    desc: "Вход и регистрация по почте",
    color: "text-emerald-300",
    target: <AuthModal />,
  },
];

export const BurgerMenu = () => {
  const { openModal } = useModal();
  const { addNotification } = useNotifications();
  const { colony } = useColony();

  // В браузере аккаунт заводит сам игрок (почта + пароль), в Telegram он уже есть —
  // поэтому пункт меню показываем только веб-версии.
  const items = MENU_ITEMS.filter(
    (item) => item.id !== "auth" || detectPlatformName() === "web",
  ).map((item) => ({
    ...item,
    // Сектор ещё не построен — пункт меню остаётся на месте, но не открывает модалку
    locked: item.requiresRoom
      ? !isRoomKindBuilt(colony, item.requiresRoom)
      : false,
  }));

  return (
    <Modal title="Меню">
      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map((item, index) => (
          <button
            key={item.id}
            onClick={() => {
              if (item.locked) {
                addNotification({
                  type: "warn",
                  content: `${item.label}: ${item.lockedDesc ?? "сектор не построен"}`,
                  timeout: 5000,
                });
                return;
              }

              openModal(() => item.target);
            }}
            className={`group w-full rounded-xl border border-white/10 bg-slate-900/55 px-3 py-2.5 shadow-lg transition-colors duration-300 ${
              items.length % 2 === 1 && index === items.length - 1
                ? "sm:col-span-2"
                : ""
            } ${
              item.locked
                ? "cursor-not-allowed opacity-45 grayscale"
                : "hover:border-cyan-300/40 hover:bg-slate-800/70 active:scale-[0.99]"
            }`}
            style={{
              animationDelay: `${index * 70}ms`,
              animation: "slideInUp 0.4s ease-out forwards",
            }}
          >
            <div className="flex items-center space-x-3">
              <div className={`transition-colors duration-300 ${item.color}`}>
                {item.icon}
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-bold text-white transition-colors duration-300 group-hover:text-cyan-50">
                  {item.label}
                </div>
                <div className="ui-caption transition-colors duration-300 group-hover:text-slate-300">
                  {item.locked ? item.lockedDesc : item.desc}
                </div>
              </div>
              <div className="text-lg text-slate-500 transition-colors duration-300 group-hover:text-cyan-300">
                {item.locked ? "🔒" : "›"}
              </div>
            </div>
          </button>
        ))}
      </div>
    </Modal>
  );
};

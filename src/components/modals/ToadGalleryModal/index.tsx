import React, { useMemo, useState } from "react";
import { useSoundEffects } from "../../../hooks/use-sound-effects";
import Modal from "../../shared/Modal";
import { ToadAvatar } from "../../shared/ToadAvatar";
import {
  TOAD_SPECIES_CONFIG,
  ToadObtainedBy,
  getLootboxHint,
  LootboxChanceLevel,
} from "../../../models/Toad/toad-species";
import { getAchievementState } from "../../../backend/achivements-manager";
import { GlowWrapper } from "../../shared/GlowWrapper";

// Интерфейс для элемента галереи
interface GallerySlot {
  type: string;
  name: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  description: string;
  isUnlocked: boolean;
  unlockedAt?: string;
  exampleToad?: any;
  obtainedBy?: ToadObtainedBy;
  lootboxChanceLevel?: LootboxChanceLevel;
  recipeHint?: string;
  achievementId?: string;
  price?: number;
  hidden?: boolean;
}

interface ToadGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Хелпер для иконок способов получения
const getObtainedByIcon = (obtainedBy?: ToadObtainedBy) => {
  switch (obtainedBy) {
    case "start":
      return { icon: "", label: "Стартовая" };
    case "shop":
      return { icon: "🛒", label: "Магазин" };
    case "lootbox":
      return { icon: "🎁", label: "Лутбокс" };
    case "achievement":
      return { icon: "🏆", label: "Достижение" };
    case "collider":
      return { icon: "⚗️", label: "Коллайдер" };
    case "recipe":
      return { icon: "🔮", label: "Рецепт" };
    case "unknown":
      return { icon: "❓", label: "Неизвестно" };
    default:
      return { icon: "❓", label: "Неизвестно" };
  }
};

// Хелпер для цветов редкости
const getRarityStyles = (rarity: string, isUnlocked: boolean) => {
  if (!isUnlocked) {
    return {
      border: "border-gray-700",
      bg: "bg-gray-800",
      bgLight: "bg-gray-800/40",
      text: "text-gray-500",
      glow: "",
      icon: "text-gray-600",
      titleColor: "text-gray-500",
      progressBar: "bg-gray-600",
      badge: "bg-gray-700 text-gray-400",
    };
  }

  switch (rarity) {
    case "legendary":
      return {
        border: "border-yellow-500/50",
        bg: "bg-gradient-to-br from-yellow-900/90 to-amber-900/90",
        bgLight: "bg-gradient-to-br from-yellow-900/30 to-amber-900/30",
        text: "text-yellow-200",
        glow: "shadow-[0_0_30px_rgba(234,179,8,0.4)]",
        icon: "text-yellow-300",
        titleColor: "text-yellow-400",
        progressBar: "bg-gradient-to-r from-yellow-500 to-amber-500",
        badge: "bg-yellow-900/70 text-yellow-300",
      };
    case "epic":
      return {
        border: "border-purple-500/50",
        bg: "bg-gradient-to-br from-purple-900/90 to-fuchsia-900/90",
        bgLight: "bg-gradient-to-br from-purple-900/30 to-fuchsia-900/30",
        text: "text-purple-200",
        glow: "shadow-[0_0_30px_rgba(168,85,247,0.4)]",
        icon: "text-purple-300",
        titleColor: "text-purple-400",
        progressBar: "bg-gradient-to-r from-purple-500 to-pink-500",
        badge: "bg-purple-900/70 text-purple-300",
      };
    case "rare":
      return {
        border: "border-blue-500/50",
        bg: "bg-gradient-to-br from-blue-900/90 to-cyan-900/90",
        bgLight: "bg-gradient-to-br from-blue-900/30 to-cyan-900/30",
        text: "text-blue-200",
        glow: "shadow-[0_0_20px_rgba(59,130,246,0.4)]",
        icon: "text-blue-300",
        titleColor: "text-blue-400",
        progressBar: "bg-gradient-to-r from-blue-500 to-cyan-500",
        badge: "bg-blue-900/70 text-blue-300",
      };
    default: // common
      return {
        border: "border-green-500/30",
        bg: "bg-gradient-to-br from-green-900/90 to-emerald-900/90",
        bgLight: "bg-gradient-to-br from-green-900/30 to-emerald-900/30",
        text: "text-green-200",
        glow: "shadow-[0_0_15px_rgba(34,197,94,0.2)]",
        icon: "text-green-300",
        titleColor: "text-green-400",
        progressBar: "bg-gradient-to-r from-green-500 to-emerald-500",
        badge: "bg-green-900/70 text-green-300",
      };
  }
};

// Хелпер для получения подсказки
const getHintText = (item: GallerySlot): string => {
  if (item.isUnlocked) return "";

  switch (item.obtainedBy) {
    case "lootbox":
      return item.lootboxChanceLevel
        ? getLootboxHint(item.lootboxChanceLevel)
        : "Лутбокс";
    case "shop":
      return "Продается в магазине";
    case "achievement":
      return "Награда за достижение";
    case "collider":
      return "Случайный шанс получить в коллайдере";
    case "recipe":
      return item.recipeHint || "Крафт по рецепту";
    case "unknown":
      return "Способ получения неизвестен";
    default:
      return "Способ получения неизвестен";
  }
};

// Компонент для отображения иконки редкости
const RarityIcon: React.FC<{ rarity: string; size?: "sm" | "md" }> = ({
  rarity,
  size = "sm",
}) => {
  const icons = {
    common: "●",
    rare: "◆",
    epic: "★",
    legendary: "👑",
  };

  const sizes = {
    sm: "text-xs",
    md: "text-base",
  };

  const colors = {
    common: "text-green-400",
    rare: "text-blue-400",
    epic: "text-purple-400",
    legendary: "text-yellow-400",
  };

  return (
    <span className={`${sizes[size]} ${colors[rarity as keyof typeof colors]}`}>
      {icons[rarity as keyof typeof icons]}
    </span>
  );
};

export const ToadGalleryModal: React.FC<ToadGalleryModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { playClick } = useSoundEffects();

  const openedToadsTypes = getAchievementState().toads_collection || [];

  const [selectedItem, setSelectedItem] = useState<GallerySlot | null>(null);
  const [sortBy, setSortBy] = useState<"rarity" | "unlocked" | "name">(
    "rarity"
  );

  const icon = (
    <svg
      className="w-6 h-6 text-purple-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
      />
    </svg>
  );

  const galleryItems: GallerySlot[] = useMemo(() => {
    return TOAD_SPECIES_CONFIG.map((config) => {
      const ownedToad = openedToadsTypes.find((type) => type === config.type);
      return {
        type: config.type,
        name: config.name,
        rarity: config.rarity as any,
        description: config.desc,
        isUnlocked: !!ownedToad,
        exampleToad: { type: ownedToad, genes: { colors: ["#4E6D1A"] } },
        obtainedBy: config.obtainedBy,
        lootboxChanceLevel: config.lootboxChanceLevel,
        recipeHint: config.recipeHint,
        achievementId: config.achievementId,
        hidden: config.hidden,
      };
    }).filter((item) => !item.hidden || item.isUnlocked); // Скрываем скрытых, если не открыты
  }, [openedToadsTypes]);

  // Сортировка
  const sortedItems = useMemo(() => {
    const items = [...galleryItems];

    switch (sortBy) {
      case "rarity":
        const rarityOrder = { legendary: 4, epic: 3, rare: 2, common: 1 };
        return items.sort((a, b) => {
          if (a.isUnlocked !== b.isUnlocked) {
            return a.isUnlocked ? -1 : 1;
          }
          const rarityDiff = rarityOrder[b.rarity] - rarityOrder[a.rarity];
          if (rarityDiff !== 0) return rarityDiff;
          return a.name.localeCompare(b.name);
        });

      case "unlocked":
        return items.sort((a, b) => {
          if (a.isUnlocked !== b.isUnlocked) {
            return a.isUnlocked ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });

      case "name":
        return items.sort((a, b) => a.name.localeCompare(b.name));

      default:
        return items;
    }
  }, [galleryItems, sortBy]);

  const stats = {
    total: galleryItems.length,
    unlocked: galleryItems.filter((i) => i.isUnlocked).length,
    byRarity: {
      legendary: galleryItems.filter(
        (i) => i.isUnlocked && i.rarity === "legendary"
      ).length,
      epic: galleryItems.filter((i) => i.isUnlocked && i.rarity === "epic")
        .length,
      rare: galleryItems.filter((i) => i.isUnlocked && i.rarity === "rare")
        .length,
      common: galleryItems.filter((i) => i.isUnlocked && i.rarity === "common")
        .length,
    },
    bySource: {
      lootbox: galleryItems.filter(
        (i) => i.isUnlocked && i.obtainedBy === "lootbox"
      ).length,
      achievement: galleryItems.filter(
        (i) => i.isUnlocked && i.obtainedBy === "achievement"
      ).length,
      collider: galleryItems.filter(
        (i) => i.isUnlocked && i.obtainedBy === "collider"
      ).length,
      shop: galleryItems.filter((i) => i.isUnlocked && i.obtainedBy === "shop")
        .length,
    },
  };

  const progressPercentage = (stats.unlocked / stats.total) * 100;

  const handleItemClick = (item: GallerySlot) => {
    playClick();
    setSelectedItem(item);
  };

  const detailStyles = selectedItem
    ? getRarityStyles(selectedItem.rarity, selectedItem.isUnlocked)
    : null;

  const detailedView = selectedItem && detailStyles;

  const hadleClose = () => {
    if (detailedView) {
      setSelectedItem(null);
      return;
    }
    onClose();
  };

  return (
    <Modal
      closeButton={false}
      isOpen={isOpen}
      onClose={hadleClose}
      icon={!selectedItem?.name && icon}
      title={selectedItem?.name || "Жабопедия"}
    >
      {!detailedView && (
        <>
          <div className="flex justify-between items-center mb-4 px-1">
            <div className="text-sm text-gray-400">
              Найдено{" "}
              <span className="text-purple-300 font-bold">
                {stats.unlocked}
              </span>{" "}
              из <span className="text-gray-300">{stats.total}</span> видов
            </div>
            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-xs bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-gray-300 focus:outline-none focus:border-purple-500"
              >
                <option value="rarity">По редкости</option>
                <option value="unlocked">По открытию</option>
                <option value="name">По имени</option>
              </select>
            </div>
          </div>

          <div className="mb-6 bg-gray-800/50 rounded-xl p-4 border border-gray-700/50 backdrop-blur-sm">
            <div className="flex justify-between items-center mb-3">
              <div className="text-sm text-gray-300 font-medium">
                Прогресс коллекции
              </div>
              <div className="text-purple-300 font-bold text-lg">
                {Math.round(progressPercentage)}%
              </div>
            </div>

            <div className="w-full bg-gray-900 rounded-full h-3 mb-3 ">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-600 via-pink-500 to-yellow-500 shadow-[0_0_10px_rgba(236,72,153,0.5)] transition-all duration-700 ease-out"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-green-900/30 rounded p-2">
                <div className="text-green-400 font-bold">
                  {stats.byRarity.common}
                </div>
                <div className="text-xs text-gray-400">Обычные</div>
              </div>
              <div className="bg-blue-900/30 rounded p-2">
                <div className="text-blue-400 font-bold">
                  {stats.byRarity.rare}
                </div>
                <div className="text-xs text-gray-400">Редкие</div>
              </div>
              <div className="bg-purple-900/30 rounded p-2">
                <div className="text-purple-400 font-bold">
                  {stats.byRarity.epic}
                </div>
                <div className="text-xs text-gray-400">Эпические</div>
              </div>
              <div className="bg-yellow-900/30 rounded p-2">
                <div className="text-yellow-400 font-bold">
                  {stats.byRarity.legendary}
                </div>
                <div className="text-xs text-gray-400">Легенды</div>
              </div>
            </div>
          </div>

          {/* --- СЕТКА ГАЛЕРЕИ --- */}
          <div className="grid grid-cols-2 gap-6 px-3 pb-3">
            {sortedItems.map((item, idx) => {
              const styles = getRarityStyles(item.rarity, item.isUnlocked);
              const hintText = getHintText(item);

              return (
                <GlowWrapper
                  disabled={
                    item.rarity === "rare" ||
                    item.rarity === "common" ||
                    !item.isUnlocked
                  }
                  sparklesOn={item.rarity === "legendary"}
                  key={item.type + idx}
                  onClick={() => handleItemClick(item)}
                  style={
                    item.rarity === "epic"
                      ? {
                          "--color-01": "#9d4edd",
                          "--color-02": "#7b2cbf",
                          "--color-03": "#c77dff",
                          "--color-04": "#e0aaff",
                        }
                      : {}
                  }
                  className={`
                relative rounded-xl p-2 flex flex-col items-center justify-between
                border transition-all duration-300 group cursor-pointer
                 ${styles.bgLight} ${styles.border}

                ${
                  item.isUnlocked
                    ? "hover:scale-[1.02] active:scale-95"
                    : "active:scale-95"
                }
              `}
                >
                  {/* Значок редкости */}
                  <div className="absolute top-0 right-1">
                    <RarityIcon rarity={item.rarity} />
                  </div>

                  {/* Аватар жабы */}
                  <div className="flex items-center justify-center w-full ">
                    {item.isUnlocked && item.exampleToad ? (
                      <div className="drop-shadow-2xl transform scale-110">
                        <ToadAvatar toad={item.exampleToad} size={20} />
                      </div>
                    ) : (
                      <div className="relative w-16 h-16 flex items-center justify-center">
                        <svg
                          viewBox="0 0 100 100"
                          className="absolute inset-0 w-full h-full text-gray-900 opacity-30"
                          fill="currentColor"
                        >
                          <path d="M20,70 Q10,60 10,50 Q10,30 30,20 Q50,10 70,20 Q90,30 90,50 Q90,60 80,70 L90,90 L70,90 L70,80 L30,80 L30,90 L10,90 Z" />
                        </svg>
                        <div className="text-3xl font-bold text-gray-600 drop-shadow-md z-10 select-none">
                          ?
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Информация под аватаром */}
                  <div className="w-full text-center">
                    <div
                      className={`font-bold text-xs truncate ${styles.titleColor} my-1`}
                    >
                      {item.isUnlocked ? item.name : "???"}
                    </div>

                    {/* Подсказка для неоткрытых */}
                    {!item.isUnlocked && hintText && (
                      <div className="text-[10px] text-gray-400 px-1 truncate mb-1">
                        {hintText}
                      </div>
                    )}

                    {/* Цена для магазинных */}
                    {item.obtainedBy === "shop" &&
                      !item.isUnlocked &&
                      item.price && (
                        <div className="text-[10px] text-yellow-400 font-medium">
                          {item.price} монет
                        </div>
                      )}

                    {/* Бейдж редкости */}
                    <div
                      className={`text-[10px] px-2 py-0.5 rounded-full ${styles.badge} inline-block`}
                    >
                      {item.rarity === "legendary"
                        ? "ЛЕГЕНДАРНАЯ"
                        : item.rarity === "epic"
                        ? "ЭПИЧЕСКАЯ"
                        : item.rarity === "rare"
                        ? "РЕДКАЯ"
                        : "ОБЫЧНАЯ"}
                    </div>
                  </div>

                  {/* Эффект при наведении */}
                  <div
                    className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-20 transition-opacity duration-300 pointer-events-none"
                    style={{
                      background: `radial-gradient(circle at center, ${
                        styles.titleColor.replace("text-", "#").split("-")[0]
                      }20 0%, transparent 70%)`,
                    }}
                  />
                </GlowWrapper>
              );
            })}
          </div>

          {/* Подсказки по интерфейсу */}
          <div className="mt-6 pt-4 border-t border-gray-800">
            <div className="text-xs text-gray-500 text-center">
              💡 Нажмите на жабу для подробной информации.
            </div>
          </div>
        </>
      )}

      {/* --- DETAIL OVERLAY (Полное описание) --- */}
      {detailedView && (
        <div className="relative flex flex-col">
          <button
            onClick={() => setSelectedItem(null)}
            className="absolute top-[-48px] right-0 text-gray-400 hover:text-white p-1 rounded-full bg-black/30 w-7 h-7 flex items-center justify-center"
          >
            ✕
          </button>

          {/* Большой Аватар */}
          <div className="mb-6 flex mx-auto self-center">
            {selectedItem.isUnlocked && selectedItem.exampleToad ? (
              <GlowWrapper
                className="rounded-xl "
                disabled={
                  selectedItem.rarity === "rare" ||
                  selectedItem.rarity === "common"
                }
                sparklesOn={selectedItem.rarity === "legendary"}
                style={
                  selectedItem.rarity === "epic"
                    ? {
                        "--color-01": "#9d4edd",
                        "--color-02": "#7b2cbf",
                        "--color-03": "#c77dff",
                        "--color-04": "#e0aaff",
                      }
                    : {}
                }
              >
                <ToadAvatar toad={selectedItem.exampleToad} size={50} />
              </GlowWrapper>
            ) : (
              <div className="text-8xl w-[200px] text-center opacity-40">?</div>
            )}
          </div>

          {/* Информационный блок */}
          <div className="w-full space-y-4">
            {/* Описание */}
            <div className="bg-black/30 rounded-xl p-4">
              <p className={`text-sm leading-relaxed ${detailStyles.text}`}>
                {selectedItem.description}
              </p>
            </div>

            {/* Детали получения */}
            {!selectedItem.isUnlocked && (
              <div className="bg-black/40 rounded-xl p-4 border border-dashed border-gray-600">
                <h4 className={`text-sm font-medium mb-2 ${detailStyles.text}`}>
                  Как получить:
                </h4>

                {selectedItem.lootboxChanceLevel ? (
                  <div className="mt-2 text-xs text-gray-400">
                    Шанс выпадения в лутбоксе:{" "}
                    {getLootboxHint(selectedItem.lootboxChanceLevel)}
                  </div>
                ) : (
                  <p className="text-xs text-gray-300">
                    {getHintText(selectedItem)}
                  </p>
                )}
                {selectedItem.price && (
                  <div className="mt-2 text-xs text-yellow-400">
                    Цена: {selectedItem.price} монет
                  </div>
                )}
              </div>
            )}

            {/* Статистика редкости */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-black/30 rounded p-3">
                <div className="text-gray-400 mb-1">Редкость</div>
                <div className={detailStyles.titleColor}>
                  {selectedItem.rarity === "legendary"
                    ? "Легендарная"
                    : selectedItem.rarity === "epic"
                    ? "Эпическая"
                    : selectedItem.rarity === "rare"
                    ? "Редкая"
                    : "Обычная"}
                </div>
              </div>
              <div className="bg-black/30 rounded p-3">
                <div className="text-gray-400 mb-1">Статус</div>
                <div
                  className={
                    selectedItem.isUnlocked ? "text-green-400" : "text-gray-400"
                  }
                >
                  {selectedItem.isUnlocked ? "✓ В коллекции" : "✗ Не найдена"}
                </div>
              </div>
            </div>

            <div>
              {/* Способ получения */}
              {selectedItem.obtainedBy && (
                <div className="flex  gap-2 mb-4 text-sm">
                  <span className={detailStyles.text}>
                    Способ получения:{" "}
                    {getObtainedByIcon(selectedItem.obtainedBy).label}
                  </span>
                  <span>{getObtainedByIcon(selectedItem.obtainedBy).icon}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

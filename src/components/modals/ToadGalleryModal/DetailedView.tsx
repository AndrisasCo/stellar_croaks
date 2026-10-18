import React, { useMemo, useState } from "react";
import { useSoundEffects } from "../../../hooks/use-sound-effects";
import Modal from "../../shared/Header";
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

// Хелпер для иконок способов получения
const getObtainedByIcon = (obtainedBy?: ToadObtainedBy) => {
  switch (obtainedBy) {
    case "start":
      return { icon: "", label: "Стартовая" };
    case "shop":
      return { icon: "🛒", label: "Торговая капсула" };
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
      bg: "bg-color-main",
      bgLight: "bg-color-main",
      text: "text-gray-500",
      glow: "",
      icon: "text-gray-600",
      titleColor: "text-gray-500",
      progressBar: "bg-gray-600",
      badge: "bg-color-second text-gray-300",
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

export const DetailedView: React.FC = ({ selectedItem }) => {
  const detailStyles = selectedItem
    ? getRarityStyles(selectedItem.rarity, selectedItem.isUnlocked)
    : null;

  return (
    <Modal title={selectedItem?.name}>
      <div className="relative flex flex-col">
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
                <div className="mt-2 text-xs text-gray-300">
                  Шанс выпадения в лутбоксе:{" "}
                  {getLootboxHint(selectedItem.lootboxChanceLevel)}
                </div>
              ) : (
                <p className="text-xs text-gray-200">
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
              <div className="text-gray-300 mb-1">качество</div>
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
              <div className="text-gray-300 mb-1">Статус</div>
              <div
                className={
                  selectedItem.isUnlocked ? "text-green-400" : "text-gray-300"
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
    </Modal>
  );
};

import React, { useEffect, useState } from "react";
import { getGeneticFaultConfig, Toad } from "../../../models/Toad";
import { Scene } from "../../../models/scene";
import { updateScene } from "../../../backend";
import { InfoIcons } from "../../../assets/icons";

import { PRODUCTION_MIN_HUNGER } from "../../../utils/gamification-config";
import {
  normalizeSceneName,
  SCENE_NAME_MAX_LENGTH,
} from "../../../utils/scene-name";
import {
  DataCell,
  DataGrid,
  HudPanel,
  SectionTitle,
} from "../../shared/DataGrid";

/**
 * «Статистика биопода» — вторая вкладка модалки списка жаб (`ToadListModal/index.tsx`).
 *
 * Отдельной модалки статистики больше нет: у биопода два состояния — список жаб и его
 * статистика, и листать их нужно, не теряя выбор и фильтры (стрелки биоподов остаются
 * на месте в обоих состояниях). Поэтому панель — обычное содержимое модалки без `Modal`
 * (шапку рисует сам список), а биопод и его жабы приходят пропсами: их уже посчитал
 * родитель.
 *
 * Улучшений здесь нет: они ставятся на карточке самого сектора — во вкладке «Данные
 * сектора» (`modals/RoomDataTab.tsx`). У биопода это автокормушка, у Медотсека ещё и
 * репатриатор; прежние панели «Улучшение биопода» (+10 мест за Кваксы) и «Буст»
 * (ускоренный рост, ускоренная беременность, кормушка с автопроцессором) удалены как легаси.
 */
export const SceneStatsTab: React.FC<{
  /** Биопод, статистику которого смотрим (его же листают стрелки) */
  scene: Scene;
  /**
   * Жабы биопода — те, кто живёт в нём сейчас (`scene_id`); ушедшие в сектора
   * и в поход не в счёте (в походе они видны отдельной плашкой в списке жаб).
   */
  toads: Toad[];
  /** Стоит ли у сектора автокормушка: по ней понятно, кормят жаб или кормят руками */
  hasAutoFeeder: boolean;
  /** Включена ли купленная автокормушка (выключатель живёт в «Данных сектора») */
  autoFeederActive: boolean;
}> = ({ scene, toads, hasAutoFeeder, autoFeederActive }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [sceneName, setSceneName] = useState(scene.name || "");

  /**
   * Стрелки листают биоподы, не закрывая вкладку: чужое имя в поле ввода недопустимо,
   * а недописанное — тем более (имя сохраняется только кнопкой «Сохранить»).
   * Имя в зависимостях — на случай правки из другой вкладки: поле не должно остаться
   * со старым названием.
   */
  useEffect(() => {
    setSceneName(scene.name || "");
    setIsEditing(false);
  }, [scene.id, scene.name]);

  // Обработчик сохранения названия
  const handleSaveName = () => {
    const name = normalizeSceneName(sceneName);

    if (!name || name === scene.name) {
      setIsEditing(false);
      setSceneName(scene.name || "");
      return;
    }

    updateScene(scene.id, { name });

    setIsEditing(false);
  };

  // Обработчик отмены редактирования
  const handleCancelEdit = () => {
    setIsEditing(false);
    setSceneName(scene.name || "");
  };

  // Обработчик нажатия Enter / Escape
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveName();
      return;
    }

    if (e.key === "Escape") {
      // Esc в правке имени отменяет её, а не закрывает окно (см. ModalProvider).
      e.preventDefault();
      handleCancelEdit();
    }
  };

  // Статистика по жабам биопода
  const toadStats = {
    total: toads.length,
    free: Math.max(0, scene.capacity - toads.length),
    male: toads.filter((t) => t.stage === "adult" && t.sex === "male").length,
    female: toads.filter((t) => t.stage === "adult" && t.sex === "female")
      .length,
    neuter: toads.filter((t) => t.stage === "adult" && t.sex === "neuter")
      .length,
    toadpole: toads.filter((t) => t.stage === "toadpole").length,
    pregnant: toads.filter((t) => t.pregnancy?.isPregnant).length,
  };

  /** Среднее по любой числовой характеристике; пустой биопод показывает прочерк */
  const averageOf = (getValue: (toad: Toad) => number) =>
    toads.length > 0
      ? (
          toads.reduce((sum, toad) => sum + getValue(toad), 0) / toads.length
        ).toFixed(1)
      : "—";

  // Полный набор генетики: качество, размер, скорость, плодовитость, аппетит и поломка
  const averageStats = {
    rarity: averageOf((toad) => toad.genes.rarity),
    weight: averageOf((toad) => toad.genes.weight),
    speed: averageOf((toad) => toad.genes.speed),
    fertility: averageOf((toad) => toad.genes.fertility),
    hungerRate: averageOf((toad) => toad.genes.hungerRate),
    geneticFault: averageOf((toad) => toad.state.genetic_fault ?? 0),
  };

  /** Средняя поломка красится по тем же порогам, что и в карточке жабы */
  const averageFault = getGeneticFaultConfig(
    Number(averageStats.geneticFault) || 0,
  );

  const averageItems = [
    {
      label: "Качество",
      value: averageStats.rarity,
      color: "text-purple-300",
      accent: "bg-purple-400",
    },
    {
      label: "Размер",
      value: averageStats.weight,
      color: "text-sky-300",
      accent: "bg-sky-400",
    },
    {
      label: "Скорость",
      value: averageStats.speed,
      color: "text-emerald-300",
      accent: "bg-emerald-400",
    },
    {
      label: "Плодовитость",
      value: averageStats.fertility,
      suffix: "×",
      color: "text-lime-300",
      accent: "bg-lime-400",
    },
    {
      label: "Аппетит",
      value: averageStats.hungerRate,
      suffix: "×",
      color: "text-amber-300",
      accent: "bg-amber-400",
    },
    {
      label: "Поломка",
      value: averageStats.geneticFault,
      suffix: "%",
      color: averageFault.color,
      accent: "bg-rose-400",
    },
  ];

  const occupancy =
    scene.capacity > 0
      ? Math.min(100, Math.round((toads.length / scene.capacity) * 100))
      : 0;

  return (
    <div className="mb-6 space-y-4 px-1">
      {/* Название биопода: правится прямо здесь, сохранение — кнопкой галочки */}
      <HudPanel className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <svg
            className="h-3.5 w-3.5 shrink-0 text-emerald-400"
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
          {isEditing ? (
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <input
                type="text"
                value={sceneName}
                onChange={(e) => setSceneName(e.target.value)}
                onKeyDown={handleKeyPress}
                maxLength={SCENE_NAME_MAX_LENGTH}
                className="min-w-0 flex-1 border border-emerald-500/60 bg-slate-950/50 px-2 py-1 text-sm text-emerald-50 placeholder:text-slate-600 focus:border-emerald-300 focus:outline-none"
                placeholder="Введите название биопода"
                autoFocus
              />
              <div className="flex gap-1">
                <button
                  onClick={handleSaveName}
                  className="flex h-7 w-7 items-center justify-center border border-emerald-500/50 text-emerald-300 transition-colors hover:border-emerald-300 hover:bg-emerald-500/10"
                  title="Сохранить"
                >
                  <svg
                    className="h-4 w-4"
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
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="flex h-7 w-7 items-center justify-center border border-rose-500/50 text-rose-300 transition-colors hover:border-rose-300 hover:bg-rose-500/10"
                  title="Отмена"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="min-w-0 flex-1">
                <div className="text-3xs uppercase tracking-[0.16em] text-slate-500">
                  Название биопода
                </div>
                <div className="truncate text-sm font-medium text-slate-100">
                  {scene.name || "Без названия"}
                </div>
              </div>
              <button
                onClick={() => setIsEditing(true)}
                className="flex h-7 w-7 shrink-0 items-center justify-center border border-slate-600/70 text-slate-400 transition-colors hover:border-emerald-400/60 hover:bg-emerald-400/10 hover:text-emerald-300"
                title="Редактировать название"
              >
                {InfoIcons.pencil}
              </button>
            </>
          )}
        </div>
      </HudPanel>

      {/* Население жаб: возраст, пол и беременность — вместимость биопода из шапки */}
      <section>
        <SectionTitle aside={`${toads.length}/${scene.capacity}`}>
          Население жаб
        </SectionTitle>
        <DataGrid>
          <DataCell
            label="Мест в биоподе"
            value={`${toads.length}/${scene.capacity}`}
            color="text-emerald-300"
            className="col-span-2 sm:col-span-3"
          >
            <div className="mt-2 h-1 w-full overflow-hidden bg-slate-950/50">
              <div
                className="h-full bg-emerald-400/80 transition-[width] duration-500"
                style={{ width: `${occupancy}%` }}
              />
            </div>
          </DataCell>
          <DataCell
            label="Самцы"
            value={toadStats.male}
            color="text-blue-300"
          />
          <DataCell
            label="Самки"
            value={toadStats.female}
            color="text-pink-300"
          />
          <DataCell
            label="Бесполые"
            value={toadStats.neuter}
            color="text-slate-300"
          />
          <DataCell
            label="Головастики"
            value={toadStats.toadpole}
            color="text-emerald-300"
          />
          <DataCell
            label="Беременные"
            value={toadStats.pregnant}
            color="text-pink-300"
          />
          <DataCell
            label="Свободно"
            value={toadStats.free}
            color="text-slate-400"
          />
        </DataGrid>
      </section>

      {/* Средние характеристики: весь набор генетики, а не только три базовых */}
      <section>
        <SectionTitle aside="AVG">Средние характеристики</SectionTitle>
        <DataGrid>
          {averageItems.map((item) => (
            <DataCell
              key={item.label}
              label={item.label}
              value={item.value}
              suffix={item.suffix}
              color={item.color}
              accent={item.accent}
            />
          ))}
        </DataGrid>
        {toads.length === 0 && (
          <p className="mt-2 text-3xs uppercase tracking-[0.12em] text-slate-600">
            Нет жаб — средние значения появятся после заселения
          </p>
        )}
      </section>

      {/* Улучшения сектора — во вкладке «Данные сектора»: их ставит сама модалка биопода */}
      <HudPanel
        tone={autoFeederActive ? "lime" : "amber"}
        className="p-3 text-2xs leading-snug"
      >
        <span className="mb-1 block text-3xs font-semibold uppercase tracking-[0.16em] opacity-70">
          Автокормушка
        </span>
        <p>
          {autoFeederActive
            ? `Автокормушка установлена: жабы биопода кормятся со склада сами, как только сытость падает до ${PRODUCTION_MIN_HUNGER} %.`
            : hasAutoFeeder
              ? "Автокормушка установлена, но выключена: жабы кормятся вручную (🍎 на карточке), иначе они работают вполсилы. Включить её можно во вкладке «Данные сектора» этой модалки."
              : "Автокормушки нет: жаб кормят вручную (🍎 на карточке), иначе они работают вполсилы. Улучшение «Автокормушка» ставится на сектор — во вкладке «Данные сектора» этой модалки."}
        </p>
      </HudPanel>
    </div>
  );
};

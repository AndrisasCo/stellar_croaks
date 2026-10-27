import { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { PregnancyIcon } from "../../assets/icons";
import {
  getGeneticFaultConfig,
  getPersonalityLabel,
  getRarityConfig,
  Toad,
} from "../../models/Toad";
import { getToadDisease, isToadSick } from "../../models/disease";
import {
  getToadHp,
  getToadHpStatusLabel,
  getToadMaxHp,
} from "../../utils/expedition-config";
import {
  getToadEnergy,
  PRODUCTION_HUNGRY_FACTOR,
  PRODUCTION_MIN_HUNGER,
} from "../../utils/gamification-config";
import {
  getHungerBarColor,
  getHungerTextColor,
} from "../../utils/hunger";
import { getToadSexLabel, getToadStageLabel } from "../../utils/toad-picker";
import { DiseaseBar } from "./DiseaseBar";
import {
  GridNodes,
  HUD_TONES,
  HudTone,
  useHudTone,
} from "./DataGrid";
import { ToadAvatar } from "./ToadAvatar";
import { ToadGender } from "./ToadGender";
import { ToadLocationBadge } from "./ToadLocationBadge";

/**
 * Общая карточка жабы для списков секторов: ядро, биопод, энергосектор, Медотсек,
 * репродуктор. Места отличаются только набором характеристик и своими действиями,
 * поэтому вид строки живёт здесь, а не в каждой модалке отдельно.
 *
 * Каркас один: аватар, имя с полом и стадией, редкость, место/статус жабы. Место
 * живёт плашкой в правом верхнем углу, а действия, привязанные к показателям
 * («Покормить» у сытости, «✚» у HP), — в строках самих показателей: там игрок и решает,
 * кормить жабу или нести её в Медотсек. Ниже — то, что нужно
 * конкретному сектору: `variant="full"` добавляет генетику (ядро, биопод, репродуктор),
 * `brief` оставляет имя, редкость, HP и болезнь (Медотсек). Сытость включают там,
 * где она решает дело — в энергосекторе и рабочих списках.
 *
 * Клик по карточке открывает карточку жабы (`onOpen`), но клики по кнопкам действий,
 * названию болезни и её подсказке карточку не открывают: у них своя работа.
 *
 * Строка — часть HUD-языка интерфейса: узлы по углам, верхняя скан-линия и левый
 * маркер состояния (цвет зависит от `tone`, у выбранной жабы — жёлтый). Разметка
 * лежит под контентом и не перехватывает клики, поэтому общий вид списков совпадает
 * в колонии, Медотсеке и торговом терминале.
 */

/** Где жаба находится — плашка в правом верхнем углу (сектор, биопод, поход) */
export interface ToadListPlace {
  icon: string;
  label: string;
  hint?: string;
  className?: string;
}

/** Состояние жабы в конкретном секторе: даёт ток, на койке, ухаживает */
export interface ToadListStatus {
  icon: string;
  label: string;
  className?: string;
}

/** Цвет рамки: состояние жабы в секторе важнее обычной рамки списка */
export type ToadListTone = "default" | "success" | "warn" | "danger";

export interface ToadListCardProps {
  toad: Toad;
  /** Открыть карточку жабы поверх текущей модалки */
  onOpen?: () => void;
  /** Кнопки сектора: «В биопод», «Прервать» и т.п. — в правом верхнем углу */
  actions?: ReactNode;
  /** Кнопка рядом с сытостью: «Покормить» в списках жаб */
  hungerAction?: ReactNode;
  /** Кнопка рядом с HP: «Отправить в Медотсек» в списках жаб */
  healthAction?: ReactNode;
  /** `full` — с генетикой, `brief` — только имя, редкость, HP и болезнь */
  variant?: "brief" | "full";
  /** Сытость: важна в энергосекторе и рабочих секторах */
  showHunger?: boolean;
  /** Полоса HP и подпись состояния здоровья */
  showHp?: boolean;
  /** Силы жабы ⚡ (репродуктор, рабочие секторы) */
  showEnergy?: boolean;
  /** Болезнь: по умолчанию компактная плашка, `bar` — полоса с таймером */
  diseaseStyle?: "off" | "chip" | "bar";
  /** Жаба лечится на койке: срок болезни ускорен, соседей не заражает */
  diseaseInHospital?: boolean;
  /** Где жаба сейчас: сектор колонии, биопод или поход */
  place?: ToadListPlace;
  /** Состояние в секторе: даёт ток / в походе / на койке / ухаживает */
  status?: ToadListStatus;
  /** Жаба выбрана (компактный режим биопода) */
  selected?: boolean;
  /** Цвет родственной группы в биоподе */
  familyColor?: string;
  /** Цвет рамки: например, зелёный у жабы, которая даёт ток */
  tone?: ToadListTone;
  /** id для прокрутки к выбранной жабе */
  id?: string | number;
  avatarSize?: number;
  /** Дополнительные строки сектора: прогноз лечения, причина отказа */
  children?: ReactNode;
  className?: string;
}

/** Строка-показатель: подпись, полоска и значение */
const ToadMeter = ({
  label,
  value,
  max,
  barClassName,
  valueClassName,
  title,
}: {
  label: string;
  value: number;
  max: number;
  barClassName: string;
  valueClassName?: string;
  title?: string;
}) => {
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;

  return (
    <div className="flex items-center gap-2" title={title}>
      <span className="w-20 shrink-0 font-mono text-3xs uppercase tracking-[0.08em] text-slate-400">
        {label}
      </span>
      <div className="h-1.5 flex-1 overflow-hidden bg-slate-800/80">
        <div
          className={`h-full transition-all duration-500 ${barClassName}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      <span
        className={`w-12 shrink-0 text-right font-mono text-2xs tabular-nums ${
          valueClassName ?? "text-slate-300"
        }`}
      >
        {Math.round(value)}/{Math.round(max)}
      </span>
    </div>
  );
};

const TONE_CLASS: Record<ToadListTone, string> = {
  default: "border-slate-600/30",
  success: "border-emerald-500/40",
  warn: "border-amber-500/40",
  danger: "border-rose-500/40",
};

/** Состояние строки задаёт и акцент HUD: узлы, верхнюю линию и левый маркер. */
const TONE_HUD: Record<ToadListTone, HudTone> = {
  default: "cyan",
  success: "emerald",
  warn: "amber",
  danger: "rose",
};

export const ToadListCard = ({
  toad,
  onOpen,
  actions,
  hungerAction,
  healthAction,
  variant = "brief",
  showHunger = false,
  showHp = true,
  showEnergy = false,
  diseaseStyle = "chip",
  diseaseInHospital = false,
  place,
  status,
  selected = false,
  familyColor,
  tone = "default",
  id,
  avatarSize = 9,
  children,
  className = "",
}: ToadListCardProps) => {
  const rarity = getRarityConfig(toad.genes.rarity);
  const fault = getGeneticFaultConfig(toad.state?.genetic_fault);
  const disease = isToadSick(toad) ? getToadDisease(toad) : null;
  const hp = getToadHp(toad);
  const maxHp = getToadMaxHp(toad);
  const hunger = Math.max(0, Math.min(100, toad.state?.hunger ?? 0));
  const energy = Math.round(getToadEnergy(toad));
  const showGenetics = variant === "full";
  const hpRatio = maxHp > 0 ? hp / maxHp : 0;

  /** Клик по кнопке действия или подсказке болезни не должен открывать карточку */
  const handleCardClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!onOpen) {
      return;
    }

    if (
      (event.target as HTMLElement).closest(
        "button, a, input, select, textarea, [data-toad-card-stop]",
      )
    ) {
      return;
    }

    onOpen();
  };

  const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onOpen || event.target !== event.currentTarget) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  };

  const hungerColor = getHungerBarColor(hunger);
  const hungerText = getHungerTextColor(hunger);
  const inheritedTone = useHudTone();
  const hud =
    HUD_TONES[tone === "default" ? inheritedTone : TONE_HUD[tone]];
  const accentTone = selected ? "bg-yellow-300" : hud.node;

  return (
    <div
      id={id?.toString()}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      className={`group relative flex flex-col gap-2 overflow-hidden border p-2.5 text-left transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-cyan-300 ${
        selected
          ? "border-yellow-400/60 bg-yellow-500/10 shadow-sm shadow-yellow-500/20"
          : onOpen
            ? `${TONE_CLASS[tone]} bg-slate-950/50 hover:border-emerald-300/40`
            : `${TONE_CLASS[tone]} bg-slate-950/50`
      } ${onOpen ? "cursor-pointer" : ""} ${className}`}
      style={
        familyColor
          ? { backgroundColor: familyColor, backgroundImage: "none" }
          : undefined
      }
    >
      {/* Терминальная разметка строки: узлы по углам и верхняя скан-линия.
          Левый маркер не дублируем: он спорил с 1px-рамкой и делал левый
          край визуально толще правого. Слой не перехватывает клики. */}
      <GridNodes tone={accentTone} />
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${
          selected ? "from-yellow-300/70" : hud.gradient
        } to-transparent`}
      />
      <span
        aria-hidden="true"
        className="hud-card-scan pointer-events-none absolute inset-0 opacity-40"
      />

      {/* Верхняя строка: кто это, где и в каком состоянии */}
      <div className="flex items-start gap-2.5">
        <div className="relative shrink-0">
          <ToadAvatar toad={toad} size={avatarSize} />
          {toad.pregnancy?.isPregnant && (
            <span
              className="absolute -bottom-1 -left-1 rounded-none border border-pink-400/30 bg-slate-950 p-0.5 text-xs text-pink-400"
              title="Беременна"
            >
              <PregnancyIcon />
            </span>
          )}
          {disease && (
            <span
              className="absolute -left-1 -top-1 rounded-none border border-slate-600/50 bg-slate-950 p-0.5 text-xs"
              title={`${disease.name}: выработка биомассы снижена`}
            >
              {disease.icon}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <ToadGender gender={toad.sex} />
            <span className="truncate text-sm font-semibold text-white">
              {toad.name ?? "Безымянная"}
            </span>
            {toad.stage !== "adult" && (
              <span
                className="shrink-0 text-2xs text-blue-300"
                title="Головастик"
              >
                🐟
              </span>
            )}
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-2xs text-slate-400">
            <span>
              {getToadSexLabel(toad.sex)} ·{" "}
              {getToadStageLabel(toad.stage, toad.sex)}
            </span>

            {status && (
              <span
                className={`inline-flex items-center gap-1 ${
                  status.className ?? "text-slate-300"
                }`}
              >
                <span>{status.icon}</span>
                <span>{status.label}</span>
              </span>
            )}

            {showEnergy && (
              <span className="inline-flex items-center gap-1 text-lime-300">
                ⚡ {energy}
              </span>
            )}

            {disease && diseaseStyle === "chip" && (
              <span
                className="ui-chip border-orange-400/20 bg-orange-500/10 px-1.5 py-0.5 text-orange-200"
                title={`${disease.name}: ${disease.description}`}
              >
                {disease.icon} {disease.name}
              </span>
            )}
          </div>
        </div>

        {/* Правый угол: где жаба сейчас (плашка места) и кнопки без привязки к сытости */}
        <div className="flex max-w-[9rem] shrink-0 flex-col items-end gap-1">
          {place && (
            <ToadLocationBadge
              icon={place.icon}
              label={place.label}
              title={place.hint}
              className={place.className ?? "text-slate-400"}
              textClassName="text-2xs"
            />
          )}

          {actions && (
            <div
              className="flex items-center gap-1"
              data-toad-card-stop
              onClick={(event) => event.stopPropagation()}
            >
              {actions}
            </div>
          )}
        </div>
      </div>

      {/* Подробный вид: генетика, по которой жаб сравнивают в ядре и биоподе */}
      {showGenetics && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-2xs text-slate-400 sm:grid-cols-3">
          <span className={rarity.color}>
            Качество: {rarity.icon} {toad.genes.rarity.toFixed(1)}
          </span>
          <span className={fault.color}>
            Поломка: {fault.icon} {toad.state?.genetic_fault ?? 0}%
          </span>
          <span>Поколение {toad.generation}</span>
          <span>Вес {toad.genes.weight.toFixed(1)}</span>
          <span>Скорость {toad.genes.speed.toFixed(1)}</span>
          <span>Аппетит {toad.genes.hungerRate.toFixed(1)}</span>
          <span>Плодовитость {toad.genes.fertility.toFixed(1)}</span>
          <span className="truncate" title="Характер">
            Характер: {getPersonalityLabel(toad.genes.personality)}
          </span>
        </div>
      )}

      {/* Болезнь полосой: прогресс, остаток срока и ускорение на койке */}
      {disease && diseaseStyle === "bar" && (
        <DiseaseBar toad={toad} inHospital={diseaseInHospital} />
      )}

      {/* HP: в Медотсеке — главный показатель, в остальных списках — состояние жабы.
          Кнопка «✚» стоит рядом с HP: туда жабу и несут, когда здоровье просело */}
      {showHp && (
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <ToadMeter
              label="❤️ HP"
              value={hp}
              max={maxHp}
              barClassName={
                hpRatio <= 0
                  ? "bg-red-600"
                  : hpRatio < 0.35
                    ? "bg-red-500"
                    : hpRatio < 0.7
                      ? "bg-yellow-500"
                      : "bg-green-500"
              }
              valueClassName={hpRatio < 0.7 ? "text-rose-200" : "text-slate-300"}
              title={`Здоровье: ${getToadHpStatusLabel(toad)}`}
            />
          </div>

          {healthAction && (
            <div
              className="shrink-0"
              data-toad-card-stop
              onClick={(event) => event.stopPropagation()}
            >
              {healthAction}
            </div>
          )}
        </div>
      )}

      {/* Сытость: в энергосекторе по ней решают, даёт ли жаба ток. Кнопка кормления
          стоит здесь же — рядом с показателем, который она меняет */}
      {showHunger && (
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <ToadMeter
              label="🍽 Сытость"
              value={hunger}
              max={100}
              barClassName={hungerColor}
              valueClassName={hungerText}
              title={
                hunger <= PRODUCTION_MIN_HUNGER
                  ? `Голодный минимум: ниже ${PRODUCTION_MIN_HUNGER}% жаба вырабатывает лишь ${Math.round(
                      PRODUCTION_HUNGRY_FACTOR * 100,
                    )}% биомассы`
                  : "Сытость умножает выработку биомассы и даёт ток в энергосекторе"
              }
            />
          </div>

          {hungerAction && (
            <div
              className="shrink-0"
              data-toad-card-stop
              onClick={(event) => event.stopPropagation()}
            >
              {hungerAction}
            </div>
          )}
        </div>
      )}

      {children}
    </div>
  );
};

export default ToadListCard;

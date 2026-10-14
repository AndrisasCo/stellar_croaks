import { Toad } from "../../models/Toad";
import { EXPEDITION_TEAM_SIZE } from "../../utils/expedition-config";
import { NEST_ROOM_TOAD_SLOTS } from "../../utils/gamification-config";
import { HOSPITAL_ROOM_TOAD_SLOTS } from "../../utils/hospital";
import { canBuildOnSlot, getPowerGrid, isRoomPowered } from "./colony-build";
import { POWER_ROOM_TOAD_SLOTS, PowerGrid } from "./colony-power";
import { RoomConfig } from "./rooms-config";

/**
 * Правила переноса жабы в другой сектор (удержание жабы на карте).
 *
 * Логика чистая: жабы, вместимость биопода и состояние тока приходят аргументами,
 * поэтому правила проверяются без Pixi. Возвращаем не только «можно/нельзя», но и
 * причину — её показывают в уведомлении, когда жаба летит обратно на место.
 */

export interface ToadMoveContext {
  /** Жабы, уже живущие в целевом секторе (перемещаемая сюда не входит). */
  roomToads: Toad[];
  /** Сколько жаб уже живёт в биоподе (перемещаемая сюда не входит). */
  aviaryCount: number;
  /** Вместимость биопода текущего биопода (жаб по сцене). */
  aviaryCapacity: number;
  /** Все секторы карты — нужны, чтобы понять, застраиваемый ли это пустой гекс. */
  rooms: RoomConfig[];
  powerGrid: PowerGrid;
}

export interface ToadMoveCheck {
  ok: boolean;
  /** Почему перенести нельзя — текст для уведомления. */
  reason?: string;
}

/** Чем жаба не годится для переноса (null — годится). */
export const getToadMoveIssue = (
  toad: Toad,
  options?: {
    /** Лазарет принимает и выбитых: туда жабу как раз и несут. */
    allowDown?: boolean;
  },
): string | null => {
  if (toad.status === "out") {
    return "Жаба в походе: сначала дождитесь её возвращения в биопод.";
  }

  if ((toad.hp ?? 1) <= 0 && !options?.allowDown) {
    return "Жаба выбита из строя — сначала подлечите её.";
  }

  // Пара в репродукторе на ухаживании: жабу не уносят из репродуктора, пока идёт таймер
  if (toad.mating) {
    return "Жаба ухаживает в репродукторе — дождитесь беременности или прервите ухаживание в модалке «Репродуктор».";
  }

  return null;
};

/**
 * Можно ли перенести жабу в этот сектор.
 *
 * Сектор принимает жабу, только если у неё есть и место, и «возможность»:
 *  - биопод — пока в нём есть свободные места (по вместимости биопода);
 *  - энергосектор ⚡ — только взрослые жабы и максимум 6: внешнее питание секторе не нужно,
 *    ток ей дают сами жабы;
 *  - «Разведка» (сектор похода) — взрослые жабы в пределах состава команды (5): в ней
 *    собирают команду, а ушедшие в поход жабы освобождают место (`roomId` сбрасывается)
 *    и прячутся с карты (см. `isToadVisibleInRoom`);
 *  - репродуктор — до двух взрослых жаб: пара живёт там с ухаживания до родов, пока
 *    игрок не перенесёт её (плюс головастики, рождённые в репродукторе, — они мест не занимают);
 *  - лазарет — до шести жаб на койках (HOSPITAL_ROOM_TOAD_SLOTS): туда кладут раненых
 *    и больных, и там они выздоравливают в разы быстрее. Выбитую жабу в лазарет несут
 *    как раз для лечения, поэтому правило «сначала подлечите» на него не действует
 *    (`allowDown`), а вот ток в секторе нужен — как и всем постройкам;
 *  - прочие рабочие секторы (коллайдер, инкубатор, диссоциатор, склад, магазин) —
 *    оборудование и товар, жабам тут делать нечего;
 *  - ядро и пустые гексы жаб не принимают вовсе.
 */
export const canMoveToadToRoom = (
  toad: Toad,
  room: RoomConfig,
  context: ToadMoveContext,
): ToadMoveCheck => {
  const issue = getToadMoveIssue(toad, { allowDown: room.kind === "hospital" });

  if (issue) {
    return { ok: false, reason: issue };
  }

  if (room.kind !== "power" && !isRoomPowered(room, context.powerGrid)) {
    return {
      ok: false,
      reason: "В секторе нет электричества",
    };
  }

  switch (room.kind) {
    case "power": {
      if (toad.stage !== "adult") {
        return {
          ok: false,
          reason: "В энергосекторе могут работать только взрослые жабы",
        };
      }

      if (context.roomToads.length >= POWER_ROOM_TOAD_SLOTS) {
        return {
          ok: false,
          reason: `В энергосекторе заняты все ${POWER_ROOM_TOAD_SLOTS} мест.`,
        };
      }

      return { ok: true };
    }

    case "aviary": {
      if (context.aviaryCount >= context.aviaryCapacity) {
        return {
          ok: false,
          reason: `В био-поде нет свободных мест (${context.aviaryCount}/${context.aviaryCapacity}).`,
        };
      }

      return { ok: true };
    }

    case "breeding": {
      // Репродуктор вмещает пару взрослых жаб: туда садят и самца, и самку — ухаживание
      // запускает кнопка «Начать ухаживание» в модалке репродуктора. Головастики,
      // рождённые в репродукторе, мест не занимают: они переполняют репродуктор, пока игрок
      // не перенесёт их в биопод.
      if (toad.stage !== "adult") {
        return {
          ok: false,
          reason: "В репродукторе сидят только взрослые жабы: головастику там нечего делать.",
        };
      }

      const adultsInside = context.roomToads.filter(
        (item) => item.stage === "adult"
      ).length;

      if (adultsInside >= NEST_ROOM_TOAD_SLOTS) {
        return {
          ok: false,
          reason: `В репродукторе нет свободных мест (${adultsInside}/${NEST_ROOM_TOAD_SLOTS}).`,
        };
      }

      return { ok: true };
    }

    case "scout": {
      if (toad.stage !== "adult") {
        return {
          ok: false,
          reason: "В разведку могут попасть только взрослые жабы",
        };
      }

      if (context.roomToads.length >= EXPEDITION_TEAM_SIZE) {
        return {
          ok: false,
          reason: `В «Разведке» заняты все ${EXPEDITION_TEAM_SIZE} мест команды.`,
        };
      }

      return { ok: true };
    }

    // Лазарет — койки для раненых и больных: до шести жаб, туда кладут и выбитых
    case "hospital": {
      if (context.roomToads.length >= HOSPITAL_ROOM_TOAD_SLOTS) {
        return {
          ok: false,
          reason: `В лазарете заняты все ${HOSPITAL_ROOM_TOAD_SLOTS} коек.`,
        };
      }

      return { ok: true };
    }

    // Рабочие секторы колонии: оборудование и товар — жабам здесь жить негде
    case "collider":
    case "incubator":
    case "dissociator":
    case "storage":
    case "shop": {
      return {
        ok: false,
        reason: `«${room.title}» — рабочий сектор: жабам здесь жить негде.`,
      };
    }

    case "core":
      return {
        ok: false,
        reason: "Ядро — сердце колонии, жабам здесь не место.",
      };

    default: {
      // Свободный гекс: здесь ещё ничего не построено, а жабе нужна сектор
      if (canBuildOnSlot(room, context.rooms)) {
        return {
          ok: false,
          reason: "Сначала постройте сектор на этом гексе.",
        };
      }

      return {
        ok: false,
        reason: "Этот гекс вне колонии: жаб переносят только между секторами.",
      };
    }
  }
};

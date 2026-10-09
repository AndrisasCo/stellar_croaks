import { Toad } from "../../models/Toad";
import { canBuildOnSlot } from "./colony-build";
import { POWER_ROOM_TOAD_SLOTS } from "./colony-power";
import { RoomConfig } from "./rooms-config";

/**
 * Правила переноса жабы в другую комнату (удержание жабы на карте).
 *
 * Логика чистая: жабы, вместимость вольера и состояние тока приходят аргументами,
 * поэтому правила проверяются без Pixi. Возвращаем не только «можно/нельзя», но и
 * причину — её показывают в уведомлении, когда жаба летит обратно на место.
 */

export interface ToadMoveContext {
  /** Жабы, уже живущие в целевой комнате (перемещаемая сюда не входит). */
  roomToads: Toad[];
  /** Есть ли ток в целевой комнате (энергокомнате без тока не нужны работники). */
  roomPowered: boolean;
  /** Сколько жаб уже живёт в вольере (перемещаемая сюда не входит). */
  aviaryCount: number;
  /** Вместимость вольера текущего вольера (жаб по сцене). */
  aviaryCapacity: number;
  /** Все комнаты карты — нужны, чтобы понять, застраиваемый ли это пустой гекс. */
  rooms: RoomConfig[];
}

export interface ToadMoveCheck {
  ok: boolean;
  /** Почему перенести нельзя — текст для уведомления. */
  reason?: string;
}

/** Чем жаба не годится для переноса (null — годится). */
export const getToadMoveIssue = (toad: Toad): string | null => {
  if (toad.status === "out") {
    return "Жаба в походе: сначала дождитесь её возвращения в вольер.";
  }

  if ((toad.hp ?? 1) <= 0) {
    return "Жаба выбита из строя — сначала подлечите её.";
  }

  return null;
};

/**
 * Можно ли перенести жабу в эту комнату.
 *
 * Комната принимает жабу, только если у неё есть и место, и «возможность»:
 *  - вольер — пока в нём есть свободные места (по вместимости вольера);
 *  - энергокомната ⚡ — только под током, только взрослых жаб и максимум 6;
 *  - гнездо — беременные жабы и так живут в нём, отдельного правила нет;
 *  - рабочие комнаты (коллайдер, инкубатор, диссоциатор, склад, магазин, разведка,
 *    лазарет) — оборудование и товар, жабам тут делать нечего;
 *  - ядро и пустые гексы жаб не принимают вовсе.
 */
export const canMoveToadToRoom = (
  toad: Toad,
  room: RoomConfig,
  context: ToadMoveContext,
): ToadMoveCheck => {
  const issue = getToadMoveIssue(toad);

  if (issue) {
    return { ok: false, reason: issue };
  }

  switch (room.kind) {
    case "power": {
      if (toad.stage !== "adult") {
        return {
          ok: false,
          reason:
            "В энергокомнате работают только взрослые жабы: головастик ток не даёт.",
        };
      }

      if (context.roomToads.length >= POWER_ROOM_TOAD_SLOTS) {
        return {
          ok: false,
          reason: `В энергокомнате заняты все ${POWER_ROOM_TOAD_SLOTS} мест.`,
        };
      }

      return { ok: true };
    }

    case "aviary": {
      if (context.aviaryCount >= context.aviaryCapacity) {
        return {
          ok: false,
          reason: `В вольере нет свободных мест (${context.aviaryCount}/${context.aviaryCapacity}).`,
        };
      }

      return { ok: true };
    }

    case "breeding": {
      if (context.roomToads.length >= 2) {
        return {
          ok: false,
          reason: `В вольере нет свободных мест (2/2).`,
        };
      }

      return { ok: true };
    }

    // Рабочие комнаты колонии: оборудование и товар — жабам здесь жить негде
    case "collider":
    case "incubator":
    case "dissociator":
    case "storage":
    case "shop":
    case "scout":
    case "hospital": {
      return {
        ok: false,
        reason: `«${room.title}» — рабочая комната: жабам здесь жить негде.`,
      };
    }

    case "core":
      return {
        ok: false,
        reason: "Ядро — сердце колонии, жабам здесь не место.",
      };

    default: {
      // Свободный гекс: здесь ещё ничего не построено, а жабе нужна комната
      if (canBuildOnSlot(room, context.rooms)) {
        return {
          ok: false,
          reason: "Сначала постройте комнату на этом гексе.",
        };
      }

      return {
        ok: false,
        reason: "Этот гекс вне колонии: жаб переносят только между комнатами.",
      };
    }
  }
};

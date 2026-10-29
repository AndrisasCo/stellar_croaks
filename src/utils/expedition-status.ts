import { getGameState } from "../backend/localStorage";
import { Expedition } from "../models/expedition";
import { Toad } from "../models/Toad";

/**
 * Чистое чтение статуса походов: кто в пути, из какого контура ушла команда и занята ли
 * жаба походом.
 *
 * Вынесено из `expedition-manager.ts`, чтобы карта колонии (`colony-power.ts`,
 * `rooms-config.ts`) могла проверять занятость жаб без импорта менеджера походов: тот
 * тянет за собой склад (`storage.ts`), а складу нужна энергосеть карты — получался цикл
 * модулей. Здесь только чтение состояния, никаких действий и побочных эффектов.
 */

export const getExpeditions = (): Expedition[] =>
  getGameState().expeditions ?? [];

/**
 * Поход ещё в работе. Завершённый (`completed`) поход ждёт разбора добычи на вкладке
 * «Походы»: команда уже дома, но жабы ещё заняты и новую команду не ограничивают.
 */
export const isExpeditionActive = (expedition: Expedition): boolean =>
  expedition.phase !== "completed";

/** Активные походы: только они считаются лимитом «Диспетчерской» */
export const getActiveExpeditions = (): Expedition[] =>
  getExpeditions().filter(isExpeditionActive);

export const getExpeditionById = (id: string): Expedition | undefined =>
  getExpeditions().find((expedition) => expedition.id === id);

/**
 * Поход ушёл из этой «Разведки»?
 *
 * Сравниваем id гекса, канонический id постройки и старый числовой `Scene.id`:
 * разные сейвы помнят контур по-разному. Сводка «Все походы» использует это, чтобы
 * открыть модалку именно того контура, из которого ушла команда.
 */
export const isExpeditionFromRoom = (
  expedition: Expedition,
  room: { id: string; slotId?: string; sceneId?: number | null },
): boolean => {
  const origin = expedition.originRoomId;

  if (origin == null) {
    return false;
  }

  return (
    origin === room.id || origin === room.slotId || origin === room.sceneId
  );
};

/**
 * Походы, которые показывает первая вкладка контура.
 *
 * Только свои: `originRoomId` должен совпасть с id гекса, id постройки или старым
 * числовым `Scene.id`. Походы без контура привязывает миграция в `localStorage.ts`,
 * иначе один и тот же поход показывался бы во всех «Разведках» и блокировал отправку
 * второй команды из чужого контура.
 */
export const getRoomExpeditions = (
  expeditions: Expedition[],
  room:
    | { id: string; slotId?: string; sceneId?: number | null }
    | null
    | undefined,
): Expedition[] =>
  room == null
    ? []
    : expeditions.filter((expedition) =>
        isExpeditionFromRoom(expedition, room),
      );

/** Поход, в котором участвует жаба (или undefined) */
export const getToadExpedition = (
  toadId: number,
  expeditions: Expedition[] = getExpeditions(),
): Expedition | undefined =>
  expeditions.find((expedition) =>
    expedition.team.some((member) => member.toadId === toadId),
  );

/** Жаба сейчас в походе */
export const isToadOnExpedition = (
  toadId: number,
  expeditions: Expedition[] = getExpeditions(),
): boolean => Boolean(getToadExpedition(toadId, expeditions));

/**
 * Жаба занята походом: она либо ещё в пути (`status: "out"`), либо уже вернулась,
 * но команда ждёт разбора добычи (статус снят, а запись похода ещё держит её в команде).
 * Для всех действий «вне похода» проверяем именно это, а не только статус.
 */
export const isToadBusyOnExpedition = (
  toad: Pick<Toad, "id" | "status">,
  expeditions: Expedition[] = getExpeditions(),
): boolean =>
  toad.status === "out" || isToadOnExpedition(toad.id, expeditions);

/**
 * Жаба вернулась из похода, но добыча ещё не разобрана.
 *
 * Такую жабу карта уже рисует в слоте её КОНТУРа (см. `isToadVisibleInRoom`),
 * и она гуляет там как обычная жаба сектора — отдельной «анимации встречи» нет.
 * Действия, меняющие место жабы («Домой», перенос, разбор), по-прежнему запрещены
 * до `finishExpedition`.
 */
export const isToadReturnedFromExpedition = (
  toad: Pick<Toad, "id" | "status">,
  expeditions: Expedition[] = getExpeditions(),
): boolean =>
  toad.status !== "out" &&
  expeditions.some(
    (expedition) =>
      expedition.phase === "completed" &&
      expedition.team.some((member) => member.toadId === toad.id),
  );

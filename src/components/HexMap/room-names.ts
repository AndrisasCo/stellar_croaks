import { ColonyRoomKind } from "../../models/colony";
import { getBuiltRoomKind, ROOM_BLUEPRINTS, RoomConfig } from "./rooms-config";

/**
 * Имена секторов колонии: «Репродуктор #1», «Репродуктор #2», «Биопод #3».
 *
 * Одного вида сектора в колонии может стоять несколько штук — репродукторов, биоподов,
 * складов, — и без номера игроку их не различить: «посадите жабу в репродуктор» ничего не
 * говорит, если репродукторов два. Поэтому у вида, который строится много раз,
 * имя — это название вида плюс номер экземпляра, а у единственного сектора (коллайдер,
 * магазин, диссоциатор) номера нет: второй такой в колонии не появится, и «Коллайдер #1»
 * только путал бы. У ядра номера тоже нет — оно одно с начала игры.
 *
 * Номер считается по текущему составу колонии: базовые гексы занимают первые номера
 * (`rooms-config.ts` → `BASE_ROOMS`), постройки игрока — следующие по порядку возведения.
 * Снос номер освобождает — так же, как и цену следующего сектора того же вида
 * (`colony-build.ts` → `getRoomCost`): колония живёт настоящим, а не историей. Постоянное имя
 * есть только у биопода — это `Scene.name`, его игрок задаёт сам (список жаб биопода).
 *
 * Имена расставляет карта (`colony-build.ts` → `resolveColonyRooms`), поэтому все, кто
 * работает с гексами карты, видят один и тот же `RoomConfig.name`.
 */

/** Название вида сектора без номера: «Репродуктор», «Склад». */
export const getRoomKindTitle = (kind: ColonyRoomKind): string =>
  ROOM_BLUEPRINTS[kind].title;

/** Сектор строится в единственном экземпляре: второй такой в колонии не появится. */
export const isUniqueRoomKind = (kind: ColonyRoomKind): boolean =>
  ROOM_BLUEPRINTS[kind].unique;

/**
 * Имя сектора: название вида плюс номер экземпляра — «Репродуктор #2».
 * Единственные секторы номера не носят: «Коллайдер».
 */
export const formatRoomName = (kind: ColonyRoomKind, instance: number): string =>
  isUniqueRoomKind(kind)
    ? getRoomKindTitle(kind)
    : `${getRoomKindTitle(kind)} #${instance}`;

/** Сколько секторов этого вида стоит в колонии прямо сейчас. */
export const countRoomsOfKind = (
  rooms: RoomConfig[],
  kind: ColonyRoomKind,
): number => rooms.filter((room) => room.kind === kind).length;

/**
 * Имя, которое получит следующая постройка этого вида: «Репродуктор #3».
 *
 * Считается по карте (`resolveColonyRooms`), поэтому сходится с тем, что покажет сама
 * постройка: новая сектор встаёт в конец списка своего вида, а номер — это их число плюс один.
 */
export const getNextRoomName = (
  rooms: RoomConfig[],
  kind: ColonyRoomKind,
): string => formatRoomName(kind, countRoomsOfKind(rooms, kind) + 1);

/**
 * Расставляет имена секторам карты: каждому гексу — своё `RoomConfig.name`.
 *
 * Номера — это очередь постройки, а не расположение гекса: базовые секторы идут первыми
 * (ядро, биопод, репродуктор — `rooms-config.ts` → `BASE_ROOMS`), а за ними постройки игрока
 * в порядке возведения. Так номер у уже стоящего сектора не меняется, когда игрок строит
 * такой же ближе к ядру, — только новая сектор получает следующий номер. Порядок карты
 * задаёт `colony.rooms` (`colony-build.ts` → `resolveColonyRooms`), а без него берётся
 * порядок самих гексов. Пустые слоты и ядро остаются со своим именем: у слотов оно пустое,
 * у ядра — «Ядро» (второго ядра не построить).
 */
export const withRoomNames = (
  rooms: RoomConfig[],
  builtOrder: string[] = rooms.map((room) => room.id),
): RoomConfig[] => {
  const rank = new Map(builtOrder.map((id, index) => [id, index]));
  const instances: Partial<Record<ColonyRoomKind, number>> = {};
  const names = new Map<string, string>();

  [...rooms]
    // Базовых секторов в `colony.rooms` нет — они получают номера впереди построек
    .sort((a, b) => (rank.get(a.id) ?? -1) - (rank.get(b.id) ?? -1))
    .forEach((room) => {
      const kind = getBuiltRoomKind(room);

      // Ядро и пустые слоты — не секторы каталога: номер им не от кого считать
      if (!kind) {
        return;
      }

      const instance = (instances[kind] ?? 0) + 1;
      instances[kind] = instance;
      names.set(room.id, formatRoomName(kind, instance));
    });

  return rooms.map((room) => {
    const name = names.get(room.id);

    return name === undefined ? room : { ...room, name };
  });
};

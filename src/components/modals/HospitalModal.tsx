import Modal from "../shared/Header";
import ModalTabs, { ModalTabItem } from "../shared/ModalTabs";
import { ClickButton } from "../shared/ClickButton";
import { CurrencyIcon } from "../shared/CurrencyIcon";
import { ToadListCard } from "../shared/ToadListCard";
import { ToadSlotGrid } from "../shared/ToadSlotGrid";
import { useGameState } from "../../hooks/use-game-state";
import { useColony } from "../../hooks/use-colony";
import { useNotifications } from "../../hooks/use-notification";
import { useRoomPowerTab } from "../../hooks/use-room-power-tab";
import { useModal } from "../ModalContext";
import { useToads } from "../ToadContext";
import { Toad } from "../../models/Toad";
import { getDiseaseCureCost, getToadDisease } from "../../models/disease";
import { cureToadForTokens } from "../../utils/disease-manager";
import { healToad, isToadOnExpedition } from "../../utils/expedition-manager";
import { getHealCost, getToadHp, getToadMaxHp } from "../../utils/expedition-config";
import {
  HOSPITAL_ROOM_TOAD_SLOTS,
  getHospitalPatients,
  getHoursToFullHp,
  getToadsNeedingCare,
  isToadInHospital,
  needsHospitalCare,
} from "../../utils/hospital";
import {
  TOAD_PICKER_REJECTED_GROUP,
  splitToadPickerCandidates,
} from "../../utils/toad-picker";
import { canMoveToadToRoom, getToadMoveIssue } from "../HexMap/toad-move-rules";
import { RoomConfig } from "../HexMap/rooms-config";
import RoomDataTab, { ROOM_DATA_TAB } from "./RoomDataTab";
import { ToadInfo } from "./ToadInfoModal";
import { DataCell, DataGrid } from "../shared/DataGrid";

/**
 * Медотсек 🛏️ — сектор лечения, и модалка у него своя, а не вкладка «Разведки».
 *
 * Раньше Медотсек жил табом в модалке походов: клик по гексу Медотсека открывал «Разведку»
 * с выбранной вкладкой. Теперь у сектора свои табы (`shared/ModalTabs`):
 *
 *  - «Койки» — основной: кто лежит в этом Медотсеке и подсадка жаб на лечение общей
 *    сеткой слотов (`shared/ToadSlotGrid` знает те же правила переноса, что и карта);
 *  - «Пациенты» — все раненые и больные колонии: отсюда жабу быстро отправляют на койку
 *    (в любой Медотсек, где есть место) или лечат мгновенно за деньги;
 *  - «Данные сектора» — описание, статистика и улучшения сектора (`RoomDataTab`).
 *
 * Койка лечит +`HOSPITAL_HP_REGEN_PER_HOUR` HP в час и ускоряет срок болезни в
 * `HOSPITAL_DISEASE_SPEED` раза, а мгновенное лечение за Кваксы самое дорогое: это способ
 * пропустить ожидание.
 */
type HospitalTab = "beds" | "patients" | "room-data";

/** Табы Медотсека: лечение — первым, «Данные сектора» — последним (как у всех секторов) */
const HOSPITAL_TABS: ModalTabItem<HospitalTab>[] = [
  { id: "beds", label: "Медотсек" },
  { id: "patients", label: "Требуется внимание" },
  { ...ROOM_DATA_TAB },
];

interface HospitalModalProps {
  /** Гекс Медотсека, чью модалку открыли */
  room: RoomConfig;
}

export default function HospitalModal({ room }: HospitalModalProps) {
  const state = useGameState();
  const { rooms, powerGrid, toadsByRoom, placeToad, releaseToad } = useColony();
  const { addNotification } = useNotifications();
  const { openModal } = useModal();
  const { selectToad } = useToads();
  const {
    tab,
    setTab,
    issue: powerIssue,
  } = useRoomPowerTab<HospitalTab>({ room, powerGrid, defaultTab: "beds" });

  /** Обесточенный Медотсек: койки и пациенты закрыты, открыты только данные сектора */
  const hospitalTabs: ModalTabItem<HospitalTab>[] = HOSPITAL_TABS.map((tab) =>
    tab.id === "room-data"
      ? tab
      : {
          ...tab,
          disabled: Boolean(powerIssue),
          disabledHint: powerIssue ?? undefined,
        },
  );

  const expeditions = state.expeditions ?? [];
  const tokens = state.user.tokens || 0;
  const roomToads = toadsByRoom[room.id] ?? [];

  /** Все Медотсекы колонии: койки есть в каждом, а «быстро в Медотсек» ищет свободную */
  const hospitalRooms = rooms.filter((item) => item.kind === "hospital");
  const hospitalIds = hospitalRooms.map((item) => item.id);

  /** Жабы в походе: их не лечат и не переносят, пока команда не вернётся */
  const awayToads = state.toads.filter((toad) =>
    isToadOnExpedition(toad.id, expeditions),
  );
  const homeToads = state.toads.filter(
    (toad) => !isToadOnExpedition(toad.id, expeditions),
  );

  /** Кто лежит на койках колонии прямо сейчас (у модалки — свои, у «Пациентов» — все) */
  const patients = getHospitalPatients(homeToads, hospitalIds);

  /** Все раненые и больные дома: и на койке, и без неё */
  const needingCare = getToadsNeedingCare(homeToads);

  /** Сколько коек в колонии: в каждом Медотсеке по шесть */
  const hospitalCapacity = hospitalIds.length * HOSPITAL_ROOM_TOAD_SLOTS;
  const freeSlots = Math.max(0, HOSPITAL_ROOM_TOAD_SLOTS - roomToads.length);

  /** Койки Медотсека: жаба на койке или пустой слот с «+» — как в репродукторе */
  const bedSlots = Array.from(
    { length: HOSPITAL_ROOM_TOAD_SLOTS },
    (_, index) => ({
      toad: roomToads[index] ?? null,
      label: `Койка ${index + 1}`,
      icon: "🛏️",
    }),
  );

  /** Раненые и больные в походе: ими займёмся, когда команда вернётся */
  const awayWounded = awayToads.filter((toad) =>
    needsHospitalCare(toad),
  ).length;

  /** Правила переноса для этого гекса — те же, что у карты (`toad-move-rules`) */
  const moveContext = (toad: Toad) => ({
    roomToads: roomToads.filter((item) => item.id !== toad.id),
    // Переносим в Медотсек, а не в биопод: жильё тут не считается
    aviaryCount: 0,
    aviaryCapacity: 0,
    rooms,
    powerGrid,
    expeditions,
  });

  /**
   * Куда положить жабу: первый Медотсек, который её принимает.
   * Проверяем теми же правилами, что и перенос по карте (`canMoveToadToRoom`): место
   * на койке, ток в секторе, возраст, поход — чтобы кнопка не обещала лишнего.
   */
  const getAdmission = (
    toad: Toad,
  ): { room: RoomConfig | null; issue: string | null } => {
    if (hospitalRooms.length === 0) {
      return { room: null, issue: "в колонии нет Медотсека" };
    }

    let firstIssue: string | null = null;

    for (const hospital of hospitalRooms) {
      const check = canMoveToadToRoom(toad, hospital, {
        roomToads: (toadsByRoom[hospital.id] ?? []).filter(
          (item) => item.id !== toad.id,
        ),
        aviaryCount: 0,
        aviaryCapacity: 0,
        rooms,
        powerGrid,
        expeditions,
      });

      if (check.ok) {
        return { room: hospital, issue: null };
      }

      firstIssue = firstIssue ?? check.reason ?? null;
    }

    return { room: null, issue: firstIssue };
  };

  /**
   * Жабы для подсадки на койку: все жабы колонии, а кого койка не берёт — в списке
   * «Не подходят» с причиной отказа (место занято, жаба в походе, сектор без тока).
   * Сверху списка — те, кому помощь нужна прямо сейчас.
   */
  const candidates = splitToadPickerCandidates(
    homeToads
      // Пациенты этого Медотсека и так стоят списком выше
      .filter((toad) => toad.scene_id !== room.id)
      .map((toad) => {
        const check = canMoveToadToRoom(toad, room, moveContext(toad));

        return {
          toad,
          rank: needsHospitalCare(toad) ? 1 : 0,
          reason: check.ok
            ? null
            : (check.reason ?? "жабу нельзя поместить в Медотсек"),
        };
      }),
  );

  const notify = (result: { success: boolean; message: string }) =>
    addNotification({
      type: result.success ? "success" : "warn",
      content: result.message,
    });

  /**
   * Открыть карточку жабы поверх Медотсека: модалки складываются в стек, поэтому
   * «Закрыть» в карточке вернёт игрока к тому же списку пациентов и вкладке.
   */
  const openToadCard = (toad: Toad) => {
    selectToad(toad.id);
    openModal(() => <ToadInfo />);
  };

  const handleHeal = (toadId: number) => notify(healToad(toadId));

  /** Мгновенный курс от болезни за Кваксы — самый дорогой способ, зато сразу */
  const handleCure = (toadId: number) => notify(cureToadForTokens(toadId));

  /** Положить жабу на койку (место и ток проверила `canMoveToadToRoom`) */
  const handleAdmit = (toad: Toad, hospital: RoomConfig) => {
    const check = canMoveToadToRoom(toad, hospital, moveContext(toad));

    if (!check.ok) {
      addNotification({
        type: "warn",
        content: check.reason ?? `${toad.name} не помещается в Медотсек`,
      });
      return;
    }

    placeToad(toad.id, hospital.id);
  };

  /**
   * Выписать жабу из Медотсека домой — в её биопод (`homeId`).
   *
   * Жильё жаба не меняла (пока лежала на койке, места в биоподе она не занимала), но
   * свободного места там может уже не быть — тогда `releaseToad` отправит её в любой
   * свободный биопод под током.
   */
  const handleDischarge = (toad: Toad) => {
    const result = releaseToad(toad.id);

    if (!result.ok) {
      addNotification({
        type: "warn",
        content: "Свободных мест в биоподах нет",
        timeout: 9000,
      });
      return;
    }
  };

  /** Карточка жабы в списках Медотсека: кратко — имя, редкость, HP и болезнь. */
  const renderCareCard = (toad: Toad) => {
    const maxHp = getToadMaxHp(toad);
    const hp = getToadHp(toad);
    const missingHp = Math.max(0, maxHp - hp);
    const wounded = missingHp > 0;
    const disease = getToadDisease(toad);
    const healCost = getHealCost(toad);
    const cureCost = getDiseaseCureCost(toad);
    const inBed = isToadInHospital(toad, hospitalIds);
    const admission = inBed ? null : getAdmission(toad);
    // Выписывают в биопод по любым причинам, поэтому выбитого пациента тоже отпускаем:
    // правило «жаба выбита» здесь не мешает (allowDown) — это же Медотсек
    const dischargeIssue = inBed
      ? getToadMoveIssue(toad, { allowDown: true, expeditions })
      : null;
    const affordable = tokens >= healCost;
    const cureAffordable = tokens >= cureCost;
    /** Что обещает кнопка «быстро в Медотсек»: койка здесь, в другом секторе или отказ */
    const admitLabel = admission?.room
      ? admission.room.id === room.id
        ? "Поместить в медотсек"
        : `Поместить в медотсек: «${admission.room.name}»`
      : admission?.issue;

    return (
      <ToadListCard
        key={toad.id}
        toad={toad}
        onOpen={() => openToadCard(toad)}
        variant="brief"
        showHp
        diseaseStyle="bar"
        diseaseInHospital={inBed}
        status={
          inBed
            ? { icon: "🛏️", label: "на койке", className: "text-cyan-300" }
            : undefined
        }
      >
        {wounded && (
          <p className="text-2xs text-slate-400">
            До полного HP:{" "}
            {inBed
              ? `${getHoursToFullHp(missingHp, true)} ч на койке`
              : `дома ~${getHoursToFullHp(
                  missingHp,
                  false,
                )} ч · в Медотсеке ~${getHoursToFullHp(missingHp, true)} ч`}
          </p>
        )}

        {!wounded && !disease && (
          <p className="text-2xs text-slate-400">
            Полностью здоров - можно выписывать
          </p>
        )}

        {!wounded && disease && (
          <p className="text-2xs text-slate-400">
            Выздоравливает от "{disease.name}"
          </p>
        )}

        {wounded && (
          <ClickButton
            onClick={() => handleHeal(toad.id)}
            disabled={!affordable}
            className={`w-full py-2 rounded-none text-xs font-bold border transition-colors duration-300 ${
              affordable
                ? "bg-emerald-900/50 border-emerald-500/50 text-emerald-100 hover:bg-emerald-800/60"
                : "bg-slate-800/40 border-slate-700/40 text-slate-500"
            }`}
          >
            🩹 Мгновенно вылечить за {healCost}{" "}
            <CurrencyIcon currency="tokens" className="h-3 w-3" />
          </ClickButton>
        )}

        {disease && (
          <ClickButton
            onClick={() => handleCure(toad.id)}
            disabled={!cureAffordable}
            className={`w-full py-2 rounded-none text-xs font-bold border transition-colors duration-300 ${
              cureAffordable
                ? "bg-sky-900/50 border-sky-500/50 text-sky-100 hover:bg-sky-800/60"
                : "bg-slate-800/40 border-slate-700/40 text-slate-500"
            }`}
          >
            💊 Мгновенный курс от болезни за {cureCost}{" "}
            <CurrencyIcon currency="tokens" className="h-3 w-3" />
          </ClickButton>
        )}

        {!inBed && (
          <ClickButton
            onClick={() => admission?.room && handleAdmit(toad, admission.room)}
            disabled={!admission?.room}
            className={`w-full py-2 rounded-none text-xs font-bold border transition-colors duration-300 ${
              admission?.room
                ? "bg-amber-900/50 border-amber-500/50 text-amber-100 hover:bg-amber-800/60"
                : "bg-slate-800/40 border-slate-700/40 text-slate-500"
            }`}
          >
            {admitLabel}
          </ClickButton>
        )}

        {inBed && (
          <ClickButton
            onClick={() => handleDischarge(toad)}
            disabled={Boolean(dischargeIssue)}
            className={`w-full py-2 rounded-none text-xs font-bold border transition-colors duration-300 ${
              dischargeIssue
                ? "bg-slate-800/40 border-slate-700/40 text-slate-500"
                : "bg-slate-800/60 border-slate-500/50 text-slate-200 hover:bg-slate-700/70"
            }`}
          >
            {dischargeIssue
              ? `Выписать нельзя: ${dischargeIssue}`
              : "Вернуть в биопод"}
          </ClickButton>
        )}
      </ToadListCard>
    );
  };

  return (
    <Modal title={room.name} tone="sky">
      {/* Табы сразу под названием — общий каркас модалок секторов */}
      <ModalTabs tabs={hospitalTabs} active={tab} onChange={setTab} />

      <div className="flex flex-col gap-2 px-1">
        {/* ВКЛАДКА «Койки»: кто лежит в этом Медотсеке и подсадка жаб на лечение */}
        {tab === "beds" && (
          <>
            {/* Койки — та же сетка слотов, что у репродуктора и коллайдера */}
            <ToadSlotGrid
              slots={bedSlots}
              columns={6}
              title={`🛏️ В «${room.name}» (${roomToads.length}/${HOSPITAL_ROOM_TOAD_SLOTS})`}
              headerRight={`свободно мест: ${freeSlots}`}
              pickerFor={() => ({
                groups: [
                  {
                    label: `Можно взять (${candidates.available.length})`,
                    // Порядок строк уже задан: раненые и больные — сверху
                    items: candidates.available.map(({ toad, rank }) => ({
                      toad,
                      rank,
                      note: needsHospitalCare(toad)
                        ? `нужна помощь${
                            isToadInHospital(toad, hospitalIds)
                              ? " · лежит в другом Медотсеке"
                              : ""
                          }`
                        : "здорова — койка ускорит дела лишь косвенно",
                    })),
                  },
                ],
                rejected: {
                  label: TOAD_PICKER_REJECTED_GROUP,
                  items: candidates.rejected,
                },
                hint: "Сверху — жабы, которым нужна помощь. На койку берут взрослых жаб колонии, не в походе; за ток сектора отвечает энергосеть.",
                emptyText:
                  "Свободных жаб нет: остальные в походе или уже лежат в Медотсеке.",
              })}
              onPick={(toad) => handleAdmit(toad, room)}
              onOpen={(toad) => openToadCard(toad)}
              onRemove={(toad) => handleDischarge(toad)}
              removeLabel="Выписать в биопод"
            />

            {roomToads.map((toad) => renderCareCard(toad))}
          </>
        )}

        {/* ВКЛАДКА «Пациенты»: все раненые и больные колонии — на койку или за Кваксы */}
        {tab === "patients" && (
          <>
            <p className="text-2xs leading-snug text-slate-400">
              Все раненые и больные жабы колонии в одном списке: отсюда их
              быстро отправляют на койку (в любой Медотсек, где есть место) или
              лечат мгновенно за Кваксы — это самый дорогой способ, зато без
              ожидания. Нажмите на имя жабы, чтобы открыть её карточку.
            </p>

            {hospitalRooms.length === 0 && (
              <p className="rounded-none border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-2xs leading-snug text-amber-200/90">
                🏥 В колонии нет «Медотсека»: постройте этот сектор на свободном
                гексе — только на койке жабы выздоравливают быстро.
              </p>
            )}

            {awayWounded > 0 && (
              <p className="text-2xs text-slate-500">
                Ещё {awayWounded} жаб(ы) с ранами в походе: займёмся ими, когда
                команда вернётся домой.
              </p>
            )}

            {needingCare.length === 0 && (
              <p className="text-2xs text-slate-500">
                Все жабы в форме: ни ран, ни кибер-болезней.
              </p>
            )}

            {needingCare.map((toad) => renderCareCard(toad))}
          </>
        )}

        {/* ВКЛАДКА «Данные сектора»: описание, статистика, улучшения и снос */}
        {tab === "room-data" && (
          <RoomDataTab
            room={room}
            stats={
              <DataGrid columns={3}>
                <DataCell
                  dense
                  label="На этих койках"
                  value={`${roomToads.length}/${HOSPITAL_ROOM_TOAD_SLOTS}`}
                  color="text-white"
                />
                <DataCell
                  dense
                  label="Лежит в колонии"
                  value={`${patients.length}/${hospitalCapacity}`}
                  color="text-white"
                />
                <DataCell
                  dense
                  label="Нужна помощь"
                  value={needingCare.length}
                  color="text-amber-300"
                />
              </DataGrid>
            }
          />
        )}
      </div>
    </Modal>
  );
}

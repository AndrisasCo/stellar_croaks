import React, { useEffect, useMemo, useState } from "react";
import Modal from "../shared/Header";
import { ClickButton } from "../shared/ClickButton";
import { useNotifications } from "../../hooks/use-notification";
import { useGameState } from "../../hooks/use-game-state";
import { useColony } from "../../hooks/use-colony";
import { Toad } from "../../models/Toad";
import { getDiseaseCureCost, getToadDisease } from "../../models/disease";
import {
  DEFAULT_EXPEDITION_STATS,
  Expedition,
  ExpeditionMember,
  EXPEDITION_ROLE_ORDER,
  ExpeditionRole,
  getSectorById,
  isSectorUnlocked,
  SECTORS,
} from "../../models/expedition";
import {
  EXPEDITION_RETURN_RATIO,
  EXPEDITION_TEAM_SIZE,
  EXTRACTION_ASTRO_COST,
  ExpeditionTeamMember,
  getDispatchOfficeCost,
  getExpeditionProfitFloor,
  getExpeditionSendCost,
  getExpeditionSuccessChance,
  getHealCost,
  getRolePower,
  getRoleStat,
  getSectorSuccessFactor,
  getSpeedUpReturnCost,
  getToadHp,
  getToadHpStatusLabel,
  getToadMaxHp,
  HP_REGEN_PER_HOUR,
  ROLE_CONFIG,
} from "../../utils/expedition-config";
import {
  buyDispatchOffice,
  canSendToad,
  extractExpedition,
  getExpeditionEtaMs,
  getExpeditionLootSummary,
  getExpeditionProgress,
  getExpeditionTeamStatus,
  getReturnProgress,
  healToad,
  isToadOnExpedition,
  processExpeditions,
  speedUpReturn,
  startExpedition,
  withdrawExpedition,
} from "../../utils/expedition-manager";
import { getMaxExpeditions } from "../../utils/expedition-config";
import { cureToadForTokens } from "../../utils/disease-manager";
import {
  HOSPITAL_DISEASE_SPEED,
  HOSPITAL_HP_REGEN_PER_HOUR,
  HOSPITAL_ROOM_TOAD_SLOTS,
  getHospitalPatients,
  getHoursToFullHp,
  getToadsNeedingCare,
  isToadInHospital,
  needsHospitalCare,
} from "../../utils/hospital";
import { RoomConfig } from "../HexMap/rooms-config";
import { canMoveToadToRoom, getToadMoveIssue } from "../HexMap/toad-move-rules";

/** Часы/минуты/секунды до события похода */
const formatDuration = (ms: number): string => {
  if (ms <= 0) {
    return "вот-вот";
  }
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}ч ${minutes}м`;
  }
  if (minutes > 0) {
    return `${minutes}м ${seconds}с`;
  }
  return `${seconds}с`;
};

/** Время реплики в чате похода */
const formatClock = (at: number): string =>
  new Date(at).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });

const HpBar: React.FC<{ hp: number; maxHp: number; className?: string }> = ({
  hp,
  maxHp,
  className,
}) => {
  const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
  const color =
    ratio <= 0
      ? "bg-red-600"
      : ratio < 0.35
      ? "bg-red-500"
      : ratio < 0.7
      ? "bg-yellow-500"
      : "bg-green-500";

  return (
    <div
      className={`h-1.5 w-full bg-gray-700 rounded-full overflow-hidden ${
        className || ""
      }`}
    >
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  );
};

const LogList: React.FC<{ expedition: Expedition }> = ({ expedition }) => {
  const entries = [...expedition.log].reverse().slice(0, 12);

  if (entries.length === 0) {
    return (
      <p className="text-2xs text-gray-400 italic">
        Тишина в эфире: команда ещё не вышла на связь.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1 max-h-40 overflow-y-auto pr-1">
      {entries.map((entry) => {
        const role = entry.role === "system" ? null : ROLE_CONFIG[entry.role];
        const color =
          entry.kind === "good"
            ? "text-green-300"
            : entry.kind === "bad"
            ? "text-red-300"
            : "text-gray-300";

        return (
          <p key={entry.id} className={`text-2xs leading-snug ${color}`}>
            <span className="text-gray-500">{formatClock(entry.at)} </span>
            <span className="font-semibold">
              {role ? `${role.icon} ${entry.toadName ?? role.label}` : "📡 Связь"}:{" "}
            </span>
            {entry.text}
            {typeof entry.hpDelta === "number" && entry.hpDelta !== 0 && (
              <span className={entry.hpDelta < 0 ? "text-red-400" : "text-green-400"}>
                {" "}
                ({entry.hpDelta > 0 ? `+${entry.hpDelta}` : entry.hpDelta} HP)
              </span>
            )}
          </p>
        );
      })}
    </div>
  );
};

const TeamStatusList: React.FC<{ expedition: Expedition }> = ({
  expedition,
}) => (
  <div className="flex flex-col gap-1.5">
    {getExpeditionTeamStatus(expedition).map(({ member, toad, hp, maxHp, down }) => (
      <div key={member.toadId} className="flex items-center gap-2">
        <span className="text-sm w-5 text-center">
          {ROLE_CONFIG[member.role].icon}
        </span>
        <div className="flex-1">
          <div className="flex items-center justify-between text-2xs">
            <span className={down ? "text-red-400" : "text-gray-200"}>
              {toad?.name ?? `Жаба #${member.toadId}`}
              {down && " — выбита"}
            </span>
            <span className="text-gray-400">
              {hp}/{maxHp} HP
            </span>
          </div>
          <HpBar hp={hp} maxHp={maxHp} className="mt-0.5" />
        </div>
      </div>
    ))}
  </div>
);

type ExpeditionTab = "runs" | "send" | "infirmary";

/** Пустые слоты команды (роль → id жабы) */
const emptySlots = (): Record<ExpeditionRole, number | ""> => ({
  scout: "",
  tank: "",
  medic: "",
  hacker: "",
  negotiator: "",
});

const ExpeditionModal: React.FC<{
  onClose?: () => void;
  /** Вкладка, с которой открывается модалка: комната «Лазарет» открывает свою вкладку. */
  initialTab?: ExpeditionTab;
}> = ({ initialTab = "runs" }) => {
  const { addNotification } = useNotifications();
  const state = useGameState();
  const [, setTick] = useState(0);

  const [tab, setTab] = useState<ExpeditionTab>(initialTab);
  const [sectorId, setSectorId] = useState<number>(SECTORS[0].id);
  const [slots, setSlots] =
    useState<Record<ExpeditionRole, number | "">>(emptySlots());

  // Походы живут по реальному времени — обновляем отсчёты раз в секунду
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Открыли модалку — «догоняем» события походов, пока игрок был в меню.
  // Зависимостей нет: синк нужен один раз при открытии (тик раз в секунду дальше).
  useEffect(() => {
    processExpeditions(addNotification);
  }, []);

  const expeditions = state.expeditions ?? [];
  const stats = {
    ...DEFAULT_EXPEDITION_STATS,
    ...(state.expeditionStats ?? {}),
  };
  const dispatchLevel = state.user.dispatchLevel ?? 0;
  const teamLimit = getMaxExpeditions(dispatchLevel);
  const dispatchCost = getDispatchOfficeCost(dispatchLevel);

  const selectedSector =
    SECTORS.find((item) => item.id === sectorId) ?? SECTORS[0];

  const availableToads = useMemo(
    () => state.toads.filter((toad) => canSendToad(toad, expeditions).ok),
    [state.toads, expeditions]
  );

  const members: ExpeditionMember[] = EXPEDITION_ROLE_ORDER.filter(
    (role) => slots[role] !== ""
  ).map((role) => ({ toadId: slots[role] as number, role }));

  const sendCost = getExpeditionSendCost(selectedSector, members.length);
  const biomass = state.user.biomass || 0;
  const tokens = state.user.tokens || 0;
  const astro = state.user.astro_quax || 0;
  const canSend =
    members.length > 0 &&
    biomass >= sendCost &&
    expeditions.length < teamLimit;

  // Лазарет: койки комнаты и два списка — кто лежит и кому ещё нужна помощь.
  // Комнаты и жаб по комнатам берём из колонии теми же вычислениями, что и карта.
  const { rooms, powerGrid, toadsByRoom, placeToad, releaseToad } = useColony();

  const hospitalRooms = useMemo(
    () => rooms.filter((room) => room.kind === "hospital"),
    [rooms]
  );
  const hospitalIds = useMemo(
    () => hospitalRooms.map((room) => room.id),
    [hospitalRooms]
  );

  /** Жабы в походе: их не лечат и не переносят, пока команда не вернётся */
  const awayToads = useMemo(
    () => state.toads.filter((toad) => isToadOnExpedition(toad.id, expeditions)),
    [state.toads, expeditions]
  );
  const homeToads = useMemo(
    () => state.toads.filter((toad) => !isToadOnExpedition(toad.id, expeditions)),
    [state.toads, expeditions]
  );

  /** Первый список лазарета: жабы, которые лежат на койках прямо сейчас */
  const patients = getHospitalPatients(homeToads, hospitalIds);

  /** Второй список: все раненые и больные дома, кого ещё не положили в лазарет */
  const needingCare = getToadsNeedingCare(homeToads).filter(
    (toad) => !isToadInHospital(toad, hospitalIds)
  );

  /** Сколько коек в колонии: в каждом лазарете по шесть */
  const hospitalCapacity = hospitalIds.length * HOSPITAL_ROOM_TOAD_SLOTS;

  /** Раненые и больные в походе: ими займёмся, когда команда вернётся */
  const awayWounded = awayToads.filter((toad) => needsHospitalCare(toad)).length;

  /**
   * Куда положить жабу из списка «нужна помощь»: первый лазарет, который её принимает.
   * Проверяем теми же правилами, что и перенос по карте (`canMoveToadToRoom`): место
   * на койке, ток в комнате, возраст, поход — чтобы кнопка не обещала лишнего.
   */
  const getAdmission = (
    toad: Toad
  ): { room: RoomConfig | null; issue: string | null } => {
    if (hospitalRooms.length === 0) {
      return { room: null, issue: "в колонии нет лазарета" };
    }

    let firstIssue: string | null = null;

    for (const room of hospitalRooms) {
      const check = canMoveToadToRoom(toad, room, {
        roomToads: (toadsByRoom[room.id] ?? []).filter(
          (item) => item.id !== toad.id
        ),
        // Переносим в лазарет, а не в вольер: жильё тут не считается
        aviaryCount: 0,
        aviaryCapacity: 0,
        rooms,
        powerGrid,
      });

      if (check.ok) {
        return { room, issue: null };
      }

      firstIssue = firstIssue ?? check.reason ?? null;
    }

    return { room: null, issue: firstIssue };
  };

  /** Команда с самими жабами: по ней считаем шанс удачного завершения */
  const team: ExpeditionTeamMember[] = members
    .map((member) => {
      const toad = state.toads.find((item) => item.id === member.toadId);
      return toad ? { role: member.role, toad } : null;
    })
    .filter((member): member is ExpeditionTeamMember => member !== null);

  /**
   * Шанс вернуться с удачей: каждая занятая роль даёт +20% от своей силы,
   * глубина сектора режет вклад, удача гуляет ±10%.
   */
  const successChance = getExpeditionSuccessChance(team, selectedSector);
  const sectorSuccessFactor = getSectorSuccessFactor(selectedSector);
  /** Поход всегда выгоднее фермы: норма добычи за путь туда-обратно + снаряжение */
  const awayHours =
    selectedSector.durationHours * (1 + EXPEDITION_RETURN_RATIO);
  const profitNorm = getExpeditionProfitFloor(
    team.map((member) => member.toad),
    awayHours,
    sendCost
  );

  const notify = (result: { success: boolean; message: string }) =>
    addNotification({
      type: result.success ? "success" : "warn",
      content: result.message,
    });

  const handleSend = () => {
    const result = startExpedition(sectorId, members);
    notify(result);
    if (result.success) {
      setSlots(emptySlots());
      setTab("runs");
    }
  };

  const handleWithdraw = (id: string) => notify(withdrawExpedition(id));
  const handleSpeedUp = (id: string) => notify(speedUpReturn(id));
  const handleExtract = (id: string) =>
    notify(extractExpedition(id, addNotification));
  const handleHeal = (toadId: number) => notify(healToad(toadId));
  const handleBuyDispatch = () => notify(buyDispatchOffice());

  /** Мгновенный курс от болезни за Кваксы — самый дорогой способ, зато сразу */
  const handleCure = (toadId: number) => notify(cureToadForTokens(toadId));

  /** Положить жабу на койку лазарета (место и ток проверила `getAdmission`) */
  const handleAdmit = (toad: Toad, room: RoomConfig) => {
    placeToad(toad.id, room.id);
    addNotification({
      type: "success",
      content: `${toad.name} на койке в «Лазарете» — здесь жабы поправляются быстро 🛏️`,
    });
  };

  /**
   * Выписать жабу из лазарета в вольер. Жильё при этом не меняется (жаба остаётся
   * в своём вольере), поэтому проверяем только «жива и не в походе».
   */
  const handleDischarge = (toad: Toad) => {
    releaseToad(toad.id);
    addNotification({
      type: "success",
      content: `${toad.name} выписана из лазарета в вольер`,
    });
  };

  /** Карточка жабы в списках лазарета: HP, болезнь, прогноз и кнопки помощи */
  const renderCareCard = (toad: Toad, options: { inBed: boolean }) => {
    const maxHp = getToadMaxHp(toad);
    const hp = getToadHp(toad);
    const missingHp = Math.max(0, maxHp - hp);
    const wounded = missingHp > 0;
    const disease = getToadDisease(toad);
    const healCost = getHealCost(toad);
    const cureCost = getDiseaseCureCost(toad);
    const inBed = options.inBed;
    const admission = inBed ? null : getAdmission(toad);
    // Выписывают в вольер по любым причинам, поэтому выбитого пациента тоже отпускаем:
    // правило «сначала подлечите» здесь не мешает (allowDown) — это же лазарет
    const dischargeIssue = inBed
      ? getToadMoveIssue(toad, { allowDown: true })
      : null;
    const affordable = tokens >= healCost;
    const cureAffordable = tokens >= cureCost;

    return (
      <div
        key={toad.id}
        className="bg-color-main rounded-2xl p-3 border border-gray-600/30 flex flex-col gap-1.5"
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-white">
            {toad.name}{" "}
            <span className="text-2xs font-normal text-gray-400">
              · {getToadHpStatusLabel(toad)}
              {disease && ` · ${disease.icon} ${disease.name}`}
              {inBed && " · на койке"}
            </span>
          </p>
          <span className="text-2xs text-gray-300">
            {Math.round(hp)}/{maxHp} HP
          </span>
        </div>

        <HpBar hp={hp} maxHp={maxHp} />

        {wounded && (
          <p className="text-2xs text-gray-400">
            До полного HP:{" "}
            {inBed
              ? `${getHoursToFullHp(missingHp, true)} ч на койке`
              : `дома ~${getHoursToFullHp(
                  missingHp,
                  false
                )} ч · в лазарете ~${getHoursToFullHp(missingHp, true)} ч`}
          </p>
        )}

        {!wounded && disease && (
          <p className="text-2xs text-gray-400">
            Раны зажили — осталась болезнь: на койке срок идёт в{" "}
            {HOSPITAL_DISEASE_SPEED} раза быстрее, а пациент никого не заражает.
          </p>
        )}

        {wounded && (
          <ClickButton
            onClick={() => handleHeal(toad.id)}
            disabled={!affordable}
            className={`w-full py-2 rounded-xl text-2xs font-bold border transition-colors duration-300 ${
              affordable
                ? "bg-emerald-900/50 border-emerald-500/50 text-emerald-100 hover:bg-emerald-800/60"
                : "bg-slate-800/40 border-gray-700/40 text-gray-500"
            }`}
          >
            🩹 Мгновенно вылечить за {healCost} 🔷
          </ClickButton>
        )}

        {disease && (
          <ClickButton
            onClick={() => handleCure(toad.id)}
            disabled={!cureAffordable}
            className={`w-full py-2 rounded-xl text-2xs font-bold border transition-colors duration-300 ${
              cureAffordable
                ? "bg-sky-900/50 border-sky-500/50 text-sky-100 hover:bg-sky-800/60"
                : "bg-slate-800/40 border-gray-700/40 text-gray-500"
            }`}
          >
            💊 Мгновенный курс от болезни за {cureCost} 🔷
          </ClickButton>
        )}

        {!inBed && (
          <ClickButton
            onClick={() => admission?.room && handleAdmit(toad, admission.room)}
            disabled={!admission?.room}
            className={`w-full py-2 rounded-xl text-2xs font-bold border transition-colors duration-300 ${
              admission?.room
                ? "bg-amber-900/50 border-amber-500/50 text-amber-100 hover:bg-amber-800/60"
                : "bg-slate-800/40 border-gray-700/40 text-gray-500"
            }`}
          >
            {admission?.room
              ? "🛏️ Положить в лазарет"
              : `🛏️ В лазарет нельзя: ${admission?.issue ?? "некуда"}`}
          </ClickButton>
        )}

        {inBed && (
          <ClickButton
            onClick={() => handleDischarge(toad)}
            disabled={Boolean(dischargeIssue)}
            className={`w-full py-2 rounded-xl text-2xs font-bold border transition-colors duration-300 ${
              dischargeIssue
                ? "bg-slate-800/40 border-gray-700/40 text-gray-500"
                : "bg-slate-800/60 border-gray-500/50 text-gray-200 hover:bg-slate-700/70"
            }`}
          >
            {dischargeIssue
              ? `🚪 Выписать нельзя: ${dischargeIssue}`
              : "🚪 Выписать в вольер"}
          </ClickButton>
        )}
      </div>
    );
  };

  /** Одна жаба — одна роль: занимая слот, освобождаем её из других */
  const setSlot = (role: ExpeditionRole, toadId: number | "") => {
    setSlots((prev) => {
      const next = { ...prev };
      if (toadId !== "") {
        EXPEDITION_ROLE_ORDER.forEach((item) => {
          if (next[item] === toadId) {
            next[item] = "";
          }
        });
      }
      next[role] = toadId;
      return next;
    });
  };

  return (
    <Modal title="Разведка Периметра" icon={<span className="text-xl">🧭</span>}>
      <div className="flex flex-col gap-3 px-1">
        {/* Сводка по разведке */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-color-main rounded-xl py-2 px-1 border border-gray-600/30">
            <p className="text-2xs text-gray-400">Походов завершено</p>
            <p className="text-base font-bold text-white">{stats.completed}</p>
          </div>
          <div className="bg-color-main rounded-xl py-2 px-1 border border-gray-600/30">
            <p className="text-2xs text-gray-400">Лучшая глубина</p>
            <p className="text-base font-bold text-white">{stats.bestDepth}</p>
          </div>
          <div className="bg-color-main rounded-xl py-2 px-1 border border-gray-600/30">
            <p className="text-2xs text-gray-400">Команды</p>
            <p className="text-base font-bold text-white">
              {expeditions.length}/{teamLimit}
            </p>
          </div>
        </div>

        {/* Переключение вкладок */}
        <div className="grid grid-cols-3 gap-1.5">
          {(
            [
              {
                id: "runs",
                label: `🚁 Походы${
                  expeditions.length ? ` (${expeditions.length})` : ""
                }`,
              },
              { id: "send", label: "🎯 Новый поход" },
              {
                id: "infirmary",
                label: `🩹 Лазарет${
                  hospitalCapacity ? ` (${patients.length}/${hospitalCapacity})` : ""
                }`,
              },
            ] as { id: ExpeditionTab; label: string }[]
          ).map((item) => (
            <ClickButton
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`py-2 rounded-xl text-2xs font-bold border transition-colors duration-300 ${
                tab === item.id
                  ? "bg-amber-800/60 border-amber-400/70 text-amber-100"
                  : "bg-slate-800/50 border-gray-600/40 text-gray-300 hover:bg-slate-700/60"
              }`}
            >
              {item.label}
            </ClickButton>
          ))}
        </div>

        {/* ВКЛАДКА: активные походы */}
        {tab === "runs" && (
          <div className="flex flex-col gap-3">
            {expeditions.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-3">
                Никто не в походе. Соберите команду из жаб и отправьте её за
                Периметр — добыча и образцы того стоят.
              </p>
            )}

            {expeditions.map((expedition) => {
              const sectorDef = getSectorById(expedition.sectorId);
              const returning = expedition.phase === "returning";
              const progress = returning
                ? getReturnProgress(expedition)
                : getExpeditionProgress(expedition);
              const eta = getExpeditionEtaMs(expedition);
              const speedUpCost = getSpeedUpReturnCost(expedition);

              return (
                <div
                  key={expedition.id}
                  className="bg-color-main rounded-2xl p-3 border border-gray-600/30 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-white">
                        {sectorDef.icon} {sectorDef.name}
                      </p>
                      <p className="text-2xs text-gray-400">
                        глубина {sectorDef.depth} • команда из{" "}
                        {expedition.team.length} жаб
                        {expedition.forced && (
                          <span className="text-red-400"> • выбиты</span>
                        )}
                      </p>
                    </div>
                    <span
                      className={`text-2xs font-bold px-2 py-1 rounded-lg ${
                        returning
                          ? "bg-blue-900/50 text-blue-200"
                          : "bg-amber-900/50 text-amber-200"
                      }`}
                    >
                      {returning ? "🏠 возврат" : "🧭 в пути"}
                    </span>
                  </div>

                  <div>
                    <div className="flex justify-between text-2xs text-gray-400 mb-1">
                      <span>
                        {returning
                          ? "Путь домой"
                          : `Прогресс ${Math.round(progress * 100)}%`}
                      </span>
                      <span>
                        {returning ? "домой через " : "сектор через "}
                        {formatDuration(eta)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          returning ? "bg-blue-400" : "bg-amber-400"
                        }`}
                        style={{ width: `${progress * 100}%` }}
                      />
                    </div>
                  </div>

                  <TeamStatusList expedition={expedition} />

                  <p className="text-2xs text-gray-300">
                    🎒 В рюкзаке: {getExpeditionLootSummary(expedition)}
                  </p>

                  <LogList expedition={expedition} />

                  <div className="flex flex-wrap gap-1.5">
                    {!returning && (
                      <ClickButton
                        onClick={() => handleWithdraw(expedition.id)}
                        className="flex-1 py-2 rounded-xl bg-slate-800/60 hover:bg-slate-700/70 text-gray-200 text-2xs font-bold border border-gray-600/40"
                      >
                        ⏪ Отозвать
                      </ClickButton>
                    )}
                    {returning && speedUpCost > 0 && (
                      <ClickButton
                        onClick={() => handleSpeedUp(expedition.id)}
                        className="flex-1 py-2 rounded-xl bg-emerald-900/50 hover:bg-emerald-800/60 text-emerald-100 text-2xs font-bold border border-emerald-500/40"
                      >
                        ⚡ Ускорить ({speedUpCost} 🧪)
                      </ClickButton>
                    )}
                    <ClickButton
                      onClick={() => handleExtract(expedition.id)}
                      className="flex-1 py-2 rounded-xl bg-cyan-900/50 hover:bg-cyan-800/60 text-cyan-100 text-2xs font-bold border border-cyan-500/40"
                    >
                      🚁 Маяк ({EXTRACTION_ASTRO_COST} 💎 / есть {astro})
                    </ClickButton>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ВКЛАДКА: отправка новой команды */}
        {tab === "send" && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              {SECTORS.map((item) => {
                const unlocked = isSectorUnlocked(item, stats);
                const selected = item.id === sectorId;

                return (
                  <ClickButton
                    key={item.id}
                    disabled={!unlocked}
                    onClick={() => setSectorId(item.id)}
                    className={`w-full text-left rounded-xl p-2 border transition-colors duration-300 ${
                      !unlocked
                        ? "bg-slate-900/40 border-gray-700/40 text-gray-500"
                        : selected
                        ? "bg-amber-900/50 border-amber-400/70 text-amber-50"
                        : "bg-slate-800/50 border-gray-600/40 text-gray-200 hover:bg-slate-700/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold">
                          {item.icon} {item.name}
                          {!unlocked && (
                            <span className="text-2xs font-normal">
                              {" "}
                              🔒 {stats.completed}/{item.unlockExpeditions}{" "}
                              походов
                            </span>
                          )}
                        </p>
                        <p className="text-2xs text-gray-400">
                          {item.description}
                        </p>
                      </div>
                      <div className="text-2xs text-right shrink-0">
                        <p>🕒 {item.durationHours} ч туда</p>
                        <p>🎒 добыча ×{item.lootMultiplier}</p>
                        <p>💥 риск ×{item.dangerMultiplier}</p>
                      </div>
                    </div>
                  </ClickButton>
                );
              })}
            </div>

            {/* Слоты ролей команды */}
            <div className="bg-color-main rounded-2xl p-3 border border-gray-600/30 flex flex-col gap-2">
              <p className="text-xs font-bold text-white">
                👥 Команда: {members.length}/{EXPEDITION_TEAM_SIZE}
              </p>

              {EXPEDITION_ROLE_ORDER.map((role) => {
                const config = ROLE_CONFIG[role];
                const pickedId = slots[role];
                const picked =
                  pickedId === ""
                    ? undefined
                    : availableToads.find((toad) => toad.id === pickedId);

                return (
                  <div
                    key={role}
                    className="flex flex-col gap-1 pb-2 border-b border-gray-700/40 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-2xs font-bold text-gray-100">
                        {config.icon} {config.label}
                      </p>
                      <p className="text-2xs text-gray-400 text-right">
                        {config.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={pickedId}
                        onChange={(event) =>
                          setSlot(
                            role,
                            event.target.value === ""
                              ? ""
                              : Number(event.target.value)
                          )
                        }
                        className="flex-1 bg-slate-800/70 text-gray-100 text-2xs rounded-lg px-2 py-1 border border-gray-600/40"
                      >
                        <option value="">— пусто —</option>
                        {availableToads.map((toad) => (
                          <option key={toad.id} value={toad.id}>
                            {toad.name} · {getRoleStat(toad, role).toFixed(2)}{" "}
                            {config.statLabel} · {getToadHpStatusLabel(toad)}
                          </option>
                        ))}
                      </select>
                      <span className="text-2xs font-bold text-amber-200 w-10 text-right">
                        {picked ? `${Math.round(getRolePower(picked, role) * 100)}%` : "—"}
                      </span>
                    </div>

                    {picked && (
                      <HpBar hp={getToadHp(picked)} maxHp={getToadMaxHp(picked)} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Итог отправки */}
            <div className="bg-color-main rounded-2xl p-3 border border-gray-600/30 flex flex-col gap-2">
              <div className="flex items-center justify-between text-2xs text-gray-300">
                <span>Снаряжение: {sendCost} 🧪</span>
                <span>В запасе: {Math.round(biomass)} 🧪</span>
              </div>
              <p className="text-2xs text-gray-400">
                {selectedSector.icon} {selectedSector.name}: путь туда{" "}
                {selectedSector.durationHours} ч, обратно ~
                {Math.round(selectedSector.durationHours * EXPEDITION_RETURN_RATIO * 10) / 10} ч
              </p>

              {/* Итог по ролям: шанс удачного возврата и норма добычи против фермы */}
              <div className="flex items-center justify-between rounded-lg bg-slate-800/50 px-2 py-1.5 text-2xs">
                <span className="text-gray-300">🎯 Шанс удачного возврата</span>
                <span
                  className={`font-bold ${
                    successChance >= 1 ? "text-emerald-300" : "text-amber-200"
                  }`}
                >
                  {Math.round(successChance * 100)}%
                  {successChance >= 1 ? " (гарантия)" : ""}
                </span>
              </div>
              <p className="text-2xs leading-snug text-gray-400">
                Каждая роль даёт +20% (сила роли умножает вклад, глубина сектора —
                ×{sectorSuccessFactor.toFixed(2)}). Удачное завершение умножает
                добычу.
              </p>
              {team.length > 0 && (
                <p className="text-2xs leading-snug text-lime-300">
                  Поход принесёт не меньше {Math.round(profitNorm)} в
                  🔷-эквиваленте: это выгоднее фермы за{" "}
                  {awayHours.toFixed(1)} ч и окупает снаряжение.
                </p>
              )}

              {expeditions.length >= teamLimit && (
                <p className="text-2xs text-amber-300">
                  Все команды уже в походе: дождитесь возврата или постройте
                  «Диспетчерскую».
                </p>
              )}
              {members.length > 0 && biomass < sendCost && (
                <p className="text-2xs text-red-300">
                  Не хватает биомассы на снаряжение.
                </p>
              )}

              <ClickButton
                onClick={handleSend}
                disabled={!canSend}
                className={`w-full py-2.5 rounded-xl text-xs font-bold border transition-colors duration-300 ${
                  canSend
                    ? "bg-amber-800/60 border-amber-400/70 text-amber-50 hover:bg-amber-700/70"
                    : "bg-slate-800/40 border-gray-700/40 text-gray-500"
                }`}
              >
                🚀 Отправить в «{selectedSector.name}»
              </ClickButton>
            </div>
          </div>
        )}

        {/* ВКЛАДКА: лазарет — койки и список всех, кому нужна помощь */}
        {tab === "infirmary" && (
          <div className="flex flex-col gap-2">
            <p className="text-2xs text-gray-400">
              Дома жаба восстанавливает всего {HP_REGEN_PER_HOUR} HP в час. Койка в
              лазарете лечит +{HOSPITAL_HP_REGEN_PER_HOUR} HP в час (в{" "}
              {HOSPITAL_HP_REGEN_PER_HOUR / HP_REGEN_PER_HOUR} раз быстрее), а
              срок болезни там идёт в {HOSPITAL_DISEASE_SPEED} раза быстрее — и
              пациент никого не заражает. Мгновенное лечение за Кваксы самое
              дорогое: это способ пропустить ожидание.
            </p>

            {hospitalRooms.length === 0 && (
              <p className="text-2xs text-amber-200/90 bg-amber-950/30 border border-amber-500/30 rounded-xl px-3 py-2">
                🏥 В колонии нет «Лазарета»: постройте комнату на свободном гексе
                карты — только на койке жабы выздоравливают быстро.
              </p>
            )}

            {/* СПИСОК 1: кто лежит на койках прямо сейчас */}
            <div className="flex items-center justify-between pt-1">
              <p className="text-2xs font-bold text-amber-200 uppercase tracking-wide">
                🛏️ В лазарете ({patients.length}/{hospitalCapacity})
              </p>
              <span className="text-2xs text-gray-500">🔷 {tokens} в запасе</span>
            </div>

            {patients.length === 0 && (
              <p className="text-2xs text-gray-500">
                {hospitalRooms.length
                  ? "Койки свободны: перенесите сюда раненых и больных — здесь они поправятся в разы быстрее."
                  : "Койки появятся вместе с лазаретом."}
              </p>
            )}

            {patients.map((toad) => renderCareCard(toad, { inBed: true }))}

            {/* СПИСОК 2: все жабы с ранами и болезнями — лечить или переносить в лазарет */}
            <div className="flex items-center justify-between pt-1">
              <p className="text-2xs font-bold text-amber-200 uppercase tracking-wide">
                📋 Нуждаются в помощи ({needingCare.length})
              </p>
            </div>

            {awayWounded > 0 && (
              <p className="text-2xs text-gray-500">
                Ещё {awayWounded} жаб(ы) с ранами в походе: займёмся ими, когда
                команда вернётся домой.
              </p>
            )}

            {needingCare.length === 0 && (
              <p className="text-2xs text-gray-500">
                Все жабы в форме: ни ран, ни кибер-болезней.
              </p>
            )}

            {needingCare.map((toad) => renderCareCard(toad, { inBed: false }))}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ExpeditionModal;

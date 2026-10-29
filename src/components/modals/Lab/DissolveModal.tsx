import { useState } from "react";
import { useNotifications } from "../../../hooks/use-notification";
import { useSoundEffects } from "../../../hooks/use-sound-effects";
import { Toad } from "../../../models/Toad";
import {
  canDissolveToad,
  dissolveToads,
  getDissolveBatchYield,
  getDissolveYield,
  getIncubatingToadIds,
} from "../../../utils/dissolve-manager";
import { DISSOLVE_MAX_BATCH } from "../../../utils/gamification-config";
import { getToadHomeId } from "../../../utils/toad-location";
import { ClickButton } from "../../shared/ClickButton";
import {
  DataCell,
  DataGrid,
  HudPanel,
  SectionTitle,
} from "../../shared/DataGrid";
import { DissolveConfirm } from "../../shared/DissolveConfirm";
import Modal from "../../shared/Header";
import ModalTabs, { ModalTabItem } from "../../shared/ModalTabs";
import { ToadListCard } from "../../shared/ToadListCard";
import { useToads } from "../../ToadContext";
import RoomDataTab, { ROOM_DATA_TAB, RoomDataTabId } from "../RoomDataTab";
import { RoomConfig } from "../../HexMap/rooms-config";
import { useColony } from "../../../hooks/use-colony";
import { useDissociator } from "../../../hooks/use-dissociator";
import { useRoomPowerTab } from "../../../hooks/use-room-power-tab";
import { DissolveBlockedModal } from "../../shared/DissolveBlockedModal";

/**
 * Диссоциатор — прямая переработка жабы в биомассу.
 * Необратимая механика: жаба исчезает, лаборатория получает биомассу.
 *
 * Модалка живёт в двух местах: из лаборатории (просто разбор) и по гексу диссоциатора на
 * карте — тогда в ней есть и последний таб «Данные сектора», как у остальных секторов.
 */

/** Табы диссоциатора: разбор жаб и данные сектора-гекса */
type DissolveTab = "dissolve" | RoomDataTabId;

export default function DissolveModal({ room }: { room?: RoomConfig }) {
  const { allToads = [], ownedScenes = [], account } = useToads();
  const { addNotification } = useNotifications();
  const { playBubble2, playBubblesLong, playSuccess } = useSoundEffects();

  // Диссоциатор принимает жаб, только когда его сектор построен и под током
  const { ready: dissociatorReady, built: dissociatorBuilt } = useDissociator();
  const { powerGrid } = useColony();

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  /** Окно «Диссоциатор недоступен»: разбор не начинается, пока сектор не готов */
  const [showBlocked, setShowBlocked] = useState(false);
  const {
    tab,
    setTab,
    issue: powerIssue,
  } = useRoomPowerTab<DissolveTab>({ room, powerGrid, defaultTab: "dissolve" });

  /** Табы: разбор жаб и, если модалку открыл гекс диссоциатора, «Данные сектора» */
  const tabs: ModalTabItem<DissolveTab>[] = [
    {
      id: "dissolve",
      label: "🧪 Разбор",
      disabled: Boolean(powerIssue),
      disabledHint: powerIssue ?? undefined,
    },
    ...(room ? [{ ...ROOM_DATA_TAB }] : []),
  ];

  const biomass = Math.floor(account?.biomass || 0);
  const incubatingIds = getIncubatingToadIds();
  const selectedToads = allToads.filter((toad) =>
    selectedIds.includes(toad.id),
  );
  const selectedYield = getDissolveBatchYield(selectedToads);
  const availableToads = allToads.filter((toad) =>
    canDissolveToad(toad, incubatingIds),
  );

  // Группы: каждый биопод отдельно. Склада жаб больше нет — у каждой жабы есть дом
  // (`homeId`), поэтому жаба, работающая в секторе, остаётся в списке своего биопода,
  // хотя её место сейчас (`scene_id`) — строка с id сектора.
  const groups = ownedScenes
    .map((scene) => ({
      key: `scene-${scene.id}`,
      label: `🏠 ${scene.name}`,
      toads: allToads.filter((toad) => getToadHomeId(toad) === scene.id),
    }))
    .filter((group) => group.toads.length > 0);

  const toggleToad = (toad: Toad) => {
    if (selectedIds.includes(toad.id)) {
      setSelectedIds(selectedIds.filter((id) => id !== toad.id));
      playBubble2();
      return;
    }

    if (selectedIds.length >= DISSOLVE_MAX_BATCH) {
      addNotification({
        type: "warn",
        content: `За один разбор — не более ${DISSOLVE_MAX_BATCH} жаб`,
      });
      return;
    }

    setSelectedIds([...selectedIds, toad.id]);
    playBubble2();
  };

  const handleDissolve = () => {
    setShowConfirm(false);

    // Жабы уходят в биомассу только через построенный и запитанный сектор
    if (!dissociatorReady || powerIssue) {
      setShowBlocked(true);
      return;
    }

    // Разбор в биомассу — «пузыри» диссоциатора, а не хруст
    playBubblesLong();
    const result = dissolveToads(selectedIds);

    if (!result.success) {
      addNotification({ type: "warn", content: result.message });
      return;
    }

    playSuccess();
    addNotification({ type: "success", content: result.message });
    setSelectedIds([]);
  };

  return (
    <Modal
      title={room?.name ?? "Диссоциатор"}
      icon={
        <img
          src="/assets/destructor.webp"
          alt=""
          className="h-8 w-8 object-contain"
        />
      }
      tone="lime"
    >
      {/* Табы: разбор жаб и «Данные сектора» (у модалки из лаборатории гекса нет —
          тогда таб один, и рисовать полоску табов нечего) */}
      {tabs.length > 1 && (
        <ModalTabs tabs={tabs} active={tab} onChange={setTab} />
      )}

      {tab === "dissolve" && (
        <>
          <div className="px-2 pb-2">
            <HudPanel tone="amber" className="mb-3 p-2">
              <p className="text-2xs leading-snug text-amber-100">
                ♻️ Диссоциатор мгновенно перерабатывает жабу в биомассу. Жабы
                исчезают навсегда: качество, вес и здоровье влияют на выход,
                головастики дают заметно меньше.
              </p>
            </HudPanel>

            <DataGrid columns={3} className="mb-3">
              <DataCell
                dense
                label="Биомасса"
                value={`🧪 ${biomass}`}
                color="text-lime-300"
              />
              <DataCell
                dense
                label="Выбрано"
                value={`${selectedToads.length}/${DISSOLVE_MAX_BATCH}`}
                color="text-amber-200"
              />
              <DataCell
                dense
                label="Потенциал"
                value={`+${selectedToads.length > 0 ? selectedYield : getDissolveBatchYield(availableToads)} 🧪`}
                color="text-amber-300"
              />
            </DataGrid>

            {groups.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-slate-300 text-4xl mb-3">♻️</div>
                <p className="text-slate-300 text-sm">
                  Жаб для переработки не найдено
                </p>
              </div>
            ) : (
              groups.map((group) => (
                <div key={group.key} className="mb-3">
                  <SectionTitle aside={`${group.toads.length} шт.`}>
                    {group.label}
                  </SectionTitle>
                  <div className="flex flex-col gap-2">
                    {group.toads.map((toad) => {
                      const isIncubating = !canDissolveToad(
                        toad,
                        incubatingIds,
                      );
                      const isSelected = selectedIds.includes(toad.id);

                      return (
                        <ToadListCard
                          key={toad.id}
                          toad={toad}
                          onOpen={() => {
                            if (!isIncubating) {
                              toggleToad(toad);
                            }
                          }}
                          variant="full"
                          showHunger
                          showHp
                          diseaseStyle="chip"
                          selected={isSelected}
                          status={
                            isIncubating
                              ? {
                                  icon: "⏳",
                                  label: "в инкубаторе",
                                  className: "text-slate-500",
                                }
                              : isSelected
                                ? {
                                    icon: "✓",
                                    label: "к переработке",
                                    className: "text-amber-300",
                                  }
                                : undefined
                          }
                          actions={
                            <span
                              className={`ui-chip shrink-0 leading-none ${
                                isIncubating
                                  ? "text-slate-500"
                                  : "text-amber-300"
                              }`}
                            >
                              +{getDissolveYield(toad)} 🧪
                            </span>
                          }
                          className={
                            isIncubating
                              ? "cursor-not-allowed opacity-50"
                              : undefined
                          }
                        />
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Панель запуска разбора */}
          <div className="sticky bottom-0 bg-slate-900/80 backdrop-blur-3xl pt-2 pb-1 px-2 border-t border-slate-600/40">
            <div className="flex items-center justify-between mb-2 text-xs">
              <span className="text-slate-300">
                Выбрано {selectedToads.length} из {DISSOLVE_MAX_BATCH}
              </span>
              <span className="flex items-center gap-2">
                <span className="text-lime-300">🧪 {biomass}</span>
                <span className="text-amber-300 font-bold">
                  +{selectedYield} 🧪
                </span>
              </span>
            </div>
            <ClickButton
              className="ui-button-danger w-full py-3"
              disabled={selectedToads.length === 0}
              onClick={() =>
                dissociatorReady ? setShowConfirm(true) : setShowBlocked(true)
              }
            >
              Разобрать на биомассу
            </ClickButton>
            {selectedToads.length > 0 && (
              <ClickButton
                className="w-full mt-2 bg-color-second hover:bg-slate-600 text-slate-200 py-2 rounded-none text-sm"
                onClick={() => setSelectedIds([])}
              >
                Очистить
              </ClickButton>
            )}
          </div>
        </>
      )}

      {/* ВКЛАДКА «Данные сектора»: описание, улучшения и снос гекса диссоциатора */}
      {tab === "room-data" && room && <RoomDataTab room={room} />}

      {showConfirm && (
        <DissolveConfirm
          toads={selectedToads}
          onCancel={() => setShowConfirm(false)}
          onConfirm={handleDissolve}
        />
      )}

      {/* Диссоциатор ещё не готов: окно-подсказка вместо подтверждения разбора */}
      {showBlocked && (
        <DissolveBlockedModal
          unpowered={dissociatorBuilt && !dissociatorReady}
          onClose={() => setShowBlocked(false)}
        />
      )}
    </Modal>
  );
}

import { useMemo } from "react";
import Modal from "../shared/Header";
import { useColony } from "../../hooks/use-colony";
import { useGameState } from "../../hooks/use-game-state";
import {
  BiomassFarmRoomStat,
  BiomassUpkeepRoomStat,
  getBiomassFarmStats,
} from "../../utils/production-manager";
import { UPKEEP_PER_TOAD_HOUR } from "../../utils/gamification-config";
import { DataCell, DataGrid, HudPanel } from "../shared/DataGrid";
import { IconText } from "../shared/CurrencyIcon";
import { ToadIcon } from "../shared/ToadIcon";

/** Знак и один знак после запятой: темп фермы в HUD показывается так же. */
const formatRate = (value: number): string =>
  `${value > 0 ? "+" : ""}${value.toFixed(1)}`;

/** Биомасса на складе может быть дробной: в модалке важен и остаток. */
const formatBiomass = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);

/** Цвет темпа: плюс — зелёный, минус — красный, ноль — нейтральный. */
const rateTone = (value: number): string =>
  value > 0 ? "text-lime-300" : value < 0 ? "text-rose-300" : "text-slate-300";

/** Маленькая цифра сводки: подпись сверху, значение снизу. */
const BiomassStat = ({
  label,
  value,
  hint,
  tone = "text-white",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) => (
  <DataCell dense label={label} value={value} color={tone}>
    {hint && (
      <p className="mt-0.5 text-3xs leading-tight text-slate-500">{hint}</p>
    )}
  </DataCell>
);

/** Строка биопода: кто живёт, сколько даёт и сколько стоит содержание. */
const BiomassRoomRow = ({ room }: { room: BiomassFarmRoomStat }) => {
  const unit = room.toads === 1 ? "жаба" : "жаб";

  return (
    <HudPanel className="px-2.5 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-2xs font-semibold text-slate-100">
            <IconText text={room.icon} /> {room.name}
          </p>
          <p className="text-3xs leading-tight text-slate-400">
            {room.toads} {unit} в биоподе
            {room.awayToads > 0 && ` · ${room.awayToads} в походе`}
          </p>
        </div>
        {!room.powered && (
          <span className="shrink-0 border border-rose-500/30 bg-slate-950/50 px-1.5 py-0.5 text-3xs text-rose-200">
            без тока
          </span>
        )}
      </div>

      <DataGrid columns={3} className="mt-1.5">
        <DataCell
          dense
          label="Выработка"
          value={`+${room.gross.toFixed(1)}`}
          color="text-lime-300"
        />
        <DataCell
          dense
          label="Содержание"
          value={`−${room.upkeep.toFixed(1)}`}
          color="text-rose-300"
        />
        <DataCell
          dense
          label="Итог"
          value={formatRate(room.net)}
          color={rateTone(room.net)}
        />
      </DataGrid>
    </HudPanel>
  );
};

/**
 * Строка сектора вне фермы: тут только содержание — его жабы едят, но биомассу
 * не вырабатывают (лазарет, репродуктор, ⚡-сектор, «Разведка»).
 */
const BiomassUpkeepRow = ({ room }: { room: BiomassUpkeepRoomStat }) => {
  const unit = room.toads === 1 ? "жаба" : "жаб";

  return (
    <HudPanel className="flex items-center justify-between gap-2 px-2.5 py-1.5">
      <div className="min-w-0">
        <p className="truncate text-2xs font-semibold text-slate-100">
          <IconText text={room.icon} /> {room.name}
        </p>
        <p className="text-3xs leading-tight text-slate-400">
          {room.toads} {unit} · биомассу не дают
        </p>
      </div>
      <p className="shrink-0 text-2xs font-semibold tabular-nums text-rose-300">
        −{room.upkeep.toFixed(1)}
      </p>
    </HudPanel>
  );
};

/**
 * «Биомасса» — статистика фермы по тапу на чип 🧪 в HUD.
 *
 * HUD показывает одно число `🧪/ч`; здесь оно разложено по биоподам: сколько даёт
 * каждая жаба, сколько уходит на содержание и почему биопод мог перестать
 * производить (нет тока, жильцы в походе). Расчёт — `getBiomassFarmStats`,
 * тот же, что у шапки карты, поэтому цифры сходятся.
 */
export default function BiomassStatsModal() {
  const state = useGameState();
  const { rooms, powerGrid } = useColony();
  const stats = useMemo(
    () =>
      getBiomassFarmStats(
        rooms,
        state.toads ?? [],
        powerGrid,
        state.expeditions ?? [],
      ),
    [rooms, state.toads, powerGrid, state.expeditions],
  );

  const biomass = state.user.biomass || 0;
  const hasRooms = stats.rooms.length > 0;

  return (
    <Modal title="Биомасса" tone="lime">
      <div className="space-y-3 pb-1">
        <HudPanel tone="lime" className="px-3 py-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-2xs uppercase tracking-wide text-lime-200/60">
                На складе
              </p>
              <p className="text-2xl font-bold tabular-nums text-lime-200">
                {formatBiomass(biomass)} 🧪
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xs uppercase tracking-wide text-slate-400">
                Ферма
              </p>
              <p
                className={`text-xl font-bold tabular-nums ${rateTone(stats.net)}`}
              >
                {formatRate(stats.net)} 🧪/ч
              </p>
            </div>
          </div>

          <DataGrid columns={3} className="mt-3">
            <BiomassStat
              label="Выработка"
              value={`+${stats.gross.toFixed(1)}`}
              tone="text-lime-300"
              hint="в час"
            />
            <BiomassStat
              label="Содержание"
              value={`−${stats.upkeep.toFixed(1)}`}
              tone="text-rose-300"
              hint="в час"
            />
            <BiomassStat
              label="Итог"
              value={formatRate(stats.net)}
              tone={rateTone(stats.net)}
              hint="в час"
            />
          </DataGrid>
        </HudPanel>

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-2xs text-slate-400">
          <span>
            <ToadIcon className="mr-1 h-3 w-3" />
            {stats.activeToads} работают на ферме
          </span>
          {stats.serviceToads > 0 && (
            <span className="text-sky-200/80">
              🏥 {stats.serviceToads} в других секторах
            </span>
          )}
          {stats.awayToads > 0 && (
            <span className="text-amber-200/80">
              🥾 {stats.awayToads} в походе
            </span>
          )}
          {stats.unplacedToads > 0 && (
            <span className="text-amber-200/80">
              ❔ {stats.unplacedToads} без гекса
            </span>
          )}
          {stats.unpoweredToads > 0 && (
            <span className="text-rose-200/90">
              ⚡ {stats.unpoweredToads} без тока
            </span>
          )}
        </div>

        <div>
          <h3 className="mb-1.5 text-2xs font-bold uppercase tracking-wide text-slate-400">
            Откуда биомасса
          </h3>

          {hasRooms ? (
            <div className="space-y-1.5">
              {stats.rooms.map((room) => (
                <BiomassRoomRow key={room.id} room={room} />
              ))}
            </div>
          ) : (
            <HudPanel className="px-3 py-2 text-2xs leading-snug text-slate-400">
              Биоподов пока нет — биомассу никто не вырабатывает.
            </HudPanel>
          )}
        </div>

        {(stats.serviceRooms.length > 0 || stats.unplacedToads > 0) && (
          <div>
            <h3 className="mb-1.5 text-2xs font-bold uppercase tracking-wide text-slate-400">
              Содержание вне фермы
            </h3>
            <div className="space-y-1.5">
              {stats.serviceRooms.map((room) => (
                <BiomassUpkeepRow key={room.id} room={room} />
              ))}
              {stats.unplacedToads > 0 && (
                <HudPanel
                  tone="amber"
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-2xs font-semibold text-amber-100">
                      ❔ Без гекса
                    </p>
                    <p className="text-3xs leading-tight text-slate-400">
                      {stats.unplacedToads}{" "}
                      {stats.unplacedToads === 1 ? "жаба" : "жаб"} · биомассу не
                      дают
                    </p>
                  </div>
                  <p className="shrink-0 text-2xs font-semibold tabular-nums text-rose-300">
                    −
                    {(stats.unplacedToads * UPKEEP_PER_TOAD_HOUR).toFixed(1)}
                  </p>
                </HudPanel>
              )}
            </div>
          </div>
        )}

        <HudPanel className="px-3 py-2 text-2xs leading-snug text-slate-400">
          <p>
            Выработка жабы зависит от Качества, веса, характера, сытости и
            здоровья. Содержание — {UPKEEP_PER_TOAD_HOUR} 🧪/ч за каждую жабу
            колонии, кроме ушедших в поход.
          </p>
          <p className="mt-1">
            Обесточенный биопод не производит, но его жабы продолжают есть. Жабы
            в походе не работают и содержания не требуют. Жабы в лазарете,
            репродукторе, ⚡-секторе и «Разведке» едят, но биомассу не дают.
          </p>
        </HudPanel>
      </div>
    </Modal>
  );
}

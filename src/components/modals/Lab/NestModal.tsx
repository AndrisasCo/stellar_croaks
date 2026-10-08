import { useEffect, useState } from "react";
import { Toad, getRarityConfig } from "../../../models/Toad";
import { useNotifications } from "../../../hooks/use-notification";
import { useSoundEffects } from "../../../hooks/use-sound-effects";
import {
  MAX_ENERGY,
  NEST_MAX_SLOTS,
  canUpgradeNest,
  getBreedPairBiomassCost,
  getEnergyCost,
  getNestSlotUpgradeCost,
  getToadEnergy,
} from "../../../utils/gamification-config";
import {
  getNestOccupancy,
  performManualBreeding,
  upgradeNestSlots,
} from "../../../utils/breeding-manager";
import { CURRENCY_CONFIG } from "../../../utils/constants";
import {
  ASTRO_PRICES,
  acceleratePregnancy,
  buyQuarantine,
  getAstroBalance,
  resetBreedCooldown,
} from "../../../utils/astro-shop";
import { getToadDisease } from "../../../utils/disease-manager";
import { completeAchivement } from "../../../backend/achivements-manager";
import { ClickButton } from "../../shared/ClickButton";
import { useToads } from "../../ToadContext";

const formatCooldown = (ms: number): string => {
  if (ms <= 0) {
    return "готова";
  }
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}м ${seconds}с` : `${seconds}с`;
};

const EnergyBar = ({ value }: { value: number }) => (
  <div className="w-full h-1.5 bg-gray-700/60 rounded-full overflow-hidden">
    <div
      className="h-full bg-gradient-to-r from-lime-400 to-emerald-500"
      style={{ width: `${Math.min(100, (value / MAX_ENERGY) * 100)}%` }}
    />
  </div>
);

const ToadPick = ({
  toad,
  selected,
  onPick,
}: {
  toad: Toad;
  selected: boolean;
  onPick: () => void;
}) => {
  const energy = getToadEnergy(toad);
  const cost = getEnergyCost(toad);
  const cooldownLeft = (toad.breedCooldownUntil ?? 0) - Date.now();
  const isPregnant = Boolean(toad.pregnancy?.isPregnant);
  const isReady = !isPregnant && cooldownLeft <= 0 && energy >= cost;
  const rarity = getRarityConfig(toad.genes.rarity);
  const disease = getToadDisease(toad);

  const status = isPregnant
    ? "🍼 вынашивает"
    : isReady
    ? "готова"
    : cooldownLeft > 0
    ? `отдых: ${formatCooldown(cooldownLeft)}`
    : `нужно ⚡${cost}`;

  return (
    <button
      type="button"
      onClick={onPick}
      disabled={isPregnant}
      className={`w-full text-left rounded-lg p-2 border transition-all ${
        selected
          ? "border-emerald-400 bg-emerald-500/10"
          : "border-gray-600/50 bg-color-main hover:border-emerald-400/50"
      } ${isPregnant ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className={`text-xs font-semibold truncate ${rarity.color}`}>
          {toad.name}
        </span>
        <span className="text-2xs text-gray-400 shrink-0">
          {toad.genes.rarity.toFixed(1)}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <span className="text-2xs text-lime-300 shrink-0">
          ⚡{Math.round(energy)}
        </span>
        <EnergyBar value={energy} />
      </div>
      <div className="mt-1 text-2xs text-gray-400 truncate">
        {rarity.label} · {status}
      </div>
      {disease && (
        <div className="mt-0.5 text-2xs text-red-400 truncate">
          {disease.icon} {disease.name} (−
          {Math.round(disease.productionPenalty * 100)}% биомассы)
        </div>
      )}
    </button>
  );
};

export default function NestModal() {
  const { toads, account, currentScene } = useToads();
  const { addNotification } = useNotifications();
  const { playOk, playExited } = useSoundEffects();

  const [maleId, setMaleId] = useState<number | null>(null);
  const [femaleId, setFemaleId] = useState<number | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [, setTick] = useState(0);

  // Раз в секунду обновляем обратный отсчёт cooldown
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Часть 5: жабы в походе за Периметр не могут размножаться дома
  const adults = toads.filter(
    (t) => t.stage === "adult" && t.status !== "out"
  );
  const males = adults.filter((t) => t.sex === "male");
  const females = adults.filter((t) => t.sex === "female");

  const male = males.find((t) => t.id === maleId) || null;
  const female = females.find((t) => t.id === femaleId) || null;

  const occupancy = getNestOccupancy(currentScene?.id ?? null);
  const nestFull = occupancy.used >= occupancy.limit;
  const pregnant = toads.filter(
    (t) => t.scene_id === (currentScene?.id ?? null) && t.pregnancy?.isPregnant
  );
  const biomass = Math.floor(account?.biomass || 0);
  const astro = Math.floor(getAstroBalance());
  const nestUpgradeCost = getNestSlotUpgradeCost(currentScene);
  const canUpgrade = canUpgradeNest(currentScene);
  const tokens = Math.floor(account?.tokens || 0);

  const totalEnergyCost =
    (male ? getEnergyCost(male) : 0) + (female ? getEnergyCost(female) : 0);
  const biomassCost = male && female ? getBreedPairBiomassCost(male, female) : 0;
  const enoughBiomass = biomass >= biomassCost;

  const canBreed = Boolean(
    male && female && !isBusy && !nestFull && enoughBiomass
  );

  const handleBreed = async () => {
    if (!male || !female || isBusy) {
      return;
    }
    setIsBusy(true);
    const result = await performManualBreeding(
      male.id,
      female.id,
      addNotification
    );
    setIsBusy(false);

    if (result.success) {
      playOk();
      completeAchivement("first-manual-breed");
      setMaleId(null);
      setFemaleId(null);
    } else {
      playExited();
    }
  };

  /** Астро-кваксы: снять отдых жабы (Часть 3.7) */
  const handleResetCooldown = (toad: Toad) => {
    const result = resetBreedCooldown(toad.id);
    addNotification({
      type: result.success ? "success" : "warn",
      content: result.message,
    });
    result.success ? playOk() : playExited();
    setTick((t) => t + 1);
  };

  /** Кваксы: апгрейд постройки «Гнездо» (Часть 3.2) */
  const handleUpgradeNest = () => {
    const result = upgradeNestSlots(currentScene?.id ?? null);
    addNotification({
      type: result.success ? "success" : "warn",
      content: result.message,
    });
    result.success ? playOk() : playExited();
    setTick((t) => t + 1);
  };

  /** Астро-кваксы: ускорить роды (Часть 3.7) */
  const handleAccelerate = (toad: Toad) => {
    const result = acceleratePregnancy(toad.id);
    addNotification({
      type: result.success ? "success" : "warn",
      content: result.message,
    });
    result.success ? playOk() : playExited();
    setTick((t) => t + 1);
  };

  /** Астро-кваксы: карантин вольера (Часть 3.6/3.7) */
  const handleQuarantine = () => {
    const result = buyQuarantine(currentScene?.id ?? null);
    addNotification({
      type: result.success ? "success" : "warn",
      content: result.message,
    });
    if (result.success && (result.cured || 0) > 0) {
      completeAchivement("quarantine-cure");
    }
    result.success ? playOk() : playExited();
    setTick((t) => t + 1);
  };

  return (
    <>
      {/* Заголовок */}
      <div className="flex w-full justify-center items-center relative">
        <div className="flex items-center gap-2 pb-4">
          <h2 className="text-xl font-bold bg-gradient-to-r from-green-400 to-purple-500 bg-clip-text text-transparent">
            Гнездо
          </h2>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {/* Сводка */}
        <div className="flex items-center justify-between text-xs bg-color-main rounded-xl px-3 py-2 border border-gray-500/30">
          <span className="text-emerald-300">
            🪺 Гнёзда: {occupancy.used}/{occupancy.limit}
          </span>
          <span className="text-lime-300">🧪 Биомасса: {biomass}</span>
          <span className="text-purple-300">★ {astro}</span>
        </div>

        <p className="text-1xs text-gray-400 text-center leading-snug">
          Выберите самца и самку. Спаривание тратит силы жаб (⚡) и биомассу.
          Пока идёт беременность, гнездо занято.
        </p>

        {/* Выбор жаб */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-2">
            <div className="text-xs font-semibold text-blue-300">♂ Самцы</div>
            <div className="flex flex-col gap-2 max-h-[34vh] overflow-y-auto pr-1">
              {males.length === 0 ? (
                <span className="text-1xs text-gray-500">Нет самцов</span>
              ) : (
                males.map((toad) => (
                  <ToadPick
                    key={toad.id}
                    toad={toad}
                    selected={toad.id === maleId}
                    onPick={() => setMaleId(toad.id === maleId ? null : toad.id)}
                  />
                ))
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-xs font-semibold text-pink-300">♀ Самки</div>
            <div className="flex flex-col gap-2 max-h-[34vh] overflow-y-auto pr-1">
              {females.length === 0 ? (
                <span className="text-1xs text-gray-500">Нет самок</span>
              ) : (
                females.map((toad) => (
                  <ToadPick
                    key={toad.id}
                    toad={toad}
                    selected={toad.id === femaleId}
                    onPick={() =>
                      setFemaleId(toad.id === femaleId ? null : toad.id)
                    }
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Стоимость пары */}
        <div className="bg-color-main rounded-xl px-3 py-2 border border-gray-500/30 text-xs flex flex-col gap-1">
          <div className="flex justify-between">
            <span className="text-gray-400">Стоимость сил пары</span>
            <span className="text-lime-300">⚡ {totalEnergyCost}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Стоимость биомассы</span>
            <span
              className={enoughBiomass ? "text-emerald-300" : "text-red-400"}
            >
              🧪 {biomassCost}
            </span>
          </div>
        </div>

        {/* Постройка «Гнездо»: апгрейд за Кваксы (Часть 3.2) */}
        <div className="bg-color-main rounded-xl px-3 py-2 border border-gray-500/30 text-xs flex items-center justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-gray-400">
              🪺 Постройка «Гнездо»: {occupancy.limit}/{NEST_MAX_SLOTS} слотов
            </span>
            <span className="text-gray-500 text-2xs">
              {canUpgrade
                ? `Следующий слот: ${nestUpgradeCost} ${CURRENCY_CONFIG.tokens.icon} (у вас ${tokens})`
                : "Достигнут максимум"}
            </span>
          </div>
          <ClickButton
            disabled={!canUpgrade || tokens < nestUpgradeCost}
            onClick={handleUpgradeNest}
            className={`shrink-0 px-2 py-1 rounded-lg border text-2xs font-semibold transition-all ${
              canUpgrade && tokens >= nestUpgradeCost
                ? "border-amber-400/50 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25"
                : "border-gray-500/30 bg-gray-600/30 text-gray-400 cursor-not-allowed"
            }`}
          >
            {canUpgrade
              ? `＋1 слот (${nestUpgradeCost} ${CURRENCY_CONFIG.tokens.icon})`
              : "Максимум"}
          </ClickButton>
        </div>

        {/* Астро-кваксы: ускорения и карантин (Часть 3.7) */}
        <div className="bg-color-main rounded-xl px-3 py-2 border border-purple-500/30 text-xs flex flex-col gap-2">
          <div className="flex justify-between">
            <span className="text-gray-400">★ Астро-кваксы</span>
            <span className="text-purple-300">★ {astro}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {pregnant.map((toad) => (
              <ClickButton
                key={toad.id}
                onClick={() => handleAccelerate(toad)}
                className="text-2xs px-2 py-1 rounded-lg border border-pink-400/40 bg-pink-500/10 hover:bg-pink-500/20 text-pink-200"
              >
                Ускорить роды · {toad.name} (★{ASTRO_PRICES.acceleratePregnancy})
              </ClickButton>
            ))}
            {[male, female]
              .filter((toad): toad is Toad => Boolean(toad))
              .map((toad) => (
                <ClickButton
                  key={toad.id}
                  onClick={() => handleResetCooldown(toad)}
                  className="text-2xs px-2 py-1 rounded-lg border border-purple-400/40 bg-purple-500/10 hover:bg-purple-500/20 text-purple-200"
                >
                  Снять отдых · {toad.name} (★{ASTRO_PRICES.resetCooldown})
                </ClickButton>
              ))}
            <ClickButton
              onClick={handleQuarantine}
              className="text-2xs px-2 py-1 rounded-lg border border-emerald-400/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-200"
            >
              Карантин вольера (★{ASTRO_PRICES.quarantine})
            </ClickButton>
          </div>
        </div>

        {nestFull ? (
          <div className="text-center text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
            Все гнёзда вольера заняты. Дождитесь родов.
          </div>
        ) : (
          <ClickButton
            disabled={!canBreed}
            onClick={handleBreed}
            className={`w-full py-3 rounded-xl font-bold border-2 transition-all ${
              canBreed
                ? "bg-gradient-to-r from-pink-600 to-purple-600 text-white border-white/20 hover:scale-[1.02]"
                : "bg-gray-600/40 text-gray-400 border-gray-500/30 cursor-not-allowed"
            }`}
          >
            {isBusy ? "Спариваем..." : "Запустить размножение"}
          </ClickButton>
        )}
      </div>
    </>
  );
}

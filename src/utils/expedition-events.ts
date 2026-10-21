import { Expedition, ExpeditionRole, SectorDef } from "../models/expedition";
import { Toad, getToadTypeLabel } from "../models/Toad";
import { generateRandomLootboxToad } from "../models/Toad/lootbox";
import { Items } from "../models/user";
import {
  EXPEDITION_ASTRO_BONUS_CHANCE,
  EXPEDITION_ASTRO_CHANCE,
  EXPEDITION_MAX_COMPANIONS,
  EXPEDITION_MIN_DAMAGE,
  EXPEDITION_SAMPLE_CHANCE,
  EXPEDITION_STEP_BIOMASS,
  EXPEDITION_STEP_TOKENS,
  ROLE_CONFIG,
  getExpeditionAstroDrop,
  getRolePower,
  getSectorDamageMultiplier,
  getSectorLootFactor,
} from "./expedition-config";

/**
 * ЧАСТЬ 5.5. События похода.
 * Каждое событие = проверка `удача + характеристика роли` (см. `ctx.check`),
 * а исход — урон, лечение или добыча. Тексты — в духе чёрного юмора Периметра.
 */

/** Дельта добычи за одно событие */
export interface ExpeditionLootDelta {
  biomass?: number;
  tokens?: number;
  astro_quax?: number;
  /** Предметы склада (ключи `Items`) */
  items?: Partial<Record<Items, number>>;
  /** Найденные образцы */
  sample?: number;
}

export interface ExpeditionEventMember {
  toadId: number;
  role: ExpeditionRole;
  toad: Toad;
}

export interface ExpeditionEventContext {
  expedition: Expedition;
  sector: SectorDef;
  /** Живые жабы команды */
  alive: ExpeditionEventMember[];
  /** Жаба в роли (null, если роль не занята или жаба выбита) */
  byRole: (role: ExpeditionRole) => ExpeditionEventMember | null;
  /** Случайная живая жаба */
  randomMember: () => ExpeditionEventMember | null;
  /** Проверка «удача + характеристика роли» с поправкой на ранения */
  check: (member: ExpeditionEventMember, baseChance?: number) => boolean;
  /** Урон по конкретной жабе (возвращает фактический урон) */
  damage: (member: ExpeditionEventMember, amount: number) => number;
  /** Урон по команде с перераспределением на щитоносца */
  teamDamage: (amount: number) => { total: number; absorbed: number };
  /** Лечение жабы (возвращает фактическое лечение) */
  heal: (member: ExpeditionEventMember, amount: number) => number;
  /** Добыча за событие */
  loot: (delta: ExpeditionLootDelta) => void;
  /** Заразить жабу кибер-болезнью (возвращает название болезни) */
  infect: (member: ExpeditionEventMember) => string | null;
  /**
   * Присоединить случайную жабу к походу. Жаба ещё не в команде ролей: она идёт
   * следом, а дома Manager поселит её в свободный биопод. `false` — попутчик
   * уже есть (лимит `EXPEDITION_MAX_COMPANIONS`).
   */
  join: (toad: Partial<Toad>) => boolean;
  /** Строка в чат похода */
  log: (entry: {
    role?: ExpeditionRole | "system";
    member?: ExpeditionEventMember;
    text: string;
    kind?: "good" | "bad" | "info";
    hpDelta?: number;
  }) => void;
  /** Бросок 0..1 */
  rng: () => number;
}

export interface ExpeditionEventDef {
  id: string;
  /** Роль, без которой событие не выпадает (не задано — общее событие) */
  role?: ExpeditionRole;
  /**
   * Условие попадания в пул. Нужно событиям, которые нельзя повторять в одном
   * походе (например, попутчик: второй такой жабы за рейд не будет).
   */
  available?: (ctx: ExpeditionEventContext) => boolean;
  run: (ctx: ExpeditionEventContext) => void;
}

/** Урон события с учётом опасности сектора и общего множителя походов */
export const scaleDamage = (
  ctx: ExpeditionEventContext,
  base: number,
): number =>
  Math.max(
    EXPEDITION_MIN_DAMAGE,
    Math.round(base * getSectorDamageMultiplier(ctx.sector)),
  );

/** Базовая добыча «за шаг пути»: биомасса и Кваксы с разбросом */
export const stepLoot = (
  ctx: ExpeditionEventContext,
  mult = 1,
): ExpeditionLootDelta => {
  const factor = getSectorLootFactor(ctx.sector) * mult;
  return {
    biomass: Math.max(
      1,
      Math.round(EXPEDITION_STEP_BIOMASS * factor * (0.7 + ctx.rng() * 0.6)),
    ),
    tokens: Math.max(
      1,
      Math.round(EXPEDITION_STEP_TOKENS * factor * (0.6 + ctx.rng() * 0.5)),
    ),
  };
};

/** Иконки предметов склада для чата похода */
export const ITEM_ICONS: Partial<Record<Items, string>> = {
  [Items.food]: "🍎",
  [Items.craftDust]: "✨",
  [Items.battery]: "🔋",
  [Items.worms]: "🪱",
  [Items.sparkleFlys]: "✨",
  // Пигменты больше не выпадают в походах, но иконки нужны для старых сейвов.
  [Items.pigmentGreen]: "🟢",
  [Items.pigmentRed]: "🔴",
  [Items.pigmentBlue]: "🔵",
  [Items.pigmentUnstable]: "🌈",
};

/** Редкая примесь к хорошему событию: астро-кваксы и образец */
export const rareLoot = (ctx: ExpeditionEventContext): ExpeditionLootDelta => {
  const delta: ExpeditionLootDelta = {};
  if (ctx.rng() < EXPEDITION_ASTRO_CHANCE) {
    // Дальние секторы платят больше: находка масштабируется глубиной, а не
    // одинаковой единицей для стартового шлюза и «Дальнего Периметра».
    delta.astro_quax = getExpeditionAstroDrop(ctx.sector);
  }
  if (ctx.rng() < EXPEDITION_SAMPLE_CHANCE) {
    delta.sample = 1;
  }
  // Прежний бросок пигмента (35%) теперь отдаёт Астро-кваксы. Оба броска
  // независимы: за одно хорошее событие может прилететь две находки.
  if (ctx.rng() < EXPEDITION_ASTRO_BONUS_CHANCE) {
    delta.astro_quax =
      (delta.astro_quax || 0) + getExpeditionAstroDrop(ctx.sector);
  }
  return delta;
};

/** Краткое человекочитаемое описание добычи (для чата) */
export const describeLoot = (delta: ExpeditionLootDelta): string => {
  const parts: string[] = [];
  if (delta.biomass) parts.push(`+${delta.biomass} 🧪`);
  if (delta.tokens) parts.push(`+${delta.tokens} 🔷`);
  if (delta.astro_quax) parts.push(`+${delta.astro_quax} 💎`);
  if (delta.sample) parts.push("+образец 🧬");
  Object.entries(delta.items || {}).forEach(([item, amount]) => {
    if (!amount) {
      return;
    }
    const icon = ITEM_ICONS[item as Items] || "📦";
    parts.push(`+${amount} ${icon}`);
  });
  return parts.join(", ");
};

/** Имя роли для лога */
export const getRoleLabel = (role: ExpeditionRole): string =>
  ROLE_CONFIG[role].label;

/**
 * Событие роли, которой в команде нет: роль не заняли или её жабу уже выбили.
 * Проверка в этом случае не бросается — событие выходит провальным **всегда**,
 * а урон получает случайная живая жаба (`ctx.randomMember`), чтобы пустая роль
 * стоила команде дороже. Если бить некого (вся команда выбита) — ничего не происходит.
 */
const failMissingRole = (
  ctx: ExpeditionEventContext,
  base: number,
  text: (victim: ExpeditionEventMember, dealt: number) => string,
): void => {
  const victim = ctx.randomMember();
  if (!victim) {
    return;
  }

  const dealt = ctx.damage(victim, scaleDamage(ctx, base));
  ctx.log({
    member: victim,
    kind: "bad",
    text: text(victim, dealt),
  });
};

// === Пул событий похода ===

export const EXPEDITION_EVENTS: ExpeditionEventDef[] = [
  {
    id: "quiet_corridor",
    run: (ctx) => {
      ctx.log({
        text: "Тихо. Слышен гул суперсерверов.",
        kind: "info",
      });
      if (ctx.rng() < 0.4) {
        ctx.loot({ biomass: Math.round(2 * getSectorLootFactor(ctx.sector)) });
      }
    },
  },
  {
    id: "stowaway_toad",
    available: (ctx) =>
      (ctx.expedition.companions?.length ?? 0) < EXPEDITION_MAX_COMPANIONS,
    run: (ctx) => {
      const { baseToad } = generateRandomLootboxToad(
        ctx.sector.id,
        ctx.rng,
      );
      // id выдаст `createToads` на возврате: у события нет своего места в сейве,
      // а сгенерированный id мог бы совпасть у двух завершившихся походов.
      const { id: _generatedId, ...companion } = baseToad;

      if (!ctx.join(companion)) {
        return;
      }

      ctx.log({
        kind: "good",
        text: `к команде прибилась случайная жаба: ${getToadTypeLabel(
          baseToad.type,
        ).toLowerCase()} «${baseToad.name}» — вылезла из вентиляции и увязалась следом. Дома поселим её в биопод`,
      });
    },
  },
  {
    id: "collapsed_bridge",
    role: "scout",
    run: (ctx) => {
      const scout = ctx.byRole("scout");
      if (!scout) {
        failMissingRole(
          ctx,
          10,
          (victim, dealt) =>
            `мостки рухнули: ${victim.toad.name} в провале (−${dealt} HP), обход искать было некому`,
        );
        return;
      }

      if (ctx.check(scout, 0.5)) {
        const delta = { ...stepLoot(ctx, 1.2), ...rareLoot(ctx) };
        ctx.loot(delta);
        ctx.log({
          member: scout,
          kind: "good",
          text: `нашел обход по ржавым вентилляционным шахтам. Найдено: ${describeLoot(delta)}`,
        });
      } else {
        const dealt = ctx.damage(scout, scaleDamage(ctx, 10));
        ctx.log({
          member: scout,
          kind: "bad",
          text: `обход оказался провалом (−${dealt} HP)`,
        });
      }
    },
  },
  {
    id: "turret_grid",
    role: "tank",
    run: (ctx) => {
      const tank = ctx.byRole("tank");
      if (!tank) {
        failMissingRole(
          ctx,
          16,
          (victim, dealt) =>
            `залп турельной сетки достал ${victim.toad.name} (−${dealt} HP): щитоносца в команде не было`,
        );
        return;
      }

      if (ctx.check(tank, 0.5)) {
        const delta = {
          ...stepLoot(ctx),
          items: { [Items.craftDust]: 1 },
          ...rareLoot(ctx),
        };
        ctx.loot(delta);
        ctx.log({
          member: tank,
          kind: "good",
          text: `продавил турельную решётку и выгреб обломки: ${describeLoot(
            delta,
          )}`,
        });
      } else {
        const dealt = ctx.damage(tank, scaleDamage(ctx, 16));
        ctx.log({
          member: tank,
          kind: "bad",
          text: `словил весь залп сетки (−${dealt} HP), но остальных прикрыл`,
        });
      }
    },
  },
  {
    id: "sealed_vault",
    role: "hacker",
    run: (ctx) => {
      const hacker = ctx.byRole("hacker");
      if (!hacker) {
        failMissingRole(
          ctx,
          8,
          (victim, dealt) =>
            `ловушка сейфа накрыла ${victim.toad.name} (−${dealt} HP): вскрывать было некому`,
        );
        return;
      }

      if (ctx.check(hacker, 0.45)) {
        const delta = {
          tokens: Math.max(
            2,
            Math.round(
              EXPEDITION_STEP_TOKENS * getSectorLootFactor(ctx.sector),
            ),
          ),
          ...rareLoot(ctx),
        };
        ctx.loot(delta);
        ctx.log({
          member: hacker,
          kind: "good",
          text: `вскрыл сейф за 12 секунд: ${describeLoot(delta)}`,
        });
      } else {
        const dealt = ctx.damage(hacker, scaleDamage(ctx, 8));
        ctx.log({
          member: hacker,
          kind: "bad",
          text: `поймал ловушку-приманку в терминале (−${dealt} HP)`,
        });
      }
    },
  },
  {
    id: "mold_crater",
    role: "negotiator",
    run: (ctx) => {
      const biologist = ctx.byRole("negotiator");
      if (!biologist) {
        failMissingRole(
          ctx,
          7,
          (victim, dealt) =>
            `споры плесени накрыли ${victim.toad.name} (−${dealt} HP): переговорщика в команде нет`,
        );
        return;
      }
      if (ctx.check(biologist, 0.5)) {
        const delta = { ...stepLoot(ctx, 0.8), ...rareLoot(ctx) };
        ctx.loot(delta);
        ctx.log({
          member: biologist,
          kind: "good",
          text: `уговорила плесень расступиться: ${describeLoot(delta)}`,
        });
      } else {
        const victim = ctx.randomMember() ?? biologist;
        const disease = ctx.infect(victim);
        if (disease) {
          ctx.log({
            member: victim,
            kind: "bad",
            text: `кратер с плесенью наградил ${victim.toad.name}: ${disease}`,
          });
        } else {
          const dealt = ctx.damage(victim, scaleDamage(ctx, 7));
          ctx.log({
            member: victim,
            kind: "bad",
            text: `распылила споры в шлем ${victim.toad.name} (−${dealt} HP)`,
          });
        }
      }
    },
  },
  {
    id: "nano_repair_bay",
    role: "medic",
    run: (ctx) => {
      const medic = ctx.byRole("medic");
      if (!medic) {
        failMissingRole(
          ctx,
          9,
          (victim, dealt) =>
            `пресс нано-отсека придавил ${victim.toad.name} (−${dealt} HP): ремонтника в команде нет`,
        );
        return;
      }
      const power = getRolePower(medic.toad, "medic");
      const amount = Math.round(8 + power * 14);
      let healedTotal = 0;
      ctx.alive.forEach((member) => {
        healedTotal += ctx.heal(member, amount);
      });
      ctx.log({
        member: medic,
        kind: "good",
        text:
          healedTotal > 0
            ? `раскопал нано-ремонтный отсек: команда подлатана на ${healedTotal} HP`
            : "нашёл нано-ремонтный отсек, но все и так целы",
      });
    },
  },
  {
    id: "turret_ambush",
    run: (ctx) => {
      const { total, absorbed } = ctx.teamDamage(scaleDamage(ctx, 12));
      ctx.log({
        kind: "bad",
        text: `из стены вылезла турель-паук: команда потеряла ${total} HP${
          absorbed > 0 ? ` (${absorbed} взял щитоносец)` : ""
        }`,
      });
    },
  },
  {
    id: "orbital_crates",
    run: (ctx) => {
      const delta = {
        tokens: Math.max(
          2,
          Math.round(EXPEDITION_STEP_TOKENS * getSectorLootFactor(ctx.sector)),
        ),
        items: {
          [Items.food]: 3 + Math.floor(ctx.rng() * 8),
        },
        ...rareLoot(ctx),
      };
      ctx.loot(delta);
      ctx.log({
        kind: "good",
        text: `контейнеры дрейфуют с орбиты — вскрыли на месте: ${describeLoot(
          delta,
        )}`,
      });
    },
  },
  {
    id: "data_terminal",
    role: "hacker",
    run: (ctx) => {
      const hacker = ctx.byRole("hacker");
      if (!hacker) {
        failMissingRole(
          ctx,
          10,
          (victim, dealt) =>
            `защита терминала ударила ${victim.toad.name} током (−${dealt} HP): оператора в команде нет`,
        );
        return;
      }
      const delta = {
        tokens: Math.max(
          3,
          Math.round(
            EXPEDITION_STEP_TOKENS * 1.6 * getSectorLootFactor(ctx.sector),
          ),
        ),
        items: { [Items.craftDust]: 1 },
        ...rareLoot(ctx),
      };
      ctx.loot(delta);
      ctx.log({
        member: hacker,
        kind: "good",
        text: `выкачал архив терминала: ${describeLoot(delta)}`,
      });
    },
  },
  {
    id: "biomass_reef",
    run: (ctx) => {
      const delta = stepLoot(ctx, 1.4);
      ctx.loot(delta);
      ctx.log({
        kind: "good",
        text: `под ногами чавкнула биомассовая отмель — зачерпнули горстями: ${describeLoot(
          delta,
        )}`,
      });
    },
  },
  {
    id: "leaky_reactor",
    role: "tank",
    run: (ctx) => {
      const tank = ctx.byRole("tank");
      if (!tank) {
        failMissingRole(
          ctx,
          14,
          (victim, dealt) =>
            `клапан охлаждайки сорвало, струя достала ${victim.toad.name} (−${dealt} HP): щитоносца в команде нет`,
        );
        return;
      }
      if (ctx.check(tank, 0.55)) {
        const delta = {
          ...stepLoot(ctx, 1.1),
          items: { [Items.craftDust]: 1 },
          ...rareLoot(ctx),
        };
        ctx.loot(delta);
        ctx.log({
          member: tank,
          kind: "good",
          text: `залез в реакторный колодец и вытащил детали: ${describeLoot(delta)}`,
        });
      } else {
        const { total } = ctx.teamDamage(scaleDamage(ctx, 18));
        ctx.log({
          member: tank,
          kind: "bad",
          text: `сорвал клапан охлаждайки — команда сварилась на ${total} HP`,
        });
      }
    },
  },
  {
    id: "drone_patrol",
    role: "scout",
    run: (ctx) => {
      const scout = ctx.byRole("scout");
      if (!scout) {
        failMissingRole(
          ctx,
          12,
          (victim, dealt) =>
            `сканер дрона вцепился в ${victim.toad.name} (−${dealt} HP): разведчика в команде не было`,
        );
        return;
      }
      if (ctx.check(scout, 0.55)) {
        ctx.log({
          member: scout,
          kind: "good",
          text: "провела команду по рельсам под самым носом дронов-патрульных",
        });
      } else {
        const dealt = ctx.damage(scout, scaleDamage(ctx, 12));
        ctx.log({
          member: scout,
          kind: "bad",
          text: `подставилась под сканер дрона (−${dealt} HP)`,
        });
      }
    },
  },
  {
    id: "stray_signal",
    run: (ctx) => {
      if (ctx.rng() < 0.5) {
        const delta = {
          tokens: Math.max(1, Math.round(2 * getSectorLootFactor(ctx.sector))),
          ...rareLoot(ctx),
        };
        ctx.loot(delta);
        ctx.log({
          kind: "good",
          text: `поймали чужой сигнал и обменяли координаты на ${describeLoot(
            delta,
          )}`,
        });
      } else {
        const victim = ctx.randomMember();
        if (!victim) {
          return;
        }
        const dealt = ctx.damage(victim, scaleDamage(ctx, 9));
        ctx.log({
          kind: "bad",
          text: `сигнал оказался приманкой: ${victim.toad.name} словила разряд (−${dealt} HP)`,
        });
      }
    },
  },
  {
    id: "gene_pool",
    role: "negotiator",
    run: (ctx) => {
      const biologist = ctx.byRole("negotiator");
      if (!biologist) {
        failMissingRole(
          ctx,
          10,
          (victim, dealt) =>
            `генбассейн принял ${victim.toad.name} с головой (−${dealt} HP): договариваться было некому`,
        );
        return;
      }
      if (ctx.check(biologist, 0.45)) {
        const delta: ExpeditionLootDelta = {
          ...stepLoot(ctx, 0.6),
          ...rareLoot(ctx),
        };
        if (ctx.rng() < 0.25) {
          delta.sample = (delta.sample || 0) + 1;
        }
        ctx.loot(delta);
        ctx.log({
          member: biologist,
          kind: "good",
          text: `выудила из генбассейна живую пробу: ${describeLoot(delta)}`,
        });
      } else {
        const dealt = ctx.damage(biologist, scaleDamage(ctx, 10));
        ctx.log({
          member: biologist,
          kind: "bad",
          text: `провалилась в генбассейн с головой (−${dealt} HP)`,
        });
      }
    },
  },
];

/**
 * Случайное событие из пула. Состав команды пул не фильтрует: событие роли, которую
 * никто не занял (или её жабу уже выбили), всё равно выпадает — и всегда проваливается
 * уроном случайной жабе (`failMissingRole`). Так пустые роли стоят команде дороже.
 * Если передан `ctx`, из пула убираются события с невыполненным `available`
 * (например, второй попутчик за поход).
 */
export const pickExpeditionEvent = (
  rng: () => number = Math.random,
  ctx?: ExpeditionEventContext,
): ExpeditionEventDef => {
  const pool = ctx
    ? EXPEDITION_EVENTS.filter((event) => event.available?.(ctx) ?? true)
    : EXPEDITION_EVENTS;

  return (
    pool[Math.floor(rng() * pool.length)] ??
    EXPEDITION_EVENTS[Math.floor(rng() * EXPEDITION_EVENTS.length)]
  );
};

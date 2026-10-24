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
  [Items.geneDust]: "✨",
  [Items.battery]: "🔋",
  [Items.worms]: "🪱",
  [Items.sparkleFlys]: "✨",
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

const NEUTRAL_EVENTS: ExpeditionEventDef[] = [
  {
    id: "sealed_observation_deck",
    run: (ctx) => {
      ctx.log({
        kind: "info",
        text: "Смотровая палуба заварена изнутри. Через щель видно, что станция дрейфует к газовому гиганту — медленно, но верно. Никто не стал считать, сколько осталось.",
      });
    },
  },
  {
    id: "crew_roster_wall",
    run: (ctx) => {
      ctx.log({
        kind: "info",
        text: "На стене — список экипажа. Последние двенадцать имён зачёркнуты одним движением, снизу подписано: «переведены». Куда — не указано.",
      });
    },
  },
  {
    id: "toad_superstition",
    run: (ctx) => {
      ctx.log({
        kind: "info",
        text: "Команда обходит люк с маркировкой «B-13» по широкой дуге. Никто не объясняет почему, и спрашивать никто не хочет.",
      });
    },
  },
  {
    id: "abandoned_experiment_log",
    run: (ctx) => {
      ctx.log({
        kind: "info",
        text: "На терминале открыт журнал эксперимента: последняя запись обрывается на середине слова. Курсор всё ещё мигает.",
      });
    },
  },
  {
    id: "gravity_anomaly",
    run: (ctx) => {
      ctx.log({
        kind: "info",
        text: "В одном отсеке гравитация чуть сильнее — капли конденсата падают быстрее. Приборы показывают норму. Жабы решили не задерживаться.",
      });
    },
  },
  {
    id: "handwritten_warning",
    run: (ctx) => {
      ctx.log({
        kind: "info",
        text: "Кто-то выцарапал на переборке: «они считают нас». Почерк торопливый, глубина царапин — неровная, будто рука дрожала.",
      });
    },
  },
  {
    id: "toad_ritual",
    run: (ctx) => {
      ctx.log({
        kind: "info",
        text: "Одна из жаб молча коснулась переборки и что-то прошептала — старый обычай перед дальней дорогой. Остальные сделали вид, что не заметили.",
      });
    },
  },
  {
    id: "dormant_swarm",
    run: (ctx) => {
      ctx.log({
        kind: "info",
        text: "За стеклом — масса спящих насекомых, прижатых к дальней стенке контейнера. Стекло целое. Пока целое. Команда прошла мимо на цыпочках.",
      });
    },
  },
  {
    id: "sector_map_scratch",
    run: (ctx) => {
      ctx.log({
        kind: "info",
        text: "На стене нацарапана карта сектора. Несколько коридоров перечёркнуты, один обведён трижды. Подписи стёрты — кто-то не хотел, чтобы их читали.",
      });
    },
  },
  {
    id: "distress_buoy",
    run: (ctx) => {
      ctx.log({
        kind: "info",
        text: "В углу мигает спасательный буй. Сигнал записан и повторяется по кругу: голос называет координаты, но не называет себя. Буй никто не выключил.",
      });
    },
  },
];

const EXPEDITION_EVENTS_BASE: ExpeditionEventDef[] = [
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
      const { baseToad } = generateRandomLootboxToad(ctx.sector.id, ctx.rng);
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
        ).toLowerCase()} «${baseToad.name}» — вылезла из вентиляции и увязалась следом. `,
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
          items: { [Items.geneDust]: 1 },
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
          text: `словил весь залп турели (−${dealt} HP), но остальных прикрыл`,
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
          text: `убедил${biologist.toad.sex === "female" ? "а" : ""} плесень расступиться: ${describeLoot(delta)}`,
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
            text: `споры распылились на ${victim.toad.name} (−${dealt} HP)`,
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
        text: `раскопал${medic.toad.sex === "female" ? "а" : ""} нано-ремонтный отсек: команда подлатана на ${healedTotal} HP`,
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
        items: { [Items.geneDust]: 1 },
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
        text: `под ногами чавкнули неизвестные водоросли - взяли с собой, они сгодятся как источник биомассы: ${describeLoot(
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
            `паровой клапан сорвало, струя попала в ${victim.toad.name} (−${dealt} HP): щитоносца в команде нет`,
        );
        return;
      }
      if (ctx.check(tank, 0.55)) {
        const delta = {
          ...stepLoot(ctx, 1.1),
          items: { [Items.geneDust]: 1 },
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
          text: `паровой клапан сорвало, струя пара окатила команду  (-${total} HP)`,
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
            ` дрон-шмель атаковал ${victim.toad.name} (−${dealt} HP): разведчика в команде не было`,
        );
        return;
      }
      if (ctx.check(scout, 0.55)) {
        ctx.log({
          member: scout,
          kind: "good",
          text: `провел команду по рельсам под самым носом дронов-патрульных`,
        });
      } else {
        const dealt = ctx.damage(scout, scaleDamage(ctx, 12));
        ctx.log({
          member: scout,
          kind: "bad",
          text: `подставился под сканер дрона (−${dealt} HP)`,
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
            `генбассейн поглотил ${victim.toad.name} с головой (−${dealt} HP): договариваться было некому`,
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
  {
    id: "medkit_cache",
    run: (ctx) => {
      const power = ctx.byRole("medic")
        ? getRolePower(ctx.byRole("medic")!.toad, "medic")
        : 0;
      const amount = Math.round(6 + power * 8);
      let healed = 0;
      ctx.alive.forEach((m) => {
        healed += ctx.heal(m, amount);
      });
      ctx.log({
        kind: "good",
        text: `в стене нашли аптечку, заныканную кем-то на чёрный день. Судя по пыли, день так и не наступил. Команда подлатана на ${healed} HP`,
      });
    },
  },
  {
    id: "supply_drop_pod",
    run: (ctx) => {
      const delta = {
        ...stepLoot(ctx, 1.2),
        items: { [Items.food]: 2 + Math.floor(ctx.rng() * 4) },
        ...rareLoot(ctx),
      };
      ctx.loot(delta);
      ctx.log({
        kind: "good",
        text: `сбили капсулу снабжения, застрявшую в ферме антенн. На борту — припасы и записка: «прости, что не дождался». Адресат так и не получил посылку: ${describeLoot(delta)}`,
      });
    },
  },
  {
    id: "friendly_maintenance_drone",
    run: (ctx) => {
      const delta = {
        tokens: Math.max(2, Math.round(3 * getSectorLootFactor(ctx.sector))),
        ...rareLoot(ctx),
      };
      ctx.loot(delta);
      ctx.log({
        kind: "good",
        text: `дрон-уборщик принял команду за смену, которую ждал годами, и высыпал содержимое бака: ${describeLoot(delta)}. Улетая, он трижды просигналил что-то похожее на «наконец-то»`,
      });
    },
  },
  {
    id: "clean_water_condenser",
    run: (ctx) => {
      const delta = stepLoot(ctx, 1.3);
      ctx.loot(delta);
      ctx.log({
        kind: "good",
        text: `конденсатор ещё работает — кто-то настраивал его совсем недавно. Нацедили чистой воды и сняли биомассу с осадка: ${describeLoot(delta)}`,
      });
    },
  },
  {
    id: "cache_of_spare_parts",
    run: (ctx) => {
      const delta = {
        items: { [Items.geneDust]: 1 },
        ...stepLoot(ctx, 0.9),
        ...rareLoot(ctx),
      };
      ctx.loot(delta);
      ctx.log({
        kind: "good",
        text: `разобрали заклинивший шкаф с запчастями. Внутри — аккуратно подписанные коробки и пустая полка с биркой «для Витька». Витька здесь давно нет: ${describeLoot(delta)}`,
      });
    },
  },
  {
    id: "collapsing_ceiling",
    run: (ctx) => {
      const { total } = ctx.teamDamage(scaleDamage(ctx, 9));
      ctx.log({
        kind: "bad",
        text: `потолок просел и осыпался: команда потеряла ${total} HP. В обломках — чей-то спальный мешок, аккуратно свёрнутый. Кто-то спал здесь, пока балки держали`,
      });
    },
  },
  {
    id: "acid_drip",
    run: (ctx) => {
      const victim = ctx.randomMember();
      if (!victim) return;
      const dealt = ctx.damage(victim, scaleDamage(ctx, 8));
      ctx.log({
        member: victim,
        kind: "bad",
        text: `капля кислоты с потолка попала ${victim.toad.name} (−${dealt} HP). Над головой — разъеденная труба: кто-то пустил по ней не то, что она должна была нести`,
      });
    },
  },
  {
    id: "false_floor",
    run: (ctx) => {
      const victim = ctx.randomMember();
      if (!victim) return;
      const dealt = ctx.damage(victim, scaleDamage(ctx, 10));
      ctx.log({
        member: victim,
        kind: "bad",
        text: `фальшпол провалился под ${victim.toad.name} (−${dealt} HP). Внизу — кабели, перерезанные аккуратно, а не порванные. Кто-то готовил эту ловушку заранее`,
      });
    },
  },
  {
    id: "contaminated_air",
    run: (ctx) => {
      const victim = ctx.randomMember();
      if (!victim) return;
      const disease = ctx.infect(victim);
      if (disease) {
        ctx.log({
          member: victim,
          kind: "bad",
          text: `в отсеке надышались дряни: ${victim.toad.name} подхватил${victim.toad.sex === "female" ? "а" : ""} ${disease}. Фильтры выдраны с корнем — вентиляцию отключили намеренно`,
        });
      } else {
        const dealt = ctx.damage(victim, scaleDamage(ctx, 6));
        ctx.log({
          member: victim,
          kind: "bad",
          text: `в отсеке надышались дряни: ${victim.toad.name} (−${dealt} HP). Фильтры выдраны с корнем — вентиляцию отключили намеренно`,
        });
      }
    },
  },
  {
    id: "snapped_cable",
    run: (ctx) => {
      const { total } = ctx.teamDamage(scaleDamage(ctx, 7));
      ctx.log({
        kind: "bad",
        text: `лопнувший силовой кабель хлестнул по команде (−${total} HP). На срезе видно: кабель перегрызли, а не перетёрли. Кто-то был здесь и ушёл`,
      });
    },
  },
  {
    id: "manual_override_hatch",
    role: "scout",
    run: (ctx) => {
      const scout = ctx.byRole("scout");
      if (!scout) {
        failMissingRole(
          ctx,
          11,
          (victim, dealt) =>
            `люк захлопнулся, прищемив ${victim.toad.name} (−${dealt} HP): разведчика в команде не было`,
        );
        return;
      }
      if (ctx.check(scout, 0.5)) {
        const delta = { ...stepLoot(ctx, 1.1), ...rareLoot(ctx) };
        ctx.loot(delta);
        ctx.log({
          member: scout,
          kind: "good",
          text: `пролез в технический лаз и открыл ручной обход. В лазу — чужие следы, свежие, но ведущие наружу: ${describeLoot(delta)}`,
        });
      } else {
        const dealt = ctx.damage(scout, scaleDamage(ctx, 11));
        ctx.log({
          member: scout,
          kind: "bad",
          text: `застрял в лазу и ободрался (−${dealt} HP). Стенки лаза исцарапаны изнутри — кто-то выбирался отсюда так же`,
        });
      }
    },
  },
  {
    id: "pressure_bulkhead",
    role: "tank",
    run: (ctx) => {
      const tank = ctx.byRole("tank");
      if (!tank) {
        failMissingRole(
          ctx,
          15,
          (victim, dealt) =>
            `гермодверь прижала ${victim.toad.name} (−${dealt} HP): щитоносца в команде не было`,
        );
        return;
      }
      if (ctx.check(tank, 0.55)) {
        const delta = {
          ...stepLoot(ctx, 1.0),
          items: { [Items.geneDust]: 1 },
          ...rareLoot(ctx),
        };
        ctx.loot(delta);
        ctx.log({
          member: tank,
          kind: "good",
          text: `удержал гермодверь и вынес из отсека всё ценное. За дверью — стол, накрытый на двоих: ${describeLoot(delta)}`,
        });
      } else {
        const dealt = ctx.damage(tank, scaleDamage(ctx, 15));
        ctx.log({
          member: tank,
          kind: "bad",
          text: `дверь пошла на закрытие и приложила щитоносца (−${dealt} HP). Механизм заклинило снаружи — кто-то заблокировал его намеренно`,
        });
      }
    },
  },
  {
    id: "encrypted_black_box",
    role: "hacker",
    run: (ctx) => {
      const hacker = ctx.byRole("hacker");
      if (!hacker) {
        failMissingRole(
          ctx,
          9,
          (victim, dealt) =>
            `чёрный ящик коротнул на ${victim.toad.name} (−${dealt} HP): вскрывать было некому`,
        );
        return;
      }
      if (ctx.check(hacker, 0.45)) {
        const delta = {
          tokens: Math.max(
            3,
            Math.round(
              EXPEDITION_STEP_TOKENS * 1.4 * getSectorLootFactor(ctx.sector),
            ),
          ),
          ...rareLoot(ctx),
        };
        ctx.loot(delta);
        ctx.log({
          member: hacker,
          kind: "good",
          text: `расковырял чёрный ящик дрона. Последняя запись: «возвращаюсь на базу», хотя базы в этом секторе нет уже годами: ${describeLoot(delta)}`,
        });
      } else {
        const dealt = ctx.damage(hacker, scaleDamage(ctx, 9));
        ctx.log({
          member: hacker,
          kind: "bad",
          text: `ящик оказался с сюрпризом (−${dealt} HP). Внутри — не данные, а ловушка. Кто-то не хотел, чтобы это читали`,
        });
      }
    },
  },
  {
    id: "spore_hive",
    role: "negotiator",
    run: (ctx) => {
      const negotiator = ctx.byRole("negotiator");
      if (!negotiator) {
        failMissingRole(
          ctx,
          9,
          (victim, dealt) =>
            `улей плесени атаковал ${victim.toad.name} (−${dealt} HP): договариваться было некому`,
        );
        return;
      }
      if (ctx.check(negotiator, 0.5)) {
        const delta: ExpeditionLootDelta = {
          ...stepLoot(ctx, 0.7),
          ...rareLoot(ctx),
        };
        if (ctx.rng() < 0.2) {
          delta.sample = (delta.sample || 0) + 1;
        }
        ctx.loot(delta);
        ctx.log({
          member: negotiator,
          kind: "good",
          text: `уговорил${negotiator.toad.sex === "female" ? "а" : ""} улей отдать излишки. Плесень признала команду — значит, кто-то до неё уже договаривался: ${describeLoot(delta)}`,
        });
      } else {
        const victim = ctx.randomMember() ?? negotiator;
        const dealt = ctx.damage(victim, scaleDamage(ctx, 9));
        ctx.log({
          member: victim,
          kind: "bad",
          text: `улей не стал слушать: ${victim.toad.name} (−${dealt} HP). В спорах улей видел только чужаков — и, судя по костям у входа, не впервые`,
        });
      }
    },
  },
  {
    id: "field_surgery_kit",
    role: "medic",
    run: (ctx) => {
      const medic = ctx.byRole("medic");
      if (!medic) {
        failMissingRole(
          ctx,
          8,
          (victim, dealt) =>
            `автоклав ошпарил ${victim.toad.name} (−${dealt} HP): ремонтника в команде нет`,
        );
        return;
      }
      if (ctx.check(medic, 0.55)) {
        const power = getRolePower(medic.toad, "medic");
        const amount = Math.round(10 + power * 16);
        let healed = 0;
        ctx.alive.forEach((m) => {
          healed += ctx.heal(m, amount);
        });
        ctx.log({
          member: medic,
          kind: "good",
          text: `развернул${medic.toad.sex === "female" ? "а" : ""} полевую хирургию в старом медотсеке. На столе — разложенные инструменты, будто врач вышел на минуту: команда восстановлена на ${healed} HP`,
        });
      } else {
        const dealt = ctx.damage(medic, scaleDamage(ctx, 8));
        ctx.log({
          member: medic,
          kind: "bad",
          text: `медотсек оказался неисправен, автоклав ошпарил ремонтника (−${dealt} HP). В журнале — последняя запись: «стерилизовать повторно» — и дата трёхлетней давности`,
        });
      }
    },
  },
  {
    id: "medkit_cache",
    run: (ctx) => {
      const power = ctx.byRole("medic")
        ? getRolePower(ctx.byRole("medic")!.toad, "medic")
        : 0;
      const amount = Math.round(6 + power * 8);
      let healed = 0;
      ctx.alive.forEach((m) => {
        healed += ctx.heal(m, amount);
      });
      ctx.log({
        kind: "good",
        text: `в стене нашли аптечку, заныканную кем-то на чёрный день. Судя по пыли, день так и не наступил. Команда подлатана на ${healed} HP`,
      });
    },
  },
  {
    id: "supply_drop_pod",
    run: (ctx) => {
      const delta = {
        ...stepLoot(ctx, 1.2),
        items: { [Items.food]: 2 + Math.floor(ctx.rng() * 4) },
        ...rareLoot(ctx),
      };
      ctx.loot(delta);
      ctx.log({
        kind: "good",
        text: `сбили капсулу снабжения, застрявшую в ферме антенн. На борту — припасы и записка: «прости, что не дождался». Адресат так и не получил посылку: ${describeLoot(delta)}`,
      });
    },
  },
  {
    id: "friendly_maintenance_drone",
    run: (ctx) => {
      const delta = {
        tokens: Math.max(2, Math.round(3 * getSectorLootFactor(ctx.sector))),
        ...rareLoot(ctx),
      };
      ctx.loot(delta);
      ctx.log({
        kind: "good",
        text: `дрон-уборщик принял команду за смену, которую ждал годами, и высыпал содержимое бака: ${describeLoot(delta)}. Улетая, он трижды просигналил что-то похожее на «наконец-то»`,
      });
    },
  },
  {
    id: "clean_water_condenser",
    run: (ctx) => {
      const delta = stepLoot(ctx, 1.3);
      ctx.loot(delta);
      ctx.log({
        kind: "good",
        text: `конденсатор ещё работает — кто-то настраивал его совсем недавно. Нацедили чистой воды и сняли биомассу с осадка: ${describeLoot(delta)}`,
      });
    },
  },
  {
    id: "cache_of_spare_parts",
    run: (ctx) => {
      const delta = {
        items: { [Items.geneDust]: 1 },
        ...stepLoot(ctx, 0.9),
        ...rareLoot(ctx),
      };
      ctx.loot(delta);
      ctx.log({
        kind: "good",
        text: `разобрали заклинивший шкаф с запчастями. Внутри — аккуратно подписанные коробки и пустая полка с биркой «для Витька». Витька здесь давно нет: ${describeLoot(delta)}`,
      });
    },
  },
  {
    id: "collapsing_ceiling",
    run: (ctx) => {
      const { total } = ctx.teamDamage(scaleDamage(ctx, 9));
      ctx.log({
        kind: "bad",
        text: `потолок просел и осыпался: команда потеряла ${total} HP. В обломках — чей-то спальный мешок, аккуратно свёрнутый. Кто-то спал здесь, пока балки держали`,
      });
    },
  },
  {
    id: "acid_drip",
    run: (ctx) => {
      const victim = ctx.randomMember();
      if (!victim) return;
      const dealt = ctx.damage(victim, scaleDamage(ctx, 8));
      ctx.log({
        member: victim,
        kind: "bad",
        text: `капля кислоты с потолка попала ${victim.toad.name} (−${dealt} HP). Над головой — разъеденная труба: кто-то пустил по ней не то, что она должна была нести`,
      });
    },
  },
  {
    id: "false_floor",
    run: (ctx) => {
      const victim = ctx.randomMember();
      if (!victim) return;
      const dealt = ctx.damage(victim, scaleDamage(ctx, 10));
      ctx.log({
        member: victim,
        kind: "bad",
        text: `фальшпол провалился под ${victim.toad.name} (−${dealt} HP). Внизу — кабели, перерезанные аккуратно, а не порванные. Кто-то готовил эту ловушку заранее`,
      });
    },
  },
  {
    id: "contaminated_air",
    run: (ctx) => {
      const victim = ctx.randomMember();
      if (!victim) return;
      const disease = ctx.infect(victim);
      if (disease) {
        ctx.log({
          member: victim,
          kind: "bad",
          text: `в отсеке надышались дряни: ${victim.toad.name} подхватил${victim.toad.sex === "female" ? "а" : ""} ${disease}. Фильтры выдраны с корнем — вентиляцию отключили намеренно`,
        });
      } else {
        const dealt = ctx.damage(victim, scaleDamage(ctx, 6));
        ctx.log({
          member: victim,
          kind: "bad",
          text: `в отсеке надышались дряни: ${victim.toad.name} (−${dealt} HP). Фильтры выдраны с корнем — вентиляцию отключили намеренно`,
        });
      }
    },
  },
  {
    id: "snapped_cable",
    run: (ctx) => {
      const { total } = ctx.teamDamage(scaleDamage(ctx, 7));
      ctx.log({
        kind: "bad",
        text: `лопнувший силовой кабель хлестнул по команде (−${total} HP). На срезе видно: кабель перегрызли, а не перетёрли. Кто-то был здесь и ушёл`,
      });
    },
  },
  {
    id: "manual_override_hatch",
    role: "scout",
    run: (ctx) => {
      const scout = ctx.byRole("scout");
      if (!scout) {
        failMissingRole(
          ctx,
          11,
          (victim, dealt) =>
            `люк захлопнулся, прищемив ${victim.toad.name} (−${dealt} HP): разведчика в команде не было`,
        );
        return;
      }
      if (ctx.check(scout, 0.5)) {
        const delta = { ...stepLoot(ctx, 1.1), ...rareLoot(ctx) };
        ctx.loot(delta);
        ctx.log({
          member: scout,
          kind: "good",
          text: `пролез в технический лаз и открыл ручной обход. В лазу — чужие следы, свежие, но ведущие наружу: ${describeLoot(delta)}`,
        });
      } else {
        const dealt = ctx.damage(scout, scaleDamage(ctx, 11));
        ctx.log({
          member: scout,
          kind: "bad",
          text: `застрял в лазу и ободрался (−${dealt} HP). Стенки лаза исцарапаны изнутри — кто-то выбирался отсюда так же`,
        });
      }
    },
  },
  {
    id: "pressure_bulkhead",
    role: "tank",
    run: (ctx) => {
      const tank = ctx.byRole("tank");
      if (!tank) {
        failMissingRole(
          ctx,
          15,
          (victim, dealt) =>
            `гермодверь прижала ${victim.toad.name} (−${dealt} HP): щитоносца в команде не было`,
        );
        return;
      }
      if (ctx.check(tank, 0.55)) {
        const delta = {
          ...stepLoot(ctx, 1.0),
          items: { [Items.geneDust]: 1 },
          ...rareLoot(ctx),
        };
        ctx.loot(delta);
        ctx.log({
          member: tank,
          kind: "good",
          text: `удержал гермодверь и вынес из отсека всё ценное. За дверью — стол, накрытый на двоих: ${describeLoot(delta)}`,
        });
      } else {
        const dealt = ctx.damage(tank, scaleDamage(ctx, 15));
        ctx.log({
          member: tank,
          kind: "bad",
          text: `дверь пошла на закрытие и приложила щитоносца (−${dealt} HP). Механизм заклинило снаружи — кто-то заблокировал его намеренно`,
        });
      }
    },
  },
  {
    id: "encrypted_black_box",
    role: "hacker",
    run: (ctx) => {
      const hacker = ctx.byRole("hacker");
      if (!hacker) {
        failMissingRole(
          ctx,
          9,
          (victim, dealt) =>
            `чёрный ящик коротнул на ${victim.toad.name} (−${dealt} HP): вскрывать было некому`,
        );
        return;
      }
      if (ctx.check(hacker, 0.45)) {
        const delta = {
          tokens: Math.max(
            3,
            Math.round(
              EXPEDITION_STEP_TOKENS * 1.4 * getSectorLootFactor(ctx.sector),
            ),
          ),
          ...rareLoot(ctx),
        };
        ctx.loot(delta);
        ctx.log({
          member: hacker,
          kind: "good",
          text: `расковырял чёрный ящик дрона. Последняя запись: «возвращаюсь на базу», хотя базы в этом секторе нет уже годами: ${describeLoot(delta)}`,
        });
      } else {
        const dealt = ctx.damage(hacker, scaleDamage(ctx, 9));
        ctx.log({
          member: hacker,
          kind: "bad",
          text: `ящик оказался с сюрпризом (−${dealt} HP). Внутри — не данные, а ловушка. Кто-то не хотел, чтобы это читали`,
        });
      }
    },
  },
  {
    id: "spore_hive",
    role: "negotiator",
    run: (ctx) => {
      const negotiator = ctx.byRole("negotiator");
      if (!negotiator) {
        failMissingRole(
          ctx,
          9,
          (victim, dealt) =>
            `улей плесени атаковал ${victim.toad.name} (−${dealt} HP): договариваться было некому`,
        );
        return;
      }
      if (ctx.check(negotiator, 0.5)) {
        const delta: ExpeditionLootDelta = {
          ...stepLoot(ctx, 0.7),
          ...rareLoot(ctx),
        };
        if (ctx.rng() < 0.2) {
          delta.sample = (delta.sample || 0) + 1;
        }
        ctx.loot(delta);
        ctx.log({
          member: negotiator,
          kind: "good",
          text: `уговорил${negotiator.toad.sex === "female" ? "а" : ""} улей отдать излишки. Плесень признала команду — значит, кто-то до неё уже договаривался: ${describeLoot(delta)}`,
        });
      } else {
        const victim = ctx.randomMember() ?? negotiator;
        const dealt = ctx.damage(victim, scaleDamage(ctx, 9));
        ctx.log({
          member: victim,
          kind: "bad",
          text: `улей не стал слушать: ${victim.toad.name} (−${dealt} HP). В спорах улей видел только чужаков — и, судя по костям у входа, не впервые`,
        });
      }
    },
  },
  {
    id: "field_surgery_kit",
    role: "medic",
    run: (ctx) => {
      const medic = ctx.byRole("medic");
      if (!medic) {
        failMissingRole(
          ctx,
          8,
          (victim, dealt) =>
            `автоклав ошпарил ${victim.toad.name} (−${dealt} HP): ремонтника в команде нет`,
        );
        return;
      }
      if (ctx.check(medic, 0.55)) {
        const power = getRolePower(medic.toad, "medic");
        const amount = Math.round(10 + power * 16);
        let healed = 0;
        ctx.alive.forEach((m) => {
          healed += ctx.heal(m, amount);
        });
        ctx.log({
          member: medic,
          kind: "good",
          text: `развернул${medic.toad.sex === "female" ? "а" : ""} полевую хирургию в старом медотсеке. На столе — разложенные инструменты, будто врач вышел на минуту: команда восстановлена на ${healed} HP`,
        });
      } else {
        const dealt = ctx.damage(medic, scaleDamage(ctx, 8));
        ctx.log({
          member: medic,
          kind: "bad",
          text: `медотсек оказался неисправен, автоклав ошпарил ремонтника (−${dealt} HP). В журнале — последняя запись: «стерилизовать повторно» — и дата трёхлетней давности`,
        });
      }
    },
  },
];

/** Полный пул: ролевые события и общие нейтральные */
export const EXPEDITION_EVENTS: ExpeditionEventDef[] = [
  ...EXPEDITION_EVENTS_BASE,
  ...NEUTRAL_EVENTS,
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

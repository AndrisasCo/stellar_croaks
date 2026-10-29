/**
 * Проверка сборки команды похода из жаб комнаты «Разведка» на РЕАЛЬНОМ коде проекта.
 *
 * Скрипт бандлит модули через esbuild и прогоняет их как обычный JS, поэтому проверяются
 * те же формулы, что работают в модалке походов, а не их копия (`utils/expedition-crew.ts`):
 *   1) слоты команды: пять ролей, пустой набор свободен целиком;
 *   2) сильнейшая роль жабы — по её характеристике для роли (скаут/щитоносец/ремонтник/
 *      оператор/биолог), а проценты в UI = сила роли × 100;
 *   3) одна жаба — одна роль: перевод жабы на другую роль освобождает прежнюю, а выбранная
 *      роль переходит новой жабе (прежний жилец слота выходит из команды);
 *   4) функции не трогают переданные слоты (в модалке это состояние React);
 *   5) тап по жабе комнаты ставит её на сильнейшую из свободных ролей, а когда свободных нет —
 *      на сильнейшую вообще;
 *   6) «Собрать команду»: свободные роли занимают сильнейшие пары «жаба — роль», занятые роли
 *      и уже выбранные жабы не трогаются, лишние жабы остаются в комнате, пустой экипаж
 *      ничего не меняет, повторный сбор — тот же результат;
 *   7) полный круг модалки: собрали из комнаты → убрали жабу → поставили обратно;
 *   8) сортировка жаб под роль для выпадающих списков роли (`sortToadsByRolePower`):
 *      сверху сильнейшая для роли, список не теряет жаб, исходный массив не мутируется,
 *      равные по силе остаются в порядке колонии;
 *   9) слоты и жильцы «Разведки» — одно и то же (`syncSlotsWithCrew`): жаба, ушедшая из
 *      сектора, освобождает роль, вернувшаяся — снова её занимает, чужие роли не
 *      перетасовываются, лишняя жаба сектора полную команду не трогает, а без изменений
 *      возвращается тот же объект слотов (React не перерисовывается зря).
 *
 * Запуск: node tmp-verify-expedition-crew.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const outDir = mkdtempSync(join(tmpdir(), "croak-crew-"));
const root = process.cwd();

/** Собрать модуль проекта в CJS, чтобы запустить его в node */
const bundle = (entry, name) => {
  const outfile = join(outDir, `${name}.cjs`);
  execFileSync(
    "npx",
    [
      "esbuild",
      entry,
      "--bundle",
      "--format=cjs",
      "--platform=node",
      "--log-level=error",
      `--outfile=${outfile}`,
    ],
    { cwd: root, stdio: ["ignore", "ignore", "inherit"] },
  );

  return require(outfile);
};

/**
 * Сохранение игре здесь не нужно (сборка команды — чистая арифметика слотов), но модели
 * подтягивают конфиги через платформенный слой: подменяем localStorage, как в других smoke-тестах.
 */
globalThis.localStorage ||= {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};
globalThis.window ||= { dispatchEvent: () => true, addEventListener: () => {} };
globalThis.window.localStorage = globalThis.localStorage;

const crew = bundle("src/utils/expedition-crew.ts", "expedition-crew");
const config = bundle("src/utils/expedition-config.ts", "expedition-config");
const models = bundle("src/models/expedition.ts", "models-expedition");

const failures = [];
const check = (label, actual, expected) => {
  const ok = actual === expected;
  if (!ok) {
    failures.push(`${label}: получили ${actual}, ждали ${expected}`);
  }
  console.log(`${ok ? "✅" : "❌"} ${label}: ${actual}`);
};

/** Жаба комнаты «Разведка» с заданными генами (гены — единственный источник ролей) */
const T = (id, genes = {}) => ({
  id,
  name: `Жаба ${id}`,
  stage: "adult",
  generation: 1,
  sex: "male",
  type: "hybrid",
  scene_id: 1,
  roomId: "room-scout",
  created_at: new Date().toISOString(),
  parents: null,
  state: { hunger: 100 },
  pregnancy: null,
  genes: {
    colors: ["#000000"],
    pattern: "smooth",
    weight: 15,
    speed: 1,
    rarity: 1,
    hungerRate: 1,
    fertility: 1,
    personality: null,
    ...genes,
  },
});

/** Жабы «по профилю» роли: характеристика на потолке роли даёт силу 100 % */
const scoutToad = T(1, { speed: 1.5, weight: 5, fertility: 0.2, rarity: 0 });
const tankToad = T(2, { weight: 48, speed: 0.5, fertility: 0.2, rarity: 0 });
const medicToad = T(3, { fertility: 3, speed: 0.5, weight: 5, rarity: 0 });
const hackerToad = T(4, { rarity: 12, speed: 0.5, weight: 5, fertility: 0.2 });
// Роль биолога решает характер: гены при этом слабые, чтобы не тянуть другие роли
const bioToad = T(5, {
  personality: "bold",
  speed: 0.5,
  weight: 4,
  fertility: 0.5,
  rarity: 0,
});
/** Слабые жабы комнаты: не сильнее ни одной из профильных — в команду не попадут */
const weakToad = T(6, { speed: 1, weight: 5, fertility: 0.5, rarity: 0 });
const weakToad2 = T(7, { speed: 0.5, weight: 5, fertility: 2.2, rarity: 0 });

const rolesOf = (slots) =>
  models.EXPEDITION_ROLE_ORDER.map((role) => slots[role]).filter(
    (id) => id !== "",
  );
const teamOf = (slots) => new Set(rolesOf(slots));
const snapshot = (slots) => JSON.stringify(slots);
const checkTrue = (label, value) => check(label, value ? "да" : "нет", "да");

console.log("\n[1] Слоты команды");
console.log("─".repeat(60));
const empty = crew.emptyExpeditionSlots();
check("ролей в команде", models.EXPEDITION_ROLE_ORDER.length, 5);
check("свободных ролей на старте", crew.countFreeRoles(empty), 5);
check("роль скаута свободна", empty.scout, "");
check(
  "у жабы на пустом составе роли нет",
  crew.getAssignedRole(empty, 1) ?? "нет",
  "нет",
);

console.log("\n[2] Сильнейшая роль жабы");
console.log("─".repeat(60));
check("быстрая жаба — скаут", crew.getBestRole(scoutToad), "scout");
check("тяжёлая жаба — щитоносец", crew.getBestRole(tankToad), "tank");
check("плодовитая жаба — ремонтник", crew.getBestRole(medicToad), "medic");
check("редкая жаба — оператор", crew.getBestRole(hackerToad), "hacker");
check("жаба с характером — биолог", crew.getBestRole(bioToad), "negotiator");
// Потолок роли берём из конфига: характеристики ролей меняются вместе с балансом,
// а проверяем мы перевод силы в проценты, а не конкретное число скорости.
const scoutCap = config.ROLE_CONFIG.scout.statCap;
const capScout = {
  ...scoutToad,
  genes: { ...scoutToad.genes, speed: scoutCap },
};
const halfScout = {
  ...scoutToad,
  genes: { ...scoutToad.genes, speed: scoutCap / 2 },
};
check(
  "проценты роли = сила × 100",
  crew.getRolePowerPercent(capScout, "scout"),
  100,
);
check(
  "половина силы роли — половина процентов",
  crew.getRolePowerPercent(halfScout, "scout"),
  50,
);
check(
  "проценты совпадают с силой роли",
  crew.getRolePowerPercent(bioToad, "negotiator"),
  Math.round(config.getRolePower(bioToad, "negotiator") * 100),
);

console.log("\n[3] Одна жаба — одна роль");
console.log("─".repeat(60));
const scoutOnly = crew.assignToadToRole(empty, scoutToad.id, "scout");
check("жаба встала на роль", scoutOnly.scout, scoutToad.id);
const movedToTank = crew.assignToadToRole(scoutOnly, scoutToad.id, "tank");
check("прежняя роль освободилась", movedToTank.scout, "");
check("жаба встала на новую роль", movedToTank.tank, scoutToad.id);
check("у жабы одна роль", rolesOf(movedToTank).length, 1);
const displaced = crew.assignToadToRole(scoutOnly, tankToad.id, "scout");
check("слот перешёл новой жабе", displaced.scout, tankToad.id);
check(
  "прежний жилец слота вышел из команды",
  crew.getAssignedRole(displaced, scoutToad.id) ?? "нет",
  "нет",
);
check(
  "исходные слоты не изменились",
  snapshot(scoutOnly),
  snapshot({ ...empty, scout: scoutToad.id }),
);
check("свободных ролей после вытеснения", crew.countFreeRoles(displaced), 4);

console.log("\n[4] Снятие жабы из команды");
console.log("─".repeat(60));
const removed = crew.removeToadFromTeam(scoutOnly, scoutToad.id);
check("роль после снятия свободна", removed.scout, "");
check("свободных ролей стало пять", crew.countFreeRoles(removed), 5);
check(
  "повторное снятие ничего не меняет",
  crew.removeToadFromTeam(removed, scoutToad.id),
  removed,
);
check(
  "снятие чужой жабы не трогает слоты",
  crew.removeToadFromTeam(scoutOnly, 999) === scoutOnly,
  true,
);

console.log("\n[5] Куда встанет жаба комнаты по тапу");
console.log("─".repeat(60));
check(
  "на пустом составе — на сильнейшую роль",
  crew.getCrewTapRole(empty, scoutToad),
  "scout",
);
check(
  "если сильнейшая занята другой жабой — на сильнейшую свободную",
  crew.getCrewTapRole(
    crew.assignToadToRole(empty, tankToad.id, "scout"),
    scoutToad,
  ),
  "negotiator",
);
check(
  "своя роль для жабы свободна: жаба остаётся на ней",
  crew.getCrewTapRole(scoutOnly, scoutToad),
  "scout",
);
const full = {
  scout: tankToad.id,
  tank: weakToad.id,
  medic: weakToad2.id,
  hacker: medicToad.id,
  negotiator: hackerToad.id,
};
check("на полном составе свободных ролей нет", crew.countFreeRoles(full), 0);
check(
  "когда всё занято — на сильнейшую вообще",
  crew.getCrewTapRole(full, scoutToad),
  "scout",
);

console.log("\n[6] «Собрать команду» из жаб комнаты");
console.log("─".repeat(60));
const pair = crew.fillTeamFromCrew(empty, [scoutToad, tankToad]);
check("профильная жаба встала на свою роль", pair.scout, scoutToad.id);
check("вторая жаба — на свою роль", pair.tank, tankToad.id);
check("остальные роли остались пустыми", crew.countFreeRoles(pair), 3);

const five = crew.fillTeamFromCrew(empty, [
  bioToad,
  hackerToad,
  tankToad,
  medicToad,
  scoutToad,
]);
check("все пять ролей заняты", crew.countFreeRoles(five), 0);
check("жаб в команде ровно пять", teamOf(five).size, 5);
check("скаут — по профилю", five.scout, scoutToad.id);
check("щитоносец — по профилю", five.tank, tankToad.id);
check("ремонтник — по профилю", five.medic, medicToad.id);
check("оператор — по профилю", five.hacker, hackerToad.id);
check("биолог — по профилю", five.negotiator, bioToad.id);

const kept = crew.fillTeamFromCrew({ ...empty, medic: 9 }, [T(9), scoutToad]);
check("уже выбранная жаба осталась на месте", kept.medic, 9);
check("свободную роль заняла жаба комнаты", kept.scout, scoutToad.id);
check("жаба-медик не встала в чужую роль", rolesOf(kept).length, 2);

const crowded = crew.fillTeamFromCrew({ ...empty, scout: 100 }, [
  scoutToad,
  weakToad,
  weakToad2,
  tankToad,
  medicToad,
  hackerToad,
  bioToad,
]);
check("занятая роль не тронута", crowded.scout, 100);
check("оставшиеся роли заняты", crew.countFreeRoles(crowded), 0);
check("в команде пять жаб", rolesOf(crowded).length, 5);
checkTrue(
  "слабая жаба осталась в комнате",
  !teamOf(crowded).has(weakToad.id),
);
checkTrue(
  "вторая слабая жаба осталась в комнате",
  !teamOf(crowded).has(weakToad2.id),
);
check(
  "пустой экипаж ничего не меняет",
  snapshot(crew.fillTeamFromCrew(full, [])),
  snapshot(full),
);
check(
  "повторный сбор даёт тот же состав",
  snapshot(
    crew.fillTeamFromCrew(five, [
      scoutToad,
      tankToad,
      medicToad,
      hackerToad,
      bioToad,
    ]),
  ),
  snapshot(five),
);

console.log("\n[7] Полный круг модалки");
console.log("─".repeat(60));
const without = crew.removeToadFromTeam(five, tankToad.id);
check("после снятия роль свободна", without.tank, "");
check("свободная роль одна", crew.countFreeRoles(without), 1);
const backAgain = crew.assignToadToRole(
  without,
  tankToad.id,
  crew.getCrewTapRole(without, tankToad),
);
check("жаба вернулась на свою роль", backAgain.tank, tankToad.id);
check("состав снова полный и тот же", snapshot(backAgain), snapshot(five));

console.log("\n[8] Сортировка жаб под роль (выпадающие списки роли)");
console.log("─".repeat(60));
/** Порядок списка одной строкой id — так видно и состав, и очерёдность */
const idsOf = (toads) => toads.map((toad) => toad.id).join("-");
/** Кто оказался первым в списке (id строкой) */
const topId = (toads) => String(toads[0].id);
const colony = [weakToad2, bioToad, scoutToad, hackerToad, tankToad, medicToad];
const before = idsOf(colony);

check(
  "скаут: сверху самая быстрая жаба",
  topId(crew.sortToadsByRolePower(colony, "scout")),
  String(scoutToad.id),
);
check(
  "щитоносец: сверху самая тяжёлая жаба",
  topId(crew.sortToadsByRolePower(colony, "tank")),
  String(tankToad.id),
);
check(
  "ремонтник: сверху самая плодовитая жаба",
  topId(crew.sortToadsByRolePower(colony, "medic")),
  String(medicToad.id),
);
check(
  "оператор: сверху самая редкая жаба",
  topId(crew.sortToadsByRolePower(colony, "hacker")),
  String(hackerToad.id),
);
/** Профильная жаба роли биолога: в коде силу роли решает hungerRate */
const hungryToad = T(30, { hungerRate: 1.4 });
check(
  "биолог: сверху жаба с самым большим hungerRate",
  topId(crew.sortToadsByRolePower([...colony, hungryToad], "negotiator")),
  String(hungryToad.id),
);
check(
  "биолог: при равной силе роли порядок колонии сохраняется",
  idsOf(crew.sortToadsByRolePower(colony, "negotiator")),
  before,
);
checkTrue(
  "сила роли не растёт вниз по списку",
  crew
    .sortToadsByRolePower(colony, "scout")
    .every(
      (toad, index, list) =>
        index === 0 ||
        config.getRolePower(list[index - 1], "scout") >=
          config.getRolePower(toad, "scout"),
    ),
);
checkTrue(
  "сортировка не теряет и не добавляет жаб",
  (() => {
    const sorted = crew.sortToadsByRolePower(colony, "negotiator");
    return (
      sorted.length === colony.length &&
      colony.every((toad) => sorted.includes(toad))
    );
  })(),
);
check("исходный список не тронут", idsOf(colony), before);

/** Две жабы с одинаковыми генами: сила роли равна, значит порядок колонии сохраняется */
const twinA = T(20, { speed: 1.2 });
const twinB = T(21, { speed: 1.2 });
check(
  "равные по силе жабы — в порядке колонии",
  idsOf(crew.sortToadsByRolePower([twinA, twinB], "scout")),
  "20-21",
);
check(
  "перестановка равных жаб на входе меняет и порядок вывода",
  idsOf(crew.sortToadsByRolePower([twinB, twinA], "scout")),
  "21-20",
);

console.log("\n[9] Слоты = жильцы «Разведки» (syncSlotsWithCrew)");
console.log("─".repeat(60));
/** Состав сектора «Разведка»: те же пять жаб, что модалка держит в слотах */
const teamCrew = [scoutToad, tankToad, medicToad, hackerToad, bioToad];
const synced = crew.syncSlotsWithCrew(empty, teamCrew);
check("пустые слоты заняли жильцы сектора", snapshot(synced), snapshot(five));
checkTrue(
  "без изменений возвращается тот же объект",
  crew.syncSlotsWithCrew(synced, teamCrew) === synced,
);
checkTrue(
  "синхронизация не мутирует переданные слоты",
  snapshot(empty) ===
    snapshot({ scout: "", tank: "", medic: "", hacker: "", negotiator: "" }),
);

/** Жабу вернули в биопод: её роль освобождается, чужие роли не перетасовываются */
const left = crew.syncSlotsWithCrew(
  synced,
  teamCrew.filter((toad) => toad.id !== scoutToad.id),
);
check("ушедшая жаба покинула слот", left.scout, "");
check("свободных ролей после ухода жабы", crew.countFreeRoles(left), 1);
check(
  "чужие роли не тронуты",
  snapshot({ ...left, scout: synced.scout }),
  snapshot(synced),
);
checkTrue("объект слотов сменился", left !== synced);

/** Вернувшаяся в сектор команда снова занимает слоты — без ручной сборки */
const returned = crew.syncSlotsWithCrew(left, teamCrew);
check("вернувшаяся жаба снова на роли", returned.scout, scoutToad.id);
check("состав снова полный", crew.countFreeRoles(returned), 0);

/** Лишняя жаба в секторе (перенесли на карте) не вытесняет собранную команду */
checkTrue(
  "лишняя жаба сектора не трогает полную команду",
  crew.syncSlotsWithCrew(synced, [...teamCrew, weakToad]) === synced,
);

/** Свободную роль занимает жилец сектора — по силе роли, а не по порядку колонии */
const medicLeft = crew.syncSlotsWithCrew(synced, [
  scoutToad,
  tankToad,
  hackerToad,
  bioToad,
  weakToad,
]);
check("свободную роль занял жилец сектора", medicLeft.medic, weakToad.id);
check("жаб в команде по-прежнему пять", rolesOf(medicLeft).length, 5);

/** Поход забрал жабу из сектора: слот освобождается, а не держит жабу «в пути» */
const onRun = crew.syncSlotsWithCrew(
  synced,
  teamCrew.filter((toad) => toad.id !== hackerToad.id),
);
check("слот ушедшей в поход жабы свободен", onRun.hacker, "");
check("свободных ролей, пока жаба в походе", crew.countFreeRoles(onRun), 1);

console.log("\n" + "─".repeat(60));
if (failures.length > 0) {
  console.log(`❌ Провалено проверок: ${failures.length}`);
  failures.forEach((item) => console.log(`   • ${item}`));
  process.exit(1);
}

console.log("✅ Все проверки сборки команды из «Разведки» прошли");


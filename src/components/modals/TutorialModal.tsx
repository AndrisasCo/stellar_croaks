import React, { useEffect } from "react";
import Modal from "../shared/Header";
import { useSoundEffects } from "../../hooks/use-sound-effects";
import { INITIAL_CAPACITY } from "../../models/scene";
import { CURRENCY_CONFIG, TYPE_ICONS } from "../../utils/constants";
import { completeAchivement } from "../../backend/achivements-manager";
import { useModal } from "../ModalContext";
import { CurrencyText } from "../shared/CurrencyIcon";

const TutorialModal: React.FC = () => {
  const { playClick } = useSoundEffects();
  const { closeModal } = useModal();

  /** Кнопка «Начать игру!» закрывает обучение (раньше handleClose не была определена) */
  const handleClose = () => closeModal();

  useEffect(() => {
    completeAchivement("read-tutorial");
  }, []);

  const icon = (
    <svg
      className="w-6 h-6 text-blue-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
      />
    </svg>
  );

  const tutorialSections = [
    {
      icon: "🐸",
      title: "Ваши первые жабы",
      description:
        "В начале игры у вас есть стартовые жабы - самец и самка. Ухаживайте за ними, кормите и разводите потомство.",
      color: "green",
      tips: [
        "💚 Кормите жаб регулярно - голодные жабы не растут и не вырабатывают биомассу",
        "🎯 Нажимайте на жаб для просмотра характеристик",
        "🏠 Перемещайте жаб между биоподами для селекции",
        "🧭 Первые два гекса на карте колонии — «Разведка» (25🔷) и «Склад» (25🔷): походы приносят больше фермы, а склад расширяет полки",
        "🌝 Если вы случайно уничтожили единственных жаб и при этом не можете купить новых - не беда! Сбросьте игровой прогресс в настройках, это позволит попробовать свои силы еще раз. ",
      ],
    },
    {
      icon: "🧪",
      title: "Биомасса - ресурс биокупола",
      description:
        "Жабы в биоподах круглосуточно вырабатывают биомассу. Это главный ресурс лаборатории: он тратится на размножение, а излишки обмениваются на Кваксы.",
      color: "yellow",
      tips: [
        "📈 Выработка зависит от редкости, размера и характера - выгоднее всего редкие и крупные жабы",
        "🍽️ При сытости 20 % и ниже жаба выдаёт только 30 % нормы — кормите её, чтобы ферма не проседала",
        "🧾 Каждая жаба в биоподе съедает 0.6 биомассы в час на содержание",
        `🏠 Мест в биоподах больше не бывает «про запас»: каждая жаба живёт в биоподе, новый биопод строится гексом на карте (+${INITIAL_CAPACITY} мест)`,
      ],
    },
    {
      icon: "❤️",
      title: "Разведение в Репродукторе",
      description:
        "Потомство появляется только в репродукторе: посадите туда самца и самку и нажмите «Начать ухаживание». Пара платит биомассой и силами, а затем отдыхает.",
      color: "pink",
      tips: [
        "🔬 Посадите самца и самку в репродуктор на карте (2 места) и нажмите «Начать ухаживание» (15–30 мин) — кнопка активна, когда пара отдохнула и хватает биомассы",
        "🧪 Спаривание стоит биомассы: 8 × (1 + качество/20) с каждой жабы",
        "⚡ Спаривание стоит сил: 25 × (1 + качество/20) у каждой жабы",
        "🛏️ После спаривания жабы отдыхают: 10 мин × (1 + качество/10) × характер — отдых можно сбросить за астро-кваксы в Репродукторе",
        "🐸 Из репродуктора жабы сами не уходят: и после ухаживания, и после родов их выносит игрок, а головастики, рождённые в репродукторе, ждут переноса в биопод",
        "🥚 В репродукторе 2 места — на одну пару. Нужна вторая пара — постройте ещё один «Репродуктор» на карте",
        "⏰ Головастик взрослеет за 2 часа, но таймер запускает только кормление: новорождённый выходит с 0 % сытости — сначала покормите его. Рост ускоряют черви, беременность — мушки",
      ],
    },
    {
      icon: "⚡",
      title: "Силы жаб и отдых",
      description:
        "У каждой жабы есть запас сил (энергия): он тратится на скрещивание и восстанавливается сам, но медленно. Ускорить процесс можно за Астро-кваксы.",
      color: "teal",
      tips: [
        "🔋 Максимум 100 сил, восстановление +6 в час",
        "🛏️ Таймер отдыха после спаривания показан прямо в «Репродукторе»",
        "★ Снять отдых можно за 1 Астро-квакс, ускорить роды - за 2",
        "🌟 Бонусы биопода тоже ускоряют жизнь жаб",
      ],
    },
    {
      icon: "⚗️",
      title: "Генетика и мутации",
      description:
        "Управляйте генетическим здоровьем ваших жаб. Следите за поломками ДНК и выбирайте стратегию разведения.",
      color: "indigo",
      tips: [
        "🧪 Поломка ДНК - показатель здоровья генов (0-100%)",
        "💥 Коллайдер быстро увеличивает поломку, но дает редких жаб",
        "❤️ Естественное размножение мягко уменьшает поломку",
        "⚠️ Близкородственное скрещивание увеличивает поломку: список родственников есть в характеристиках жабы",
        "🔬 Идеальная генетика (0%) - лучший выбор для разведения",
      ],
    },
    {
      icon: "🎛️",
      title: "Коллайдер и гибриды",
      description:
        "Продвинутая и необратимая механика: коллайдер даёт редких жаб, но родители исчезают навсегда.",
      color: "blue",
      tips: [
        "🔍 Комбинируйте жаб в коллайдере, это даст более редкую жабу, но уничтожит родителей",
        "📊 Осторожно! В коллайдере есть шанс получить бесполую жабу",
        "🎯 Попробуйте вывести уникальную жабу",
        "⚖️ Балансируйте между коллайдером и разведением в «Репродукторе»",
      ],
    },
    {
      icon: "♻️",
      title: "Диссоциатор: жаба в биомассу",
      description:
        "Постройка «Диссоциатор» в лаборатории мгновенно перерабатывает жабу в биомассу. Это быстрый способ закрыть дыру в биомассе, но жаба исчезает навсегда.",
      color: "orange",
      tips: [
        "🧪 Выход биомассы = (2 + качество × 1.5) × вес × характер × здоровье",
        "🦴 Головастик даёт 35% выхода, бесполая жаба - 60%",
        "🐛 Больные жабы тоже дают меньше: выгоднее разбирать здоровых",
        "🍼 Беременных разбирать можно, но вынашиваемое потомство пропадёт",
        "⛔ Жаб в инкубаторе коллайдера разобрать нельзя",
        "⚠️ Разбор всегда подтверждается: жаба исчезает навсегда",
      ],
    },
    {
      icon: "🦠",
      title: "Болезни и кибер-события",
      description:
        "Биокупол живёт своей жизнью: случаются утечки, сбои и нанозаражения. Часть событий бьёт по ферме и заражает жаб.",
      color: "orange",
      tips: [
        "🦠 «Сбой прошивки», «Нанозаражение» и «Мутационный каскад» срезают выработку на 30-75% и заразны для соседей",
        "🎲 Кибер-событие может отнять или подарить биомассу, корм, Кваксы и сытость",
        "🛡️ Карантин биопода за 2 Астро-квакса лечит всех больных жаб сцены",
        "⏳ Без лечения болезнь затухает сама по таймеру (6-16 часов)",
      ],
    },
    {
      icon: "🧭",
      title: "Разведка Периметра (походы)",
      description:
        "Команда до 5 жаб уходит за Периметр в сектор-рейд. Поход идёт по реальному времени: события разыгрываются в пути, а добыча возвращается домой вместе с командой.",
      color: "orange",
      tips: [
        "🎯 У каждой жабы своя роль: скаут, щитоносец, ремонтник, оператор и биолог — сила роли считается по её характеристикам",
        "🎲 Каждая роль даёт +20% к шансу удачного возврата: 5 ролей с силой 0.9 — это 45%, три роли по 200% закрывают поход гарантированно",
        "📈 Поход всегда выгоднее фермы: добыча добирается до нормы «ферма за время пути × 1.5 + снаряжение», а удачное завершение умножает улов",
        "🧪 Снаряжение команды стоит биомассы: 4 × глубина сектора за каждую жабу",
        "❤️ У жаб появился запас HP: провалы в событиях бьют по здоровью, щитоносец прикрывает остальных",
        "🏠 Дома HP капает очень медленно (+1 в час), а койка «Медотсека» лечит +24 в час и ускоряет срок болезни",
        "🩹 В Медотсеке 6 коек: вкладка «Медотсек» показывает, кто лежит и кому ещё нужна помощь; мгновенное лечение за Кваксы — самое дорогое",
        "🚁 Команду можно отозвать, ускорить возврат за биомассу или вытащить «Экстренным маяком» за Астро-кваксы",
        "🏢 «Диспетчерская» за Кваксы добавляет вторую и третью команду: походы идут параллельно",
      ],
    },
    {
      icon: "📊",
      title: "Характеристики жаб",
      description:
        "Каждая жаба имеет уникальные гены, влияющие на ее внешность, поведение и способности.",
      color: "teal",
      tips: [
        "⚡ Скорость влияет на передвижение по биоподу",
        "📊 качество увеличивает стоимость жабы и выработку биомассы",
        "💕 Плодовитость влияет на число детей в помёте",
        "🍽️ Аппетит определяет скорость голодания",
        "📏 Размер влияет на визуальное отображение и выработку биомассы",
      ],
    },
    {
      icon: "💰",
      title: "Экономика игры",
      description: `Зарабатывайте ${CURRENCY_CONFIG.tokens.icon} продажей жаб, обменом биомассы и выполнением заказов. Используйте их для покупки корма и улучшений.`,
      color: "yellow",
      tips: [
        `💸 Продавайте жаб на рынке за ${CURRENCY_CONFIG.tokens.icon} ${CURRENCY_CONFIG.tokens.name}`,
        "🧪 Обменивайте излишки биомассы на Кваксы во вкладке «Продать»",
        "⭐ Выполняйте элитные заказы за " +
          `${CURRENCY_CONFIG.astro_quax.icon} ${CURRENCY_CONFIG.astro_quax.name}: редкие сочетания генов и характеров платят сотни астро`,
        "🛒 На рынке покупайте корм, жаб и предметы; биоподы и склады — гексы на карте колонии, обновление витрин стоит Кваксы",
      ],
    },
    {
      icon: "🏆",
      title: "Лидерборд и достижения",
      description:
        "Соревнуйтесь с другими игроками! Зарабатывайте места в рейтингах по редким жабам, богатству и коллекциям.",
      color: "orange",
      tips: [
        "👑 Занимайте топовые места в категориях лидерборда",
        "📈 Увеличивайте коллекцию и развивайте ферму для подъема в рейтинге",
        "🥇 Выполняйте достижения: за полностью закрытые группы дают лутбоксы и уникальных жаб",
      ],
    },
  ];

  const getColorClasses = (color: string) => {
    const colors = {
      green:
        "from-green-900/20 to-emerald-900/10 border-green-400/50 text-green-400",
      pink: "from-pink-900/20 to-rose-900/10 border-pink-400/50 text-pink-400",
      yellow:
        "from-yellow-900/20 to-amber-900/10 border-yellow-400/50 text-yellow-400",
      purple:
        "from-purple-900/20 to-violet-900/10 border-purple-400/50 text-purple-400",
      indigo:
        "from-indigo-900/20 to-purple-900/10 border-indigo-400/50 text-indigo-400",
      teal: "from-teal-900/20 to-cyan-900/10 border-teal-400/50 text-teal-400",
      orange:
        "from-orange-900/20 to-red-900/10 border-orange-400/50 text-orange-400",
      blue: "from-blue-900/20 to-cyan-900/10 border-blue-400/50 text-blue-400",
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  const getTipColorClasses = (color: string) => {
    const colors = {
      green: "bg-green-900/30 border-green-500/30 text-green-300",
      pink: "bg-pink-900/30 border-pink-500/30 text-pink-300",
      yellow: "bg-yellow-900/30 border-yellow-500/30 text-yellow-300",
      purple: "bg-purple-900/30 border-purple-500/30 text-purple-300",
      indigo: "bg-indigo-900/30 border-indigo-500/30 text-indigo-300",
      teal: "bg-teal-900/30 border-teal-500/30 text-teal-300",
      orange: "bg-orange-900/30 border-orange-500/30 text-orange-300",
      blue: "bg-blue-900/30 border-blue-500/30 text-blue-300",
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  return (
    <Modal icon={icon} title="Обучение">
      {/* Контент */}
      <div className="px-4">
        {/* Вступление */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-4">🐸✨</div>
          <h3 className="text-white font-semibold px-2 text-lg mb-2">
            Добро пожаловать в мир космических жаб!
          </h3>
          <p className="text-gray-300 text-sm">
            Освойте все механики игры и станьте лучшим жабоводом галактики
          </p>
        </div>

        {/* Секции обучения */}
        <div className="space-y-6">
          {tutorialSections.map((section, index) => (
            <div
              key={index}
              className={`
                relative rounded-xl p-5 border transition-all
                bg-gradient-to-r ${getColorClasses(section.color)}
                hover:shadow-lg hover:scale-[1.02] transform transition-all duration-300
              `}
            >
              {/* Номер секции */}
              <div
                className={`
                  absolute -top-3 -left-3 w-8 h-8 rounded-full flex items-center justify-center 
                  text-white font-bold text-sm border-2
                  ${
                    section.color === "indigo"
                      ? "bg-indigo-800 border-indigo-500"
                      : section.color === "teal"
                        ? "bg-teal-800 border-teal-500"
                        : "bg-color-main border-gray-600"
                  }
                `}
              >
                {index + 1}
              </div>

              {/* Заголовок секции */}
              <div className="flex items-center gap-3 mb-3">
                <div className="text-2xl">{section.icon}</div>
                <h4 className="text-white font-semibold text-lg">
                  {section.title}
                </h4>
              </div>

              {/* Описание */}
              <p className="text-gray-200 mb-4 leading-relaxed">
                <CurrencyText text={section.description} />
              </p>

              {/* Советы */}
              <div className="space-y-2">
                {section.tips.map((tip, tipIndex) => (
                  <div
                    key={tipIndex}
                    className={`
                      flex items-start gap-2 p-3 rounded-lg border text-sm
                      ${getTipColorClasses(section.color)}
                      ${
                        section.color === "indigo"
                          ? "hover:bg-indigo-800/50"
                          : section.color === "teal"
                            ? "hover:bg-teal-800/50"
                            : ""
                      }
                    `}
                  >
                    <span className="flex-shrink-0 mt-0.5">•</span>
                    <span>
                      <CurrencyText text={tip} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Блок генетических уровней */}
        <div className="mt-6 p-5 bg-gradient-to-r from-indigo-900/20 to-purple-900/20 rounded-xl border border-indigo-400/50">
          <h4 className="text-indigo-400 font-semibold text-lg mb-3 text-center">
            ⚗️ Уровни поломки ДНК
          </h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-green-900/30 border border-green-500/30 rounded-lg p-3 text-center hover:bg-green-800/40 transition-colors">
              <div className="text-green-400 font-semibold mb-1">0% 🧬</div>
              <div className="text-green-300 text-xs">Идеальная</div>
            </div>
            <div className="bg-yellow-900/30 border border-yellow-500/30 rounded-lg p-3 text-center hover:bg-yellow-800/40 transition-colors">
              <div className="text-yellow-400 font-semibold mb-1">1-25% 🔬</div>
              <div className="text-yellow-300 text-xs">Стабильная</div>
            </div>
            <div className="bg-orange-900/30 border border-orange-500/30 rounded-lg p-3 text-center hover:bg-orange-800/40 transition-colors">
              <div className="text-orange-400 font-semibold mb-1">
                26-50% ⚠️
              </div>
              <div className="text-orange-300 text-xs">Нестабильная</div>
            </div>
            <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-3 text-center hover:bg-red-800/40 transition-colors">
              <div className="text-red-400 font-semibold mb-1">51%+ 💥</div>
              <div className="text-red-300 text-xs">Критическая</div>
            </div>
          </div>
        </div>

        {/* Заключение */}
        <div className="mt-6 p-5 bg-gradient-to-r from-purple-900/20 to-blue-900/20 rounded-xl border border-purple-400/50 text-center">
          <div className="text-2xl mb-3">🚀🌟</div>
          <h4 className="text-white font-semibold mb-2">
            Готовы к приключениям?
          </h4>
          <p className="text-gray-200 text-sm">
            Начните свое путешествие в мире космических жаб! Создавайте
            уникальных существ, управляйте генетикой и займите первое место в
            галактическом рейтинге!
          </p>
        </div>

        {/* Кнопка закрытия */}
        <button
          onClick={() => {
            playClick();
            handleClose();
          }}
          className="w-full mt-5 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-semibold transition-colors duration-200 transform hover:scale-105 active:scale-95"
        >
          Начать игру!
        </button>
      </div>

      {/* CSS анимации */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fade-in-up {
          animation: fadeInUp 0.6s ease-out forwards;
        }
      `}</style>
    </Modal>
  );
};

export default TutorialModal;

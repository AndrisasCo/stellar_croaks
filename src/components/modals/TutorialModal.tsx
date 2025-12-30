import React, { useEffect } from "react";
import Modal from "../shared/Header";
import { useSoundEffects } from "../../hooks/use-sound-effects";
import { CURRENCY_CONFIG, TYPE_ICONS } from "../../utils/constants";
import { completeAchivement } from "../../backend/achivements-manager";

const TutorialModal: React.FC = () => {
  const { playClick } = useSoundEffects();

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
        "💚 Кормите жаб регулярно - голодные жабы стоят дешевле, не растут и не размножаются",
        "🎯 Нажимайте на жаб для просмотра характеристик",
        "🏠 Перемещайте жаб между вольерами для селекции",
        "🌝 Если вы случайно уничтожили единственных жаб и при этом не можете купить новых - не беда! Сбросьте игровой прогресс в настройках, это позволит попробовать свои силы еще раз. ",
      ],
    },
    {
      icon: "❤️",
      title: "Разведение жаб",
      description:
        "Скрещивайте жаб для получения потомства с уникальными характеристиками. Детеныши наследуют гены родителей.",
      color: "pink",
      tips: [
        "🔬 Нужен как минимум 1 самец и 1 самка для размножения",
        "⏰ Жабам требуется время для беременности, а затем роста",
        "🎲 Потомство может получить улучшенные характеристики",
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
        "⚠️ Близкородственное скрещивание увеличивает поломку",
        "🔬 Идеальная генетика (0%) - лучший выбор для разведения",
      ],
    },
    {
      icon: "📊",
      title: "Характеристики жаб",
      description:
        "Каждая жаба имеет уникальные гены, влияющие на ее внешность, поведение и способности.",
      color: "teal",
      tips: [
        "⚡ Скорость влияет на передвижение по вольеру",
        "📊 Редкость увеличивает стоимость жаб",
        "💕 Плодовитость влияет на успех размножения",
        "🍽️ Аппетит определяет скорость голодания",
        "📏 Размер влияет на визуальное отображение",
      ],
    },
    {
      icon: "💰",
      title: "Экономика игры",
      description: `Зарабатывайте ${CURRENCY_CONFIG.tokens.icon} продажей жаб и выполнением заказов. Используйте их для покупки корма и улучшений.`,
      color: "yellow",
      tips: [
        `💸 Продавайте жаб на рынке за ${CURRENCY_CONFIG.tokens.icon} ${CURRENCY_CONFIG.tokens.name}`,
        `⭐ Выполняйте элитные заказы за ${CURRENCY_CONFIG.astro_quax.icon} ${CURRENCY_CONFIG.astro_quax.name}`,
        "🛒 Покупайте корм, жаб, вольеры и предметы в магазине",
      ],
    },
    {
      icon: "⚡",
      title: "Продвинутые механики",
      description:
        "Освойте продвинутые стратегии для максимальной эффективности в разведении и торговле.",
      color: "blue",
      tips: [
        "🔍 Комбинируйте жаб в коллайдере, это даст более редкую жабу, но уничтожит родителей",
        "📊 Осторожно! В коллайдере есть шанс получить бесполую жабу",
        "🎯 Попробуйте вывести уникальную жабу",
        "⚖️ Балансируйте между коллайдером и естественным размножением",
      ],
    },
    {
      icon: "🏆",
      title: "Лидерборд и достижения",
      description:
        "Соревнуйтесь с другими игроками! Зарабатывайте места в рейтингах по редким жабам, богатству и коллекциям.",
      color: "orange",
      tips: [
        "👑 Занимайте топовые места в трех категориях",
        "📈 Увеличивайте свою коллекцию для подъема в рейтинге",
        "🕒 Лидерборд обновляется ежедневно",
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
                {section.description}
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
                    <span>{tip}</span>
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

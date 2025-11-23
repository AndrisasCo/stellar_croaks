import React, { useEffect } from "react";
import Modal from "../shared/Modal";
import { useSoundEffects } from "../../hooks/use-sound-effects";
import { CURRENCY_CONFIG, TYPE_ICONS } from "../../utils/constants";
import { completeAchivement } from "../../backend/achivements-manager";

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TutorialModal: React.FC<TutorialModalProps> = ({ isOpen, onClose }) => {
  const { playClick } = useSoundEffects();

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
      icon: "💰",
      title: "Экономика игры",
      description: `Зарабатывайте ${CURRENCY_CONFIG.tokens.icon} продажей жаб и выполнением заказов. Используйте их для покупки корма и улучшений.`,
      color: "yellow",
      tips: [
        `💸 Продавайте жаб на рынке за ${CURRENCY_CONFIG.tokens.icon} ${CURRENCY_CONFIG.tokens.name}ы`,
        `⭐ Выполняйте элитные заказы за ${CURRENCY_CONFIG.astro_quax.icon} ${CURRENCY_CONFIG.astro_quax.name}ы`,
        "🛒 Покупайте корм, жаб, вольеры и предметы в магазине",
      ],
    },
    {
      icon: "🧬",
      title: "Генетика и характеристики",
      description:
        "Каждая жаба имеет уникальные гены, влияющие на ее внешность, поведение и способности.",
      color: "purple",
      tips: [
        "⚡ Скорость влияет на передвижение по вольеру",
        "📊 Редкость увеличивает стоимость жаб",
        "💕 Плодовитость влияет на успех размножения",
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
      orange: "bg-orange-900/30 border-orange-500/30 text-orange-300",
      blue: "bg-blue-900/30 border-blue-500/30 text-blue-300",
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  const handleClose = () => {
    completeAchivement("read-tutorial");
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} icon={icon} title="Обучение">
      {/* Контент */}
      <div className="p-4 overflow-y-auto  h-[calc(80vh-60px)] ">
        {/* Вступление */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-4">🐸✨</div>
          <h3 className="text-white font-semibold px-2 text-lg mb-2">
            Добро пожаловать в мир космических жаб!
          </h3>
          <p className="text-gray-400 text-sm">
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
              <div className="absolute -top-3 -left-3 w-8 h-8 bg-gray-800 border-2 border-gray-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
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
              <p className="text-gray-300 mb-4 leading-relaxed">
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

        {/* Заключение */}
        <div className="mt-8 p-5 bg-gradient-to-r from-purple-900/20 to-blue-900/20 rounded-xl border border-purple-400/50 text-center">
          <div className="text-2xl mb-3">🚀🌟</div>
          <h4 className="text-white font-semibold mb-2">
            Готовы к приключениям?
          </h4>
          <p className="text-gray-300 text-sm">
            Начните свое путешествие в мире космических жаб! Создавайте
            уникальных существ, торгуйте с другими игроками и займите первое
            место в галактическом рейтинге!
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

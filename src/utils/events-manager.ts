export const generateRandomEvents = (daysPassed: number) => {
  const events = [];

  for (let i = 0; i < daysPassed; i++) {
    // Рандомные события каждый день
    if (Math.random() < 0.1) {
      // 10% шанс события в день
      events.push(generateDailyEvent());
    }
  }

  return events;
};

export const generateDailyEvent = () => {
  const events = [
    {
      type: "food_find",
      message: "Жабы нашли ягодную поляну!",
      effect: "hunger -20",
    },
    { type: "predator", message: "Напала цапля!", effect: "health -30" },
    {
      type: "rain",
      message: "Прошел дождь - жабы счастливы!",
      effect: "health +10",
    },
    {
      type: "disease",
      message: "Обнаружена жабья плесень",
      effect: "health -15",
    },
  ];

  return events[Math.floor(Math.random() * events.length)];
};

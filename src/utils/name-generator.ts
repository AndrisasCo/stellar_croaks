type NameStyle =
  | "simple"
  | "titled"
  | "nature"
  | "foodie"
  | "double"
  | "random";

class FrogNameGenerator {
  private prefixes: string[] = [
    "Квак",
    "Ляг",
    "Жаб",
    "Буп",
    "Хоп",
    "Прыг",
    "Ква",
    "Ук",
    "Тиба",
    "Зелён",
    "Болот",
    "Рек",
    "Озёр",
    "Лист",
    "Мох",
    "Цап",
    "Лоп",
    "Пузыр",
    "Камуш",
    "Ил",
    "Дождев",
    "Вечерн",
    "Лун",
    "Вод",
    "Трав",
    "Луж",
    "Пруд",
    "Речн",
    "Берёз",
    "Ив",
  ];

  private suffixes: string[] = [
    "ушка",
    "улья",
    "стик",
    "ша",
    "шка",
    "сти",
    "кок",
    "зон",
    "зилла",
    "морф",
    "нуся",
    "ся",
    "тошка",
    "тик",
    "лап",
    "рыг",
    "куша",
    "бум",
    "прыг",
    "хоп",
    "сквик",
    "глаз",
    "ротик",
    "брюшко",
    "хвостик",
    "лапка",
    "спинка",
    "бородавка",
    "пузо",
  ];

  private titles: string[] = [
    "Великий",
    "Могучий",
    "Храбрый",
    "Мудрый",
    "Быстрый",
    "Ловкий",
    "Неуловимый",
    "Великолепный",
    "Загадочный",
    "Таинственный",
    "Королевский",
    "Император",
    "Принц",
    "Принцесса",
    "Герцог",
    "Профессор",
    "Доктор",
    "Капитан",
    "Сэр",
    "Лорд",
    "Магистр",
  ];

  private natureNames: string[] = [
    "Лист",
    "Камень",
    "Облако",
    "Ветер",
    "Дождь",
    "Гроза",
    "Радуга",
    "Роса",
    "Иней",
    "Туман",
    "Поток",
    "Волна",
    "Скала",
    "Утёс",
    "Ручей",
    "Омут",
    "Болото",
    "Трясина",
    "Рассвет",
    "Закат",
  ];

  private foodNames: string[] = [
    "Комарик",
    "Мошка",
    "Муха",
    "Стрекоз",
    "Сверчок",
    "Червяк",
    "Гусеница",
    "Бабочк",
    "Жучок",
    "Паучок",
    "Мотылёк",
    "Моль",
    "Мошкара",
    "Насеком",
    "Блошк",
    "Малинк",
    "Мошкар",
  ];

  private randomElement<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  generateSimple(): string {
    const prefix = this.randomElement(this.prefixes);
    const suffix = this.randomElement(this.suffixes);
    return prefix + suffix;
  }

  generateTitled(): string {
    const title = this.randomElement(this.titles);
    const name = this.generateSimple();
    return `${title} ${name}`;
  }

  generateNature(): string {
    const nature = this.randomElement(this.natureNames);
    const prefix = this.randomElement(this.prefixes);
    return `${prefix}${nature.toLowerCase()}`;
  }

  generateFoodie(): string {
    const food = this.randomElement(this.foodNames);
    const suffix = this.randomElement(this.suffixes);
    return food + suffix;
  }

  generateDouble(): string {
    const name1 = this.generateSimple();
    const name2 = this.generateSimple();
    return `${name1}-${name2}`;
  }

  generate(style: NameStyle = "random"): string {
    const styleMap: Record<NameStyle, () => string> = {
      simple: this.generateSimple.bind(this),
      titled: this.generateTitled.bind(this),
      nature: this.generateNature.bind(this),
      foodie: this.generateFoodie.bind(this),
      double: this.generateDouble.bind(this),
      random: () => {
        const styles: Exclude<NameStyle, "random">[] = [
          "simple",
          "titled",
          "nature",
          "foodie",
          "double",
        ];
        return this.generate(this.randomElement(styles));
      },
    };

    return styleMap[style]();
  }

  generateMultiple(count: number = 5, style: NameStyle = "random"): string[] {
    const names: Set<string> = new Set();
    while (names.size < count) {
      names.add(this.generate(style));
    }
    return Array.from(names);
  }

  getAvailableStyles(): NameStyle[] {
    return ["simple", "titled", "nature", "foodie", "double", "random"];
  }
}

export const nameGenerator = new FrogNameGenerator();

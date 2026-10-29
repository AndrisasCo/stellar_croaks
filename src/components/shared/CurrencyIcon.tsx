import { Fragment } from "react";
import { CURRENCY_CONFIG, CurrencyType } from "../../utils/constants";
import { ToadIcon } from "./ToadIcon";

/** Соответствие эмодзи валюте — для текстов, которые приходят строками. */
const CURRENCY_BY_EMOJI: Record<string, CurrencyType> = {
  [CURRENCY_CONFIG.tokens.icon]: "tokens",
  [CURRENCY_CONFIG.astro_quax.icon]: "astro_quax",
};

/**
 * Эмодзи жабы-счётчика в строках: `IconText` заменяет его на `ToadIcon`.
 *
 * Тексты утилит (`expedition-manager`, `colony-build`, уведомления) собираются
 * в plain string и приходят в компонент готовыми — поэтому маркер ловится здесь,
 * а не в каждом месте вывода.
 */
const TOAD_EMOJI = "🐸";

/**
 * SVG-иконка валюты в стиле пропуска КОНТУРа.
 *
 * `alt` пустой намеренно: иконка всегда стоит рядом с числом или названием
 * валюты, и скринридер не должен повторять «Кваксы» дважды.
 */
export const CurrencyIcon = ({
  currency,
  className = "h-4 w-4",
  title,
}: {
  currency: CurrencyType;
  className?: string;
  title?: string;
}) => (
  <img
    src={CURRENCY_CONFIG[currency].asset}
    alt=""
    title={title ?? CURRENCY_CONFIG[currency].name}
    draggable={false}
    className={`inline-block shrink-0 select-none align-[-0.18em] ${className}`}
  />
);

/**
 * Текст с эмодзи-маркерами (🔷, 💎, 🐸), заменёнными на SVG-иконки.
 *
 * Нужен для строк, которые собираются в утилитах и приходят в компонент
 * готовым текстом: уведомления, подсказки КВАЗа, описания туториала, бортовой
 * журнал похода, причины сноса сектора. Эмодзи шрифта в этих строках рядом с
 * SVG-иконками HUD выглядели чужими, а `IconText` оставляет тексты удобными
 * для утилит.
 *
 * Тем же способом выводятся эмодзи-иконки из данных: значок биопода
 * (`HexMap/rooms-config.ts`), место жабы (`ToadLocationBadge`), награды
 * достижений, предупреждения диссоциатора, подсказки КВАЗа.
 */
export const IconText = ({
  text,
  iconClassName = "h-[1em] w-[1em]",
}: {
  text: string;
  iconClassName?: string;
}) => {
  const parts = text.split(/(🔷|💎|🐸)/);

  if (parts.length === 1) {
    return <>{text}</>;
  }

  return (
    <>
      {parts.map((part, index) => {
        if (part === TOAD_EMOJI) {
          return <ToadIcon key={`toad-${index}`} className={iconClassName} />;
        }

        const currency = CURRENCY_BY_EMOJI[part];

        return currency ? (
          <CurrencyIcon
            key={`${currency}-${index}`}
            currency={currency}
            className={iconClassName}
          />
        ) : (
          <Fragment key={`text-${index}`}>{part}</Fragment>
        );
      })}
    </>
  );
};

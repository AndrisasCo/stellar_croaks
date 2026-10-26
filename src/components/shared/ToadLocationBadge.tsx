/**
 * Бейдж «где жаба сейчас»: иконка и название места одной плашкой.
 *
 * Место показывают и плитка выбора жабы (`shared/ToadPicker`), и список колонии
 * (`shared/ToadListCard`). Раньше каждый рисовал его по-своему: в списке выбора это была
 * серая плашка, а в карточке — обычный текст в строке метаданных. Теперь вид один на всех:
 * фон, отступы и обрезка длинного имени сектора живут здесь, а вызывающий код задаёт только
 * цвет и размер текста под свою плотность.
 */
export interface ToadLocationBadgeProps {
  /** Иконка места: эмодзи сектора, биопода или похода */
  icon: string;
  /** Название места; длинное имя обрезается, чтобы не вытеснять остальные данные */
  label: string;
  /** Подсказка: уточнение места или причина, почему жаба не в секторе */
  title?: string;
  /** Цвет и дополнительные классы плашки */
  className?: string;
  /** Размер текста: в плитке выбора компактнее, в карточке списка — на шаг крупнее */
  textClassName?: string;
}

/** Общая плашка места — одна форма для панели выбора и списков жаб */
export const ToadLocationBadge = ({
  icon,
  label,
  title,
  className = "text-slate-300",
  textClassName = "text-3xs",
}: ToadLocationBadgeProps) => (
  <span
    className={`inline-flex min-w-0 items-center gap-1 rounded bg-slate-800/80 px-1 py-0.5 ${className}`}
    title={title}
  >
    <span aria-hidden className="shrink-0">
      {icon}
    </span>
    <span className={`truncate ${textClassName}`}>{label}</span>
  </span>
);

export default ToadLocationBadge;

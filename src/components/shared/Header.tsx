import React, { ReactNode } from "react";
import {
  HUD_TONES,
  HudTone,
  HudToneProvider,
} from "./DataGrid";

interface ToadListModalProps {
  /**
   * Линейная SVG-иконка или ассет. Emoji в заголовках не используем: название
   * модалки остаётся текстовым, а цвет и характер задают маркеры и тон сектора.
   */
  icon?: ReactNode;
  children: any;
  title?: string | ReactNode;
  /** Акцент сектора: контур — emerald, репродуктор — rose, лаборатория — violet. */
  tone?: HudTone;
}

/**
 * Шапка модалки — общая для всех секторов.
 *
 * Тонкая HUD-линия и квадратные маркеры держат заголовок в одном языке с сетками,
 * а `tone` передаёт акцент всему содержимому: табы, панели, узлы и подписи
 * автоматически окрашиваются в цвет сектора.
 */
const Modal: React.FC<ToadListModalProps> = ({
  children,
  icon,
  title,
  tone = "cyan",
}) => {
  const style = HUD_TONES[tone];

  return (
    <HudToneProvider tone={tone}>
      {/* Заголовок */}
      <div className="relative flex w-full items-center justify-center">
        {title && (
          <div className="flex min-w-0 items-center gap-2 pb-4 pt-1">
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 shrink-0 ${style.node} ${style.glow}`}
            />
            {icon}
            <h2 className="brand-text max-w-[calc(100vw_-_5rem)] truncate text-lg font-bold uppercase tracking-[0.06em] sm:max-w-none sm:text-xl">
              {title}
            </h2>
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 shrink-0 ${style.node} ${style.glow}`}
            />
          </div>
        )}

        {title && (
          <span
            aria-hidden="true"
            className={`absolute bottom-2 left-1/2 h-px w-24 -translate-x-1/2 bg-gradient-to-r ${style.gradientMirror}`}
          />
        )}
      </div>

      {children}
    </HudToneProvider>
  );
};

export default Modal;

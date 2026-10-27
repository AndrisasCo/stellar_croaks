// components/ModalProvider.tsx
import React, { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ModalOptions, ModalComponent, ModalContext } from "../ModalContext";
import { ClickButton } from "../shared/ClickButton";
import { GridNodes } from "../shared/DataGrid";

interface ModalProviderProps {
  children: React.ReactNode;
  rootId?: string;
  defaultOptions?: ModalOptions;
}

export const ModalProvider: React.FC<ModalProviderProps> = ({
  children,
  rootId = "modal-root",
  defaultOptions = {},
}) => {
  const [modals, setModals] = useState<
    Array<{
      component: ModalComponent;
      options?: ModalOptions;
      isOpen: boolean;
    }>
  >([]);

  const [modalRoot, setModalRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let element = document.getElementById(rootId);

    if (!element) {
      element = document.createElement("div");
      element.id = rootId;
      element.style.position = "relative";
      element.style.zIndex = "99";
      document.body.appendChild(element);
    }

    setModalRoot(element);

    return () => {
      if (element && element.parentNode && element.childNodes.length === 0) {
        element.parentNode.removeChild(element);
      }
    };
  }, [rootId]);

  const openModal = useCallback(
    (component: ModalComponent, options?: ModalOptions) => {
      setModals((prev) => {
        const newModal = {
          component,
          options: { ...defaultOptions, ...options },
          isOpen: true,
        };

        // Предыдущие модалки не удаляем и не размонтируем: они остаются в стеке
        // скрытыми. Так «Вернуться» из карточки жабы возвращает тот же список
        // с сохранёнными фильтрами, сортировкой и позицией скролла.
        const updatedModals = prev.map((modal) => ({
          ...modal,
          isOpen: false,
        }));

        return [...updatedModals, newModal];
      });
    },
    [defaultOptions],
  );

  const closeModal = useCallback(() => {
    setModals((prev) => {
      if (prev.length === 0) return prev;

      const updatedModals = [...prev];
      const lastModal = updatedModals[updatedModals.length - 1];

      // Вызываем кастомный обработчик закрытия
      if (lastModal.options?.onClose) {
        lastModal.options.onClose();
      }

      // Удаляем последнюю модалку
      updatedModals.pop();

      // Если есть предыдущие модалки, открываем их
      if (updatedModals.length > 0) {
        updatedModals[updatedModals.length - 1].isOpen = true;
      }

      return updatedModals;
    });
  }, []);

  const closeAllModals = useCallback(() => {
    setModals([]);
  }, []);

  /**
   * Блокировка фонового скролла по стеку, а не по факту открытия/закрытия.
   *
   * При возврате из карточки жабы в ядро или список биопода в стеке остаётся
   * предыдущая модалка, поэтому разблокировать страницу ещё рано. Держим скролл
   * заблокированным, пока открыта хотя бы одна модалка с `disableScroll`.
   */
  useEffect(() => {
    const activeModal = modals[modals.length - 1];
    const lockScroll = Boolean(
      activeModal?.isOpen && activeModal.options?.disableScroll,
    );

    document.body.style.overflow = lockScroll ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [modals]);

  /** Стек модалок для слушателя Escape: колбэк не должен зависеть от рендера. */
  const modalsRef = useRef(modals);

  useEffect(() => {
    modalsRef.current = modals;
  }, [modals]);

  /**
   * Escape закрывает верхнюю модалку (и так по одной — как кнопка ×).
   *
   * Слушатель висит на window: кнопки внутри модалки обычно нигде не в фокусе,
   * и тогда событие не доходит до её контейнера. Модалка «в режиме правки»
   * (имя биопода, ник) гасит клавишу сама через preventDefault — там Esc
   * отменяет правку, а закрывает окно уже следующее нажатие.
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.repeat || event.defaultPrevented) {
        return;
      }

      const lastModal = modalsRef.current[modalsRef.current.length - 1];

      if (!lastModal?.isOpen) {
        return;
      }

      event.preventDefault();
      closeModal();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeModal]);

  const currentModal = modals.length > 0 ? modals[modals.length - 1] : null;

  /**
   * Оболочка одной модалки из стека.
   *
   * В DOM остаются все модалки стека: активная показана, предыдущие скрыты через
   * `visibility: hidden` + `pointer-events: none`. Так возврат назад (`closeModal`)
   * не размонтирует список и не теряет его фильтры, сортировку и позицию скролла.
   *
   * Телефон: панель занимает весь экран (h-full по оверлею, без скруглений) — как и раньше,
   * тут скрывать нечего. Десктоп (≥768px, брейкпоинт проекта): панель превращается в карточку
   * по центру — `md:h-auto` снимает «на всю высоту», `md:max-w-5xl` делает пошире,
   * появляются скругление, рамка и тень, чтобы окно читалось окном, а не ещё одним экраном.
   *
   * Фоновую картинку Торговая Капсулаа (`bg-shop.webp`) убрали: панель — полупрозрачная (`bg-color-main`
   * + blur), так что карта просвечивает, и колония не исчезает за «шторкой». Закрывающий крестик
   * позиционируется от самой панели (relative), а не от экрана: на десктопе он стоит в углу
   * карточки, а не сбоку за её пределами.
   *
   * Скроллится только тело `#modal` (grow + min-h-0), кнопка «Закрыть» остаётся под рукой.
   *
   * Ширина карточки на десктопе у всех модалок одна — общий `md:max-w-5xl`
   * (широкий вариант). Если когда-нибудь понадобится узкое окно, ширину можно
   * переопределить через `openModal(<X/>, { className: "md:max-w-lg" })`: тогда
   * общий класс не подключится и вступит заданный.
   */
  const renderModal = (
    modal: (typeof modals)[number],
    isActive: boolean,
    index: number,
  ) => {
    if (!modalRoot) return null;

    const { component: Component, options = {} } = modal;

    /** Клик мимо панели закрывает верхнюю модалку (`closeOnOverlayClick` из App.tsx). */
    const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        closeModal();
      }
    };

    const modalContent = (
      <div
        className={`overlay md:p-4 ${options.overlayClassName ?? ""}`}
        style={
          isActive ? undefined : { visibility: "hidden", pointerEvents: "none" }
        }
        aria-hidden={isActive ? undefined : true}
        onClick={options.closeOnOverlayClick ? handleOverlayClick : undefined}
      >
        <div
          style={options.bg ? { backgroundImage: `url(${options.bg})` } : {}}
          className={[
            // Каркас: колонка, всё внутри обрезается по скруглению панели
            "relative flex h-full w-full flex-col overflow-hidden text-white",
            "bg-color-main shadow-2xl backdrop-blur-md",
            // Десктоп: карточка по центру — уже не во всю высоту, пошире, со скруглением.
            // Минимум 600px не даёт коротким окнам «схлопываться»; 80dvh ограничивает
            // высоту на низких экранах, чтобы карточка не выходила за пределы вьюпорта.
            // Если модалка задала свою max-width, общий `md:max-w-5xl` не подключаем:
            // иначе побеждает правило из CSS, а не класс, добавленный позже.
            "md:h-auto md:min-h-[min(600px,80dvh)] md:max-h-[85dvh] md:rounded-none md:border md:border-white/20",
            /\bmax-w-/.test(options.className ?? "") ? "" : "md:max-w-5xl",
            // Анимация появления (index.css); без значения панель появляется без неё
            options.animation ? `modal-anim-${options.animation}` : "",
            options.className ?? "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {/* Полоска-акцент: тот же градиент, что у заголовков модалок (shared/Header) */}
          <div className="brand-bar relative z-10 h-1 w-full shrink-0" />

          {/* Углы корпуса: та же разметка, что у HUD-панелей внутри модалки.
              Слой выше фона, но не перехватывает клики и не мешает скроллу. */}
          <div className="pointer-events-none absolute inset-0 z-20">
            <GridNodes tone="bg-cyan-200/70" />
          </div>

          {/* Фон лаборатории: едва заметная техно-сетка и скан-линии. Контент
              лежит выше (`z-10`), поэтому паттерн не мешает чтению. */}
          <div
            aria-hidden="true"
            className="hud-backdrop pointer-events-none absolute inset-0 z-0"
          />

          {/* no-overscroll: свайп по списку не уходит в pull-to-refresh — иначе
              iOS Safari перезагружал страницу и «шторка» будто закрывалась сама.
              grow + min-h-0 вместо фиксированной высоты: тело занимает остаток панели
              на телефоне, а на пределе карточки скроллится само. */}
          <div
            id={isActive ? "modal" : undefined}
            className="no-overscroll safe-area-bottom relative z-10 flex min-h-0 grow flex-col overflow-y-auto px-3 pt-4 md:px-6 md:pt-5"
          >
            {options.showCloseButton && (
              <ClickButton
                onClick={closeModal}
                aria-label="Закрыть"
                title="Закрыть (Esc)"
                className="absolute right-2 top-2 z-50 flex h-10 w-10 items-center justify-center border border-white/10 bg-slate-950/55 text-3xl leading-none text-slate-300 backdrop-blur-md transition-colors duration-300 hover:border-cyan-300/50 hover:text-cyan-200 md:right-3 md:top-3"
              >
                ×
              </ClickButton>
            )}

            <Component {...options?.props} onClose={closeModal} />

            <div className="min-h-4" />
            <ClickButton
              className="ui-button-secondary ui-button-close relative mt-auto min-h-10 w-full py-3 sm:w-auto sm:min-w-64 sm:self-end"
              onClick={closeModal}
              title="Закрыть (Esc)"
            >
              Закрыть
              <span
                aria-hidden="true"
                className="absolute right-3 top-1/2 -translate-y-1/2 border border-white/10 px-1 text-3xs font-semibold tracking-[0.14em] text-slate-500"
              >
                ESC
              </span>
            </ClickButton>
          </div>
        </div>
      </div>
    );

    return createPortal(modalContent, modalRoot, `modal-${index}`);
  };

  const contextValue = {
    openModal,
    closeModal,
    closeAllModals,
    currentModal,
    modals,
  };

  return (
    <ModalContext.Provider value={contextValue}>
      {children}
      {modals.map((modal, index) =>
        renderModal(modal, index === modals.length - 1 && modal.isOpen, index),
      )}
    </ModalContext.Provider>
  );
};

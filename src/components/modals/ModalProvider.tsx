// components/ModalProvider.tsx
import React, { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { ModalOptions, ModalComponent, ModalContext } from "../ModalContext";
import { ClickButton } from "../shared/ClickButton";

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

        // Закрываем предыдущие модалки если нужно
        const updatedModals = prev.map((modal) => ({
          ...modal,
          isOpen: false,
        }));

        return [...updatedModals, newModal];
      });

      // Блокируем скролл если нужно
      if (options?.disableScroll ?? defaultOptions.disableScroll) {
        document.body.style.overflow = "hidden";
      }
    },
    [defaultOptions]
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

    // Восстанавливаем скролл
    document.body.style.overflow = "";
  }, []);

  const closeAllModals = useCallback(() => {
    setModals([]);
    document.body.style.overflow = "";
  }, []);

  const currentModal = modals.length > 0 ? modals[modals.length - 1] : null;

  const renderModal = () => {
    if (!modalRoot || !currentModal || !currentModal.isOpen) return null;

    const { component: Component, options } = currentModal;

    const modalContent = (
      <>
        <div className="overlay">
          <div className="text-white h-full  w-full max-w-2xl max-h-[100vh] overflow-hidden bg-[url('/bg/bg-shop.webp')] cover">
            <div
              id="modal"
              className="h-[100vh]  overflow-auto py-4 flex flex-col  bg-slate-900/50 backdrop-blur-sm px-1"
            >
              <ClickButton
                onClick={closeModal}
                className="text-gray-300 z-50 absolute right-2 top-0 hover:text-green-400 text-5xl transition-colors duration-300 p-1 hover:scale-110"
              >
                ×
              </ClickButton>

              <Component {...options?.props} onClose={closeModal} />

              <div className="min-h-4" />
              <ClickButton
                className="w-full mt-auto bg-color-second hover:bg-slate-800/70 text-gray-200 py-3 rounded-xl "
                onClick={closeModal}
              >
                Закрыть
              </ClickButton>
            </div>
          </div>
        </div>
      </>
    );

    return createPortal(modalContent, modalRoot);
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
      {renderModal()}
    </ModalContext.Provider>
  );
};

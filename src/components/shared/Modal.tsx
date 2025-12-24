import React, { ReactNode, useEffect, useState } from "react";
import { ClickButton } from "./ClickButton";

interface ToadListModalProps {
  icon?: ReactNode;
  children: any;
  isOpen: boolean;
  onClose: () => void;
  title?: string | ReactNode;
  closeButton?: boolean;
}

const Modal: React.FC<ToadListModalProps> = ({
  children,
  isOpen,
  onClose,
  icon,
  title,
  closeButton = true,
}) => {
  const [modalIsOpen, setModalIsOpen] = useState(isOpen);

  useEffect(() => {
    setModalIsOpen(isOpen);
  }, [isOpen, setModalIsOpen]);

  useEffect(() => {
    // Блокируем скролл
    document.body.style.overflow = !modalIsOpen ? "auto" : "hidden";

    // Функция cleanup - восстанавливаем скролл при размонтировании
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [modalIsOpen]);

  if (!isOpen) return null;

  return (
    <div onClick={onClose} className="overlay">
      <div
        onClick={(e) => e.stopPropagation()}
        className=" text-white h-full  w-full max-w-2xl max-h-[100vh] overflow-hidden bg-[url('/assets/bg-shop.png')] cover"
      >
        <div className="h-[100vh] overflow-auto py-4 flex flex-col  bg-slate-900/50 backdrop-blur-sm px-1">
          {/* Заголовок */}
          <div className="flex w-full justify-center items-center relative">
            {title && (
              <div className="flex items-center gap-2 pb-4 ">
                {icon}
                <h2 className="text-xl font-bold bg-gradient-to-r from-green-400 to-purple-500 bg-clip-text text-transparent">
                  {title}
                </h2>
              </div>
            )}
            {closeButton && (
              <ClickButton
                onClick={onClose}
                className="text-gray-300 absolute right-2 top-[-16px] hover:text-green-400 text-5xl transition-colors duration-300 p-1 hover:scale-110"
              >
                ×
              </ClickButton>
            )}
          </div>

          {children}

          <div className="min-h-4" />
          <ClickButton
            className="w-full mt-auto bg-color-second hover:bg-slate-800/70 text-gray-200 py-3 rounded-xl "
            onClick={onClose}
          >
            Закрыть
          </ClickButton>
        </div>
      </div>
    </div>
  );
};

export default Modal;

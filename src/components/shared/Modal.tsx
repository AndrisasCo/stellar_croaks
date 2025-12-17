import React, { ReactNode, useEffect, useState } from "react";

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
        className="bg-gray-800/90 text-white  px-1 rounded-2xl w-full max-w-2xl max-h-[95vh] overflow-hidden border-2 border-green-500/50 shadow-2xl backdrop-blur-sm"
      >
        <div className="h-[calc(95vh-32px)] overflow-auto py-4 flex flex-col">
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
              <button
                onClick={onClose}
                className="text-gray-400 absolute right-2 top-[-8px] hover:text-green-400 text-2xl transition-colors duration-300 p-1 hover:scale-110"
              >
                ×
              </button>
            )}
          </div>

          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;

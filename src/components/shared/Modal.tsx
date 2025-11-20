import React, { ReactNode } from "react";

interface ToadListModalProps {
  icon?: ReactNode;
  children: any;
  isOpen: boolean;
  onClose: () => void;
  title: string | ReactNode;
}

const Modal: React.FC<ToadListModalProps> = ({
  children,
  isOpen,
  onClose,
  icon,
  title,
}) => {
  if (!isOpen) return null;

  return (
    <div onClick={onClose} className="overlay">
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-gray-800/90 text-white p-4 rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden border-2 border-green-500/50 shadow-2xl backdrop-blur-sm"
      >
        {/* Заголовок */}
        <div className="flex w-full justify-center items-center pb-4">
          <div className="flex items-center gap-2">
            {icon}
            <h2 className="text-xl font-bold bg-gradient-to-r from-green-400 to-purple-500 bg-clip-text text-transparent">
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 absolute right-2 top-1 hover:text-green-400 text-2xl transition-colors duration-300 p-1 hover:scale-110"
          >
            ×
          </button>
        </div>

        {children}
      </div>
    </div>
  );
};

export default Modal;

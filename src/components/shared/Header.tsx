import React, { ReactNode, useEffect, useState } from "react";
import { ClickButton } from "./ClickButton";

interface ToadListModalProps {
  icon?: ReactNode;
  children: any;
  title?: string | ReactNode;
}

const Modal: React.FC<ToadListModalProps> = ({ children, icon, title }) => {
  return (
    <>
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
      </div>

      {children}
    </>
  );
};

export default Modal;

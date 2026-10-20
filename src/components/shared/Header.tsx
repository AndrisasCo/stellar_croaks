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
            <h2 className="brand-text text-xl font-bold">
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

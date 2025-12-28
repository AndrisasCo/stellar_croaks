// contexts/ModalContext.tsx
import React, { createContext, useContext, useState, useCallback } from "react";

export type ModalComponent = React.ComponentType<any>;

export interface ModalOptions {
  onClose?: () => void;
  props?: Record<string, any>;
  closeOnOverlayClick?: boolean;
  showCloseButton?: boolean;
  className?: string;
  overlayClassName?: string;
  animation?: "fade" | "slide" | "zoom";
  disableScroll?: boolean;
}

interface ModalData {
  component: ModalComponent;
  options?: ModalOptions;
  isOpen: boolean;
}

interface ModalContextType {
  openModal: (component: ModalComponent, options?: ModalOptions) => void;
  closeModal: () => void;
  closeAllModals: () => void;
  currentModal: ModalData | null;
  modals: ModalData[];
}

export const ModalContext = createContext<ModalContextType | undefined>(
  undefined
);

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal must be used within ModalProvider");
  }
  return context;
};

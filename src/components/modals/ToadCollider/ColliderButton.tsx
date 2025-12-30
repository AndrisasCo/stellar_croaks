import { useState } from "react";
import { useSoundEffects } from "../../../hooks/use-sound-effects";
import { ClickButton } from "../../shared/ClickButton";
import { useToads } from "../../ToadContext";
import ToadCollider from "./ToadColliderModal";
import ToadSlotModal from "./ToadSlotModal";
import { useNotifications } from "../../../hooks/use-notification";
import { useModal } from "../../ModalContext";
import { ColliderMenu } from "./ColliderMenu";

export default function ColliderButton() {
  const { colliderState, toads, allToads } = useToads();
  const { playClickCollider } = useSoundEffects();
  const { openModal, closeModal } = useModal();

  const { addNotification } = useNotifications();
  const isColliderDisabled = allToads.length < 10;
  const activeSlot = colliderState.slots.find((slot) => slot.child);

  const openCollider = () => {
    if (isColliderDisabled && !activeSlot) {
      addNotification({
        type: "danger",
        content: `Нужно как минимум 10 жаб, чтобы открыть коллайдер`,
      });
      return;
    }

    playClickCollider();

    openModal(() => <ColliderMenu />, { bg: "/bg/bg-lab.webp" });
  };

  return (
    <ClickButton
      onClick={openCollider}
      className="
                 bg-[url('/assets/collider-btn.webp')] bg-contain bg-no-repeat bg-center
                               w-[100px] h-[64px]
                  transition-all duration-300 transform
                  hover:scale-105 active:scale-95
                    disabled:opacity-60
                  "
    />
  );
}

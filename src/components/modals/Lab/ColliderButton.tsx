import { useSoundEffects } from "../../../hooks/use-sound-effects";
import { ClickButton } from "../../shared/ClickButton";
import { useToads } from "../../ToadContext";
import { useNotifications } from "../../../hooks/use-notification";
import { useModal } from "../../ModalContext";
import { ColliderMenu } from "./LabMenu";

export default function ColliderButton() {
  const { colliderState, allToads } = useToads();
  const { playClickCollider } = useSoundEffects();
  const { openModal } = useModal();

  const { addNotification } = useNotifications();
  // Ручное размножение доступно с самого начала (нужна хотя бы пара жаб),
  // поэтому порог открытия лаборатории снижен с 10 до 2.
  const isColliderDisabled = allToads.length < 2;
  const activeSlot = colliderState.slots.find((slot) => slot.child);

  const openCollider = () => {
    if (isColliderDisabled && !activeSlot) {
      addNotification({
        type: "danger",
        content: `Нужно как минимум 2 жабы, чтобы открыть лабораторию`,
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

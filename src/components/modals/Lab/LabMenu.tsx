import { useModal } from "../../ModalContext";
import { ClickButton } from "../../shared/ClickButton";
import DissolveModal from "./DissolveModal";
import NestModal from "./NestModal";
import ToadCollider from "./ToadColliderModal";
import ToadSlotModal from "./ToadSlotModal";

interface LabMenuButton {
  name: string;
  bg: string;
  Component: React.ReactNode;
}

export const ColliderMenu = () => {
  const { openModal } = useModal();

  const buttons: LabMenuButton[] = [
    {
      name: "Коллайдер",
      bg: "/assets/collider.webp",
      Component: <ToadCollider />,
    },
    {
      name: "Инкубатор",
      bg: "/assets/incubator.webp",
      Component: <ToadSlotModal />,
    },
    {
      name: "Гнездо",
      bg: "/assets/bowl2.webp",
      Component: <NestModal />,
    },
    {
      name: "Диссоциатор",
      bg: "/assets/destructor.webp",
      Component: <DissolveModal />,
    },
    // {
    //   name: "Био-принтер",
    //   bg: "/assets/printer.webp",
    //   Component: <ToadCollider />,
    // },
  ];

  return (
    <>
      {/* Заголовок */}
      <div className="flex items-center justify-center gap-3">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-purple-500 bg-clip-text text-transparent">
          Лаборатория
        </h2>
      </div>

      {/* Основное меню - 4 крупные кнопки */}
      <div className="grid grid-cols-2 gap-y-4 gap-x-2 p-4 mt-4">
        {/* Кнопка Коллайдера */}
        {buttons.map((b) => (
          <ClickButton
            key={b.name}
            style={{ backgroundImage: `url(${b.bg})` }}
            onClick={() => openModal(() => b.Component)}
            className={`group w-full bg-center aspect-[1/1.2] relative bg-[#f0f8ff0f] rounded-xl  bg-no-repeat bg-contain`}
          >
            {/* Название */}
            <div className="absolute bottom-4 left-0 right-0 text-center ">
              <span className="text-white font-bold text-xl drop-shadow-lg backdrop-blur-sm rounded-md px-1 text-shadow-black">
                {b.name}
              </span>
            </div>
          </ClickButton>
        ))}
      </div>
    </>
  );
};

// <div className="absolute top-3 right-3 w-3 h-3 bg-green-500 rounded-full animate-ping"></div>

import { Toad } from "../../../models/Toad";
import { ToadTypes } from "../../../models/Toad/toad-species";
import { makeColorWhiter } from "../../ToadCanvas/utils";

export const ToadAvatar = (props: {
  toad: Toad;
  size?: number;
  onClick?: () => void;
}) => {
  const { toad, size = 10, onClick } = props;
  const type = Object.values(ToadTypes).includes(toad.type)
    ? toad.type
    : ToadTypes.hybrid;

  const isColoredToad = [ToadTypes.hybrid, ToadTypes.camouflage].includes(type);
  const imageSrc = isColoredToad
    ? `/assets/${type}.webp`
    : `/sprites/${type}.webp`;

  return (
    <div
      onClick={onClick}
      style={{
        width: size * 4,
        height: size * 4,
      }}
      className={`relative rounded-[12px] overflow-hidden`}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: isColoredToad
            ? makeColorWhiter(toad.genes?.colors[0], 20)
            : "#1C2229",
        }}
      />
      <div
        style={{
          width: size * 4,
          height: size * 4,
          color: toad.genes?.colors[0],
          background: `url(${imageSrc}) ${
            isColoredToad ? "5% 50%" : "0% 0%"
          }  / ${isColoredToad ? 4.5 * size : 13 * size}px no-repeat #1C2229`,
        }}
        className={`absolute
          ${isColoredToad ? "mt-[0%]" : "mt-[7%]  ml-[2%]"}
          inset-0 ${isColoredToad && "mix-blend-multiply"}`}
      />
    </div>
  );
};

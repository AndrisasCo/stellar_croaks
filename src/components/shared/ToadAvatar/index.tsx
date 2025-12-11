import { Toad, ToadTypes } from "../../../models/toad";
import { makeColorWhiter } from "../../ToadCanvas/utils";

export const ToadAvatar = (props: { toad: Toad; size?: number }) => {
  const { toad, size = 10 } = props;
  const type = Object.values(ToadTypes).includes(toad.type)
    ? toad.type
    : ToadTypes.hybrid;

  const isColoredToad = [ToadTypes.hybrid, ToadTypes.camouflage].includes(type);
  const imageSrc = isColoredToad
    ? `/assets/${type}.png`
    : `/sprites/${type}.png`;

  return (
    <div
      className={`w-${size} h-${size}  relative rounded-[12px] overflow-hidden`}
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
          color: toad.genes?.colors[0],
          background: `url(${imageSrc}) ${
            isColoredToad ? "5% 50%" : "0% 0%"
          }  / ${isColoredToad ? 4 * size : 13 * size}px no-repeat #1C2229`,
        }}
        className={`absolute
          ${isColoredToad ? "mt-[0%]" : "mt-[7%]  ml-[2%]"}
          w-${size} h-[${size * 0.8}px]   inset-0 ${
          isColoredToad && "mix-blend-multiply"
        }`}
      />
    </div>
  );
};

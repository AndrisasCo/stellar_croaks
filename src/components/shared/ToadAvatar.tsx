import { Toad, ToadTypes } from "../../models/toad";
import { makeColorWhiter } from "../ToadCanvas/utils";

export const ToadAvatar = (props: { toad: Toad; size?: number }) => {
  const { toad, size = 10 } = props;
  const imageSrc = Object.values(ToadTypes).includes(toad.type)
    ? `/sprites/${toad.type}.png`
    : `/sprites/hybrid.png`;
  console.log(toad, toad.genes);
  const isColoredToad = [ToadTypes.hybrid, ToadTypes.camouflage].includes(
    toad.type
  );

  return (
    <div
      className={`w-${size} h-${size}  relative rounded-full overflow-hidden`}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: isColoredToad
            ? makeColorWhiter(toad.genes?.colors[0], 20)
            : "rgba(55, 65, 81, 0.5)",
        }}
      />
      <div
        style={{
          background: `url(${imageSrc})`,
          backgroundSize: 13 * size,
        }}
        className={`absolute w-${size} h-${
          size - 2
        } mt-[7%]  ml-[2%]  inset-0 ${isColoredToad && "mix-blend-multiply"}`}
      />
    </div>
  );
};

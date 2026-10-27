import { Toad } from "../../../models/Toad";
import {
  ToadTypes,
  isColorableToadType,
} from "../../../models/Toad/toad-species";
import { makeColorWhiter } from "../../ToadCanvas/utils";

/** Аватару нужны только вид и окрас: каталог лутбокса хранит частичных жаб. */
type ToadAvatarModel = {
  type?: Toad["type"];
  genes?: Pick<Toad["genes"], "colors">;
};

export const ToadAvatar = (props: {
  toad: ToadAvatarModel;
  size?: number;
  onClick?: () => void;
}) => {
  const { toad, size = 10, onClick } = props;
  const type =
    toad.type && Object.values(ToadTypes).includes(toad.type)
      ? toad.type
      : ToadTypes.hybrid;
  const baseColor = toad.genes?.colors[0] ?? "#1C2229";

  const isColoredToad = isColorableToadType(type);
  const imageSrc = isColoredToad ? `/bg/${type}.webp` : `/sprites/${type}.webp`;

  return (
    <div
      onClick={onClick}
      style={{
        width: size * 4,
        height: size * 4,
      }}
      className="relative overflow-hidden rounded-none"
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: isColoredToad
            ? makeColorWhiter(baseColor, 20)
            : "#1C2229",
        }}
      />
      <div
        style={{
          width: size * 4,
          height: size * 4,
          color: baseColor,
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

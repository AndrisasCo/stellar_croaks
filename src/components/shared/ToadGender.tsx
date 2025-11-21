import { TYPE_ICONS } from "../../utils/constants";

export const ToadGender = ({ gender }: { gender: string }) => {
  return (
    <span
      className={`text-xl font-bold leading-[0.5]
         ${gender === "male" ? " text-blue-500" : ""}
         ${gender === "female" ? " text-pink-500 " : ""}
         ${gender === "neuter" ? " text-gray-500/50 " : ""}
        `}
    >
      {TYPE_ICONS[gender as keyof typeof TYPE_ICONS]}
    </span>
  );
};

/**
 * Полоска HP жабы: цвет — по запасу здоровья (зелёный → жёлтый → красный).
 *
 * Полоска нужна там, где жабу сравнивают перед делом (роль в походе) и где её лечат
 * (лазарет), поэтому она живёт одним компонентом, а не дублируется в модалках.
 */
export const HpBar: React.FC<{ hp: number; maxHp: number; className?: string }> = ({
  hp,
  maxHp,
  className,
}) => {
  const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
  const color =
    ratio <= 0
      ? "bg-red-600"
      : ratio < 0.35
      ? "bg-red-500"
      : ratio < 0.7
      ? "bg-yellow-500"
      : "bg-green-500";

  return (
    <div
      className={`h-1.5 w-full bg-gray-700 rounded-full overflow-hidden ${
        className || ""
      }`}
    >
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  );
};

export default HpBar;

import { CurrencyIcon } from "../../../shared/CurrencyIcon";
import { GridNodes, HudPanel, HudTone } from "../../../shared/DataGrid";
import { ShopItem } from "./use-shop";
import { LootboxDetails } from "./LootboxDetails";
import { useModal } from "../../../ModalContext";

/** Редкость груза: цвет узлов, рамки и технический код на карточке. */
const RARITY_STYLE: Record<
  ShopItem["rarity"],
  {
    tone: HudTone;
    border: string;
    text: string;
    code: string;
    glow: string;
    node: string;
  }
> = {
  common: {
    tone: "emerald",
    border: "border-emerald-400/35",
    text: "text-emerald-300",
    code: "COMMON",
    glow: "shadow-[0_0_14px_rgba(52,211,153,0.16)]",
    node: "bg-emerald-300",
  },
  uncommon: {
    tone: "sky",
    border: "border-sky-400/40",
    text: "text-sky-300",
    code: "UNCOMMON",
    glow: "shadow-[0_0_14px_rgba(56,189,248,0.18)]",
    node: "bg-sky-300",
  },
  rare: {
    tone: "violet",
    border: "border-violet-400/45",
    text: "text-violet-300",
    code: "RARE",
    glow: "shadow-[0_0_18px_rgba(167,139,250,0.24)]",
    node: "bg-violet-300",
  },
};

export const BuyButton = (props: { item: ShopItem }) => {
  const { item } = props;
  const { openModal } = useModal();
  const style = RARITY_STYLE[item.rarity];
  const soldOut = item.left === 0;

  return (
    <HudPanel tone={style.tone} className="p-2.5">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div
            className={`relative flex h-14 w-14 shrink-0 items-center justify-center border bg-slate-950/70 ${style.border} ${style.glow}`}
          >
            <GridNodes tone={style.node} />
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute inset-x-2 top-0 h-px bg-gradient-to-r from-transparent via-current to-transparent ${style.text} opacity-60`}
            />
            <img
              src={item.icon}
              className="relative z-10 max-h-12 max-w-12 object-contain"
              alt=""
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-sm font-semibold text-white">
                {item.name}
              </p>
              <span
                className={`shrink-0 text-3xs font-semibold uppercase tracking-[0.14em] ${style.text}`}
              >
                {style.code}
              </span>
            </div>
            <p className="mt-0.5 text-2xs leading-snug text-slate-400">
              {item.description}
            </p>
            <div
              className={`mt-1 flex items-center gap-1.5 text-3xs uppercase tracking-[0.12em] ${
                soldOut ? "text-rose-300" : "text-emerald-300/90"
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-1 w-1 ${
                  soldOut
                    ? "bg-rose-300"
                    : "bg-emerald-300 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
                }`}
              />
              {soldOut
                ? "Нет в наличии"
                : `${item.left === Infinity ? "∞" : item.left} в наличии`}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-1.5 sm:shrink-0 sm:flex-col">
          <button
            type="button"
            aria-label={`Купить «${item.name}» за ${item.price}`}
            className="ui-button-primary min-w-[99px] whitespace-nowrap px-3 py-1.5"
            onClick={item.onClick}
            disabled={item.disabled}
          >
            {item.price}{" "}
            <CurrencyIcon currency={item.currency} className="h-4 w-4" />
          </button>
          {item.key === "lootbox" && (
            <button
              type="button"
              onClick={() => {
                openModal(() => <LootboxDetails />);
              }}
              className="ui-button-secondary whitespace-nowrap px-3 py-1.5 text-3xs"
            >
              Подробнее
            </button>
          )}
        </div>
      </div>
    </HudPanel>
  );
};

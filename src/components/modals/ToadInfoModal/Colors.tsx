import { useState } from "react";
import { Toad } from "../../../models/Toad";

import { isColorableToadType } from "../../../models/Toad/toad-species";

import { Tooltip } from "../../shared/Tooltip";

import { ClickButton } from "../../shared/ClickButton";
import { InventoryItem, Items, itemsFull } from "../../../models/user";
import { useToads } from "../../ToadContext";
import { updateToadById, updateUserStorage } from "../../../backend";
import {
  generateRandomHexColor,
  varyColor,
} from "../../../utils/randomize-toad-characteristics";
import { useNotifications } from "../../../hooks/use-notification";
import {
  EXPEDITION_TOAD_BUSY_REASON,
  isToadBusyOnExpedition,
} from "../../../utils/expedition-manager";

export const Colors = ({ toad }: { toad: Toad }) => {
  const { account } = useToads();
  const { addNotification } = useNotifications();

  const inventory = account.storage;
  const [openTooltip, setOpenToopltip] = useState(false);
  const coloredTypes = isColorableToadType(toad.type);
  /** Жабу в походе не перекрашивают: добыча и возвращение идут своим порядком */
  const onExpedition = isToadBusyOnExpedition(toad);

  const color = toad.genes.colors[0];

  if (!coloredTypes || !color) {
    return null;
  }

  const currentPigments = [
    Items.pigmentBlue,
    Items.pigmentGreen,
    Items.pigmentRed,
    Items.pigmentUnstable,
  ]
    .filter((p) => inventory[p])
    .map((p) => itemsFull[p]);

  const handleUsePigment = (pigment: InventoryItem) => () => {
    setOpenToopltip(false);

    if (onExpedition) {
      addNotification({
        type: "warn",
        content: EXPEDITION_TOAD_BUSY_REASON,
      });
      return;
    }

    if ((account.storage[pigment.key] || 0) <= 0) {
      addNotification({
        type: "warn",
        content: `У вас нет ${pigment.name} для окрашивания`,
      });
      return;
    }

    const colors = {
      [Items.pigmentBlue]: varyColor("#0000AA"),
      [Items.pigmentRed]: varyColor("#AA0000"),
      [Items.pigmentGreen]: varyColor("#00AA00"),
      [Items.pigmentUnstable]: generateRandomHexColor(),
    };

    const color = colors[pigment.key];

    updateUserStorage({ [pigment.key]: account.storage[pigment.key] - 1 });
    updateToadById(toad.id, { genes: { ...toad.genes, colors: [color] } });

    addNotification({
      type: "success",
      content: `Успешное окрашивание`,
    });
  };

  const noPigments = !currentPigments.length;

  return (
    <div className="flex ml-auto gap-2 mt-2 relative">
      <div className="flex gap-1 mt-2 justify-center">
        <div
          className="w-4 h-4 rounded-full border border-white/30"
          style={{ backgroundColor: color }}
        />
      </div>

      <ClickButton
        onClick={() => setOpenToopltip(true)}
        disabled={onExpedition}
        title={onExpedition ? EXPEDITION_TOAD_BUSY_REASON : undefined}
        className="bg-slate-600/50 hover:bg-green-600/40 px-1 rounded-lg py-2 text-xs flex justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-slate-600/50"
      >
        <span>🎨</span> Покрасить
      </ClickButton>
      <Tooltip
        className="min-w-[200px] right-0"
        revert
        title="Покраска"
        isOpen={openTooltip}
        onClose={() => setOpenToopltip(false)}
      >
        <div className="flex flex-col gap-1 items-start">
          {noPigments
            ? "У вас нет пигментов для окрашивания, купите их в Торговой капсуле"
            : currentPigments.map((p) => (
                <ClickButton
                  key={p.key}
                  onClick={handleUsePigment(p)}
                  disabled={onExpedition}
                  className="text-left p-1 border-2 rounded-sm border-slate-400/20 w-full text-sm flex gap-2 items-center disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <img width={30} src={p.icon} />
                  {p.name}
                </ClickButton>
              ))}
        </div>
      </Tooltip>
    </div>
  );
};

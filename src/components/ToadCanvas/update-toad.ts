import { Container, Sprite } from "pixi.js";
import { getTextureByType, makeColorWhiter } from "./utils";
import { ANIMATION_SPEED, TOAD_FRAMES_COUNT } from "./constants";
import { isColorableToadType } from "../../models/Toad/toad-species";
import { Toad } from "../../models/Toad";

export const updateToadAppearance =
  (container: Container, toad: Toad, state: string, bounce: number = 0) =>
  (texturesRef: { current: any }) => {
    const toadSprite = container.getChildAt(0) as Sprite;
    if (!toadSprite || !texturesRef.current) {
      return;
    }
    const isToadpole = toad.stage === "toadpole";
    // Pixi v8 не описывает `userData` в типах: прогресс анимации кладёт туда карта.
    const data = (
      container as Container & { userData?: { animationProgress: number } }
    ).userData;
    const textures = isToadpole
      ? texturesRef.current.toadpoleTextures
      : getTextureByType(texturesRef, toad.type);

    if (textures && textures.length > 0) {
      if (state === "walking" && data) {
        data.animationProgress += ANIMATION_SPEED;
        const frameIndex =
          (Math.floor(data.animationProgress) % (TOAD_FRAMES_COUNT - 1)) + 1;
        toadSprite.texture = textures[frameIndex];
      } else {
        toadSprite.texture = textures[0];
        if (data) {
          data.animationProgress = 0;
        }
      }
    }
    const size = toad.genes.weight * 1.5;
    const bodyY = (-bounce * size) / 10;
    toadSprite.y = bodyY;
    const aspectRatio = toadSprite.height / toadSprite.width;
    toadSprite.setSize(size * 2, size * 2 * aspectRatio);
    if (toad.stage === "adult" && isColorableToadType(toad.type)) {
      toadSprite.tint = makeColorWhiter(toad.genes.colors[0], 10);
    }
  };

import { Container, Sprite } from "pixi.js";
import { getTextureByType, makeColorWhiter } from "./utils";
import { ANIMATION_SPEED, TOAD_FRAMES_COUNT } from "./constants";
import { ToadTypes } from "../../models/Toad/toad-species";
import { Toad } from "../../models/Toad";

export const updateToadAppearance =
  (container: Container, toad: Toad, state: string, bounce: number = 0) =>
  (texturesRef) => {
    const toadSprite = container.getChildAt(0) as Sprite;
    if (!toadSprite || !texturesRef.current) {
      return;
    }
    const isToadpole = toad.stage === "toadpole";
    const data = container.userData;
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
        data.animationProgress = 0;
      }
    }
    const size = toad.genes.weight * 1.5;
    const bodyY = (-bounce * size) / 10;
    toadSprite.y = bodyY;
    const aspectRatio = toadSprite.height / toadSprite.width;
    toadSprite.setSize(size * 2, size * 2 * aspectRatio);
    if (
      toad.stage === "adult" &&
      [ToadTypes.hybrid, ToadTypes.camouflage].includes(toad.type)
    ) {
      toadSprite.tint = makeColorWhiter(toad.genes.colors[0], 10);
    }
  };

import { ContainerChildCustom } from ".";
import { updateToadAppearance } from "./update-toad";

export const moveToads =
  (app, texturesRef) => (container: ContainerChildCustom) => {
    const data = container.userData;
    if (!data) return;

    const isNew = data.toadData.spawnTime
      ? Date.now() - data.toadData.spawnTime < 10000
      : false;

    const stateChanged = data.state !== data.lastState || isNew;
    const bounceChanged = Math.abs(data.bounce - data.lastBounce) > 0.1;

    if (data.needsRedraw || stateChanged || bounceChanged) {
      updateToadAppearance(
        container,
        data.toadData,
        data.state,
        data.bounce
      )(texturesRef);
      data.needsRedraw = false;
      data.lastState = data.state;
      data.lastBounce = data.bounce;
    }

    if (data.dropAnimation.isDropping) {
      data.dropAnimation.progress += app.ticker.deltaTime;
      const progress = Math.min(
        data.dropAnimation.progress / data.dropAnimation.duration,
        1
      );
      const bounce = Math.sin(progress * Math.PI) * 16;
      container.y = data.dropAnimation.targetY + bounce;

      if (progress >= 1) {
        data.dropAnimation.isDropping = false;
        data.state = "idle";
        data.stateTimer = 30;
        container.y = data.dropAnimation.targetY;
      }
      data.needsRedraw = true;
      return;
    }

    if (data.isDragging) return;

    if (data.state === "jumping") {
      data.bounce -= 0.4;
      if (data.bounce <= 0) {
        data.bounce = 0;
        data.state = "idle";
        data.stateTimer = 30;
      }
      data.needsRedraw = true;
      return;
    }

    if (data.isTapped) {
      data.tapTimer += app.ticker.deltaTime;
      if (data.tapTimer > 5) {
        data.isTapped = false;
      }
    }

    data.stateTimer -= app.ticker.deltaTime;

    if (data.destination.x) {
      data.state = "walking";

      const dx = data.destination.x - container.x;
      const dy = data.destination.y - container.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < (data.distance || 1)) {
        data.vx = 0;
        data.vy = 0;
        data.destination = {};
        data.stateTimer = 320;
      } else {
        data.vx = (dx / distance) * data.speed;
        data.vy = (dy / distance) * data.speed;
      }

      data.needsRedraw = true;
    } else {
      if (data.stateTimer <= 0 && Math.random() < 0.05) {
        if (data.state === "sleeping") {
          data.state = "idle";
          data.stateTimer = 90 + Math.random() * 120;
        } else if (Math.random() < 0.3) {
          data.state = "sleeping";
          data.stateTimer = 180 + Math.random() * 180;
        } else if (Math.random() < 0.7) {
          data.state = "walking";
          data.stateTimer = 120 + Math.random() * 180;

          data.vx = (Math.random() - 0.5) * data.speed;
          data.vy = (Math.random() - 0.5) * data.speed;
        } else {
          data.state = "idle";
          data.stateTimer = 60 + Math.random() * 120;
        }
        data.needsRedraw = true;
      }
    }

    if (data.state !== "walking") {
      return;
    }

    data.bounce += 0.01 * data.bounceDirection;
    if (data.bounce >= 4) data.bounceDirection = -10;
    if (data.bounce <= 0) data.bounceDirection = 10;
    data.needsRedraw = true;

    container.x += data.vx;
    container.y += data.vy;

    if (data.vx !== 0) {
      container.scale.x = data.vx > 0 ? -1 : 1;
    }

    // ВАЖНО: Используем app.screen для проверки границ, а не статические width/height
    // Это позволяет жабам реагировать на изменение размера окна
    const currentScreenW = app.screen.width;
    const currentScreenH = app.screen.height;

    const leftBound = 15 + data.size;
    const rightBound = currentScreenW - 15 - data.size;
    const topBound = 25 + data.size;
    const bottomBound = currentScreenH - 15 - data.size;

    if (
      container.x < leftBound ||
      container.x > rightBound ||
      container.y < topBound ||
      container.y > bottomBound
    ) {
      data.vx *= -1;
      data.vy *= -1;
      container.x = Math.max(leftBound, Math.min(rightBound, container.x));
      container.y = Math.max(topBound, Math.min(bottomBound, container.y));
      data.state = "idle";
      data.stateTimer = 30;
      data.animationProgress = 0;
      data.needsRedraw = true;
    }
  };

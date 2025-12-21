export const getWindowDimensions = () => {
  const width = Math.min(window.innerWidth, 672);
  const height = width;
  return {
    width,
    height,
  };
};

export const getSceneSettings = () => {
  const { width, height } = getWindowDimensions();
  const padding = 4;
  const penWidth = width - padding * 2;
  const penHeight = height - padding * 2;
  return {
    padding,
    penWidth,
    penHeight,
  };
};

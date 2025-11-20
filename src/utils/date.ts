export const getHoursFromNow = (date: string | number) =>
  Math.floor((Date.now() - new Date(date).getTime()) / 1000 / 60 / 60);

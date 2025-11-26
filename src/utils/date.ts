export const getHoursFromNow = (date: string | number) =>
  (Date.now() - new Date(date).getTime()) / 1000 / 60 / 60;

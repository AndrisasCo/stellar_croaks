import { useState } from "react";

interface FlyingNumberData {
  id: number;
  value: number | string;
  color?: "red" | "green" | "yellow" | "purple" | "blue";
  position?: { x: number; y: number };
}

export const useFlyingNumbers = () => {
  const [flyingNumbers, setFlyingNumbers] = useState<FlyingNumberData[]>([]);

  const addFlyingNumber = (
    value: number | string,
    color?: "red" | "green" | "yellow" | "purple" | "blue",
    position?: { x: number; y: number }
  ) => {
    const id = Date.now();
    setFlyingNumbers((prev) => [...prev, { id, value, color, position }]);
  };

  const removeFlyingNumber = (id: number) => {
    setFlyingNumbers((prev) => prev.filter((item) => item.id !== id));
  };

  return {
    flyingNumbers,
    addFlyingNumber,
    removeFlyingNumber,
  };
};

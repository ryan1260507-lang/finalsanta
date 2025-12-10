export const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// Generates an array [1, 2, ..., 35] randomly shuffled
export const generateGiftDistribution = (total: number): number[] => {
  const gifts = Array.from({ length: total }, (_, i) => i + 1);
  return shuffleArray(gifts);
};
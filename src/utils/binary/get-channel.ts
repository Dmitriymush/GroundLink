export const getChannel = (data: Buffer, from: number, to: number): number => {
  return data[from] | (data[to] << 8);
};

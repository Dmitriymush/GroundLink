export const mapValue = (value: number, minInput: number, maxInput: number, minOutput: number, maxOutput: number) => {
    const inputRange = maxInput - minInput;
    const outputRange = maxOutput - minOutput;
    const scaledValue = (value - minInput) / inputRange;
    const mappedValue = scaledValue * outputRange + minOutput;
    return Math.round(mappedValue);
  };
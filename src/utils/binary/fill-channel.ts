export const fillChannel = (buffer: Buffer, value: number, start: number, stop: number) => {
    const array = new Uint16Array(1);
    array[0] = value;
    
    const newBuffer = Buffer.from(array.buffer);
    buffer[start] = newBuffer[0];
    buffer[stop] = newBuffer[1];
}
/**
 * Wire SDK Bridge — Node.js WASM wrapper
 *
 * Loads sine_wire.wasm and provides TypeScript interface for:
 * - wire__proto_to_link: protobuf → wire binary
 * - wire__link_to_proto: wire binary → protobuf
 * - wire__raw_to_mavlink: wire binary → MAVLink FTP payload
 * - wire__mavlink_to_raw: MAVLink FTP payload → wire binary
 */

import * as fs from 'fs';
import * as path from 'path';

const SIZEOF_SIZE_T = 4; // WASM32

// Error codes
const SINE_WIRE_ERR_OK = 0;
const SINE_WIRE_ERR_UNKNOWN_OBJ = -1;
const SINE_WIRE_ERR_INVALID_WIRE_SIZE = -2;
const SINE_WIRE_ERR_BUFF_TOO_SMALL = -3;
const SINE_WIRE_ERR_EXCEPTION = -4;
const SINE_WIRE_ERR_SERDES = -5;
const SINE_WIRE_ERR_CRC = -6;

interface WasmExports {
  memory: WebAssembly.Memory;
  malloc: (size: number) => number;
  free: (ptr: number) => void;
  wire__proto_to_link: (protoIn: number, protoInSize: number, binaryOut: number, binaryOutSize: number) => number;
  wire__link_to_proto: (binaryIn: number, binaryInSize: number, protoOut: number, protoOutSize: number) => number;
  wire__raw_to_mavlink: (raw: number, rawSize: number, sysId: number, compId: number, uuid: number, payloadOut: number, payloadOutSize: number) => number;
  wire__mavlink_to_raw: (payload: number, payloadSize: number, sysId: number, compId: number, uuid: number, rawOut: number, rawOutSize: number) => number;
}

function checkError(code: number, funcName: string): void {
  if (code === SINE_WIRE_ERR_OK) return;
  const messages: Record<number, string> = {
    [SINE_WIRE_ERR_UNKNOWN_OBJ]: 'Unknown object type',
    [SINE_WIRE_ERR_INVALID_WIRE_SIZE]: 'Invalid wire size',
    [SINE_WIRE_ERR_BUFF_TOO_SMALL]: 'Output buffer too small',
    [SINE_WIRE_ERR_EXCEPTION]: 'C++ exception in WASM',
    [SINE_WIRE_ERR_SERDES]: 'Serialization/deserialization error',
    [SINE_WIRE_ERR_CRC]: 'CRC mismatch',
  };
  throw new Error(`${funcName} failed: ${messages[code] ?? `Unknown error ${code}`}`);
}

export class WireBridge {
  private exports: WasmExports | null = null;

  async init(wasmDir?: string): Promise<void> {
    // Try multiple paths to find the WASM file
    const searchPaths = [
      wasmDir ? path.join(wasmDir, 'sine_wire.wasm') : '',
      path.join(__dirname, '..', '..', '..', 'wire', 'build', 'sine.wire', 'lib', 'sine_wire.wasm'),
      path.join(process.cwd(), 'wire', 'build', 'sine.wire', 'lib', 'sine_wire.wasm'),
    ].filter(Boolean);

    let wasmBuffer: Buffer | null = null;
    for (const p of searchPaths) {
      try {
        wasmBuffer = fs.readFileSync(p);
        console.log(`[WireBridge] Loaded WASM from: ${p}`);
        break;
      } catch { /* try next */ }
    }

    if (!wasmBuffer) {
      throw new Error(`[WireBridge] Could not find sine_wire.wasm. Searched: ${searchPaths.join(', ')}`);
    }

    const importObject = {
      wasi_snapshot_preview1: {
        fd_write: () => 0,
        fd_seek: () => 0,
        fd_close: () => 0,
        fd_read: () => 0,
        environ_get: () => 0,
        environ_sizes_get: () => 0,
        proc_exit: () => {},
        clock_time_get: () => 0,
        args_get: () => 0,
        args_sizes_get: () => 0,
        fd_prestat_get: () => -1,
        fd_prestat_dir_name: () => -1,
        path_open: () => -1,
        random_get: (buf: number, len: number) => {
          const view = new Uint8Array(this.exports!.memory.buffer, buf, len);
          for (let i = 0; i < len; i++) view[i] = Math.floor(Math.random() * 256);
          return 0;
        },
      },
    };

    const result = await WebAssembly.instantiate(wasmBuffer, importObject);
    this.exports = result.instance.exports as unknown as WasmExports;
  }

  get isInitialized(): boolean {
    return this.exports !== null;
  }

  /**
   * Convert protobuf bytes → wire binary (for sending to modem)
   */
  protoToLink(protoBytes: Uint8Array): Uint8Array {
    return this.callConvert('wire__proto_to_link', this.exports!.wire__proto_to_link, protoBytes);
  }

  /**
   * Convert wire binary → protobuf bytes (for parsing modem response)
   */
  linkToProto(wireBytes: Uint8Array): Uint8Array {
    return this.callConvert('wire__link_to_proto', this.exports!.wire__link_to_proto, wireBytes);
  }

  /**
   * Wrap raw binary into MAVLink FTP payload
   */
  rawToMavlink(raw: Uint8Array, sysId: number, compId: number, uuid: number): Uint8Array {
    const e = this.exports!;
    const mem = new Uint8Array(e.memory.buffer);

    const inputPtr = e.malloc(raw.length);
    mem.set(raw, inputPtr);

    const outCapacity = 512;
    const outPtr = e.malloc(outCapacity);
    const outLenPtr = e.malloc(SIZEOF_SIZE_T);
    new DataView(e.memory.buffer).setUint32(outLenPtr, outCapacity, true);

    try {
      const code = e.wire__raw_to_mavlink(inputPtr, raw.length, sysId, compId, uuid, outPtr, outLenPtr);
      checkError(code, 'wire__raw_to_mavlink');

      const outLen = new DataView(e.memory.buffer).getUint32(outLenPtr, true);
      return new Uint8Array(e.memory.buffer.slice(outPtr, outPtr + outLen));
    } finally {
      e.free(inputPtr);
      e.free(outPtr);
      e.free(outLenPtr);
    }
  }

  /**
   * Extract raw binary from MAVLink FTP payload
   * Returns: { raw, sysId, compId, uuid }
   */
  mavlinkToRaw(payload: Uint8Array): { raw: Uint8Array; sysId: number; compId: number; uuid: number } {
    const e = this.exports!;
    const mem = new Uint8Array(e.memory.buffer);

    const inputPtr = e.malloc(payload.length);
    mem.set(payload, inputPtr);

    const sysIdPtr = e.malloc(1);
    const compIdPtr = e.malloc(1);
    const uuidPtr = e.malloc(4);
    const outCapacity = 512;
    const outPtr = e.malloc(outCapacity);
    const outLenPtr = e.malloc(SIZEOF_SIZE_T);
    new DataView(e.memory.buffer).setUint32(outLenPtr, outCapacity, true);

    try {
      const code = e.wire__mavlink_to_raw(inputPtr, payload.length, sysIdPtr, compIdPtr, uuidPtr, outPtr, outLenPtr);
      checkError(code, 'wire__mavlink_to_raw');

      const view = new DataView(e.memory.buffer);
      const outLen = view.getUint32(outLenPtr, true);

      return {
        raw: new Uint8Array(e.memory.buffer.slice(outPtr, outPtr + outLen)),
        sysId: new Uint8Array(e.memory.buffer)[sysIdPtr],
        compId: new Uint8Array(e.memory.buffer)[compIdPtr],
        uuid: view.getUint32(uuidPtr, true),
      };
    } finally {
      e.free(inputPtr);
      e.free(sysIdPtr);
      e.free(compIdPtr);
      e.free(uuidPtr);
      e.free(outPtr);
      e.free(outLenPtr);
    }
  }

  /**
   * Generic converter for proto↔link, proto↔beam style functions
   */
  private callConvert(
    name: string,
    fn: (inPtr: number, inSize: number, outPtr: number, outSizePtr: number) => number,
    input: Uint8Array,
  ): Uint8Array {
    const e = this.exports!;
    const mem = new Uint8Array(e.memory.buffer);

    const inputPtr = e.malloc(input.length);
    mem.set(input, inputPtr);

    const outCapacity = 4096;
    const outPtr = e.malloc(outCapacity);
    const outLenPtr = e.malloc(SIZEOF_SIZE_T);
    new DataView(e.memory.buffer).setUint32(outLenPtr, outCapacity, true);

    try {
      const code = fn.call(null, inputPtr, input.length, outPtr, outLenPtr);
      checkError(code, name);

      const outLen = new DataView(e.memory.buffer).getUint32(outLenPtr, true);
      return new Uint8Array(e.memory.buffer.slice(outPtr, outPtr + outLen));
    } finally {
      e.free(inputPtr);
      e.free(outPtr);
      e.free(outLenPtr);
    }
  }
}

const { BroadcastChannel, isMainThread } = require("node:worker_threads");
const { HID, devicesAsync } = require("node-hid");
const dgram = require("dgram");

// Error types
const ErrorCode = {
  DEVICE_ERROR: 'DEVICE_ERROR',
  BUFFER_OVERFLOW: 'BUFFER_OVERFLOW',
  UDP_ERROR: 'UDP_ERROR',
  WORKER_ERROR: 'WORKER_ERROR',
  INVALID_CHANNEL: 'INVALID_CHANNEL',
  CONNECTION_ERROR: 'CONNECTION_ERROR'
};

if (isMainThread) {
  return;
}

const handleError = (code, error, context = {}) => {
  const errorContext = {
    code,
    message: error.message || String(error),
    timestamp: Date.now(),
    context
  };

  console.error('HID Error:', errorContext);

  // Notify main process about error
  bc.postMessage({
    type: 'error',
    error: errorContext
  });

  // Update device state for critical errors
  if ([ErrorCode.DEVICE_ERROR, ErrorCode.CONNECTION_ERROR].includes(code)) {
    dev.connected = false;
  }
};

const CHANNELS_ADDRESS = {
  CH1: [3, 4],
  CH2: [5, 6],
  CH3: [7, 8],
  CH4: [9, 10],
  CH5: [11, 12],
  CH6: [13, 14],
  CH7: [15, 16],
  CH8: [17, 18],
  CH9: [19, 20],
  CH10: [21, 22],
  CH11: [23, 24],
  CH12: [25, 26],
  CH13: [27, 28],
  CH14: [29, 30],
  CH15: [31, 32],
  CH16: [33, 34],
};

const fillChannel = (buffer, value, start, stop) => {
  const array = new Uint16Array(1);
  array[0] = value;

  const newBuffer = Buffer.from(array.buffer);
  buffer[start] = newBuffer[0];
  buffer[stop] = newBuffer[1];
};

const getChannel = (data, from, to) => {
  return data[from] | (data[to] << 8);
};

const getChannels = (data) => {
  return {
    roll: getChannel(data, 3, 4), // ch1
    pitch: getChannel(data, 5, 6), // ch2
    throttle: getChannel(data, 7, 8), //ch3
    yaw: getChannel(data, 9, 10), // ch4
    arm: getChannel(data, 11, 12), // ch5
    mode: getChannel(data, 13, 14), // ch6
    aux3: getChannel(data, 15, 16), // ch7
    aux4: getChannel(data, 17, 18), // ch8
    aux5: getChannel(data, 19, 20), // ch9
    aux6: getChannel(data, 21, 22), // ch10
    aux7: getChannel(data, 23, 24), // ch11
    aux8: getChannel(data, 25, 26), // ch12
    aux9: getChannel(data, 27, 28), // ch13
    aux10: getChannel(data, 29, 30), // ch14
    aux11: getChannel(data, 31, 32), // ch15
    aux12: getChannel(data, 33, 34), // ch16
  };
};

const bc = new BroadcastChannel("hid");

const validateDeviceParams = (vendorId, productId) => {
  if (!vendorId || !productId) {
    throw new Error(`Invalid device parameters: vendorId=${vendorId}, productId=${productId}`);
  }
  return true;
};

const validateData = (data) => {
  if (!data || data.length > 35) { // 35 is our buffer size
    throw new Error(`Invalid data length: ${data?.length}`);
  }
  return true;
};

const validateUDPConfig = () => {
  if (!dev.udpIp || !dev.udpPort) {
    throw new Error('Invalid UDP configuration');
  }
  return true;
};

const dev = {
  device: null,
  udpIp: null,
  udpPort: null,
  udpClient: dgram.createSocket({
    type: "udp4",
  }),
  channels: [],
  manualChannels: {},
  mixes: [],
  connected: false,
};

const dataToSend = Buffer.alloc(35).fill(0);

const processManualChannels = (dataToSend) => {
  Object.keys(dev.manualChannels).forEach((key) => {
    const channel = dev.manualChannels[key];

    fillChannel(
      dataToSend,
      channel.value,
      channel.address[0],
      channel.address[1]
    );
  });
};

const convertButtonToValue = (data, address) => {
  return ((data >> address) & 1) * 2047;
};

const normalizeDataToSend = (dataToSend, bit, address) => {
  fillChannel(
    dataToSend,
    convertButtonToValue(dataToSend[0], bit),
    address[0],
    address[1]
  );
};

const processReverse = (mix, value) => {
  if (mix.reverse) {
    return 2047 - value;
  }

  return value;
}

const processMixes = (data) => {
  for (const mix of dev.mixes) {
    const inputAddress = CHANNELS_ADDRESS[mix.input];
    const outputAddress = CHANNELS_ADDRESS[mix.output];

    const input = processReverse(
      mix,
      getChannel(data, inputAddress[0], inputAddress[1])
    );

    fillChannel(data, input, outputAddress[0], outputAddress[1]);
  }
}

bc.onmessage = (event) => {
  const { data = {} } = event;

  console.log("Message from main thread", event.data);

  if (data.vendorId == -1 && data.productId == -1) {
    console.log("Stop device");
    dev.connected = false;
    dev.device?.close();
    return;
  }

  if (data.host) {
    dev.udpIp = data.host;
  }

  if (data.port) {
    dev.udpPort = data.port;
  }

  if (data.manualChannels) {
    dev.manualChannels = data.manualChannels;
    console.log("Manual channels", dev.manualChannels);
  }

  if (data.mixes) {
    dev.mixes = data.mixes;
  }

  if (data.vendorId && data.productId) {
    console.log("send channesls to ", dev.udpIp, dev.udpPort);
    try {
      validateDeviceParams(data.vendorId, data.productId);
      dev.device = new HID(data.vendorId, data.productId);
    } catch (error) {
      handleError(ErrorCode.DEVICE_ERROR, error, { vendorId: data.vendorId, productId: data.productId });
      return;
    }

    dev.device.on("data", (data) => {
      try {
        validateData(data);
        dev.connected = true;

        // Copy data safely
        const length = Math.min(data.length, dataToSend.length);
        for (let i = 0; i < length; i++) {
          dataToSend[i] = data[i];
        }

        // Process channel data with validation
        normalizeDataToSend(dataToSend, 0, CHANNELS_ADDRESS.CH9);
        normalizeDataToSend(dataToSend, 1, CHANNELS_ADDRESS.CH10);
        normalizeDataToSend(dataToSend, 2, CHANNELS_ADDRESS.CH11);
        normalizeDataToSend(dataToSend, 3, CHANNELS_ADDRESS.CH12);
        processManualChannels(dataToSend);
        processMixes(dataToSend);

        dev.channels = dataToSend;

        // Send UDP data with error handling
        try {
          validateUDPConfig();
          dev.udpClient.send(dataToSend, dev.udpPort, dev.udpIp, (error) => {
            if (error) {
              handleError(ErrorCode.UDP_ERROR, error);
            }
          });
        } catch (error) {
        }
      } catch (error) {
        handleError(ErrorCode.BUFFER_OVERFLOW, error);
      }
    });

    dev.device.on('error', (error) => {
      handleError(ErrorCode.DEVICE_ERROR, error);

      setTimeout(() => {
        try {
          dev.device = new HID(data.vendorId, data.productId);
          dev.connected = true;
        } catch (reconnectError) {
          handleError(ErrorCode.CONNECTION_ERROR, reconnectError);
        }
      }, 100); // Exponential backoff
    });
  }
};

setInterval(() => {
  if (!dev.connected) {
    return;
  }
  bc.postMessage({
    type: "channels",
    channels: getChannels(dev.channels),
  });
}, 100);

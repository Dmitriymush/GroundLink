// DEPRECATED: This file has been replaced by the new RPanionService
// All components should now use the new hooks from @/hooks/use-rpanion-api

import {
  VIDEO_SETTINGS,
  type BaseVideoSettings,
} from "@/constants/video-settings";
import { ECDH } from "crypto";
// TODO: Remove needle import when all components are migrated
import needle from "needle";
import type path from "path";

export type Dev = {
  label: string;
  value: string;
  caps: Cap[];
};

type Cap = {
  format: string;
  fpsmax: string;
  height: number;
  label: string;
  value: string;
  width: number;
};

type VidDevice = {
  label: string;
  value: string;
  caps: Array<Cap>;
};

type VideoDevices = {
  streamingStatus: boolean;
  UDPChecked: boolean;
  dev: Array<Dev>;
  fpsSelected: string;
  streamAddresses: Array<string>;
  timestamp: boolean;
  useUDPIP: string;
  useUDPPort: number;
  vidDeviceSelected: VidDevice;
  vidResSelected: Cap;
  vidres: Array<Cap>;
  bitrate: string;
};

export type VideoSettings = {
  active: boolean;
  device: string | null;
  height: number;
  width: number;
  format: string;
  rotation: number;
  fps: string;
  bitrate: string;
  useUDP: boolean;
  useUDPIP: string;
  useUDPPort: number;
  useTimestamp: boolean;
  useCameraHeartbeat: boolean;
  mavStreamSelected: number;
  compression: string;
  _status?: boolean;
  _devices?: Array<Dev>;
};

export type VideoSettingsShortParmas = {
  height: number;
  width: number;
  bitrate: number;
  fps: number;
  host: string;
  devices: Array<Dev>;
  format: string;
  active?: boolean;
  _status?: boolean;
};

export type BaudRateSettings = {
  label: string;
  value: number;
};

export type MavVersion = {
  label: string;
  value: number;
};

export type SerialPort = {
  label: string;
  pnpId: string;
  value: string;
};

export type TelemetrySettings = {
  UDPBPort: number;
  baudRateSelected: BaseVideoSettings | null;
  baudRates: BaseVideoSettings[];
  enableDSRequest: boolean;
  enableHeartbeat: boolean;
  enableTCP: boolean;
  enableUDPB: boolean;
  mavVersionSelected: MavVersion | null;
  mavVersions: MavVersion[];
  serialPortSelected: SerialPort | null;
  serialPorts: SerialPort[];
  telemetryStatus: false;
  outputs: {
    IPPort: string;
  }[];
};

export type TelemetrySettingsParmas = {
  UDPBPort: number;
  baud: string;
  device: string;
  enableDSRequest: boolean;
  enableHeartbeat: boolean;
  enableTCP: boolean;
  enableUDPB: boolean;
  mavversion: string;
};

export const getVideoSettings = (
  params: VideoSettingsShortParmas
): VideoSettings => {
  return {
    active: params.active != null ? params.active : true,
    device:
      params.devices.find(({ value }) => value !== "testsrc")?.value || null,
    height: params.height,
    width: params.width,
    format: params.format,
    rotation: 0,
    fps: String(params.fps),
    bitrate: String(params.bitrate),
    useUDP: true,
    useUDPIP: params.host,
    useUDPPort: 5400,
    useTimestamp: false,
    useCameraHeartbeat: false,
    mavStreamSelected: 0,
    compression: "H264",
    _status: params._status,
    _devices: params.devices,
  };
};

export const isAvalible = async (ip: string): Promise<boolean> => {
  console.log("check ip", ip);

  try {
    await needle(
      "get",
      `http://${ip}:3000/api/softwareinfo`,
      {},
      { timeout: 5e3 }
    );
    return true;
  } catch (e) {
    console.warn(e);

    return false;
  }
};

export const getVideoDevices = async (ip: string): Promise<VideoDevices> => {
  const { body } = await needle(
    "get",
    `http://${ip}:3000/api/videodevices`,
    {}
  );

  // Handle if body is an array
  if (Array.isArray(body)) {
    return body[0];
  }

  return body;
};

export const stopVideoV2 = async (ip: string): Promise<void> => {
  try {
    // Check version with 10s timeout
    const { body: versionInfo } = await needle(
      "get",
      `http://${ip}:3000/version`,
      {},
      { timeout: 10000 }
    );

    // If pi4 version, use new endpoint
    if (versionInfo?.version === "pi4") {
      console.log("Stop video video active false");

      await needle(
        "post",
        `http://${ip}:3000/api/startstopvideo`,
        {
          active: false,
          compression: "H264",
          useCameraHeartbeat: false,
          mavStreamSelected: 0,
        },
        { json: true }
      );
      return;
    }
  } catch (e) {
    console.warn("Version check failed, using old endpoint:", e);
  }

  // Fallback to old endpoint
  const { body } = await needle("post", `http://${ip}:3000/api/stopvideo`, {});
  console.log(body);
};

export const getVideoSettingsApi = async (
  ip: string
): Promise<VideoSettings> => {
  const devices = await getVideoDevices(ip);

  if (!devices || !devices.vidResSelected) {
    console.warn("Invalid video devices response:", devices);
    throw new Error("Invalid video devices response");
  }

  const out = getVideoSettings({
    width: devices.vidResSelected.width,
    height: devices.vidResSelected.height,
    bitrate: Number(devices.bitrate),
    fps: devices.vidResSelected.width === 1920 ? 20 : 30,
    host: devices.useUDPIP,
    devices: devices.dev,
    format: devices.vidResSelected.format,
    _status: devices.streamingStatus,
  });

  return out;
};

export const changeVideoSettingsApi = async (
  ip: string,
  settings: VideoSettings
) => {
  console.log("change video settings", settings);

  const { body } = await needle(
    "post",
    `http://${ip}:3000/api/startstopvideo`,
    { ...settings, compression: "H264" },
    { json: true }
  );

  return body;
};

export const stopVideoSteam = async (ip: string, settings: VideoSettings) => {
  return changeVideoSettingsApi(ip, { ...settings, active: false });
};

export const startVideoStream = async (ip: string, settings: VideoSettings) => {
  return changeVideoSettingsApi(ip, { ...settings, active: true });
};

export const getVideoSettingsList = (devices: Dev[]): BaseVideoSettings[] => {
  if (devices.some((dev) => dev.value.includes("i2c"))) {
    return VIDEO_SETTINGS.rpicam;
  }

  if (devices.some((dev) => dev.value.includes("/dev/video"))) {
    return VIDEO_SETTINGS.h264AnalogConvertor;
  }

  return [];
};

export const fixVideoApi = async (ip: string): Promise<void> => {
  await needle("get", `http://${ip}:3003`);
};

export const reboot = async (ip: string): Promise<void> => {
  await needle("get", `http://${ip}:3003/reboot`);
};

export const shutdown = async (ip: string): Promise<void> => {
  await needle("get", `http://${ip}:3003/shutdown`);
};

export const getTelemetrySettings = async (
  ip: string
): Promise<TelemetrySettings> => {
  const [{ body: telemetrySettings }, { body: outputs }] = await Promise.all([
    needle("get", `http://${ip}:3000/api/FCDetails`),
    needle("get", `http://${ip}:3000/api/FCOutputs`),
  ]);

  return {
    ...telemetrySettings,
    outputs: outputs.UDPoutputs,
  };
};

type GatewayResponse = {
  gateway: string;
};
export const getGateway = async (ip: string): Promise<GatewayResponse> => {
  return (await needle("get", `http://${ip}:3003/ethernet/get-settings`)).body;
};

export const setGateway = async (
  ip: string,
  gateway: string
): Promise<void> => {
  await needle("post", `http://${ip}:3003/ethernet`, { gateway });
};

type GetTelemetryParams = {
  device: SerialPort;
  baudRate: number;
  start: boolean;
};

export const getTelemetryParams = (
  params: GetTelemetryParams
): TelemetrySettingsParmas => ({
  UDPBPort: 14550,
  baud: JSON.stringify({
    label: params.baudRate.toString(),
    value: params.baudRate,
  }),
  device: JSON.stringify(params.device),
  enableDSRequest: false,
  enableHeartbeat: false,
  enableTCP: false,
  enableUDPB: params.start,
  mavversion: JSON.stringify({
    label: "Mavlink version",
    value: 2,
  }),
});

export const changeTelemetrySettings = async (
  ip: string,
  clientIp: string,
  start: boolean
): Promise<any> => {
  const telemetrySettings = await getTelemetrySettings(ip);

  if (!telemetrySettings.outputs.some((output) => output.IPPort.includes(ip))) {
    await needle(
      "post",
      `http://${ip}:3000/api/addudpoutput`,
      {
        newoutputIP: clientIp,
        newoutputPort: "14550",
      },
      { json: true }
    );
  }

  const device = telemetrySettings.serialPorts[0];
  const baudRate = ["/dev/serial0", "/dev/ttyAMA0"].includes(device.value)
    ? 57600
    : 115200;
  const params = getTelemetryParams({ start, device, baudRate });

  await needle("post", `http://${ip}:3000/api/FCModify`, params, {
    json: true,
  });
};

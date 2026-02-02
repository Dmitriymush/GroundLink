import { format } from "node:path";

export type BaseVideoSettings = {
  label: string;
  width: number;
  height: number;
  bitrate: number;
  fps: number;
  format: string;
};

export const VIDEO_SETTINGS = {
  rpicam: [
    {
      label: "Low quality 1Mbit",
      format: "video/x-raw",
      width: 640,
      height: 480,
      bitrate: 1000,
      fps: 30,
    },
    {
      label: "Low quality 3Mbit",
      format: "video/x-raw",
      width: 640,
      height: 480,
      bitrate: 3000,
      fps: 30,
    },
    {
      label: "Medium quality, 3Mbit",
      format: "video/x-raw",
      width: 1280,
      height: 720,
      bitrate: 3000,
      fps: 30,
    },
    {
      label: "Medium quality, 5Mbit",
      format: "video/x-raw",
      width: 1280,
      height: 720,
      bitrate: 5000,
      fps: 30,
    },
    {
      label: "High quality, 3mbit",
      format: "video/x-raw",
      width: 1920,
      height: 1080,
      bitrate: 3000,
      fps: 25,
    },
    {
      label: "High quality, 5mbit",
      format: "video/x-raw",
      width: 1920,
      height: 1080,
      bitrate: 5000,
      fps: 20,
    },
  ],
  h264AnalogConvertor: [
    {
      label: "High quality",
      format: "video/x-h264",
      width: 640,
      height: 480,
      bitrate: 1000,
      fps: 30,
    },
    {
      label: "Low quality",
      format: "video/x-h264",
      width: 640,
      height: 360,
      bitrate: 1000,
      fps: 30,
    },
    {
      label: "3 Mbit",
      format: "image/jpeg",
      width: 640,
      height: 480,
      bitrate: 3000,
      fps: 30,
    },
    {
      label: "2 Mbit",
      format: "image/jpeg",
      width: 640,
      height: 480,
      bitrate: 2000,
      fps: 30,
    },
    {
      label: "1.5 Mbit",
      format: "image/jpeg",
      width: 640,
      height: 480,
      bitrate: 1500,
      fps: 30,
    },
    {
      label: "1 Mbit unstable",
      format: "image/jpeg",
      width: 640,
      height: 480,
      bitrate: 1000,
      fps: 30,
    },
    {
      label: "1 Mbit stable",
      format: "image/jpeg",
      width: 352,
      height: 288,
      bitrate: 1000,
      fps: 30,
    },
    {
      label: "0.5 Mbit unstable",
      format: "image/jpeg",
      width: 640,
      height: 480,
      bitrate: 500,
      fps: 30,
    },
    {
      label: "0.5 Mbit stable",
      format: "image/jpeg",
      width: 352,
      height: 288,
      bitrate: 500,
      fps: 25,
    },
  ],
};

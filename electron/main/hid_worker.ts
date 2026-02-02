import { join as joinPath } from "path";
import { existsSync } from "fs";
const {
  BroadcastChannel,
  isMainThread,
  Worker,
} = require("node:worker_threads");

let broadcast = null; // BroadcastChannel reference

const getPath = () => {
  const appRootDir = process.cwd();

  const devPath = joinPath(appRootDir, "requirements", "hid_worker.js");
  const prodPath = joinPath(
    appRootDir,
    "resources",
    "app",
    "requirements",
    "hid_worker.js"
  );

  if (existsSync(devPath)) {
    return devPath;
  }

  return prodPath;
};

const self = {
  childWindow: null,
  worker: null,
  started: false
};

export const setChildWindow = (childWindow) => {
  self.childWindow = childWindow;
};

export const hidWorker = ({ ipcMain }) => {
  if (self.started) return;
  self.worker = new Worker(getPath());
  broadcast = new BroadcastChannel("hid");
  self.started = true;

  ipcMain.handle("hid", async (_, data) => {
    if (!data) {
      return console.error("missed data", data, _);
    }
    if (broadcast) broadcast.postMessage(data);
  });

  broadcast.onmessage = (event) => {
    if (!broadcast) return;
    const message = event.data;
    try {
      switch (message.type) {
        case "channels":
          self?.childWindow?.webContents.send("channels", message.channels);
          break;
        case "error":
          self?.childWindow?.webContents.send("hid-error", message.error);
          console.error("HID Error:", message.error);
          break;
        default:
          console.error("Unknown message type", message.type);
      }
    } catch (e) {
      console.error("Error in broadcast.onmessage", e);
      self?.childWindow?.webContents.send("hid-error", {
        code: "INTERNAL_ERROR",
        message: e.message || String(e),
        timestamp: Date.now(),
      });
    }
  };
};

export const stopHidWorker = () => {
  // Clean up BroadcastChannel first
  if (broadcast) {
    try {
      broadcast.onmessage = null;
      broadcast.close();
    } catch (e) {
      // ignore
    }
    broadcast = null;
  }
  if (self.worker) {
    try {
      self.worker.terminate();
    } catch (err) {
      console.error("Failed to terminate HID worker", err);
    }
    self.worker = null;
    self.started = false;
  }
};

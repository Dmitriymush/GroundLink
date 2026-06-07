import { app, BrowserWindow, shell, ipcMain, session } from "electron";
import { release } from "node:os";
import { join } from "node:path";
import { hidWorker, setChildWindow, stopHidWorker } from "./hid_worker";
import { rotatorWorker, setRotatorChildWindow, stopRotatorWorker } from "./rotator_worker";
import { mavlinkWorker, setMavlinkChildWindow, stopMavlinkWorker } from "./mavlink_worker";
import { sinelinkWorker, setSinelinkChildWindow, stopSinelinkWorker } from "./sinelink_worker";
import { antennaMavlinkWorker, setAntennaMavlinkChildWindow, stopAntennaMavlinkWorker } from "./antenna_mavlink_worker";
import { cameraWorker, setCameraChildWindow, stopCameraWorker } from "./camera_worker";

try {
  const nodeHid = require("node-hid");
  nodeHid.devices();
} catch (e) {
  console.warn("[Main] node-hid not available, HID devices disabled:", (e as Error).message);
}

process.env.DIST_ELECTRON = join(__dirname, "..");
process.env.DIST = join(process.env.DIST_ELECTRON, "../dist");
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? join(process.env.DIST_ELECTRON, "../public")
  : process.env.DIST;

if (release().startsWith("6.1")) app.disableHardwareAcceleration();
if (process.platform === "win32") app.setAppUserModelId(app.getName());

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

let win: BrowserWindow | null = null;
let antennaStartupWin: BrowserWindow | null = null;
const preload = join(__dirname, "../preload/index.js");
const url = process.env.VITE_DEV_SERVER_URL;
const indexHtml = join(process.env.DIST, "index.html");

/**
 * Create the small antenna control window (primary window on startup)
 */
function createAntennaStartupWindow() {
  antennaStartupWin = new BrowserWindow({
    width: 420,
    height: 700,
    minWidth: 300,
    minHeight: 400,
    resizable: true,
    minimizable: true,
    maximizable: false,
    title: "Antenna Control",
    icon: join(process.env.VITE_PUBLIC, "favicon.ico"),
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Register IPC for all workers
  setChildWindow(antennaStartupWin);
  setRotatorChildWindow(antennaStartupWin);
  setMavlinkChildWindow(antennaStartupWin);
  setSinelinkChildWindow(antennaStartupWin);
  setAntennaMavlinkChildWindow(antennaStartupWin);
  setCameraChildWindow(antennaStartupWin);

  if (process.env.VITE_DEV_SERVER_URL) {
    antennaStartupWin.loadURL(`${url}#/antenna-floating`);
    antennaStartupWin.webContents.openDevTools();
  } else {
    antennaStartupWin.loadFile(indexHtml, { hash: "/antenna-floating" });
  }

  antennaStartupWin.on("closed", () => {
    antennaStartupWin = null;
  });
}

/**
 * Create the main full window (opened on demand via settings icon)
 */
async function createMainWindow() {
  if (win && !win.isDestroyed()) {
    win.focus();
    return;
  }

  win = new BrowserWindow({
    title: "GroundLink",
    icon: join(process.env.VITE_PUBLIC, "favicon.ico"),
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  setChildWindow(win);
  setRotatorChildWindow(win);
  setMavlinkChildWindow(win);
  setSinelinkChildWindow(win);
  setAntennaMavlinkChildWindow(win);
  setCameraChildWindow(win);

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(`${url}#/antenna-controll`);
    win.webContents.openDevTools();
  } else {
    win.loadFile(indexHtml, { hash: "/antenna-controll" });
  }

  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:")) shell.openExternal(url);
    return { action: "deny" };
  });

  win.on("closed", () => {
    win = null;
  });
}

app.whenReady().then(() => {
  // Allow geolocation for GCS auto-fill
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'geolocation');
  });
  // Start with small antenna control window
  createAntennaStartupWindow();
});

app.on("window-all-closed", () => {
  win = null;
  if (process.platform !== "darwin")  {
    stopHidWorker();
    stopRotatorWorker();
    stopMavlinkWorker();
    stopSinelinkWorker();
    stopAntennaMavlinkWorker();
    stopCameraWorker();
    app.quit();
  }
});

app.on("before-quit", () => {
  stopHidWorker();
  stopRotatorWorker();
  stopSinelinkWorker();
  stopAntennaMavlinkWorker();
  stopCameraWorker();
});

app.on("second-instance", () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.on("activate", () => {
  const allWindows = BrowserWindow.getAllWindows();
  if (allWindows.length) {
    allWindows[0].focus();
  } else {
    createAntennaStartupWindow();
  }
});

hidWorker({ ipcMain });
rotatorWorker({ ipcMain });
mavlinkWorker({ ipcMain });
sinelinkWorker({ ipcMain });
antennaMavlinkWorker({ ipcMain });
cameraWorker({ ipcMain });

ipcMain.handle("open-win", (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${url}#${arg}`);
  } else {
    childWindow.loadFile(indexHtml, { hash: arg });
  }
});

// Floating antenna control window
let antennaFloatingWin: BrowserWindow | null = null;

ipcMain.handle("open-antenna-floating", (_, options?: { width?: number; height?: number }) => {
  // If already open, focus it
  if (antennaFloatingWin && !antennaFloatingWin.isDestroyed()) {
    antennaFloatingWin.focus();
    return;
  }

  antennaFloatingWin = new BrowserWindow({
    width: options?.width || 380,
    height: options?.height || 620,
    minWidth: 300,
    minHeight: 400,
    maxWidth: 600,
    alwaysOnTop: true,
    resizable: true,
    minimizable: true,
    maximizable: false,
    skipTaskbar: false,
    title: "Antenna Control",
    icon: join(process.env.VITE_PUBLIC, "favicon.ico"),
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Share rotator + mavlink + sinelink IPC with floating window
  setRotatorChildWindow(antennaFloatingWin);
  setMavlinkChildWindow(antennaFloatingWin);
  setSinelinkChildWindow(antennaFloatingWin);
  setAntennaMavlinkChildWindow(antennaFloatingWin);

  if (process.env.VITE_DEV_SERVER_URL) {
    antennaFloatingWin.loadURL(`${url}#/antenna-floating`);
  } else {
    antennaFloatingWin.loadFile(indexHtml, { hash: "/antenna-floating" });
  }

  antennaFloatingWin.on("closed", () => {
    antennaFloatingWin = null;
  });
});

// Open main window from antenna startup window (settings icon)
ipcMain.handle("open-main-window", () => {
  createMainWindow();
});

// Open camera floating window
let cameraFloatingWin: BrowserWindow | null = null;
ipcMain.handle("open-camera-floating", () => {
  if (cameraFloatingWin && !cameraFloatingWin.isDestroyed()) {
    cameraFloatingWin.focus();
    return;
  }

  cameraFloatingWin = new BrowserWindow({
    width: 640,
    height: 520,
    minWidth: 400,
    minHeight: 350,
    resizable: true,
    minimizable: true,
    title: "Camera Control",
    icon: join(process.env.VITE_PUBLIC, "favicon.ico"),
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  setCameraChildWindow(cameraFloatingWin);

  if (process.env.VITE_DEV_SERVER_URL) {
    cameraFloatingWin.loadURL(`${url}#/camera-floating`);
  } else {
    cameraFloatingWin.loadFile(indexHtml, { hash: "/camera-floating" });
  }

  cameraFloatingWin.on("closed", () => {
    cameraFloatingWin = null;
  });
});

ipcMain.handle("set-window-opacity", (event, opacity: number) => {
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  if (senderWindow) {
    senderWindow.setOpacity(Math.max(0.2, Math.min(1, opacity)));
  }
});

ipcMain.handle("close-current-window", (event) => {
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  if (senderWindow && senderWindow !== win) {
    senderWindow.close();
  }
});

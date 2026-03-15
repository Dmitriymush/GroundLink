import { app, BrowserWindow, shell, ipcMain } from "electron";
import { release } from "node:os";
import { join } from "node:path";
import { devices } from "node-hid";
import { hidWorker, setChildWindow, stopHidWorker } from "./hid_worker";
import { rotatorWorker, setRotatorChildWindow, stopRotatorWorker } from "./rotator_worker";

devices();

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

let win = null;
const preload = join(__dirname, "../preload/index.js");
const url = process.env.VITE_DEV_SERVER_URL;
const indexHtml = join(process.env.DIST, "index.html");

async function createWindow() {
  win = new BrowserWindow({
    title: "Main window",
    icon: join(process.env.VITE_PUBLIC, "favicon.ico"),
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  setChildWindow(win);
  setRotatorChildWindow(win);

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(url);
    win.webContents.openDevTools();
  } else {
    win.loadFile(indexHtml);
  }

  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:")) shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  win = null;
  if (process.platform !== "darwin")  {
    stopHidWorker();
    stopRotatorWorker();
    app.quit();
  }
});

app.on("before-quit", () => {
  stopHidWorker();
  stopRotatorWorker();
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
    createWindow();
  }
});

hidWorker({ ipcMain });
rotatorWorker({ ipcMain });

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

  // Share rotator IPC with floating window
  setRotatorChildWindow(antennaFloatingWin);

  if (process.env.VITE_DEV_SERVER_URL) {
    antennaFloatingWin.loadURL(`${url}#/antenna-floating`);
  } else {
    antennaFloatingWin.loadFile(indexHtml, { hash: "/antenna-floating" });
  }

  antennaFloatingWin.on("closed", () => {
    antennaFloatingWin = null;
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

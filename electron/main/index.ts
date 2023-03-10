import { app, BrowserWindow, shell, ipcMain, screen, globalShortcut } from 'electron'
import { release } from 'node:os'
import { join } from 'node:path'
import { eventInit } from './events'

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.js    > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.DIST_ELECTRON = join(__dirname, '../')
process.env.DIST = join(process.env.DIST_ELECTRON, '../dist')
process.env.PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? join(process.env.DIST_ELECTRON, '../public')
  : process.env.DIST

// Disable GPU Acceleration for Windows 7
if (release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

// Remove electron security warnings
// This warning only shows in development mode
// Read more on https://www.electronjs.org/docs/latest/tutorial/security
// process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

let win: BrowserWindow | null = null
// Here, you can also use other preload
const preload = join(__dirname, '../preload/index.js')
const url = process.env.VITE_DEV_SERVER_URL
const indexHtml = join(process.env.DIST, 'index.html')
let inited = false;

function registryShotCut() {
  win.on('blur', () => {
    globalShortcut.unregisterAll()
  })
  win.on('focus', () => {
    shotCutRegist();
  })
  if (inited) return;
  inited = true;
  shotCutRegist();
}

function shotCutRegist() {
  if (globalShortcut.isRegistered('CommandOrControl+Left')) return;
  globalShortcut.register('CommandOrControl+Left', () => {
    win.webContents.goBack()
  })
  globalShortcut.register('CommandOrControl+Right', () => {
    win.webContents.goForward()
  })
}

async function createWindow(targetUrl?: string) {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize
  win = new BrowserWindow({
    width,
    height,
    title: 'YouTuBe With Mdict',
    icon: join(process.env.PUBLIC, 'favicon.ico'),
    webPreferences: {
      preload,
      // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
      // Consider using contextBridge.exposeInMainWorld
      // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) { // electron-vite-vue#298
    win.loadURL(targetUrl || url)
    // win.loadURL('https://www.youtube.com/watch?v=3yH5TuLYRcs')
    // win.loadURL('https://www.youtube.com')
    // Open devTool if the app is not packaged
    win.webContents.openDevTools()
  } else if (targetUrl) {
    win.loadURL(targetUrl)
  } else {
    win.loadFile(indexHtml)
  }

  // const view = new BrowserView()
  // win.setBrowserView(view)
  // view.setAutoResize({ width: true})
  // view.setBounds({ x: 0, y: 20, width: 1000, height: 900 })
  // view.webContents.loadURL('https://youtube.com')

  // Test actively push message to the Electron-Renderer
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
    // loadDict(win);
  })

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })
  registryShotCut();
  eventInit()
}

app.whenReady().then(() => createWindow())

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})

let dictFiles = []
ipcMain.on("loadYouTuBe", (_, data) => {
  if (data) {
    // let fileList = JSON.stringify(data)
    // dicts.setPaths(data)
    // contextBridge.exposeInMainWorld("dictFiles", data)
    dictFiles = data;
    win.close();
    createWindow("https://youtube.com")
  }
})

ipcMain.handle("get-dict-files", () => {
  return dictFiles;
})

// New window example arg: new windows url
ipcMain.handle('open-win', (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${url}#${arg}`)
  } else {
    childWindow.loadFile(indexHtml, { hash: arg })
  }
})
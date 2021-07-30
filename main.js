const
    fs = require('fs'),
    path = require('path'),
    net = require('net'),
    print = require('printer');

const { app, Menu, MenuItem, Tray, BrowserWindow, ipcMain } = require("electron");


//const servers = [];
const settings = {
    printers: []
};
const printers = {};


function readConfig() {
    // look for existing config
    if(fs.existsSync(path.join(__dirname, 'settings.json'))) {
        Object.assign(settings, JSON.parse(fs.readFileSync(path.join(__dirname, 'settings.json'))));
    }
}

function writeConfig() {
    fs.writeFileSync(path.join(__dirname, 'settings.json'), JSON.stringify(settings));
}


app.whenReady().then(() => {
    createTray();

    readConfig();

    // if not, pop settings window
    if(settings.printers.length == 0) showSettings();

    // start printer daemons
    for(var i = 0; i < settings.printers.length; i++)
        activatePrinter(settings.printers[i]);
});


ipcMain.on('getPrinterList', (event) => {
    var printerList = print.getPrinters();
    event.reply('setPrinterList', printerList);
});

ipcMain.on('getConfigList', (event) => {
    event.reply('setConfigList', settings.printers);
});

ipcMain.on('addPrinter', (event, printer) => {
    printer.active = true;
    settings.printers.push(printer);
    activatePrinter(printer);

    writeConfig();
});

ipcMain.on('removePrinter', (event, id) => {
    stopPrinter(id);

    if(printers[id])
        printers[id].menu.visible = false;

    var i = settings.printers.findIndex(v => v.id == id);
    if(i < 0) return;
    settings.printers.splice(i,1);

    writeConfig();
});

function startPrinter(id) {
    if(!printers[id]) return;
    if(printers[id].server != null) return;

    var i = settings.printers.findIndex(v => v.id == id);
    if(i < 0) return;
    settings.printers[i].active = true;

    printers[id].server = serverStart(id, settings.printers[i].port);
    printers[id].menu.checked = (printers[id].server != null);
}

function stopPrinter(id) {
    if(!printers[id]) return;
    if(printers[id].server == null)
        return printers[id].menu.checked = false;

    printers[id].server.close();
    printers[id].server = null;
    printers[id].menu.checked = false;

    var i = settings.printers.findIndex(v => v.id == id);
    if(i < 0) return;
    settings.printers[i].active = false;
}

function activatePrinter(printer) {
    const item = new MenuItem({
        id: printer.id,
        label: printer.name,
        type: 'checkbox'
    });
    contextMenu.insert(0, item);

    item.checked = false;

    // place in registration
    printers[printer.id] = {
        name: printer.name,
        def: printer,
        server: null,
        menu: item
    };

    if(printer.active)
        startPrinter(printer.id);

    
    item.click = function() {
        if(item.checked) stopPrinter(printer.id);
        else startPrinter(printer.id);
    };
}


let setupWin = null;
function showSettings() {
    if(setupWin != null) return setupWin.show();

    setupWin = new BrowserWindow({
        title: 'NetPrinter',
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration:true,
            contextIsolation: false
        },
        show: false,
        resizable: false,
        minimizable: false,
        maximizable: false,
        useContentSize: true,
        modal: true,
        width:720, height:320
    });
    //setupWin.openDevTools();
    setupWin.setMenuBarVisibility(false);
    setupWin.loadURL(`file://${__dirname}/res/settings.html`);
    setupWin.once('ready-to-show', () => {
        setupWin.show();
    });
    setupWin.on('close', e => {
        if(!app.isQuitting) {
            e.preventDefault();
            setupWin.hide();
            writeConfig();
        }
        return false;
    });
    setupWin.on('minimize', e => {
        e.preventDefault();
        setupWin.hide();
        writeConfig();
    });
}

let tray = null, contextMenu = null;
function createTray() {
    tray = new Tray(path.join(__dirname, '/res/img/network_printer.ico'));
    contextMenu = Menu.buildFromTemplate([
        //{ id:'serving', label: 'Not Serving', type: 'normal', enabled: false },
        { id: 'sep', label: '-', type: 'separator' },
        { label: 'Settings...', type: 'normal', click: showSettings },
        { label: 'Exit', type: 'normal', click: appExit }
    ]);
    tray.setToolTip('NetPrinter');
    tray.setContextMenu(contextMenu);
}

function appExit() {
    app.isQuitting = true;
    app.quit();
}



function serverStart(id, port) {
    const server = new net.Server();
    console.log(`Starting server for ${id} on port ${port}...`);

    server.on("connection", client => {
        let buffer = "";
        client.on("data", data => buffer += data);
        client.on("close", () => submitJob(id, buffer));
    });
    server.on("error", () => printError(id) );
    try {
        server.listen(port);
        console.log(server.address());
    } catch(e) {
        // could not open port...
        server = null;
        console.log('Unable to open port');
    }
    return server;
}




async function submitJob(id, buffer) {
    print.printDirect({
        data: buffer,
        printer: printers[id].name,
        type: "RAW",
        success: () => {},
        error: err => printError(id)
    });
}


function printError(id) {
    console.log('Printer error');
    stopPrinter(id);

    tray.displayBalloon({
        title: 'Printer Disconnect',
        content: `Printer ${printers[id].name} has been disconnected due to an error.`
    });
}

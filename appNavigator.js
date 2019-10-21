//*** Imports ***
const { app, BrowserWindow } = require('electron');
const ipfsLoaderHelper = require('./src/helpers/ipfsLoaderHelper.js');
const ipc = require('electron').ipcMain;
const GlobalRoomListener = require('./src/helpers/globalRoomListener.js');
const userInfoLoader = require('./src/data/userInfoLoader');
const dialogErrorHelper = require('./src/helpers/dialogErrorHelper');
const logger = require('./src/data/logger');
const appConfig = require('./appFilesConfig');
const localServer = require('./src/localServer/localServer');
const StreamersDataHandler = require('./src/Managers/StreamersDataHandler');

//Tests
const testRunner = require('./test/moduleDynamicTests/TestRunner');

//pages scripts
const StreamPage = require('./src/pages/streamPage.js');
const UserInfoPage = require('./src/pages/userInfoPage.js');
const GlobalRoomPage = require('./src/pages/globalRoomPage.js');
const StreamWatchPage = require('./src/pages/streamWatchPage.js');
const StreamerInfoPage = require('./src/pages/streamInfoPage.js');
const LoadingPage = require('./src/pages/loadingPage');
const WatchSavedStreamPage = require('./src/pages/watchSavedStreamPage');
//*** End Imports ***

//*** Page links ***
const FRONT_LAYOUT_FILE_NAME = 'index.html';
const FRONTEND_FOLDER_NAME = 'front';
function getPageLinkByName(pageFolderName) {
    return `${FRONTEND_FOLDER_NAME}/${pageFolderName}/${FRONT_LAYOUT_FILE_NAME}`;
}

const USER_INFO_PAGE_LINK = getPageLinkByName('userInfoPage');
const GLOBAL_ROOM_PAGE_LINK = getPageLinkByName('globalRoomPage');
const STREAM_PAGE_LINK = getPageLinkByName('streamerPage');
const STREAMWATCH_PAGE_LINK = getPageLinkByName('streamWatchPage');
const STREAMERINFO_PAGE_LINK = getPageLinkByName('streamInfoPage');
const LOADING_PAGE_LINK = getPageLinkByName('loadingPage');
const WATCH_SAVED_STREAM_PAGE_LINK = getPageLinkByName('watchSavedStreamPage');
//*** End page links

//*** Named constants ***
const PAGES = {
    USER_INFO_PAGE: 'userInfoPage',
    STREAMING_PAGE: 'streamingPage',
    GLOBAL_ROOM_PAGE: 'globalRoomPage',
    STREAM_WATCH_PAGE: 'streamWatchPage',
    STREAMER_INFO_PAGE: 'streamerInfoPage',
    LOADING_PAGE: 'loadingPage',
    WATCH_SAVED_STREAM_PAGE: 'watchSavedStreamPage'
};

//По умолчанию должна стоять страница создания юзера, если юзер еще не создан, если создан- то главный рум.
const DEFAULT_PAGE =  userInfoLoader.isUserDataReady() ? PAGES.GLOBAL_ROOM_PAGE : PAGES.USER_INFO_PAGE;
//*** End Named constants ***

let IpfsInstance;
let IpfsNodeID;
let currentWindow;
let globalRoomListener;
let streamersDataHandler;
function InitializeApp(debug = false) {

    //Loading page first
    loadPageByName(PAGES.LOADING_PAGE).then(() => {
    //firstable initialize IPFS instance
        ipfsLoaderHelper.initializeIPFS_Async()
            .then(data => {
                const nodeID = data.id;
                const ipfsInstance = data.ipfsInstance;
                console.log("Try to initialize IPFS instance...");
                IpfsInstance = ipfsInstance;
                IpfsNodeID = nodeID;
                globalRoomListener = new GlobalRoomListener(IpfsInstance);
                streamersDataHandler = new StreamersDataHandler(IpfsInstance, globalRoomListener);
            })
            .catch((error) => {
                if(error) {
                    console.error("Unable initialize IPFS! \n");
                    logger.printErr(error);
                    throw error;
                }
            })
            .then(async () => {
                try {
                    await appConfig.initializeBasicFolders();
                } catch(err) {
                    throw err;
                }
            })
            .then(() => {
                console.log("Try to initialize localServer");
                localServer.startLocalServer();
            })
            .catch((err) => {
                throw err;
            })
            .then(() => {
                console.log("Try to initialize Electron...");
                onAppInitialized();

                if(debug === true) {
                    testRunner.startTests();
                }

            }).catch(err => {
            throw err;
        });
    });
}

//Calls when the app and dependencies already initialized
function onAppInitialized() {
    loadDefaultPage();   
}

function loadDefaultPage() {
    loadPageByName(DEFAULT_PAGE);
}
let _currentPage;
async function loadPageByName(pageName, args)  {

    //disable currentPage, if its open
    if(_currentPage) {
        console.log("Stop last page: " + _currentPage.constructor.name);
        await Promise.resolve(_currentPage.stop());
    }
    resetAppData(); //this function reset all data listeners from another objects, so memory leak is decreasing...

    console.log("Start loading page: " + pageName + "....");
    try{
        switch(pageName) {       
            case PAGES.USER_INFO_PAGE: {
                createWindowAsync(USER_INFO_PAGE_LINK).then((win) => {
                    _currentPage = new UserInfoPage(ipc, win);
                });
                break;
            }
            case PAGES.STREAMING_PAGE: {
                const streamArgs = args;
                const streamerInfo = args.streamerInfo;
                const streamInitializer = args.streamInitializer;
                if(!streamerInfo) {
                    throw new Error(`Unable to start stream page, streamer info is NULL!!!`);
                }
                if(!streamInitializer) {
                    throw new Error(`Unable to start stream page, streamInitializer is NULL!!!`);
                }
                createWindowAsync(STREAM_PAGE_LINK).then((win) => {
                    _currentPage = new StreamPage(IpfsInstance, streamInitializer, win, ipc, streamerInfo);
                });
                break;
            }
            case PAGES.GLOBAL_ROOM_PAGE: {
                createWindowAsync(GLOBAL_ROOM_PAGE_LINK).then((win) => {
                    _currentPage = new GlobalRoomPage(IpfsInstance, ipc, win, streamersDataHandler);
                });
                break;
            }
            case PAGES.STREAM_WATCH_PAGE: {
                createWindowAsync(STREAMWATCH_PAGE_LINK).then((win => {
                    const streamerInfo = args;
                    _currentPage = new StreamWatchPage(IpfsInstance, ipc, win, streamerInfo);
                }));
                break;
            }
            case PAGES.STREAMER_INFO_PAGE: {
                createWindowAsync(STREAMERINFO_PAGE_LINK).then((win) => {
                    _currentPage = new StreamerInfoPage(IpfsInstance, IpfsNodeID, ipc, win);
                });
                break;
            }
            case PAGES.LOADING_PAGE: {
                createWindowAsync(LOADING_PAGE_LINK).then((win) => {
                    _currentPage = new LoadingPage(win);
                });
                break;
            }
            case PAGES.WATCH_SAVED_STREAM_PAGE: {
                createWindowAsync(WATCH_SAVED_STREAM_PAGE_LINK).then((win) => {
                   _currentPage = new WatchSavedStreamPage();
                });
            }
            default: {
                throw new Error(`FATAL_ERROR! \n Page ${pageName} in not EXISTS!`);
            }
        }
    } catch(err) {
        logger.printErr(err);
        dialogErrorHelper.showErorDialog('AppNavigator', `${err.message} ${err.stack}`, true);
    }
}

function getCurrentPage() {
    return _currentPage;
}

function createWindowAsync(linkToPage) {
    return new Promise((resolve, rejected) => {
        // Создаём окно браузера.
        if(!currentWindow) {
            currentWindow = new BrowserWindow({
                width: 1280,
                height: 768,
                frame: false,
                webPreferences: {
                    nodeIntegration: true
                }
            });           
        }
               
        // and load the index.html of the app.
        currentWindow.loadFile(linkToPage).then(() => {
            console.log("INITIALIZE WINDOW BY PAGE: " + linkToPage);
            resolve(currentWindow);
        }).catch((err) => {
            rejected(err);
        });
        
        // Отображаем средства разработчика.
        currentWindow.webContents.openDevTools()
        
        // Будет вызвано, когда окно будет закрыто.
        currentWindow.on('closed', () => {
            // Разбирает объект окна, обычно вы можете хранить окна     
            // в массиве, если ваше приложение поддерживает несколько окон в это время,
            // тогда вы должны удалить соответствующий элемент.
            currentWindow = null
        })        
    });
}
  
app.on('ready', () => {
    try {
        InitializeApp(false);
    } catch(err) {
        logger.printErr(err);
        dialogErrorHelper.showErorDialog("AppNavigator", `Cannot run application, coz: \n ${err.message} \n ${err.stack}`, true);
    }
});
  
// Выходим, когда все окна будут закрыты.
app.on('window-all-closed', () => {
    // Для приложений и строки меню в macOS является обычным делом оставаться
    // активными до тех пор, пока пользователь не выйдет окончательно используя Cmd + Q
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
  
app.on('activate', () => {
     // На MacOS обычно пересоздают окно в приложении,
     // после того, как на иконку в доке нажали и других открытых окон нету.
    //if (currentWindow === null) {
        //createWindowAsync()
    //}
  });

function resetAppData() {
    console.log("APP_NAVIGATOR: Reseting all app data.");
    clearAllIPCListeners();
    clearIPFSListeners();
    updateNavIpcFunctions(); 
}

//nav functions
function updateNavIpcFunctions() {
    ipc.on('goto-page', (event, args) => {
        const pageName = args.pageName;
        const pageArgs = args.pageArgs;
        loadPageByName(pageName, pageArgs);
    });
}

function clearIPFSListeners() {
    if(IpfsInstance) {
        IpfsInstance.removeAllListeners();
    }
}

function clearAllIPCListeners() {
    ipc.removeAllListeners();
}

//Handle uncaught exceptions
process
    .on('unhandledRejection', (reason, p) => {
        console.error(reason, 'Unhandled Rejection at Promise', p);
        logger.loggerInstance.error(reason.toString(), p.toString());
    })
    .on('uncaughtException', err => {
        console.error(err, 'Uncaught Exception thrown');
        logger.printErr(err);
        process.exit(1);
    });
process.setMaxListeners(0);


module.exports.loadPageByName = loadPageByName;
module.exports.loadDefaultPage = loadDefaultPage;
module.exports.getCurrentPage = getCurrentPage;
module.exports.PAGES = PAGES;
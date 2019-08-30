
let camera = '/dev/video0';
let fileName = 'master';


const IPFS = require('ipfs')
const { app, BrowserWindow } = require('electron');
const ipc = require('electron').ipcMain;

const StreamInitializer = require('./stream/streamInitializer.js');

const ipfs = new IPFS({
	repo: 'ipfs/pubsub-demo/borgStream',
	EXPERIMENTAL: {
	  pubsub: true
	},
	config: {
	  Addresses: {
		Swarm: [
		  "/ip4/0.0.0.0/tcp/5001",
		]
	  }
	},
})

ipfs.on('ready', () => {

  
	ipfs.id((err, id) => {	
		if (err) {
			return console.log(err)
		}
	})

})
	

ipfs.on('error', (err) => {
	return console.log(err)
})


ipfs.once('ready', () => ipfs.id((err, peerInfo) => {
	if (err) { throw err }

	console.log('IPFS node started and has ID ' + peerInfo.id)

}))



const streamInitializer = new StreamInitializer(ipfs);

//LoadCameras and update web-view list
streamInitializer.initializeCameras().then((data) => {
  win.webContents.send('camera-list-update', data);
});


ipc.on('update-stream-state', function (event, arg) {
  if( arg == 'start' ){
  	streamInitializer.startStream();
  	win.webContents.send('streamState', 'started')
  }

  if( arg == 'stop' ){
  	streamInitializer.stopStream();
  	win.webContents.send('streamState', 'stoped')
  }
})

ipc.on('camera-changed', (event, args) => {
  const camText = args;
  streamInitializer.setCameraByName(camText);
});

let win

function createWindow () {
  // Создаём окно браузера.
  win = new BrowserWindow({
    width: 800,
    height: 600,
    frame: false,
    webPreferences: {
      nodeIntegration: true
    }
  })

  // and load the index.html of the app.
  win.loadFile('front/index.html')

  // Отображаем средства разработчика.
  win.webContents.openDevTools()

  // Будет вызвано, когда окно будет закрыто.
  win.on('closed', () => {
    // Разбирает объект окна, обычно вы можете хранить окна     
    // в массиве, если ваше приложение поддерживает несколько окон в это время,
    // тогда вы должны удалить соответствующий элемент.
    win = null
  })
}


app.on('ready', createWindow)

// Выходим, когда все окна будут закрыты.
app.on('window-all-closed', () => {
  // Для приложений и строки меню в macOS является обычным делом оставаться
  // активными до тех пор, пока пользователь не выйдет окончательно используя Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
   // На MacOS обычно пересоздают окно в приложении,
   // после того, как на иконку в доке нажали и других открытых окон нету.
  if (win === null) {
    createWindow()
  }
})
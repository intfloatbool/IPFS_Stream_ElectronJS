const Room = require('ipfs-pubsub-room');
const dataConverter = require('../helpers/dataConverters.js');
const pathModule = require('path');
const ChatRoom = require('../data/ChatRoom');
const ChatRoomInitializer = require('../helpers/ChatRoomInitializer');
const fs = require('fs');
const localServer = require('../localServer/localServer.js');
const PageBase = require('./pageBase');
const appConfig = require('../../appFilesConfig');
const STREAMERS_DATA_PATH = pathModule.join(appConfig.folders.USER_DATA_PATH ,'streamers');
const fsExtra = require('fs-extra');
const hlsPlaylistManager = require('../data/hlsPlaylistManager');
const logger = require('../data/logger');

class StreamWatchPage extends PageBase{
    constructor(ipfs, ipc, win, streamerInfo){  
        super();
        this.setEnabled(true);
        this.lastBlockRawMessage = null;
        this.rawBlocksQueue = new Set();
        this.ipfs = ipfs;
        this.ipc = ipc;
        this.win = win;
        this.streamerInfo = streamerInfo;
        this.lastBlockIndex = 0;
        this.isStreamInitialized = false;
        const streamWatchPageObj = this;

        //*** update raw blocks queue by last block!
        this.lastStreamBlockFromInfo = this.streamerInfo.lastStreamBlockEncoded;
        this.rawBlocksQueue.add(this.lastStreamBlockFromInfo);

        this.chatRoomInitializer = new ChatRoomInitializer(this.ipfs, this.ipc, this.win, this.streamerInfo);
        this.chatRoomInitializer.initialize();

        this.initializeStreamerPath(this.streamerInfo).then((path) => {
            console.log("Stream path initialized!: " + path.toString());
            //DO something when path exists
            streamWatchPageObj.win.webContents.send('streamerDataGetted', streamWatchPageObj.streamerInfo);
            streamWatchPageObj.createTranslationFolder(path);
            streamWatchPageObj.m3uPath = pathModule.join(streamWatchPageObj.streamerVideoFolder, 'master.m3u8');
            streamWatchPageObj.subscribeToStreamerRoom(streamWatchPageObj.streamerInfo);
            streamWatchPageObj.win.webContents.send('countOfWatchers-updated', streamerInfo.streamWatchCount);
            this.handleChunksQueueLoop().then(() => {
                console.log(`Chunks Handling ENDED!`);
            });
        }).catch((err) => {
            const errMsg = "Cannot initialize streamer path: \n" + err.toString();
            console.error(errMsg);
            logger.printErr(new Error(errMsg))
        });

        this.ipc.on('exit-watch', (event, args) => {
            //Some actions on exit watch page...
        });
        this.ipc.on('gotoGlobalPage', async (event, args) => {
            this.onExit();
            super.goToGlobalPage();
        });
    }

    subscribeToStreamerRoom(streamerInfo) {
        const streamWatchPageObj = this;
        const streamHash = streamerInfo.hashOfStreamer;
        console.log("Subscribe to streamer room name: " + streamHash);
        this.streamerRoom = Room(this.ipfs, streamHash);
        //setup streamer room
        this.streamerRoom.setMaxListeners(0);
        this.streamerRoom.removeAllListeners();

        console.log("**** Try to subscribe room with hash: " + streamHash);
        this.streamerRoom.on('subscribed', () => {
            console.log(`Subscribed to ${streamHash} room!`);
        });

        this.streamerRoom.on('message', async (msg) => {
            if(!super.isEnabled()) {
                streamWatchPageObj.streamerRoom.removeAllListeners();
                return;
            }

            const messageStr = msg.data.toString();

            //end stream if message about end
            if(messageStr === 'STREAM_END') {
                this.win.webContents.send('onStreamEnded');
                await this.endPlayListAsync();
                return;
            }
            this.rawBlocksQueue.add(messageStr);
            console.log("Getted message from streamer: " + messageStr);
        });
    }

    onExit() {
        if(this.streamerRoom) {
            this.streamerRoom.leave().then(() => {
                console.log("LEave from room!");
            })
        }
    }

    async endPlayListAsync() {
        await hlsPlaylistManager.appendEndToPlaylistAsync(this.m3uPath);
    }

    async initializeStreamerPath(streamerInfo) {
        const streamerHash = streamerInfo.hashOfStreamer;
        this.streamerHash = streamerHash;
        const streamPath = pathModule.join(STREAMERS_DATA_PATH, streamerHash);
        const path = await new Promise((resolve, rejected) => {
            try{
                if(fs.existsSync(streamPath)) {
                    resolve(streamPath);
                } else {
                    const errMsg = `Path ${path} not exists!`;
                    console.error(errMsg);
                    logger.printErr(new Error(errMsg));
                    resolve(streamPath);
                }
            } catch(err) {
                const errMsg = `Some error in initialize streamer path: ` + err.toString();
                console.error(errMsg);
                logger.printErr(new Error(errMsg));
                resolve(streamPath);
            }           
        });

        console.log(`Stream ${streamerInfo.nameOfStream} path created: \n ${streamPath}`);

        return path;
    }

    createTranslationFolder(streamerPath) {
        this.streamerVideoFolder = pathModule.join(streamerPath, 'streamChunks');
        try{
            if(!fs.existsSync(this.streamerVideoFolder)) {
                fs.mkdirSync(this.streamerVideoFolder);
            } else {
               fsExtra.emptyDir(this.streamerVideoFolder);
            }
        } catch(err) {
            console.error("Cannot create translation folder ! Coz: \n" + err.toString());
            throw err;
        }       
    }

    async loadChunkAsync(streamBlock) {
        const chunkHash = streamBlock.VIDEO_CHUNK_HASH;
        const extInf = streamBlock.EXTINF;
        const chunkData = {
            fileName: 'UNKNOWN_FILE',
            extInf: "UNKNOWN_EXT"
        };
        await new Promise((resolve, rejected) => {
            this.ipfs.get(chunkHash, (err, files) => {
                if(err) {
                    rejected(err);
                }
                const chunkName = 'master' + this.lastBlockIndex + '.ts';
                const chunkPath = pathModule.join(this.streamerVideoFolder, chunkName);
                const file = files[0];
                const buffer = file.content;
                fs.writeFile(chunkPath,buffer, (err) => {
                    if(err) {
                        rejected(err);
                    }
                    chunkData.fileName = chunkName;
                    chunkData.extInf = extInf;
                    resolve();
                });
            });
        });
        return chunkData;
    }

    initializeStartingStreamIfNotYet() {
        if(this.isStreamInitialized === false) {
            this.onStreamInitialized();
            this.isStreamInitialized = true;
        }
    }

    onStreamInitialized() {
        const url = 'http://localhost:4000/user/userData/streamers/' + this.streamerHash + '/streamChunks/master.m3u8';
        this.win.webContents.send('stream-loaded', url);
    }

    async handleChunksQueueLoop(countOfChunksToReady = 1) {
        const delayOfHandle = 1000;
        while (super.isEnabled()) {
            if(this.rawBlocksQueue.size <= 0) {
                this.log(`blocks queue is empty.. wait.`);
                await this.delayAsync(delayOfHandle);
                continue;
            }
            try {
                this.log(`Trying load chunk id${this.lastBlockIndex}`);
                for(let rawBlockMessage of this.rawBlocksQueue) {
                    if(rawBlockMessage === this.lastBlockRawMessage) {
                        this.log(`Founded recursive chunk! Delay and return!`);
                        await this.delayAsync(delayOfHandle);
                        continue;
                    }
                    const streamBlock = dataConverter.convertBase64DataToObject(rawBlockMessage);
                    const chunkData = await this.loadChunkAsync(streamBlock);
                    this.win.webContents.send('countOfWatchers-updated', streamBlock.streamWatchCount);

                    await hlsPlaylistManager.updateM3UFileAsync(chunkData, this.m3uPath);
                    if(this.lastBlockIndex >= countOfChunksToReady) { //Update front page after 2 chunks is ready
                        this.initializeStartingStreamIfNotYet();
                    }
                    this.lastBlockRawMessage = rawBlockMessage;
                    this.rawBlocksQueue.delete(rawBlockMessage);
                    this.log(`Chunk id${this.lastBlockIndex} succefully downloaded!`);
                    this.lastBlockIndex++;
                    
                }
            } catch(err) {
                const errMsg = `ERROR HANDLING CHUNKS! ${err.message}`;
                console.error(errMsg);
                logger.printErr(new Error(errMsg));
                await this.delayAsync(delayOfHandle);
            }
        }
    }

    log(message) {
        console.log(`StreamWatchPage: \n ${message}`);
    }

    delayAsync(delay) {
        return new Promise(resolve => setTimeout(resolve, delay));
    }
}

module.exports = StreamWatchPage;
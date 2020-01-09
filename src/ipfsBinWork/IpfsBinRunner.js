const appConfig = require('../../appFilesConfig');
const {spawn, exec} = require('child_process');

class IpfsBinRunner {
    constructor() {

        this.peerList = new Set();

        const initCmd = ['init'];
        this.ipfsProcess = spawn(appConfig.files.IPFS_BIN, initCmd);
        this.ipfsProcess.stdout.on('data', (msg) => {
            console.log(`IPFS BIN INITALIZATION: \n ${msg.toString()}`);
        });
        this.ipfsProcess.stderr.on('error', (err) => {
            console.error(`IPFS BIN initialziation ERROR! \n ${err.toString()}`);
        });
        this.ipfsProcess.once('close', (code, signal) => {
            this.ipfsProcess.kill();
            const opt = [
                'daemon'
            ];
            this.ipfsProcess = spawn(appConfig.files.IPFS_BIN, opt);
            this.ipfsProcess.stdout.on(`data`, (msg) => {
                const msgStr = msg.toString();
                console.log(`IPFS BIN: ${msgStr}`);
    
                if(msg.includes('WebUI')) {
                    this.parseApiServer(msgStr);
                }
            });
            this.ipfsProcess.stderr.on('error', (err) => {
                console.error(`IPFS BIN ERROR! \n ${err.toString()}`);
            })
        });      

        setTimeout(() => {
            this.bootstrapRemoveProcess = spawn(appConfig.files.IPFS_BIN, ['bootstrap' ,'rm' ,'--all']);
            this.bootstrapRemoveProcess.stderr.on('error', (err) => {
                console.error(`IPFS BIN BOOTSTRAP ERROR! \n Cannot remove bootstraps coz: \n ${err.toString()}`);
            });
            this.bootstrapRemoveProcess.stdout.on('data', (msg) => {
                console.log(`IPFS BIN BOOTSTRAP: \n DATA: ${msg.toString()}`);
            });
            this.bootstrapRemoveProcess.once('close', (code, signal) => {
                console.log(`CODE: \n${code}`);
                console.log(`IPFS BIN BOOTSTRAP: \n Bootstrap process closed!`);
            });
        }, 6000);      
    }

    addPeer(peerId) {
        if(this.peerList.has(peerId)) {
            return;
        }

        this.peerList.add(peerId);
    }

    parseApiServer(apiServerLine) {
        ///ip4/127.0.0.1/tcp/5001
        //http://127.0.0.1:5001/webui
        const splitted = apiServerLine.split('\n');
        const webUiStr = splitted.find(line => line.includes('WebUI'));
        const urlBySplitted = webUiStr.split(' ');
        this.url = urlBySplitted[1].replace('webui','');
        console.log(`IPFS BINARY API: \n ${this.url}`);
    }

    getUrl() {
        return this.url;
    }

    getProcess() {
        return this.ipfsProcess;
    }
}

module.exports = IpfsBinRunner;
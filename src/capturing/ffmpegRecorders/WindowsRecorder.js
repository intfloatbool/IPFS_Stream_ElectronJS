const RecorderBase = require('./recorderBase');
const RecordCommands = require('../commands').RecordCommands;

class WindowsRecorder extends RecorderBase {
    constructor(ffmpegPath, outputPath) {
        super(ffmpegPath, outputPath, RecordCommands.WINDOWS);
    }

    setCamera(camName) {   
        this.camera = camName;
        console.log(`Camera changed to: ${this.cameraCommand}!`);
    }

    setAudio(audioName) {
        //TODO Implement audio logic for FFMPEG
        this.audio = audioName;
        console.log("Audio changed to: " + this.audio);
    } 

    changeCameraBeforeRun() {
        //find camera key and change it
        const index = this.commandsToRun.indexOf(KEYS.CAM_KEY);
        if(~index) { //if z >= 0
            this.commandsToRun[index] = 'video=' + '"' + this.camera + '"' + ':' + 'audio='+'"'+this.audio+'"';
        }
    }
}

module.exports = WindowsRecorder;
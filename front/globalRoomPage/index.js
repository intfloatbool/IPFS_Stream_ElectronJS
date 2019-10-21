const electron = require('electron');
const ipc = electron.ipcRenderer;
const streamersLoop = $.templates("#streamersLoop");
const savedStreamsLoop = $.templates(`#savedStreamsLoop`);
const requestUrl = 'http://localhost:4000/user';
$( document ).ready(function() {
    console.log( "ready!" );

    $.get( requestUrl )
        .done(function( data ) {
            if(data.status == 'SUCCESS'){
                $('#userProfileNick').text(data.body.nickname);
                $('#userProfileName').text(data.body.name);
                $('#userProfileAvatar').attr('src', data.body.photoBase64)
            }
        })
        .fail(function () {
            alert("ERROR");
        });


    $('#CreateStreamButton').click(function(){
        const args = {
            pageName: 'streamerInfoPage',
            pageArgs: 'none'
        };
        ipc.send('goto-page', args);
    });


    $('body').on('click', '[data-watch]', (e) => {
        e.preventDefault();
        let watchId = $(event.target).attr('data-watch');

        for( i in window.listOfStreamers){
            let streamer = window.listOfStreamers[i];

            if( streamer.hashOfStreamer == watchId) {
                const streamWatchPage = 'streamWatchPage';
                ipc.send('goto-page', {pageName: streamWatchPage, pageArgs: streamer});  
                break;              
            };
        }
    });

    ipc.on('listOfStreamersUpdated', (event, args) => {
        window.listOfStreamers = args;
        $('#listOfStreamers').html(streamersLoop.render({streamerInfo:args}))
    });

    ipc.on(`savedStreamsUpdated`, (event, args) =>{
        window.savedStreams = args;
        console.log(args)
        $('#listOfSavedStreams').html(savedStreamsLoop.render({streamerInfo:args}))
    });
});


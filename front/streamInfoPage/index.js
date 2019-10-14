const electron = require('electron');
const ipc = electron.ipcRenderer;
const requestUrl = 'http://localhost:4000/streamInfo';


$( document ).ready(function() {
    const imageOpts = {
        width: 350,
        height: 250,
        aspectRatio: 16 / 9
    };
    let currentImageCropper = null;
	$('#backBtn').click(function(){
		ipc.send('backBtnClicked');
	});

    $('#upload').click(() => {
        $('#chooiseUserAvaBtn').click()
    })

    $('#chooiseUserAvaBtn').change((event) => {
        const file = event.target.files[0];
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            $('#upload').attr('src', reader.result)
            $('[name="avaBase64"]').val( reader.result ); //remove unecessary data for user
            currentImageCropper = initializeImageCropper('upload', imageOpts);
        };
        reader.onerror = (err) => {
            //TODO handle error
        }
	})
	
	ipc.on('camera-list-update', (event, args) => {
	    console.log(`CAMERAS GETTED: \n ${args}`);
		initializeSelectionData('#cameraSelection', args);
	});

	ipc.on('audio-list-update', (event, args) => {
		initializeSelectionData('#audioSelection', args);
	});


    $('form').submit((event) => {
        event.preventDefault();
        if(currentImageCropper) {
            const croppedData = currentImageCropper.getCroppedCanvas({maxWidth: imageOpts.width, maxHeight: imageOpts.height}).toDataURL('image/jpeg');
            $('[name="avaBase64"]').val(croppedData);
        }

        let form = $(event.target);
        let formData = getFormData(form);

        sendFormData(requestUrl, formData, (result) => {
            if(result.status === 'SUCCESS'){
                ipc.send('goToStream');
            }else{
                let textErr = '';
                for( i in result.body ){
                    textErr += result.body[i].name+", ";
                }
                toastr["error"](textErr, "Не заполнены поля")
            }
                
        });
    })


})

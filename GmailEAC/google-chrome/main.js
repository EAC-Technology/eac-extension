function inject_script(name, remove) {
    if (remove == null) remove = true;

    var injection = document.createElement('script');
    injection.src = chrome.extension.getURL(name);

    if( remove ) {
        injection.onload = function() {
            this.parentNode.removeChild(this);
        }
    }

    (document.head || document.documentElement).appendChild(injection);
}


inject_script('injection.js')






// var sendMessage = chrome.runtime && chrome.runtime.sendMessage ? chrome.runtime.sendMessage : chrome.extension.sendRequest;


// window.addEventListener("message", function(event) {
//     if (event.source != window) return;

//     if (event.data.type == "GET_IMAGE_SIZE") {
//         sendMessage({type: 'GET_IMAGE_SIZE', url : event.data.url}, function(response) {
//             console.log(response );
//         });
//     }

// }, false);



// document.addEventListener('get_image_size', function(event) {
//     console.log(event);
//     sendMessage({type: 'GET_IMAGE_SIZE', url : event.detail.url}, function(response) {
//         event.detail.callback(response);
//     });

// }, false);



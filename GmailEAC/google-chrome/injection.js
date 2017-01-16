// wait Gmail object will be available

var intervalId = setInterval(function() {

    if (!window.Gmail) return;

    clearInterval(intervalId);

    Gmail.init();

    __.info('injection - ok');

}, 100);


// Extension.debug = true;

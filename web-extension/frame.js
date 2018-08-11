
(function() {
	var url = atob(window.location.hash.slice(1));

	iframe = document.querySelector('iframe');

	iframe.src = url;
})();


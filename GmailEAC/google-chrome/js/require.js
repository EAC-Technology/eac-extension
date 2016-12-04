var require = (function() {
	var extensionURL = '';

	function absUrl(path) {
		return `${extensionURL}${path}`;
	}

	function require(path) {
		var url = absUrl(path);
		console.log(url);
	}

	require.init = function() {
		extensionURL = window
			&& window.chrome
			&& window.chrome.runtime
			&& window.chrome.runtime.getURL
			&& window.chrome.runtime.getURL('');

		extensionURL = extensionURL || '';
	}

	require.init()

	return require;
})();


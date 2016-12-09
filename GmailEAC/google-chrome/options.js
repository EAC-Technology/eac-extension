var version = document.getElementById('version');
if (version) version.innerText = chrome.app.getDetails().version_name;



Extension.getOptions().then(function(options) {
	Object.keys(options).forEach(function(key) {
		var checkbox = $(`input[type=checkbox][option-id=${key}`);
		if (!checkbox) return;

		checkbox.checked = options[key];
	})
})



$$('input[type=checkbox][class=option]').forEach(function(el) {
	var key = el.attributes['option-id'].value;

	var update = {};
	update[key] = undefined;

	el.addEventListener('click', function() {
		update[key] = el.checked;
		Extension.setOptions(update);
	});

});


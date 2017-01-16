var version = document.getElementById('version');
if (version) version.innerText = chrome.app.getDetails().version_name;

var version = document.getElementById('name');
if (version) version.innerText = chrome.app.getDetails().name;




function toggleCheckboxes() {
	var disableStatus = $('[option-id="enable_eac_processing"]').checked == false;

	$$('input[type=checkbox][class=option]').forEach(function(cb) {
		if (cb.attributes['option-id'].value == 'enable_eac_processing') return;
		cb.disabled = disableStatus;
	})
}



Extension
	.getOptions()

	.then(function(options) {
		Object.keys(options).forEach(function(key) {
			var checkbox = $(`input[type=checkbox][option-id=${key}`);
			if (!checkbox) return;

			checkbox.checked = options[key];
		})
	})

	.then(toggleCheckboxes);



$$('input[type=checkbox][class=option]').forEach(function(el) {
	var key = el.attributes['option-id'].value;

	var update = {};
	update[key] = undefined;

	el.addEventListener('click', function() {
		update[key] = el.checked;
		Extension.setOptions(update);
	});
});




var enabler = $('[option-id="enable_eac_processing"]');
if (enabler)	enabler.onchange = toggleCheckboxes;


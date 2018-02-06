var sendMessage = function(message) {
	return new Promise(function(resolve) {
		chrome.runtime.sendMessage(message, resolve);
	});
}


sendMessage({action : 'getStats'})
	.then(function(stats) {
		var html = '';

		stats.forEach(function(account) {
			html += `
				<tr>
					<td>
						<a href="${account.url}" target="_blank">
							<img src="${account.avatar}"></img>
						</a>
					<td>

					<td class=text>
						<a href="${account.url}" target="_blank">${account.email}</a>
					</td>

					<td class=text>
						<a href="${account.url}" target="_blank">
							${account.unreadCount}
						</a>
					</td>
				</tr>`;
		})
		
		document.querySelector('#stats').innerHTML = html;
	})

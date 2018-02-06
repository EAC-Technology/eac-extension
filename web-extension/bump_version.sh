#!/bin/bash


function get_version() {
	cat manifest.json | grep \"version\" | awk -F\" '{print $4}';
}

function update_version() {
	cur_version=$(get_version);
	python update_manifest.py -f manifest.json --version "$1";
	echo
	echo "$cur_version  -->  $(get_version)";
	echo
}


new_version="$1";
cur_version=$(get_version);


if [ -z "$new_version" ]; then
	echo "current version: $cur_version";
	exit 0;
fi


if [ "$new_version" \> "$cur_version" ]; then
	update_version "$new_version";
	exit 0;

else
	echo
	echo "Attention: \"$new_version\" <= \"$cur_version\"";
	read -p "Update manifest for version \"$new_version\"?  [Y/n] " a;

	if [ -z "$a" -o "$a" = "y" -o "$a" = "Y" ]; then
		update_version "$new_version";
		exit 0;
	fi

	echo "Aborting.";
	echo
	exit 1;
fi


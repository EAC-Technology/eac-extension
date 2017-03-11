#!/bin/bash


function get_version() {
	cat manifest.json | grep \"version\" | awk -F\" '{print $4}';
}


new_version="$1";
cur_version=$(get_version);


if [ -z "$new_version" ]; then
	echo "current version: $cur_version";
	exit 0;
fi


if [ "$new_version" \> "$cur_version" ]; then
	python update_manifest.py -f manifest.json --version "$new_version";
	echo
	echo "old version: $cur_version";
	echo "new version: $(get_version)";
	echo
	exit 0;

else
	echo
	echo "Error: \"$new_version\" <= \"$cur_version\"";
	echo "Aborting.";
	echo
	exit 1;
fi


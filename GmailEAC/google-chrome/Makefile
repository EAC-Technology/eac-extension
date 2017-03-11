compile:
	-zip -r -9 build/eac-plugin-local.zip \
		manifest.json \
		icons/ \
		js/ \
		*.js \
		*.html;


release: compile
	-cat manifest.json | python update_manifest.py --name "EAC Plugin" > build/manifest.json &&\
		cd build &&\
		cp eac-plugin-local.zip eac-plugin-release.zip &&\
		zip -u -9 eac-plugin-release.zip manifest.json &&\
		rm manifest.json;


dev: compile
	-cat manifest.json | python update_manifest.py --name "EAC Plugin Dev" > build/manifest.json &&\
		cd build &&\
		cp eac-plugin-local.zip eac-plugin-dev.zip &&\
		zip -u -9 eac-plugin-dev.zip manifest.json &&\
		rm manifest.json;


install: release dev
	-thunar build/;
	-google-chrome "https://chrome.google.com/webstore/developer/dashboard?authuser=appinmail.dev";

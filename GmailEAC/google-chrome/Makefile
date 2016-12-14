all:
	-zip -r -9 build/eac-plugin.zip \
		manifest.json \
		icons/ \
		js/ \
		*.js \
		*.html


dev: all
	cat manifest.json | python update_manifest.py > build/manifest.json &&\
		cd build &&\
		mv eac-plugin.zip eac-plugin-dev.zip &&\
		zip -u -9 eac-plugin-dev.zip manifest.json &&\
		rm manifest.json;


install:
	-thunar build/

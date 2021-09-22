#!/bin/bash

#xgettext -j --from-code=UTF-8 --output=po/template.pot *.js
#mkdir -p locale/cs/LC_MESSAGES
#msgfmt po/cs.po -o locale/cs/LC_MESSAGES/hue-lights.mo

glib-compile-schemas schemas/
zip -r hue-lights@chlumskyvaclav.gmail.com.zip . --exclude=po/\* --exclude=.git/\* --exclude=*.sh --exclude=*.zip


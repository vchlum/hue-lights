#!/bin/bash

declare -a languages=("cs" "de")

if  [[ "$1" == "-t" ]] ; then
   xgettext -j --from-code=UTF-8 --output=po/template.pot *.js
   sed -i '/^#.*/d' po/*

   for i in "${languages[@]}"; do
      msgmerge -U po/$i.po po/template.pot
   done
fi

for i in "${languages[@]}"; do
   mkdir -p locale/$i/LC_MESSAGES
   msgfmt po/$i.po -o locale/$i/LC_MESSAGES/hue-lights.mo
done

glib-compile-schemas schemas/
zip -r hue-lights@chlumskyvaclav.gmail.com.zip . --exclude=po/\* --exclude=.git/\* --exclude=\*.sh --exclude=schemas/\*.xml --exclude=screenshot.png --exclude=*.zip

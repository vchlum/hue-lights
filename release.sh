#!/bin/bash

glib-compile-schemas schemas/
zip -r hue-lights@chlumskyvaclav.gmail.com.zip . --exclude=po/\* --exclude=.git/\* --exclude=*.sh --exclude=*.zip


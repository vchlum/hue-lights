#!/bin/bash

glib-compile-schemas schemas/
zip -r hue-lights@chlumskyvaclav.gmail.com . --exclude=po/\* --exclude=.git/\* --exclude=*.sh --exclude=*.zip


SHELL = bash
UUID = hue-lights@chlumskyvaclav.gmail.com

BUILD_DIR ?= build
PNG_FILES = $(wildcard ./docs/*.png)
RAW_PATH = "$(BUILD_DIR)/$(UUID).shell-extension.zip"
BUNDLE_PATH = "$(BUILD_DIR)/$(UUID).zip"

.PHONY: build package check release install uninstall clean

build: clean
	@mkdir -p $(BUILD_DIR)
	$(MAKE) package
	@mv -v $(RAW_PATH) $(BUNDLE_PATH)
gresource:
	@cd "extension/resources"; \
	glib-compile-resources --target=../preferences.gresource preferences.gresource.xml
package: gresource
	@mkdir -p $(BUILD_DIR)
	@echo "Packing files..."
	@cd "extension"; \
	gnome-extensions pack --force \
	--extra-source=../LICENSE \
	--extra-source=../CHANGELOG.md \
	--extra-source=../README.md \
	--extra-source=crypto \
	--extra-source=media \
	--extra-source=areaselector.js \
	--extra-source=avahi.js \
	--extra-source=colorpicker.js \
	--extra-source=dtlsclient.js \
	--extra-source=extensionmenu.js \
	--extra-source=modalselector.js \
	--extra-source=phue.js \
	--extra-source=phueapi.js \
	--extra-source=phueentertainmentapi.js \
	--extra-source=phuepanelmenu.js \
	--extra-source=phuescreenshot.js \
	--extra-source=phuesyncbox.js \
	--extra-source=phuesyncboxapi.js \
	--extra-source=prefspage.js \
	--extra-source=queue.js \
	--extra-source=syncboxmenu.js \
	--extra-source=utils.js \
	--extra-source=preferences.gresource \
	-o ../$(BUILD_DIR)/
check:
	@if [[ ! -f $(BUNDLE_PATH) ]]; then \
	  echo -e "\nWARNING! Extension zip couldn't be found"; exit 1; \
	elif [[ "$$(stat -c %s $(BUNDLE_PATH))" -gt 4096000 ]]; then \
	  echo -e "\nWARNING! The extension is too big to be uploaded to the extensions website, keep it smaller than 4096 KB"; exit 1; \
	fi
install:
	@if [[ ! -f $(BUNDLE_PATH) ]]; then \
	  $(MAKE) build; \
	fi
	gnome-extensions install $(BUNDLE_PATH) --force
uninstall:
	gnome-extensions uninstall "$(UUID)"
clean:
	@rm -rfv $(BUILD_DIR)
	@rm -rfv "$(UUID).zip"
	@rm -rfv extension/ui/*.ui~ extension/ui/*.ui#

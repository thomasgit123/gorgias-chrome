// Register Chrome runtime protocols and context menus
if (chrome.runtime) {

    // Called when the url of a tab changes.
    var updatedTab = function (tabId, changeInfo, tab) {
        if (ENV && ENV === 'development') {
            // Display in gmail and localhost
            if (/^https?:\/\/mail.google.com/.test(tab.url) || /^https?:\/\/localhost\/gmail/.test(tab.url)) {
                chrome.pageAction.show(tabId);
            }
        } else {
            // Display only in gmail
            if (/^https?:\/\/mail.google.com/.test(tab.url)) {
                chrome.pageAction.show(tabId);
            }
        }

    };

    // Listen for any changes to the URL of any tab.
    chrome.tabs.onUpdated.addListener(updatedTab);

    // Called after installation: https://developer.chrome.com/extensions/runtime.html#event-onInstalled
    chrome.runtime.onInstalled.addListener(function (details) {
        _gaq.push(['_trackEvent', "general", 'installed-quicktext']);

        // perform the necessary migrations
        if (!document.querySelector('body[class=ng-scope]')) {
            angular.bootstrap('body', ['gqApp']);
        }

        var injector = angular.element('body').injector();
        injector.get('QuicktextService').migrate_043_100();

        // All gmail tabs shoul be reloaded if the extension was installed
        chrome.tabs.query({'url': '*://mail.google.com/*'}, function (tabs) {
            for (var i in tabs) {
                chrome.tabs.reload(tabs[i].id, {});
            }
        });

        // Context menus
        chrome.contextMenus.create({
            "title": 'Save \'%s\' as Quicktext',
            "contexts": ['editable', 'selection']
        });

        // rather than using the contextMenu onclick function, we attach
        // an event to the onClicked event.
        // this fixes issues with the onclick function not being triggered
        // or the new tab not being opened.
        chrome.contextMenus.onClicked.addListener(function (info, tab) {

            var quicktextBody = encodeURIComponent(info.selectionText);
            window.open(chrome.extension.getURL('/pages/bg.html') + '#/list?id=new&body=' + quicktextBody, 'quicktextOptions');

        });

        chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
            if (!document.querySelector('body[class=ng-scope]')) {
                angular.bootstrap('body', ['gqApp']);
            }
            var injector = angular.element('body').injector();
            if (request.request === 'get') {
                injector.get('QuicktextService').quicktexts().then(function (res) {
                    sendResponse(res);
                    _gaq.push(['_trackEvent', "content", 'insert']);
                });
            }
            var settingsService = injector.get('SettingsService');
            if (request.request === 'stats') {
                if (request.key === 'words') {
                    var words = parseInt(request.val, 10);
                    settingsService.set("words", settingsService.get("words") + words);
                }
                sendResponse(true);
            }
            if (request.request === 'getAutocompleteEnabled') {
                sendResponse(settingsService.get("autocompleteEnabled"));
            }
            if (request.request === 'getAutocompleteDelay') {
                sendResponse(settingsService.get("autocompleteDelay"));
            }

            return true;
        });
        if (!chrome.runtime.onConnect.hasListeners()) {
            chrome.runtime.onConnect.addListener(function (port) {
                if (!port.onMessage.hasListeners()) {
                    port.onMessage.addListener(function (msg) {
                        if (!document.querySelector('body[class=ng-scope]')) {
                            angular.bootstrap('body', ['gqApp']);
                        }
                        var injector = angular.element('body').injector();
                        if (port.name === 'quicktexts') {
                            if (msg.field === 'shortcut'){
                                injector.get('QuicktextService').filtered("shortcut = '" + msg.text + "'" /* TODO: <- fix this sql */).then(function (res) {
                                    port.postMessage({'quicktexts': res, 'action': 'insert'});
                                    _gaq.push(['_trackEvent', "content", 'insert']);
                                });
                            } else {
                                injector.get('QuicktextService').filtered("shortcut = '" + msg.text + "' OR title LIKE '%"+ msg.text +"%' OR body LIKE '% " + msg.text + " %'" /* TODO: <- fix this sql */).then(function (res) {
                                    /*
                                    if (a.shortcut === word.text) {
                                        return true;
                                    }

                                    // check out the exact match of tags
                                    var tags = a.tags.split(",");
                                    for (var i in tags) {
                                        var tag = tags[i].replace(" ", "");
                                        if (tag && word.text === tag) {
                                            return true;
                                        }
                                    }

                                    if (word.text.length >= 3) { // begin searching in the title/tags after 3 chars
                                        // Search for match
                                        App.autocomplete.quicktexts = _.union(App.autocomplete.quicktexts, elements.filter(function (a) {
                                            return a.title.toLowerCase().indexOf(word.text.toLowerCase()) !== -1;
                                        }));
                                    }

                                    if (word.text.length >= 5) { // begin searching in body after 5 chars
                                        // Search for match
                                        App.autocomplete.quicktexts = _.union(App.autocomplete.quicktexts, elements.filter(function (a) {
                                            return a.body.toLowerCase().indexOf(word.text.toLowerCase()) !== -1;
                                        }));
                                    }
                                    */

                                    port.postMessage({'quicktexts': res, 'action': 'list'});
                                    _gaq.push(['_trackEvent', "content", 'insert']);
                                });
                            }
                        }
                    });
                }
            });
        }
    });
}

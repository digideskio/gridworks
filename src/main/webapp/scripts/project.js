var theProject;
var ui = {};

var Gridworks = {
};

Gridworks.reportException = function(e) {
    if (window.console) {
        console.log(e);
    }
};

function resize() {
    var header = $("#header");
    var footer = $("#footer");
    
    ui.menuBarContainer.css("top", header.outerHeight() + "px");

    var leftPanelWidth = 300;
    var leftPanelMargin = 7;
    var width = $(window).width();
    var top = ui.menuBarContainer.offset().top + ui.menuBarContainer.outerHeight();
    var height = footer.offset().top - top;
    
    ui.viewPanel
        .css("top", top + "px")
        .css("left", leftPanelWidth + "px")
        .css("height", height + "px")
        .css("width", (width - leftPanelWidth) + "px");
    
    ui.leftPanel
        .css("top", (top + leftPanelMargin) + "px")
        .css("left", leftPanelMargin + "px")
        .css("height", (height - 2 * leftPanelMargin) + "px")
        .css("width", (leftPanelWidth - 2 * leftPanelMargin) + "px");
        
    var leftPanelTabsPaddings = ui.leftPanelTabs.outerHeight(true) - ui.leftPanelTabs.innerHeight();
    ui.leftPanelTabs
        .height(ui.leftPanel.height() - leftPanelTabsPaddings);
        
    var processPanelWidth = 400;
    ui.processPanel
        .css("width", processPanelWidth + "px")
        .css("left", Math.floor((width - processPanelWidth) / 2) + "px");
}

function resizeTabs() {
    var totalHeight = ui.leftPanelTabs.height();
    var headerHeight = ui.leftPanelTabs.find(".ui-tabs-nav").innerHeight();
    var tabPanels = ui.leftPanelTabs.find(".ui-tabs-panel")
    var paddings = tabPanels.innerHeight(true) - tabPanels.height();
    tabPanels.height(totalHeight - headerHeight - paddings);
}

function resizeAll() {
    resize();
    resizeTabs();
    
    ui.menuBar.resize();
    ui.browsingEngine.resize();
    ui.processWidget.resize();
    ui.historyWidget.resize();
    ui.dataTableView.resize();
}

function initializeUI(uiState) {
    document.title = theProject.metadata.name + " - Gridworks";
    
    var path = $("#path");
    
    $('<span class="app-path-section">' +
        '<a href="#">' + theProject.metadata.name + '</a> project' +
        '</span>').appendTo(path);
    
    $('<a href="javascript:{}">current view</a>')
        .mouseenter(function() {
            this.href = Gridworks.getPermanentLink();
        })
        .appendTo($('<span class="app-path-section"></span>').appendTo(path));
    
    var body = $("#body").empty().html(
        '<div bind="viewPanel" class="view-panel"></div>' +
        '<div bind="processPanel" class="process-panel"></div>' +
        '<div bind="leftPanel" class="left-panel">' +
            '<div bind="leftPanelTabs">' +
                '<ul>' +
                    '<li><a href="#gridworks-tabs-facets">Facet/Filter</a></li>' +
                    '<li><a href="#gridworks-tabs-history" bind="historyTabHeader">Undo/Redo</a></li>' +
                '</ul>' +
                '<div id="gridworks-tabs-facets" bind="facetPanel" class="facet-panel"></div>' +
                '<div id="gridworks-tabs-history" bind="historyPanel" class="history-panel"></div>' +
            '</div>' +
        '</div>' +
        '<div class="menu-bar-container" bind="menuBarContainer"><div bind="menuBarPanel" class="menu-bar"></div></div>'
    );
    ui = DOM.bind(body);
    
    ui.menuBarContainer.css("top", $("#header").outerHeight() + "px");
    ui.menuBar = new MenuBar(ui.menuBarPanel); // construct the menu first so we can resize everything else
    
    ui.leftPanelTabs.tabs({ selected: 0 });
    resize();
    resizeTabs();
    
    ui.browsingEngine = new BrowsingEngine(ui.facetPanel, uiState.facets || []);
    ui.processWidget = new ProcessWidget(ui.processPanel);
    ui.historyWidget = new HistoryWidget(ui.historyPanel, ui.historyTabHeader);
    ui.dataTableView = new DataTableView(ui.viewPanel);
    
    ui.leftPanelTabs.bind('tabsshow', function(event, tabs) {
        if (tabs.index === 0) {
            ui.browsingEngine.resize();
        } else if (tabs.index === 1) {
            ui.historyWidget.resize();
        }
    });
    
    $(window).bind("resize", resizeAll);
}

Gridworks.reinitializeProjectData = function(f) {
    Ajax.chainGetJSON(
        "/command/get-project-metadata?" + $.param({ project: theProject.id }), null,
        function(data) {
            theProject.metadata = data;
        },
        "/command/get-models?" + $.param({ project: theProject.id }), null,
        function(data) {
            theProject.columnModel = data.columnModel;
            theProject.protograph = data.protograph;
            
            for (var i = 0; i < theProject.columnModel.columns.length; i++) {
                theProject.columnModel.columns[i].collapsed = false;
            }
        },
        f
    );
};

/*
 *  Utility state functions
 */
 
Gridworks.createUpdateFunction = function(options, onFinallyDone) {
    var functions = [];
    var pushFunction = function(f) {
        var index = functions.length;
        functions.push(function() {
            f(functions[index + 1]);
        });
    };
    
    pushFunction(function(onDone) {
        ui.historyWidget.update(onDone);
    });
    if (options.everythingChanged || options.modelsChanged || options.columnStatsChanged) {
        pushFunction(Gridworks.reinitializeProjectData);
    }
    if (options.everythingChanged || options.modelsChanged || options.rowsChanged || options.rowMetadataChanged || options.cellsChanged || options.engineChanged) {
        pushFunction(function(onDone) {
            ui.dataTableView.update(onDone);
        });
        pushFunction(function(onDone) {
            ui.browsingEngine.update(onDone);
        });
    }
    
    functions.push(onFinallyDone || function() {});
    
    return functions[0];
};

Gridworks.update = function(options, onFinallyDone) {
    var done = false;
    var dismissBusy = null;
    
    Gridworks.setAjaxInProgress();
    
    Gridworks.createUpdateFunction(options, function() {
        Gridworks.clearAjaxInProgress();
        
        done = true;
        if (dismissBusy) {
            dismissBusy();
        }
        if (onFinallyDone) {
            onFinallyDone();
        }
    })();
    
    window.setTimeout(function() {
        if (!done) {
            dismissBusy = DialogSystem.showBusy();
        }
    }, 500);
};

Gridworks.postProcess = function(command, params, body, updateOptions, callbacks) {
    updateOptions = updateOptions || {};
    callbacks = callbacks || {};
    
    params = params || {};
    params.project = theProject.id;
    
    body = body || {};
    if (!("includeEngine" in updateOptions) || updateOptions.includeEngine) {
        body.engine = JSON.stringify(ui.browsingEngine.getJSON());
    }
    
    var done = false;
    var dismissBusy = null;
    
    function onDone(o) {
        done = true;
        if (dismissBusy) {
            dismissBusy();
        }
        
        Gridworks.clearAjaxInProgress();
        
        if (o.code == "error") {
            if ("onError" in callbacks) {
                try {
                    callbacks.onError(o);
                } catch (e) {
                    Gridworks.reportException(e);
                }
            }
        } else {
            if ("onDone" in callbacks) {
                try {
                    callbacks.onDone(o);
                } catch (e) {
                    Gridworks.reportException(e);
                }
            }
            
            if (o.code == "ok") {
                Gridworks.update(updateOptions, callbacks.onFinallyDone);
                
                if ("historyEntry" in o) {
                    ui.processWidget.showUndo(o.historyEntry);
                }
            } else if (o.code == "pending") {
                if ("onPending" in callbacks) {
                    try {
                        callbacks.onPending(o);
                    } catch (e) {
                        Gridworks.reportException(e);
                    }
                }
                ui.processWidget.update(updateOptions, callbacks.onFinallyDone);
            }
        }
    }
    
    Gridworks.setAjaxInProgress();
    
    $.post(
        "/command/" + command + "?" + $.param(params),
        body,
        onDone,
        "json"
    );
    
    window.setTimeout(function() {
        if (!done) {
            dismissBusy = DialogSystem.showBusy();
        }
    }, 500);
};

Gridworks.setAjaxInProgress = function() {
    $(document.body).attr("ajax_in_progress", "true");
};

Gridworks.clearAjaxInProgress = function() {
    $(document.body).attr("ajax_in_progress", "false");
};

/*
 *  Utility model functions
 */
 
Gridworks.cellIndexToColumn = function(cellIndex) {
    var columns = theProject.columnModel.columns;
    for (var i = 0; i < columns.length; i++) {
        var column = columns[i];
        if (column.cellIndex == cellIndex) {
            return column;
        }
    }
    return null;
};

Gridworks.fetchRows = function(start, limit, onDone) {
    $.post(
        "/command/get-rows?" + $.param({ project: theProject.id, start: start, limit: limit }),
        { engine: JSON.stringify(ui.browsingEngine.getJSON()) },
        function(data) {
            theProject.rowModel = data;
            if (onDone) {
                onDone();
            }
        },
        "json"
    );
};

Gridworks.getPermanentLink = function() {
    var params = [
        "project=" + escape(theProject.id),
        "ui=" + escape(JSON.stringify({
            facets: ui.browsingEngine.getFacetUIStates()
        }))
    ];
    return "project.html?" + params.join("&");
};

/*
 * Loader
 */

function onLoad() {
    var params = URL.getParameters();
    if ("project" in params) {
        theProject = {
            id: parseInt(params.project,10)
        };
        
        var uiState = {};
        if ("ui" in params) {
            try {
                uiState = JSON.parse(params.ui);
            } catch (e) {
            }
        }
        
        Gridworks.reinitializeProjectData(function() {
            initializeUI(uiState);
        });
    }
}

$(onLoad);

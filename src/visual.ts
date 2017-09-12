/*
 *  Smart Filter by OKViz
 *
 *  Copyright (c) SQLBI. OKViz is a trademark of SQLBI Corp.
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

import ISQExpr = powerbi.data.ISQExpr;
import ISemanticFilter = powerbi.data.ISemanticFilter;

module powerbi.extensibility.visual {
 
    interface VisualMeta {
        name: string;
        version: string;
        dev: boolean;
    }

    interface VisualViewModel {
        dataGroups: VisualDataGroup[];
        settings: VisualSettings;
        filters: any;
    }

    interface VisualDataGroup {
        displayName: string;
        dataPoints: VisualDataPoint[];
    }

    interface VisualDataPoint {
        displayName?: any;
        format?: string;
        selected?: boolean;
        identities?: visuals.ISelectionId[];
        hiddenIdentities?: visuals.ISelectionId[];
    }

    interface VisualSettings {
        general: {
            selection?: string;
            filter?: ISemanticFilter;
        };
        search: {
            limit?: number;
            compressMultiple: boolean;
            backFill: Fill;
            fill?: Fill;
            fontSize: number;
            border: boolean;
            label:boolean;
            filterMultiple: boolean;
            observerMode: boolean;
        };

        colorBlind?: {
            vision?: string;
        }
    }

    function defaultSettings(): VisualSettings {

        return {
            general: {},
            search: {
                compressMultiple: false,
                backFill: {solid: { color: "#F2C811" } },
                fontSize: 10,
                border: true,
                label: false,
                filterMultiple: true,
                observerMode: false
            },

            colorBlind: {
                vision: "Normal"
            }
        };
    }

    function initEmptyFilters(filters: any, dataView: DataView, host: IVisualHost) {
        let dataCategorical = dataView.categorical;
        for (let g = 0; g < dataCategorical.categories.length; g++) {
            
            let dataPoints: VisualDataPoint[] = [];

            let category = dataCategorical.categories[g]; 
            let values = category.values;

            let categoryName = category.source.displayName;

            if (filters.constructor == Array) {

                //Keep compatible with old filters format
                let oldFilters = filters.slice(0);
                filters = {};
                filters[categoryName] = [];
                for (let i = 0; i < oldFilters.length; i++) {
                    for (let ii = 0; ii < values.length; ii++) {
                        if (String(values[ii]) == JSON.parse(oldFilters[i])) {
                            let oldToIdentity = host.createSelectionIdBuilder().withCategory(category, ii).createSelectionId();
                            filters[categoryName].push(oldToIdentity.getKey());
                            break;
                        }
                    }
                }

            } else {
                if (!(categoryName in filters))
                    filters[categoryName] = [];
            }
        }

        return filters;
    }

    function visualTransform(options: VisualUpdateOptions, host: IVisualHost): VisualViewModel {

        //Get DataViews
        let dataViews = options.dataViews;
        let hasDataViews = (dataViews && dataViews[0]);
        let hasCategoricalData = (hasDataViews && dataViews[0].categorical && dataViews[0].categorical.categories);
        let hasSettings = (hasDataViews && dataViews[0].metadata && dataViews[0].metadata.objects);

        //Get Settings
        let settings: VisualSettings = defaultSettings();
        if (hasSettings) {
            let objects = dataViews[0].metadata.objects;
            settings = {
                general: {
                    selection: getValue<string>(objects, "general", "selection", settings.general.selection),
                    filter: getValue<ISemanticFilter>(objects, "general", "filter", settings.general.filter)
                },
                search: {
                    limit: getValue<number>(objects, "search", "limit", settings.search.limit),
                    compressMultiple: getValue<boolean>(objects, "search", "compressMultiple", settings.search.compressMultiple),
                    fontSize: getValue<number>(objects, "search", "fontSize", settings.search.fontSize),
                    backFill: getValue<Fill>(objects, "search", "backFill", settings.search.backFill),
                    fill: getValue<Fill>(objects, "search", "fill", settings.search.fill),
                    border: getValue<boolean>(objects, "search", "border", settings.search.border),
                    label: getValue<boolean>(objects, "search", "label", settings.search.label),
                    filterMultiple: getValue<boolean>(objects, "search", "filterMultiple", settings.search.filterMultiple),
                    observerMode: getValue<boolean>(objects, "search", "observerMode", settings.search.observerMode)
                },

                colorBlind: {
                     vision: getValue<string>(objects, "colorBlind", "vision", settings.colorBlind.vision),
                }
            }

            //Limit some properties
            if (settings.search.limit < 1) settings.search.limit = 1;
        }

    
        //Get DataPoints
        let dataGroups:VisualDataGroup[] = [];
        let filters = (settings.general.selection ? JSON.parse(settings.general.selection) : {});

        initEmptyFilters(filters, dataViews[0], host);

        if (hasCategoricalData) {

            let dataCategorical = dataViews[0].categorical;
            for (let g = 0; g < dataCategorical.categories.length; g++) {
                
                let dataPoints: VisualDataPoint[] = [];

                let category = dataCategorical.categories[g]; 
                let values = category.values;

                let categoryName = category.source.displayName;

                for (let i = 0; i < values.length; i++) {
                    let displayName = String(values[i]);
                    let identity: visuals.ISelectionId = host.createSelectionIdBuilder().withCategory(category, i).createSelectionId();

                    //Check if there is a filter in other fields that limit these values
                    let addIdentity = true;

                    if (settings.search.filterMultiple) {
                        for (let otherCategoryName in filters) {
                            if (addIdentity && otherCategoryName != categoryName && filters.hasOwnProperty(otherCategoryName) && filters[otherCategoryName].length > 0) {

                                addIdentity = false;
                                for (let ii = 0; ii < filters[otherCategoryName].length; ii++) {
                                    if (identity.getKey() == filters[otherCategoryName][ii]) {
                                        addIdentity = true;
                                        break;
                                    }
                                }
                            }
                        }
                    }

                    //Check if there are multiple values with the same name
                    let unique = true;
                    for (let d = 0; d < dataPoints.length; d++) {
                        if (dataPoints[d].displayName == displayName){
                            unique = false;
                            if (addIdentity)
                                dataPoints[d].identities.push(identity);
                            else
                                dataPoints[d].hiddenIdentities.push(identity);
                            break;
                        }
                    }

                    if (unique) {
                        //Check if value is in the filter
                        let selected = false;
                        for (let ii = 0; ii < filters[categoryName].length; ii++) {
                            if (filters[categoryName][ii] == identity.getKey()) {
                                selected = true;
                                break;
                            }
                        }
                        
                        dataPoints.push({
                            displayName: displayName,
                            format: category.source.format,
                            selected: selected,
                            identities: (addIdentity ? [identity] : []),
                            hiddenIdentities: (addIdentity ? [] : [identity])
                        });
                    }
                    

                }

                dataGroups.push({
                    displayName: categoryName,
                    dataPoints: dataPoints
                });
            }
        }

        return {
            dataGroups: dataGroups,
            filters: filters,
            settings: settings,
        };
    }

    export class Visual implements IVisual {
        private meta: VisualMeta;
        private host: IVisualHost;
        private selectionManager: ISelectionManager;
        private selectionIdBuilder: ISelectionIdBuilder;
        private model: VisualViewModel;
        private tokenizers: Tokenizer[];
        private element: JQuery; 

        constructor(options: VisualConstructorOptions) {

            this.meta = {
                name: 'Smart Filter',
                version: '1.1.6',
                dev: false
            };
            console.log('%c' + this.meta.name + ' by OKViz ' + this.meta.version + (this.meta.dev ? ' (BETA)' : ''), 'font-weight:bold');

            this.host = options.host;
            this.selectionIdBuilder = options.host.createSelectionIdBuilder();
            this.selectionManager = options.host.createSelectionManager();

            this.model = { dataGroups: [], filters: [], settings: <VisualSettings>{} };

            this.element = $(options.element);
        }
        
        public update(options: VisualUpdateOptions) {
            let dataChanged = (options.type == VisualUpdateType.Data || options.type == VisualUpdateType.All || $('.chart').length == 0);
            if (dataChanged) {
                this.model = visualTransform(options, this.host);
                $('div, svg', this.element).remove();
            }

            let host = this.host;
            let selectionManager  = this.selectionManager;
            let dateFormat = d3.time.format('%b %e, %Y');

            let margin = {top: 0, left: 0, bottom: 5, right: 0};
            let containerSize = {
                width: options.viewport.width - margin.left - margin.right,
                height: options.viewport.height - margin.top - margin.bottom
            };

            let $container;
            if (dataChanged) {
                $container =  $('<div class="chart"></div>').appendTo(this.element);
                this.tokenizers = [];
            } else {
                $container = $('.chart');
            }

            $container.css({
                'width' :  containerSize.width + 'px',
                'height':  containerSize.height + 'px',
                'margin-top': margin.top + 'px',
                'margin-left': margin.left + 'px'
            });

            for (let g = 0; g < this.model.dataGroups.length; g++) {
                
                let $comboBox, tokenizer: Tokenizer;

                if (dataChanged) {
                    
                    $comboBox = $('<select class="tokenCombo tokenCombo' + g + '"></select>').appendTo($container);
                    tokenizer = new Tokenizer($comboBox, this.model.settings.search.label ? this.model.dataGroups[g].displayName : '', true); //this.model.dataGroups.length == 1
                    this.tokenizers.push(tokenizer);

                } else {
                    $comboBox = $('.tokenCombo' + g);
                    tokenizer = this.tokenizers[g];
                }

                if (tokenizer) {
                    if (dataChanged) {
                        tokenizer.maxElements = this.model.settings.search.limit || Infinity;
                        tokenizer.compressMultiple = (this.model.settings.search.compressMultiple && this.model.settings.search.observerMode !== true);
                        tokenizer.toggleResetter(this.model.settings.search.observerMode !== true);
                        tokenizer.elementsFontSize = PixelConverter.fromPointToPixel(this.model.settings.search.fontSize); 
                        tokenizer.elementsBackColor = this.model.settings.search.backFill.solid.color;
                        tokenizer.elementsColor = (this.model.settings.search.fill ? this.model.settings.search.fill.solid.color : OKVizUtility.autoTextColor(this.model.settings.search.backFill.solid.color));
                        
                        $('li.TokenSearch input').css({
                            'font-size': tokenizer.elementsFontSize + 'px'
                        });
                        $('li.Token').css({
                            'font-size': tokenizer.elementsFontSize + 'px',
                            'background-color': tokenizer.elementsBackColor,
                            'color': tokenizer.elementsColor
                        });

                        $('li.Token a.Close').css({
                            'background-color': tokenizer.elementsBackColor,
                            'color': tokenizer.elementsColor
                        });

            
                        $('.TokensContainer').css('border-width', (this.model.settings.search.border ?'1px' : '0'));

                        let hasSomeSelection = false;
                        let maxSelectedValues = 100;
                        let selectedValues = 0;
                        let values = [];
                        
                        for (let i = 0; i < this.model.dataGroups[g].dataPoints.length; i++) {
                            let dataPoint = this.model.dataGroups[g].dataPoints[i];
                            if (dataPoint.identities.length > 0) {
                                let value = tokenizer.sanitize(Object.prototype.toString.call(dataPoint.displayName) === '[object Date]' ? dateFormat(dataPoint.displayName) : String(dataPoint.displayName));

                                values.push(value);

                                let $option = $('<option value="' + value + '">' + value + '</option>')    
                                        .appendTo($comboBox);

                                $option.data('datapoint', i);
                                if (selectedValues < maxSelectedValues && dataPoint.selected) {
                                    $option.attr('selected', 'selected');
                                    selectedValues++;
                                }
                                if (dataPoint.selected) {

                                    hasSomeSelection = true;
                                    for (let s = 0; s < dataPoint.identities.length; s++) {
                                        if (this.canSelectIdentity(dataPoint.identities[s], true)) {
                                            selectionManager.select(dataPoint.identities[s], true);
                                            selectionManager.applySelectionFilter();
                                        }
                                    }
                                }
                            }
                        }
                        

                        if (!hasSomeSelection && this.model.settings.search.observerMode){
                            for (let i = 0; i < Math.min(values.length, maxSelectedValues); i++) {
                                $comboBox.find('option[value="' + values[i] + '"]').attr('selected', 'selected');
                                selectedValues++;
                            }
                        }
                        tokenizer.toggleReadonly(this.model.settings.search.observerMode);
                        tokenizer.remap(values);
                        tokenizer.toggleDropdownArrow(selectedValues < values.length);

                        var self = this;
                        let performSelection = function (value, add) {

                            selectionManager.clear();

                            for (let i = 0; i < self.model.dataGroups[g].dataPoints.length; i++){
                                let dataPoint = self.model.dataGroups[g].dataPoints[i];
                                if (dataPoint !== undefined) {

                                    if (value == dataPoint.displayName) {

                                        dataPoint.selected = add;

                                        let categoryName = self.model.dataGroups[g].displayName;
                                        let identities = dataPoint.identities.concat(dataPoint.hiddenIdentities);
                                        for (let s = 0; s < identities.length; s++) {

                                            let found = false;
                                            if (categoryName in self.model.filters) {
                                                for (let ii = 0; ii < self.model.filters[categoryName].length; ii++) {
                                                    
                                                    if (self.model.filters[categoryName][ii] === identities[s].getKey()) {
                                                        if (!add)
                                                            self.model.filters[categoryName].splice(ii, 1)
                                                    
                                                        found = true;
                                                        break;
                                                    }
                                                }
                                            }

                                            if (add && !found) 
                                                self.model.filters[categoryName].push(identities[s].getKey());
                                    
                                            if (self.canSelectIdentity(identities[s], add)) 
                                               selectionManager.select(identities[s], true);

                                        }
                                        
                                        selectionManager.applySelectionFilter();

                                        host.persistProperties({
                                            merge: [{
                                                objectName: 'general',
                                                selector: null,
                                                properties: {
                                                    'selection': JSON.stringify(self.model.filters)
                                                },
                                            }]
                                        });

                                        break;
                                    }
                                }

                            }      
                        }; 

                        tokenizer.onAddToken = function (value, text, e) {
                            setTimeout(function(){
                                performSelection(value, true);     
                            }, 100);
                        };

                        tokenizer.onRemoveToken = function (value, e) {
                            performSelection(value, false);
                        };

                        tokenizer.onClear = function (e) {
                            selectionManager.clear();
                            for (let i = 0; i < self.model.dataGroups[g].dataPoints.length; i++)
                                self.model.dataGroups[g].dataPoints[i].selected = false;
                            
                            initEmptyFilters(self.model.filters, options.dataViews[0], host);

                            host.persistProperties({
                                remove: [{
                                    objectName: 'general',
                                    selector: null,
                                    properties: {
                                        'filter': null,
                                        'selection': null
                                    },
                                }]
                            });

                        };
                    }

                    tokenizer.container.width(containerSize.width);
                    let offset = tokenizer.container.offset();
                    tokenizer.container.find('.TokensContainer').css('max-height', (containerSize.height - offset.top) + 'px');
                    tokenizer.container.find('ul.Dropdown').css('max-height', (containerSize.height - offset.top - tokenizer.container.find('.TokensContainer').height()) + 'px');
                }
            }

            OKVizUtility.t([this.meta.name, this.meta.version], this.element, options, this.host, {
                'cd1': this.model.settings.colorBlind.vision,
                'cd13': this.model.settings.search.observerMode,
                'cd14': this.model.settings.search.compressMultiple,
                'cd15': this.meta.dev
            });

            //Color Blind module
            OKVizUtility.applyColorBlindVision(this.model.settings.colorBlind.vision, d3.select(this.element[0]));
        }

        public canSelectIdentity(identity: visuals.ISelectionId, add) {

            //Check if the filter is present in each category
            for (let categoryName in this.model.filters) {
                if (this.model.filters.hasOwnProperty(categoryName) && this.model.filters[categoryName].length > 0) {
                    let found = false;
                    for (let i = 0; i < this.model.filters[categoryName].length; i++) {
                        if (this.model.filters[categoryName][i] == identity.getKey()) {
                            found = true;
                            break;
                        }
                    }
                    if (!found) return false;
                }
            }
            
            let selectionIds = this.selectionManager.getSelectionIds();

            for (let i = 0; i < selectionIds.length; i++) {
                if (identity.getKey() == (<visuals.ISelectionId>selectionIds[i]).getKey()){
                    return !add;
                }
            }
                              
            return add;
        }

        public destroy(): void {
           
        }

        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstanceEnumeration {
            var objectName = options.objectName;
            var objectEnumeration: VisualObjectInstance[] = [];

            switch(objectName) {
                
                 case 'search':

                    objectEnumeration.push({
                        objectName: objectName,
                        properties: {
                            "observerMode": this.model.settings.search.observerMode
                        },
                        selector: null
                    });

                    if (!this.model.settings.search.observerMode) {

                        if (this.model.dataGroups.length > 1) {
                            objectEnumeration.push({
                                objectName: objectName,
                                properties: {
                                    "filterMultiple": this.model.settings.search.filterMultiple
                                },
                                selector: null
                            });
                        }

                        objectEnumeration.push({
                            objectName: objectName,
                            properties: {
                                "compressMultiple": this.model.settings.search.compressMultiple,
                                "limit": this.model.settings.search.limit
                            },
                            selector: null
                        });
                    }

                     objectEnumeration.push({
                        objectName: objectName,
                        properties: {
                            "backFill": this.model.settings.search.backFill,
                            "fill": this.model.settings.search.fill,
                            "fontSize": this.model.settings.search.fontSize,
                            "label": this.model.settings.search.label,
                            "border": this.model.settings.search.border
                        },
                        selector: null
                    });

                    
                    break;
                
                case 'colorBlind':
                    
                    objectEnumeration.push({
                        objectName: objectName,
                        properties: {
                            "vision": this.model.settings.colorBlind.vision
                        },
                        selector: null
                    });

                    break;
                
            };

            return objectEnumeration;
        }

    }

    export class Tokenizer {

        public maxElements: number;
        public placeholder: string;
        public elementsFontSize: number;
        public elementsBackColor: string;
        public elementsColor: string;
        public compressMultiple: boolean;

        public static KEYS = {
            BACKSPACE: 8,
            TAB: 9,
            ENTER: 13, 
            ESCAPE: 27,
            ARROW_UP: 38,
            ARROW_DOWN: 40
        };

        private readonly: boolean;
        private select: JQuery;
        private dropdown: JQuery;
        private dropdownArrow: JQuery;
        private dropdownResetter: JQuery;
        public container: JQuery; 
        private tokensContainer: JQuery;
        private searchToken: JQuery;
        private searchInput: JQuery;
        private keyTimeout;
        private hideTimeout;
        private listStart: number;
        private cachedValues: string[];
   

        //Events
        public onAddToken: any = function (value, text, e) { };
        public onRemoveToken: any = function (value, e) { };
        public onClear: any = function (e) { };
        public onDropdownAddItem: any = function (value, text, e) { };
        public onDropdownShow: any = function (e) { };
        public onDuplicateToken: any = function (value, text, e) { };

        public constructor(input: JQuery, placeholder: string, resetter: boolean) {

            var $this = this;
            this.readonly = false;
            this.select = input.attr('multiple', 'multiple').css({ margin: 0, padding: 0, border: 0 }).hide();
            this.container = $('<div />')
                .attr('class', this.select.attr('class'))
                .addClass('Tokenize');

            this.dropdown = $('<ul />')
                .addClass('Dropdown');

            this.dropdownArrow = $('<i class="arrow" title="Show all entries" />')
                .on('click', function (e) {
                    //e.stopImmediatePropagation();
                    if ($this.dropdown.is(':hidden'))
                        $this.listAll(true);
                    else
                        $this.dropdown.hide();
                });
            if (resetter) {
                this.dropdownResetter = $('<span class="slicerHeader"><span class="clear" title= "Clear selections"> </span></span>')
                    .on('click', function (e) {
                        //e.stopImmediatePropagation();
                        $this.searchInput.val('');
                        $this.clear(false);
                    });
            }
            this.tokensContainer = $('<ul />')
                .addClass('TokensContainer');

            this.searchToken = $('<li />')
                .addClass('TokenSearch')
                .appendTo(this.tokensContainer);
            
            this.placeholder = this.sanitize(placeholder);
            this.searchInput = $('<input />').attr('placeholder', this.placeholder)
                .appendTo(this.searchToken);

            if (this.select.prop('disabled')) {
                this.disable();
            }

            this.container
                .append(this.tokensContainer)
                .append(this.dropdown)
                .append(this.dropdownArrow);

            if (resetter)
                this.container.append(this.dropdownResetter)

            this.container.insertAfter(this.select);

            this.tokensContainer.on('click', function (e) {
                //e.stopImmediatePropagation();
                $this.searchInput.get(0).focus();
                if ($this.dropdown.is(':hidden') && $this.searchInput.val() != '') {
                    $this.search();
                }
            });

            this.searchInput.on('blur', function () {
                $this.tokensContainer.removeClass('Focused');
            });

            this.searchInput.on('focus click', function () {
                $this.tokensContainer.addClass('Focused');
            });

            this.searchInput.on('keydown', function (e) {
                $this.resizeSearchInput();
                $this.keydown(e);
            });

            this.searchInput.on('keyup', function (e) {
                $this.keyup(e);
            });

            this.searchInput.on('paste', function () {
                setTimeout(function () { $this.resizeSearchInput(); }, 10);
                setTimeout(function () {
                    var paste_elements = $this.searchInput.val().split(',');
                    if (paste_elements.length > 1) {
                        $.each(paste_elements, function (_, value) {
                            $this.tokenAdd(value.trim(), '');
                        });
                    }
                }, 20);
            });

            $('.chart').hover(function(){
                clearTimeout($this.hideTimeout);
            }, function () {
                $this.hideTimeout = setTimeout(function(){
                    $this.dropdownHide();
                }, 1000);
            });

            this.resizeSearchInput();
            this.remap();
        }

        public toggleReadonly(isReadonly) {
            this.readonly = isReadonly;
            this.container.toggleClass('readonly', isReadonly);
            this.searchInput.attr('disabled', isReadonly ? 'disabled' : null);
            this.resetPendingTokens();
        }

        public dropdownUpdateColors() {
            $('li', this.dropdown).not('.Selected').css({
                'background': 'none',
                'color': '#fff'
            });
            $('li.Hover, li.Selected', this.dropdown).css({
                'background': this.elementsBackColor,
                'color': this.elementsColor
            });
        }

        public dropdownShow() {
            this.onDropdownShow(this);
            $('ul.Dropdown').hide();
            this.dropdown.show();
        }

        public dropdownPrev() {

            if ($('li.Hover', this.dropdown).length > 0) {
                if (!$('li.Hover', this.dropdown).is('li:first-child')) {
                    $('li.Hover', this.dropdown).removeClass('Hover').prev().addClass('Hover');
                } else {
                    $('li.Hover', this.dropdown).removeClass('Hover');
                    $('li:last-child', this.dropdown).addClass('Hover');
                }
            } else {
               $('li:first', this.dropdown).addClass('Hover');
            }
            this.dropdownUpdateColors();
        }

        public dropdownNext() {

            if ($('li.Hover', this.dropdown).length > 0) {
                if (!$('li.Hover', this.dropdown).is('li:last-child')) {
                    $('li.Hover', this.dropdown).removeClass('Hover').next().addClass('Hover');
                } else {
                    $('li.Hover', this.dropdown).removeClass('Hover');
                    $('li:first-child', this.dropdown).addClass('Hover');
                }
            } else {
                $('li:first', this.dropdown).addClass('Hover');
            }
            this.dropdownUpdateColors();
        }
 
        public dropdownAddItem(value, text?) {

            value = this.sanitize(value);
            text = (text ? this.sanitize(text) : value);
           
            var alreadySelected = ($('li[data-value="' + value + '"]', this.tokensContainer).length > 0);
            var selectedItems = $('li.Token', this.tokensContainer).length;

            if ((this.compressMultiple && selectedItems > 1) || !alreadySelected) {
                var $this = this;
                var item = $('<li />')
                    .attr('data-value', value)
                    .attr('data-text', text)
                    .css('font-size', this.elementsFontSize + 'px')
                    .on('click', function (e) {
                        //e.stopImmediatePropagation();
                        $this.tokenAdd($(this).attr('data-value'), $(this).attr('data-text'));
                    }).on('mouseover', function () {
                        $(this).addClass('Hover');
                        $this.dropdownUpdateColors();
                    }).on('mouseout', function () {
                        $('li', $this.dropdown).removeClass('Hover');
                        $this.dropdownUpdateColors();
                    }).append('<span />');
                    
                item.find('span').text(text);

                if (alreadySelected) {
                    item.addClass('Selected');

                    var close_btn = $('<a />')
                        .addClass('Close')
                        .css({
                            'background-color': this.elementsBackColor,
                            'color': this.elementsColor,
                            'padding-top': (((this.elementsFontSize * 1.2) - 10) / 2) + 'px'
                        })
                        .text("×")
                        .on('click', function (e) {
                            //e.stopImmediatePropagation();
                            $this.tokenRemove(value);
                        });

                    item.prepend(close_btn);
                }
                this.dropdown.append(item);
               
                this.onDropdownAddItem(value, text, this);
            }

            return this;

        }

        public dropdownHide() {
            clearTimeout(this.hideTimeout);
            this.dropdownReset();
            this.dropdown.hide();
        }

        public dropdownReset() {
            this.dropdown.html('');
            this.listStart = 0;
        }

        public toggleDropdownArrow(show: boolean) {
            this.dropdownArrow.toggleClass('disabled', !show);
        }

        public toggleResetter(show: boolean) {
            if (this.dropdownResetter)
                this.dropdownResetter.toggle(show);
        }

        public resizeSearchInput() {
            this.searchInput.attr('size', (this.searchInput.val().length < 2 ? Math.max(this.searchInput.attr('placeholder').length, 3) : this.searchInput.val().length + 3));
        }

        public resetSearchInput() {
            clearTimeout(this.keyTimeout);
            this.searchInput.val("");
            this.resizeSearchInput();
        }

        public resetPendingTokens() {
            $('li.PendingDelete', this.tokensContainer).removeClass('PendingDelete');
        }

        public keydown(e) {
            

            switch (e.keyCode) {
                case Tokenizer.KEYS.BACKSPACE:
                    var selectedItems = $('li.Token', this.tokensContainer).length;
                    if (this.searchInput.val().length == 0 && !this.readonly && (!this.compressMultiple || selectedItems < 2)) {
                        e.preventDefault();
                        if ($('li.Token.PendingDelete', this.tokensContainer).length) {
                            this.tokenRemove($('li.Token.PendingDelete').attr('data-value'));
                        } else {
                            $('li.Token:last', this.tokensContainer).addClass('PendingDelete');
                            this.dropdownHide();
                        }
                        
                    }
                    break;

                case Tokenizer.KEYS.TAB:
                case Tokenizer.KEYS.ENTER:
                    if ($('li.Hover', this.dropdown).length) {
                        var element = $('li.Hover', this.dropdown);
                        e.preventDefault();
                        this.tokenAdd(element.attr('data-value'), element.attr('data-text'));
                    } else {
                        if (this.searchInput.val()) {
                            e.preventDefault();
                            this.tokenAdd(this.searchInput.val(), '');
                        }
                    }
                    this.resetPendingTokens();
                    break;

                case Tokenizer.KEYS.ESCAPE:
                    this.resetSearchInput();
                    this.dropdownHide();
                    this.resetPendingTokens();
                    break;

                case Tokenizer.KEYS.ARROW_UP:
                    e.preventDefault();
                    this.dropdownPrev();
                    break;

                case Tokenizer.KEYS.ARROW_DOWN:
                    e.preventDefault();
                    this.dropdownNext();
                    break;

                default:
                    this.resetPendingTokens();
                    break;
            }

        }

        public keyup(e) {
            switch (e.keyCode) {
                case Tokenizer.KEYS.TAB:
                case Tokenizer.KEYS.ENTER:
                case Tokenizer.KEYS.ESCAPE:
                case Tokenizer.KEYS.ARROW_UP:
                case Tokenizer.KEYS.ARROW_DOWN:
                    break;

                case Tokenizer.KEYS.BACKSPACE:
                    if (this.searchInput.val() != '') {
                        this.delaySearch();
                    } else {
                        clearTimeout(this.keyTimeout);
                        this.dropdownHide();
                    }
                    break;
                default:
                    if (this.searchInput.val()) {
                        this.delaySearch();
                    }
                    break;
            }
        }

        public delaySearch() {
            clearTimeout(this.keyTimeout);
            var $this = this;
            this.keyTimeout = setTimeout(function() {
                clearTimeout($this.keyTimeout);
                $this.search();
            }, 500);
        }

        public listAll(show?) {

            if (!show && this.dropdown.is(':hidden')) return;

            let chunk = 15;
            let start = this.listStart || 0;
            let end = Math.min(start + chunk, this.cachedValues.length);
            this.listStart = end;
            for (let i = start; i < end; i++) {

                let value = this.cachedValues[i];
                this.dropdownAddItem(value);
            }
            
            if (end < this.cachedValues.length) {
                var $this = this;
                setTimeout(function(){ $this.listAll(); }, 500);
            }

            if (show && this.dropdown.is(':hidden')) {
                //Dropdown toggle
                $('li:first', this.dropdown).addClass('Hover');
                this.dropdownUpdateColors();
                this.dropdownShow();
            }

        }

        public search() {

            this.dropdownReset();

            var str = this.searchInput.val();
            if (str.trim() === '') {
                this.listAll(true);
                return;
            }

            var max = 10;
            var found = 0;
            var regexp = new RegExp(str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&"), 'i');

            for (let i = 0; i < this.cachedValues.length; i++) {

                let value = this.cachedValues[i];
                if (regexp.test(value)) {
                    this.dropdownAddItem(value);
                    found++;
                }

                if (found >= max) break;
            }

            //Dropdown toggle
            if (found > 0) {
                $('li:first', this.dropdown).addClass('Hover');
                this.dropdownUpdateColors();
                this.dropdownShow();
            } else {
                this.dropdownHide();
            }
        }

        public tokenAdd(value, text, first?) {

            let selectedItems = $('li.Token', this.tokensContainer).length;
            let useMultipleToken = (this.compressMultiple && selectedItems > 0);
            this.searchInput.attr('placeholder', '');

            value = this.sanitize(value);
            if (value == undefined || value == '') {
                return this;
            }

            text = (text ? this.sanitize(text) : value);
            first = first || false;

            if (!this.readonly && this.maxElements > 0 && $('li.Token', this.tokensContainer).length >= this.maxElements) {
                this.resetSearchInput();
                return this;
            }

            var $this = this;
            var close_btn = (this.readonly ? '' : $('<a />')
                .addClass('Close')
                .css({
                    'background-color': this.elementsBackColor,
                    'color': this.elementsColor,
                    'padding-top': (((this.elementsFontSize * 1.5) - 4) / 2) + 'px'
                })
                .text("×")
                .on('click', function (e) {
                    //e.stopImmediatePropagation();
                    $this.tokenRemove(value);
                }));

            if ($('option[value="' + value + '"]', this.select).length > 0) {
                if (!first && ($('option[value="' + value + '"]', this.select).attr('selected') === 'selected' ||
                    $('option[value="' + value + '"]', this.select).prop('selected') === true)) {
                    this.onDuplicateToken(value, text, this);
                }
                $('option[value="' + value + '"]', this.select).attr('selected', 'selected').prop('selected', true);

            } else if ($('li[data-value="' + value + '"]', this.dropdown).length > 0) {

                var option = $('<option />')
                    .attr('selected', 'selected')
                    .attr('value', value)
                    .attr('data-type', 'custom')
                    .prop('selected', true)
                    .text(text);
                this.select.append(option);
            } else {
                this.resetSearchInput();
                return this;
            }

            if ($('li.Token[data-value="' + value + '"]', this.tokensContainer).length > 0) {
                return this;
            }

            var item = $('<li />')
                .addClass('Token')
                .attr('data-value', value)
                .append('<span />')
                .css({
                    'font-size': this.elementsFontSize + 'px',
                    'background-color': this.elementsBackColor,
                    'color': this.elementsColor
                })
                .prepend(close_btn);

            item.find('span').text(text)
                

            if (useMultipleToken) 
                item.hide();

            item.insertBefore(this.searchToken);


            if (useMultipleToken) {
                var $tokenMultiple = $('li.TokenMultiple', this.tokensContainer);
                if ($tokenMultiple.length == 0) {
                    $tokenMultiple = $('<li />')
                        .addClass('TokenMultiple')
                        .append('<span />')
                        .css({
                            'font-size': this.elementsFontSize + 'px',
                            'font-style': 'italic',
                            'background-color': this.elementsBackColor,
                            'color': this.elementsColor
                        })
                        .insertBefore(this.searchToken);

                }
                $tokenMultiple.find('span').text((this.placeholder != '' ? this.placeholder : 'Multiple') + ' (' + (selectedItems + 1) + ')');

                $('li.Token').hide();
            }


            if (!first)
                this.onAddToken(value, text, this);

            this.resetSearchInput();
            this.dropdownHide();

            return this;
        }

        public tokenRemove(value, first?) {

            value = this.sanitize(value);

            var option = $('option[value="' + value + '"]', this.select);

            if (option.attr('data-type') == 'custom') {
                option.remove();
            } else {
                option.removeAttr('selected').prop('selected', false);
            }

            $('li.Token[data-value="' + value + '"]', this.tokensContainer).remove();

            first = first || false;
            if (!first) this.onRemoveToken(value, this);

            this.resizeSearchInput();
            this.dropdownHide();

            return this;
        }

        public clear(first?) {
            var $this = this;

            first = first || false;

            $('li.Token', this.tokensContainer).each(function () {
                $this.tokenRemove($(this).attr('data-value'), true);
            });

            if (!first) this.onClear(this);
            this.dropdownHide();

            return this;
        }

        public disable() {
            this.select.prop('disabled', true);
            this.searchInput.prop('disabled', true);
            this.container.addClass('Disabled');

            return this;
        }

        public enable() {
            this.select.prop('disabled', false);
            this.searchInput.prop('disabled', false);
            this.container.removeClass('Disabled');

            return this;
        }

        public remap(values?) {

            if (values)
                this.cachedValues = values;

            var $this = this;
            var tmp = $("option:selected", this.select);
        
            this.clear(true);

            tmp.each(function () {
                $this.tokenAdd($(this).val(), $(this).text(), true);
            });

            return this;
        }

        public sanitize(html) {
            return String(html)
                .replace(/(\"|')/g, '')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        }
    }
}
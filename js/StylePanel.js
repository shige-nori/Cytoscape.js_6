/**
 * StylePanel - VizMapper風データ駆動型スタイル設定パネル
 * ノードとエッジの視覚的プロパティをデータ属性に基づいて動的にマッピング
 */
class StylePanel {
    constructor() {
        this.panel = null;
        this.currentTab = 'node'; // 'node' or 'edge'
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        
        // スタイル設定を保持（永続化）
        this.nodeStyles = {
            fillColor: { type: 'default', value: '#2563eb', mapping: null, attribute: null },
            shape: { type: 'default', value: 'ellipse', mapping: null, attribute: null },
            size: { type: 'default', value: 40, mapping: null, attribute: null },
            labelFontSize: { type: 'default', value: 10, mapping: null, attribute: null },
            labelColor: { type: 'default', value: '#000000', mapping: null, attribute: null },
            labelPosition: { type: 'default', value: 'top', mapping: null, attribute: null },
            labelWidth: { type: 'default', value: 80, mapping: null, attribute: null },
            borderWidth: { type: 'default', value: 0, mapping: null, attribute: null },
            borderColor: { type: 'default', value: '#000000', mapping: null, attribute: null },
            opacity: { type: 'default', value: 100, mapping: null, attribute: null }
        };
        
        this.edgeStyles = {
            lineColor: { type: 'default', value: '#94a3b8', mapping: null, attribute: null },
            width: { type: 'default', value: 2, mapping: null, attribute: null },
            style: { type: 'default', value: 'solid', mapping: null, attribute: null },
            targetArrow: { type: 'default', value: 'none', mapping: null, attribute: null },
            opacity: { type: 'default', value: 100, mapping: null, attribute: null },
            curveStyle: { type: 'default', value: 'bezier', mapping: null, attribute: null }
        };

        // 利用可能なノード属性とエッジ属性
        this.nodeAttributes = [];
        this.edgeAttributes = [];
    }

    initialize() {
        this.createPanel();
        this.setupEventListeners();
        this.setupPanelDrag();
        window.stylePanel = this;
    }

    createPanel() {
        // パネルHTML作成
        const panelHTML = `
            <div class="style-panel" id="style-panel">
                <div class="tools-panel-header">
                    <h3>Style</h3>
                </div>
                <div class="style-panel-tabs">
                    <button class="style-tab active" data-tab="node">Node</button>
                    <button class="style-tab" data-tab="edge">Edge</button>
                </div>
                <div class="tools-panel-body style-panel-body">
                    <!-- Node Tab Content -->
                    <div class="style-tab-content active" id="style-node-content">
                        ${this.createNodeStyleControls()}
                    </div>
                    <!-- Edge Tab Content -->
                    <div class="style-tab-content" id="style-edge-content">
                        ${this.createEdgeStyleControls()}
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', panelHTML);
        this.panel = document.getElementById('style-panel');
    }

    createNodeStyleControls() {
        return `
            <!-- Fill Color -->
            <div class="style-property-group collapsed">
                <div class="style-property-header collapsed" data-toggle="collapse">
                    <label>Fill Color</label>
                    <span class="collapse-icon">▼</span>
                </div>
                <div class="style-property-control">
                    <select class="style-mapping-type" data-property="fillColor" data-element="node">
                        <option value="default" selected>Default</option>
                        <option value="discrete">Discrete</option>
                        <option value="passthrough">Passthrough</option>
                        <option value="continuous">Continuous</option>
                    </select>
                    <input type="color" class="style-color-input" id="node-fillColor" value="#2563eb">
                    <select class="style-attribute-select hidden" id="node-fillColor-attr" data-property="fillColor" data-element="node">
                        <option value="">-- Select Attribute --</option>
                    </select>
                </div>
                <div class="style-discrete-mapping hidden" id="node-fillColor-discrete"></div>
                <div class="style-continuous-range style-color-range hidden" id="node-fillColor-range">
                    <div class="range-inputs">
                        <label>Min Color: <input type="color" id="node-fillColor-min" value="#2563eb"></label>
                        <label>Max Color: <input type="color" id="node-fillColor-max" value="#dc2626"></label>
                    </div>
                </div>
            </div>

            <!-- Shape -->
            <div class="style-property-group collapsed">
                <div class="style-property-header collapsed" data-toggle="collapse">
                    <label>Shape</label>
                    <span class="collapse-icon">▼</span>
                </div>
                <div class="style-property-control">
                    <select class="style-mapping-type" data-property="shape" data-element="node">
                        <option value="default" selected>Default</option>
                        <option value="discrete">Discrete</option>
                        <option value="passthrough">Passthrough</option>
                    </select>
                    <select class="style-select" id="node-shape">
                        <option value="ellipse">Ellipse</option>
                        <option value="rectangle">Rectangle</option>
                        <option value="round-rectangle">Round Rectangle</option>
                        <option value="triangle">Triangle</option>
                        <option value="diamond">Diamond</option>
                        <option value="pentagon">Pentagon</option>
                        <option value="hexagon">Hexagon</option>
                        <option value="heptagon">Heptagon</option>
                        <option value="octagon">Octagon</option>
                        <option value="star">Star</option>
                        <option value="vee">Vee</option>
                        <option value="rhomboid">Rhomboid</option>
                    </select>
                    <select class="style-attribute-select hidden" id="node-shape-attr" data-property="shape" data-element="node">
                        <option value="">-- Select Attribute --</option>
                    </select>
                </div>
                <div class="style-discrete-mapping hidden" id="node-shape-discrete"></div>
            </div>

            <!-- Size -->
            <div class="style-property-group collapsed">
                <div class="style-property-header collapsed" data-toggle="collapse">
                    <label>Size</label>
                    <span class="collapse-icon">▼</span>
                </div>
                <div class="style-property-control">
                    <select class="style-mapping-type" data-property="size" data-element="node">
                        <option value="default" selected>Default</option>
                        <option value="discrete">Discrete</option>
                        <option value="continuous">Continuous</option>
                    </select>
                    <input type="range" class="style-slider" id="node-size" min="10" max="500" value="40">
                    <input type="number" class="style-number-input" id="node-size-value" min="10" max="500" value="40">
                    <select class="style-attribute-select hidden" id="node-size-attr" data-property="size" data-element="node">
                        <option value="">-- Select Attribute --</option>
                    </select>
                </div>
                <div class="style-discrete-mapping hidden" id="node-size-discrete"></div>
                <div class="style-continuous-range hidden" id="node-size-range">
                    <div class="range-inputs">
                        <label>Min: <input type="number" id="node-size-min" value="20" min="10" max="500"></label>
                        <label>Max: <input type="number" id="node-size-max" value="60" min="10" max="500"></label>
                    </div>
                </div>
            </div>

            <!-- Label Font Size -->
            <div class="style-property-group collapsed">
                <div class="style-property-header collapsed" data-toggle="collapse">
                    <label>Label Font Size</label>
                    <span class="collapse-icon">▼</span>
                </div>
                <div class="style-property-control">
                    <select class="style-mapping-type" data-property="labelFontSize" data-element="node">
                        <option value="default" selected>Default</option>
                        <option value="discrete">Discrete</option>
                        <option value="continuous">Continuous</option>
                    </select>
                    <input type="range" class="style-slider" id="node-labelFontSize" min="6" max="50" value="10">
                    <input type="number" class="style-number-input" id="node-labelFontSize-value" min="6" max="50" value="10">
                    <select class="style-attribute-select hidden" id="node-labelFontSize-attr" data-property="labelFontSize" data-element="node">
                        <option value="">-- Select Attribute --</option>
                    </select>
                </div>
                <div class="style-discrete-mapping hidden" id="node-labelFontSize-discrete"></div>
            </div>

            <!-- Label Color -->
            <div class="style-property-group collapsed">
                <div class="style-property-header collapsed" data-toggle="collapse">
                    <label>Label Color</label>
                    <span class="collapse-icon">▼</span>
                </div>
                <div class="style-property-control">
                    <select class="style-mapping-type" data-property="labelColor" data-element="node">
                        <option value="default" selected>Default</option>
                        <option value="discrete">Discrete</option>
                        <option value="passthrough">Passthrough</option>
                        <option value="continuous">Continuous</option>
                    </select>
                    <input type="color" class="style-color-input" id="node-labelColor" value="#000000">
                    <select class="style-attribute-select hidden" id="node-labelColor-attr" data-property="labelColor" data-element="node">
                        <option value="">-- Select Attribute --</option>
                    </select>
                </div>
                <div class="style-discrete-mapping hidden" id="node-labelColor-discrete"></div>
                <div class="style-continuous-range style-color-range hidden" id="node-labelColor-range">
                    <div class="range-inputs">
                        <label>Min Color: <input type="color" id="node-labelColor-min" value="#000000"></label>
                        <label>Max Color: <input type="color" id="node-labelColor-max" value="#dc2626"></label>
                    </div>
                </div>
            </div>

            <!-- Label Position -->
            <div class="style-property-group collapsed">
                <div class="style-property-header collapsed" data-toggle="collapse">
                    <label>Label Position</label>
                    <span class="collapse-icon">▼</span>
                </div>
                <div class="style-property-control">
                    <select class="style-select" id="node-labelPosition">
                        <option value="top">Top</option>
                        <option value="center">Center</option>
                        <option value="bottom">Bottom</option>
                    </select>
                </div>
            </div>

            <!-- Label Width -->
            <div class="style-property-group collapsed">
                <div class="style-property-header collapsed" data-toggle="collapse">
                    <label>Label Width</label>
                    <span class="collapse-icon">▼</span>
                </div>
                <div class="style-property-control">
                    <input type="range" class="style-slider" id="node-labelWidth" min="20" max="1000" value="80">
                    <input type="number" class="style-number-input" id="node-labelWidth-value" min="20" max="1000" value="80">
                </div>
            </div>

            <!-- Border Width -->
            <div class="style-property-group collapsed">
                <div class="style-property-header collapsed" data-toggle="collapse">
                    <label>Border Width</label>
                    <span class="collapse-icon">▼</span>
                </div>
                <div class="style-property-control">
                    <select class="style-mapping-type" data-property="borderWidth" data-element="node">
                        <option value="default" selected>Default</option>
                        <option value="discrete">Discrete</option>
                        <option value="continuous">Continuous</option>
                    </select>
                    <input type="range" class="style-slider" id="node-borderWidth" min="0" max="50" value="0">
                    <input type="number" class="style-number-input" id="node-borderWidth-value" min="0" max="50" value="0">
                    <select class="style-attribute-select hidden" id="node-borderWidth-attr" data-property="borderWidth" data-element="node">
                        <option value="">-- Select Attribute --</option>
                    </select>
                </div>
                <div class="style-discrete-mapping hidden" id="node-borderWidth-discrete"></div>
            </div>

            <!-- Border Color -->
            <div class="style-property-group collapsed">
                <div class="style-property-header collapsed" data-toggle="collapse">
                    <label>Border Color</label>
                    <span class="collapse-icon">▼</span>
                </div>
                <div class="style-property-control">
                    <select class="style-mapping-type" data-property="borderColor" data-element="node">
                        <option value="default" selected>Default</option>
                        <option value="discrete">Discrete</option>
                        <option value="passthrough">Passthrough</option>
                        <option value="continuous">Continuous</option>
                    </select>
                    <input type="color" class="style-color-input" id="node-borderColor" value="#000000">
                    <select class="style-attribute-select hidden" id="node-borderColor-attr" data-property="borderColor" data-element="node">
                        <option value="">-- Select Attribute --</option>
                    </select>
                </div>
                <div class="style-discrete-mapping hidden" id="node-borderColor-discrete"></div>
                <div class="style-continuous-range style-color-range hidden" id="node-borderColor-range">
                    <div class="range-inputs">
                        <label>Min Color: <input type="color" id="node-borderColor-min" value="#000000"></label>
                        <label>Max Color: <input type="color" id="node-borderColor-max" value="#dc2626"></label>
                    </div>
                </div>
            </div>

            <!-- Opacity -->
            <div class="style-property-group collapsed">
                <div class="style-property-header collapsed" data-toggle="collapse">
                    <label>Opacity</label>
                    <span class="collapse-icon">▼</span>
                </div>
                <div class="style-property-control">
                    <select class="style-mapping-type" data-property="opacity" data-element="node">
                        <option value="default" selected>Default</option>
                        <option value="discrete">Discrete</option>
                        <option value="continuous">Continuous</option>
                    </select>
                    <input type="range" class="style-slider" id="node-opacity" min="0" max="100" step="1" value="100">
                    <input type="number" class="style-number-input" id="node-opacity-value" min="0" max="100" step="1" value="100">
                    <select class="style-attribute-select hidden" id="node-opacity-attr" data-property="opacity" data-element="node">
                        <option value="">-- Select Attribute --</option>
                    </select>
                </div>
                <div class="style-discrete-mapping hidden" id="node-opacity-discrete"></div>
            </div>
        `;
    }

    createEdgeStyleControls() {
        return `
            <!-- Line Color -->
            <div class="style-property-group collapsed">
                <div class="style-property-header collapsed" data-toggle="collapse">
                    <label>Line Color</label>
                    <span class="collapse-icon">▼</span>
                </div>
                <div class="style-property-control">
                    <select class="style-mapping-type" data-property="lineColor" data-element="edge">
                        <option value="default" selected>Default</option>
                        <option value="discrete">Discrete</option>
                        <option value="passthrough">Passthrough</option>
                        <option value="continuous">Continuous</option>
                    </select>
                    <input type="color" class="style-color-input" id="edge-lineColor" value="#94a3b8">
                    <select class="style-attribute-select hidden" id="edge-lineColor-attr" data-property="lineColor" data-element="edge">
                        <option value="">-- Select Attribute --</option>
                    </select>
                </div>
                <div class="style-discrete-mapping hidden" id="edge-lineColor-discrete"></div>
                <div class="style-continuous-range style-color-range hidden" id="edge-lineColor-range">
                    <div class="range-inputs">
                        <label>Min Color: <input type="color" id="edge-lineColor-min" value="#94a3b8"></label>
                        <label>Max Color: <input type="color" id="edge-lineColor-max" value="#dc2626"></label>
                    </div>
                </div>
            </div>

            <!-- Width -->
            <div class="style-property-group collapsed">
                <div class="style-property-header collapsed" data-toggle="collapse">
                    <label>Width</label>
                    <span class="collapse-icon">▼</span>
                </div>
                <div class="style-property-control">
                    <select class="style-mapping-type" data-property="width" data-element="edge">
                        <option value="default" selected>Default</option>
                        <option value="discrete">Discrete</option>
                        <option value="continuous">Continuous</option>
                    </select>
                    <input type="range" class="style-slider" id="edge-width" min="0.1" max="10" step="0.1" value="2">
                    <input type="number" class="style-number-input" id="edge-width-value" min="0.1" max="10" step="0.1" value="2">
                    <select class="style-attribute-select hidden" id="edge-width-attr" data-property="width" data-element="edge">
                        <option value="">-- Select Attribute --</option>
                    </select>
                </div>
                <div class="style-discrete-mapping hidden" id="edge-width-discrete"></div>
                <div class="style-continuous-range hidden" id="edge-width-range">
                    <div class="range-inputs">
                        <label>Min: <input type="number" id="edge-width-min" value="0.5" min="0.1" max="10" step="0.1"></label>
                        <label>Max: <input type="number" id="edge-width-max" value="5" min="0.1" max="10" step="0.1"></label>
                    </div>
                </div>
            </div>

            <!-- Style -->
            <div class="style-property-group collapsed">
                <div class="style-property-header collapsed" data-toggle="collapse">
                    <label>Style</label>
                    <span class="collapse-icon">▼</span>
                </div>
                <div class="style-property-control">
                    <select class="style-mapping-type" data-property="style" data-element="edge">
                        <option value="default" selected>Default</option>
                        <option value="discrete">Discrete</option>
                        <option value="passthrough">Passthrough</option>
                    </select>
                    <select class="style-select" id="edge-style">
                        <option value="solid">Solid</option>
                        <option value="dotted">Dotted</option>
                        <option value="dashed">Dashed</option>
                    </select>
                    <select class="style-attribute-select hidden" id="edge-style-attr" data-property="style" data-element="edge">
                        <option value="">-- Select Attribute --</option>
                    </select>
                </div>
                <div class="style-discrete-mapping hidden" id="edge-style-discrete"></div>
            </div>

            <!-- Target Arrow -->
            <div class="style-property-group collapsed">
                <div class="style-property-header collapsed" data-toggle="collapse">
                    <label>Target Arrow</label>
                    <span class="collapse-icon">▼</span>
                </div>
                <div class="style-property-control">
                    <select class="style-mapping-type" data-property="targetArrow" data-element="edge">
                        <option value="default" selected>Default</option>
                        <option value="discrete">Discrete</option>
                        <option value="passthrough">Passthrough</option>
                    </select>
                    <select class="style-select" id="edge-targetArrow">
                        <option value="none">None</option>
                        <option value="triangle">Triangle</option>
                        <option value="triangle-tee">Triangle Tee</option>
                        <option value="circle-triangle">Circle Triangle</option>
                        <option value="triangle-cross">Triangle Cross</option>
                        <option value="triangle-backcurve">Triangle Backcurve</option>
                        <option value="vee">Vee</option>
                        <option value="tee">Tee</option>
                        <option value="square">Square</option>
                        <option value="circle">Circle</option>
                        <option value="diamond">Diamond</option>
                        <option value="chevron">Chevron</option>
                    </select>
                    <select class="style-attribute-select hidden" id="edge-targetArrow-attr" data-property="targetArrow" data-element="edge">
                        <option value="">-- Select Attribute --</option>
                    </select>
                </div>
                <div class="style-discrete-mapping hidden" id="edge-targetArrow-discrete"></div>
            </div>

            <!-- Opacity -->
            <div class="style-property-group collapsed">
                <div class="style-property-header collapsed" data-toggle="collapse">
                    <label>Opacity</label>
                    <span class="collapse-icon">▼</span>
                </div>
                <div class="style-property-control">
                    <select class="style-mapping-type" data-property="opacity" data-element="edge">
                        <option value="default" selected>Default</option>
                        <option value="discrete">Discrete</option>
                        <option value="continuous">Continuous</option>
                    </select>
                    <input type="range" class="style-slider" id="edge-opacity" min="0" max="100" step="1" value="100">
                    <input type="number" class="style-number-input" id="edge-opacity-value" min="0" max="100" step="1" value="100">
                    <select class="style-attribute-select hidden" id="edge-opacity-attr" data-property="opacity" data-element="edge">
                        <option value="">-- Select Attribute --</option>
                    </select>
                </div>
                <div class="style-discrete-mapping hidden" id="edge-opacity-discrete"></div>
            </div>

            <!-- Curve Style -->
            <div class="style-property-group collapsed">
                <div class="style-property-header collapsed" data-toggle="collapse">
                    <label>Curve Style</label>
                    <span class="collapse-icon">▼</span>
                </div>
                <div class="style-property-control">
                    <select class="style-select" id="edge-curveStyle">
                        <option value="bezier">Bezier</option>
                        <option value="unbundled-bezier">Unbundled Bezier</option>
                        <option value="haystack">Haystack</option>
                        <option value="straight">Straight</option>
                        <option value="segments">Segments</option>
                        <option value="taxi">Taxi</option>
                    </select>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        // タブ切り替え
        document.querySelectorAll('.style-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // プロパティグループの折りたたみ
        document.querySelectorAll('.style-property-header[data-toggle="collapse"]').forEach(header => {
            header.addEventListener('click', (e) => {
                // マッピングタイプのselectをクリックした場合は折りたたみを実行しない
                if (e.target.classList.contains('style-mapping-type')) {
                    return;
                }
                
                const propertyGroup = header.closest('.style-property-group');
                propertyGroup.classList.toggle('collapsed');
                header.classList.toggle('collapsed');
            });
        });

        // Node スタイル入力
        this.setupNodeStyleListeners();
        
        // Edge スタイル入力
        this.setupEdgeStyleListeners();

        // マッピングタイプ変更
        document.querySelectorAll('.style-mapping-type').forEach(select => {
            select.addEventListener('change', (e) => {
                this.handleMappingTypeChange(e);
            });
        });

        // 属性選択変更
        document.querySelectorAll('.style-attribute-select').forEach(select => {
            select.addEventListener('change', (e) => {
                this.handleAttributeChange(e);
            });
        });

        // ネットワーク図の空白クリックでパネルを閉じる
        if (networkManager && networkManager.cy) {
            networkManager.cy.on('tap', (e) => {
                if (e.target === networkManager.cy && this.panel && this.panel.classList.contains('active')) {
                    this.closePanel();
                }
            });
        }
    }

    setupNodeStyleListeners() {
        // Fill Color
        const fillColor = document.getElementById('node-fillColor');
        if (fillColor) {
            fillColor.addEventListener('input', (e) => {
                this.nodeStyles.fillColor.value = e.target.value;
                this.applyNodeStyles();
            });
        }
        
        // Fill Color Continuous Range
        const fillColorMin = document.getElementById('node-fillColor-min');
        const fillColorMax = document.getElementById('node-fillColor-max');
        if (fillColorMin) {
            fillColorMin.addEventListener('input', (e) => {
                if (!this.nodeStyles.fillColor.mapping) {
                    this.nodeStyles.fillColor.mapping = {};
                }
                this.nodeStyles.fillColor.mapping.min = e.target.value;
                this.applyNodeStyles();
            });
        }
        if (fillColorMax) {
            fillColorMax.addEventListener('input', (e) => {
                if (!this.nodeStyles.fillColor.mapping) {
                    this.nodeStyles.fillColor.mapping = {};
                }
                this.nodeStyles.fillColor.mapping.max = e.target.value;
                this.applyNodeStyles();
            });
        }

        // Shape
        const shape = document.getElementById('node-shape');
        if (shape) {
            shape.addEventListener('change', (e) => {
                this.nodeStyles.shape.value = e.target.value;
                this.applyNodeStyles();
            });
        }

        // Size
        const size = document.getElementById('node-size');
        const sizeValue = document.getElementById('node-size-value');
        if (size && sizeValue) {
            size.addEventListener('input', (e) => {
                this.nodeStyles.size.value = parseInt(e.target.value);
                sizeValue.value = e.target.value;
                this.applyNodeStyles();
            });
            sizeValue.addEventListener('input', (e) => {
                this.nodeStyles.size.value = parseInt(e.target.value);
                size.value = e.target.value;
                this.applyNodeStyles();
            });
        }
        
        // Size Continuous Range
        const sizeMin = document.getElementById('node-size-min');
        const sizeMax = document.getElementById('node-size-max');
        if (sizeMin) {
            sizeMin.addEventListener('input', (e) => {
                if (!this.nodeStyles.size.mapping) {
                    this.nodeStyles.size.mapping = {};
                }
                this.nodeStyles.size.mapping.min = parseFloat(e.target.value);
                this.applyNodeStyles();
            });
        }
        if (sizeMax) {
            sizeMax.addEventListener('input', (e) => {
                if (!this.nodeStyles.size.mapping) {
                    this.nodeStyles.size.mapping = {};
                }
                this.nodeStyles.size.mapping.max = parseFloat(e.target.value);
                this.applyNodeStyles();
            });
        }

        // Label Font Size
        const labelFontSize = document.getElementById('node-labelFontSize');
        const labelFontSizeValue = document.getElementById('node-labelFontSize-value');
        if (labelFontSize && labelFontSizeValue) {
            labelFontSize.addEventListener('input', (e) => {
                this.nodeStyles.labelFontSize.value = parseInt(e.target.value);
                labelFontSizeValue.value = e.target.value;
                this.applyNodeStyles();
            });
            labelFontSizeValue.addEventListener('input', (e) => {
                this.nodeStyles.labelFontSize.value = parseInt(e.target.value);
                labelFontSize.value = e.target.value;
                this.applyNodeStyles();
            });
        }

        // Label Color
        const labelColor = document.getElementById('node-labelColor');
        if (labelColor) {
            labelColor.addEventListener('input', (e) => {
                this.nodeStyles.labelColor.value = e.target.value;
                this.applyNodeStyles();
            });
        }
        
        // Label Color Continuous Range
        const labelColorMin = document.getElementById('node-labelColor-min');
        const labelColorMax = document.getElementById('node-labelColor-max');
        if (labelColorMin) {
            labelColorMin.addEventListener('input', (e) => {
                if (!this.nodeStyles.labelColor.mapping) {
                    this.nodeStyles.labelColor.mapping = {};
                }
                this.nodeStyles.labelColor.mapping.min = e.target.value;
                this.applyNodeStyles();
            });
        }
        if (labelColorMax) {
            labelColorMax.addEventListener('input', (e) => {
                if (!this.nodeStyles.labelColor.mapping) {
                    this.nodeStyles.labelColor.mapping = {};
                }
                this.nodeStyles.labelColor.mapping.max = e.target.value;
                this.applyNodeStyles();
            });
        }

        // Label Position
        const labelPosition = document.getElementById('node-labelPosition');
        if (labelPosition) {
            labelPosition.addEventListener('change', (e) => {
                this.nodeStyles.labelPosition.value = e.target.value;
                this.applyNodeStyles();
            });
        }

        // Label Width
        const labelWidth = document.getElementById('node-labelWidth');
        const labelWidthValue = document.getElementById('node-labelWidth-value');
        if (labelWidth && labelWidthValue) {
            labelWidth.addEventListener('input', (e) => {
                this.nodeStyles.labelWidth.value = parseInt(e.target.value);
                labelWidthValue.value = e.target.value;
                this.applyNodeStyles();
            });
            labelWidthValue.addEventListener('input', (e) => {
                this.nodeStyles.labelWidth.value = parseInt(e.target.value);
                labelWidth.value = e.target.value;
                this.applyNodeStyles();
            });
        }

        // Border Width
        const borderWidth = document.getElementById('node-borderWidth');
        const borderWidthValue = document.getElementById('node-borderWidth-value');
        if (borderWidth && borderWidthValue) {
            borderWidth.addEventListener('input', (e) => {
                this.nodeStyles.borderWidth.value = parseInt(e.target.value);
                borderWidthValue.value = e.target.value;
                this.applyNodeStyles();
            });
            borderWidthValue.addEventListener('input', (e) => {
                this.nodeStyles.borderWidth.value = parseInt(e.target.value);
                borderWidth.value = e.target.value;
                this.applyNodeStyles();
            });
        }

        // Border Color
        const borderColor = document.getElementById('node-borderColor');
        if (borderColor) {
            borderColor.addEventListener('input', (e) => {
                this.nodeStyles.borderColor.value = e.target.value;
                this.applyNodeStyles();
            });
        }
        
        // Border Color Continuous Range
        const borderColorMin = document.getElementById('node-borderColor-min');
        const borderColorMax = document.getElementById('node-borderColor-max');
        if (borderColorMin) {
            borderColorMin.addEventListener('input', (e) => {
                if (!this.nodeStyles.borderColor.mapping) {
                    this.nodeStyles.borderColor.mapping = {};
                }
                this.nodeStyles.borderColor.mapping.min = e.target.value;
                this.applyNodeStyles();
            });
        }
        if (borderColorMax) {
            borderColorMax.addEventListener('input', (e) => {
                if (!this.nodeStyles.borderColor.mapping) {
                    this.nodeStyles.borderColor.mapping = {};
                }
                this.nodeStyles.borderColor.mapping.max = e.target.value;
                this.applyNodeStyles();
            });
        }

        // Opacity
        const opacity = document.getElementById('node-opacity');
        const opacityValue = document.getElementById('node-opacity-value');
        if (opacity && opacityValue) {
            opacity.addEventListener('input', (e) => {
                this.nodeStyles.opacity.value = parseFloat(e.target.value);
                opacityValue.value = e.target.value;
                this.applyNodeStyles();
            });
            opacityValue.addEventListener('input', (e) => {
                this.nodeStyles.opacity.value = parseFloat(e.target.value);
                opacity.value = e.target.value;
                this.applyNodeStyles();
            });
        }
    }

    setupEdgeStyleListeners() {
        // Line Color
        const lineColor = document.getElementById('edge-lineColor');
        if (lineColor) {
            lineColor.addEventListener('input', (e) => {
                this.edgeStyles.lineColor.value = e.target.value;
                this.applyEdgeStyles();
            });
        }
        
        // Line Color Continuous Range
        const lineColorMin = document.getElementById('edge-lineColor-min');
        const lineColorMax = document.getElementById('edge-lineColor-max');
        if (lineColorMin) {
            lineColorMin.addEventListener('input', (e) => {
                if (!this.edgeStyles.lineColor.mapping) {
                    this.edgeStyles.lineColor.mapping = {};
                }
                this.edgeStyles.lineColor.mapping.min = e.target.value;
                this.applyEdgeStyles();
            });
        }
        if (lineColorMax) {
            lineColorMax.addEventListener('input', (e) => {
                if (!this.edgeStyles.lineColor.mapping) {
                    this.edgeStyles.lineColor.mapping = {};
                }
                this.edgeStyles.lineColor.mapping.max = e.target.value;
                this.applyEdgeStyles();
            });
        }

        // Width
        const width = document.getElementById('edge-width');
        const widthValue = document.getElementById('edge-width-value');
        if (width && widthValue) {
            width.addEventListener('input', (e) => {
                this.edgeStyles.width.value = parseFloat(e.target.value);
                widthValue.value = e.target.value;
                this.applyEdgeStyles();
            });
            widthValue.addEventListener('input', (e) => {
                this.edgeStyles.width.value = parseFloat(e.target.value);
                width.value = e.target.value;
                this.applyEdgeStyles();
            });
        }
        
        // Width Continuous Range
        const widthMin = document.getElementById('edge-width-min');
        const widthMax = document.getElementById('edge-width-max');
        if (widthMin) {
            widthMin.addEventListener('input', (e) => {
                if (!this.edgeStyles.width.mapping) {
                    this.edgeStyles.width.mapping = {};
                }
                this.edgeStyles.width.mapping.min = parseFloat(e.target.value);
                this.applyEdgeStyles();
            });
        }
        if (widthMax) {
            widthMax.addEventListener('input', (e) => {
                if (!this.edgeStyles.width.mapping) {
                    this.edgeStyles.width.mapping = {};
                }
                this.edgeStyles.width.mapping.max = parseFloat(e.target.value);
                this.applyEdgeStyles();
            });
        }

        // Style
        const style = document.getElementById('edge-style');
        if (style) {
            style.addEventListener('change', (e) => {
                this.edgeStyles.style.value = e.target.value;
                this.applyEdgeStyles();
            });
        }

        // Target Arrow
        const targetArrow = document.getElementById('edge-targetArrow');
        if (targetArrow) {
            targetArrow.addEventListener('change', (e) => {
                this.edgeStyles.targetArrow.value = e.target.value;
                this.applyEdgeStyles();
            });
        }

        // Opacity
        const opacity = document.getElementById('edge-opacity');
        const opacityValue = document.getElementById('edge-opacity-value');
        if (opacity && opacityValue) {
            opacity.addEventListener('input', (e) => {
                this.edgeStyles.opacity.value = parseFloat(e.target.value);
                opacityValue.value = e.target.value;
                this.applyEdgeStyles();
            });
            opacityValue.addEventListener('input', (e) => {
                this.edgeStyles.opacity.value = parseFloat(e.target.value);
                opacity.value = e.target.value;
                this.applyEdgeStyles();
            });
        }

        // Curve Style
        const curveStyle = document.getElementById('edge-curveStyle');
        if (curveStyle) {
            curveStyle.addEventListener('change', (e) => {
                this.edgeStyles.curveStyle.value = e.target.value;
                this.applyEdgeStyles();
            });
        }
    }

    handleMappingTypeChange(e) {
        const mappingType = e.target.value;
        const property = e.target.dataset.property;
        const element = e.target.dataset.element;
        const propertyGroup = e.target.closest('.style-property-group');
        
        if (!propertyGroup) {
            console.error('StylePanel: Property group not found');
            return;
        }
        
        const controlDiv = propertyGroup.querySelector('.style-property-control');
        if (!controlDiv) {
            console.error('StylePanel: Control div not found');
            return;
        }
        
        const attrSelect = controlDiv.querySelector('.style-attribute-select');
        const directInputs = Array.from(controlDiv.querySelectorAll('input, select')).filter(el => 
            !el.classList.contains('style-attribute-select') && !el.classList.contains('style-mapping-type')
        );
        const rangeDiv = propertyGroup.querySelector('.style-continuous-range');
        const discreteDiv = propertyGroup.querySelector('.style-discrete-mapping');

        // スタイル設定を更新
        if (element === 'node') {
            this.nodeStyles[property].type = mappingType;
        } else {
            this.edgeStyles[property].type = mappingType;
        }

        // すべて非表示にしてからモードに応じて表示
        directInputs.forEach(input => input.classList.add('hidden'));
        if (attrSelect) attrSelect.classList.add('hidden');
        if (rangeDiv) rangeDiv.classList.add('hidden');
        if (discreteDiv) discreteDiv.classList.add('hidden');

        if (mappingType === 'default') {
            // Defaultモード: 直接入力のみ表示
            directInputs.forEach(input => input.classList.remove('hidden'));
        } else if (mappingType === 'discrete') {
            // Discreteモード: 直接入力と属性選択の両方を表示
            directInputs.forEach(input => input.classList.remove('hidden'));
            if (attrSelect) {
                attrSelect.classList.remove('hidden');
                this.updateAttributeOptions(attrSelect, element);
            }
        } else if (mappingType === 'passthrough') {
            // Passthroughモード: 属性選択のみ表示
            if (attrSelect) {
                attrSelect.classList.remove('hidden');
                this.updateAttributeOptions(attrSelect, element);
            }
        } else if (mappingType === 'continuous') {
            // Continuousモード: 属性選択と範囲設定を表示
            if (attrSelect) {
                attrSelect.classList.remove('hidden');
                this.updateAttributeOptions(attrSelect, element);
            }
            if (rangeDiv) rangeDiv.classList.remove('hidden');
        }

        this.applyStyles();
    }

    handleAttributeChange(e) {
        const attribute = e.target.value;
        const property = e.target.dataset.property;
        const element = e.target.dataset.element;
        const propertyGroup = e.target.closest('.style-property-group');
        const discreteDiv = propertyGroup.querySelector('.style-discrete-mapping');

        if (element === 'node') {
            this.nodeStyles[property].attribute = attribute;
        } else {
            this.edgeStyles[property].attribute = attribute;
        }

        // Discreteマッピングの場合、属性値のリストを表示
        if (attribute && discreteDiv) {
            const styleConfig = element === 'node' ? this.nodeStyles[property] : this.edgeStyles[property];
            if (styleConfig.type === 'discrete') {
                this.buildDiscreteMappingTable(discreteDiv, property, element, attribute);
                discreteDiv.classList.remove('hidden');
            }
        } else if (discreteDiv) {
            discreteDiv.classList.add('hidden');
        }

        this.applyStyles();
    }

    updateAttributeOptions(selectElement, elementType) {
        const attributes = elementType === 'node' ? this.nodeAttributes : this.edgeAttributes;
        
        // 現在の選択値を保持
        const currentValue = selectElement.value;
        
        // オプションをクリアして再構築
        selectElement.innerHTML = '<option value="">-- Select Attribute --</option>';
        
        attributes.forEach(attr => {
            const option = document.createElement('option');
            option.value = attr;
            option.textContent = attr;
            selectElement.appendChild(option);
        });
        
        // 以前の選択を復元
        if (currentValue && attributes.includes(currentValue)) {
            selectElement.value = currentValue;
        }
    }

    buildDiscreteMappingTable(container, property, element, attribute) {
        if (!networkManager || !networkManager.cy) return;

        // 属性の一意な値を取得
        const elements = element === 'node' ? networkManager.cy.nodes() : networkManager.cy.edges();
        const uniqueValues = new Set();
        
        elements.forEach(el => {
            const value = el.data(attribute);
            if (value !== undefined && value !== null) {
                uniqueValues.add(String(value));
            }
        });

        if (uniqueValues.size === 0) {
            container.innerHTML = '<p class="discrete-empty">No values found for this attribute</p>';
            return;
        }

        // スタイル設定を取得
        const styleConfig = element === 'node' ? this.nodeStyles[property] : this.edgeStyles[property];
        
        // マッピングオブジェクトを初期化
        if (!styleConfig.mapping) {
            styleConfig.mapping = {};
        }

        // プロパティの型を判定
        const propertyType = this.getPropertyType(property);

        // テーブルを構築
        let tableHTML = '<div class="discrete-mapping-table"><table>';
        tableHTML += '<thead><tr><th>Attribute Value</th><th>Style Value</th></tr></thead><tbody>';

        Array.from(uniqueValues).sort().forEach(uniqueValue => {
            const mappedValue = styleConfig.mapping[uniqueValue] !== undefined 
                ? styleConfig.mapping[uniqueValue] 
                : styleConfig.value;
            
            const inputId = `${element}-${property}-${uniqueValue.replace(/[^a-zA-Z0-9]/g, '_')}`;
            
            tableHTML += '<tr>';
            tableHTML += `<td class="discrete-value">${uniqueValue}</td>`;
            tableHTML += '<td>';
            
            // プロパティタイプに応じた入力コントロールを生成
            if (propertyType === 'color') {
                tableHTML += `<input type="color" class="discrete-input" id="${inputId}" value="${mappedValue}" data-value="${uniqueValue}">`;
            } else if (propertyType === 'number') {
                const { min, max, step } = this.getPropertyLimits(property);
                tableHTML += `<input type="number" class="discrete-input" id="${inputId}" value="${mappedValue}" min="${min}" max="${max}" step="${step}" data-value="${uniqueValue}">`;
            } else if (propertyType === 'select') {
                tableHTML += this.getSelectOptionsHTML(property, inputId, mappedValue, uniqueValue);
            } else {
                tableHTML += `<input type="text" class="discrete-input" id="${inputId}" value="${mappedValue}" data-value="${uniqueValue}">`;
            }
            
            tableHTML += '</td></tr>';
        });

        tableHTML += '</tbody></table></div>';
        container.innerHTML = tableHTML;

        // イベントリスナーを設定
        container.querySelectorAll('.discrete-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const attrValue = e.target.dataset.value;
                let styleValue = e.target.value;
                
                // 数値型の場合は変換
                if (propertyType === 'number') {
                    styleValue = parseFloat(styleValue);
                }
                
                styleConfig.mapping[attrValue] = styleValue;
                this.applyStyles();
            });
            
            input.addEventListener('change', (e) => {
                const attrValue = e.target.dataset.value;
                let styleValue = e.target.value;
                
                // 数値型の場合は変換
                if (propertyType === 'number') {
                    styleValue = parseFloat(styleValue);
                }
                
                styleConfig.mapping[attrValue] = styleValue;
                this.applyStyles();
            });
        });
    }

    getPropertyType(property) {
        const colorProperties = ['fillColor', 'labelColor', 'borderColor', 'lineColor'];
        const numberProperties = ['size', 'labelFontSize', 'borderWidth', 'width', 'opacity'];
        const selectProperties = ['shape', 'style', 'targetArrow'];
        
        if (colorProperties.includes(property)) return 'color';
        if (numberProperties.includes(property)) return 'number';
        if (selectProperties.includes(property)) return 'select';
        return 'text';
    }

    getPropertyLimits(property) {
        const limits = {
            size: { min: 10, max: 500, step: 1 },
            labelFontSize: { min: 6, max: 50, step: 1 },
            labelWidth: { min: 20, max: 1000, step: 1 },
            borderWidth: { min: 0, max: 50, step: 1 },
            width: { min: 0.1, max: 10, step: 0.1 },
            opacity: { min: 0, max: 100, step: 1 }
        };
        return limits[property] || { min: 0, max: 100, step: 1 };
    }

    getSelectOptionsHTML(property, inputId, selectedValue, dataValue) {
        let options = [];
        
        if (property === 'shape') {
            options = [
                'ellipse', 'rectangle', 'round-rectangle', 'triangle', 'diamond',
                'pentagon', 'hexagon', 'heptagon', 'octagon', 'star', 'vee', 'rhomboid'
            ];
        } else if (property === 'style') {
            options = ['solid', 'dotted', 'dashed'];
        } else if (property === 'targetArrow') {
            options = [
                'none', 'triangle', 'triangle-tee', 'circle-triangle', 'triangle-cross',
                'triangle-backcurve', 'vee', 'tee', 'square', 'circle', 'diamond', 'chevron'
            ];
        }
        
        let html = `<select class="discrete-input" id="${inputId}" data-value="${dataValue}">`;
        options.forEach(opt => {
            const selected = opt === selectedValue ? 'selected' : '';
            html += `<option value="${opt}" ${selected}>${opt.charAt(0).toUpperCase() + opt.slice(1).replace(/-/g, ' ')}</option>`;
        });
        html += '</select>';
        
        return html;
    }

    refreshAttributes() {
        if (!networkManager || !networkManager.cy) return;

        // ノード属性を収集
        const nodeAttrs = new Set();
        networkManager.cy.nodes().forEach(node => {
            Object.keys(node.data()).forEach(key => {
                if (key !== 'id') nodeAttrs.add(key);
            });
        });
        this.nodeAttributes = Array.from(nodeAttrs).sort();

        // エッジ属性を収集
        const edgeAttrs = new Set();
        networkManager.cy.edges().forEach(edge => {
            Object.keys(edge.data()).forEach(key => {
                if (!['id', 'source', 'target'].includes(key)) edgeAttrs.add(key);
            });
        });
        this.edgeAttributes = Array.from(edgeAttrs).sort();

        // 属性選択のドロップダウンを更新
        const nodeSelects = document.querySelectorAll('.style-attribute-select[data-element="node"]');
        const edgeSelects = document.querySelectorAll('.style-attribute-select[data-element="edge"]');
        
        nodeSelects.forEach(select => {
            this.updateAttributeOptions(select, 'node');
        });
        edgeSelects.forEach(select => {
            this.updateAttributeOptions(select, 'edge');
        });
    }

    switchTab(tab) {
        this.currentTab = tab;
        
        // タブボタンの状態を更新
        document.querySelectorAll('.style-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });
        
        // タブコンテンツの表示を更新
        document.getElementById('style-node-content').classList.toggle('active', tab === 'node');
        document.getElementById('style-edge-content').classList.toggle('active', tab === 'edge');
    }

    setupPanelDrag() {
        if (!this.panel) return;
        const header = this.panel.querySelector('.tools-panel-header');
        if (!header) return;

        header.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('tools-panel-close')) return;
            this.isDragging = true;
            const rect = this.panel.getBoundingClientRect();
            this.dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
            header.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            const x = e.clientX - this.dragOffset.x;
            const y = e.clientY - this.dragOffset.y;
            this.panel.style.left = `${x}px`;
            this.panel.style.top = `${y}px`;
            this.panel.style.right = 'auto';
        });

        document.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                const header = this.panel.querySelector('.tools-panel-header');
                if (header) header.style.cursor = 'grab';
            }
        });
    }

    openPanel() {
        if (!this.panel) return;
        
        // 他のパネルを閉じる
        if (typeof layoutTools !== 'undefined') layoutTools.closePanel();
        if (typeof edgeBends !== 'undefined') edgeBends.closePanel();
        if (typeof sortNodesPanel !== 'undefined') sortNodesPanel.closePanel();
        
        this.panel.classList.add('active');
        this.panel.style.top = '50px';
        this.panel.style.right = '10px';
        this.panel.style.left = 'auto';
        
        // 属性リストを更新
        this.refreshAttributes();
    }

    closePanel() {
        if (this.panel) this.panel.classList.remove('active');
    }

    resetStyles() {
        // ノードスタイルをデフォルトにリセット
        this.nodeStyles = {
            fillColor: { type: 'default', value: '#2563eb', mapping: null, attribute: null },
            shape: { type: 'default', value: 'ellipse', mapping: null, attribute: null },
            size: { type: 'default', value: 40, mapping: null, attribute: null },
            labelFontSize: { type: 'default', value: 10, mapping: null, attribute: null },
            labelColor: { type: 'default', value: '#000000', mapping: null, attribute: null },
            labelPosition: { type: 'default', value: 'top', mapping: null, attribute: null },
            labelWidth: { type: 'default', value: 80, mapping: null, attribute: null },
            borderWidth: { type: 'default', value: 0, mapping: null, attribute: null },
            borderColor: { type: 'default', value: '#000000', mapping: null, attribute: null },
            opacity: { type: 'default', value: 100, mapping: null, attribute: null }
        };
        
        // エッジスタイルをデフォルトにリセット
        this.edgeStyles = {
            lineColor: { type: 'default', value: '#94a3b8', mapping: null, attribute: null },
            width: { type: 'default', value: 2, mapping: null, attribute: null },
            style: { type: 'default', value: 'solid', mapping: null, attribute: null },
            targetArrow: { type: 'default', value: 'none', mapping: null, attribute: null },
            opacity: { type: 'default', value: 100, mapping: null, attribute: null },
            curveStyle: { type: 'default', value: 'bezier', mapping: null, attribute: null }
        };
        
        // UIをリセット
        this.resetUIControls();
        
        // スタイルを再適用
        if (networkManager && networkManager.cy && networkManager.cy.nodes().length > 0) {
            this.applyStyles();
        }
    }

    resetUIControls() {
        // Node Tab - デフォルト値に戻す
        const nodeFillColor = document.getElementById('node-fillColor');
        if (nodeFillColor) nodeFillColor.value = '#2563eb';
        
        const nodeShape = document.getElementById('node-shape');
        if (nodeShape) nodeShape.value = 'ellipse';
        
        const nodeSize = document.getElementById('node-size');
        const nodeSizeValue = document.getElementById('node-size-value');
        if (nodeSize) nodeSize.value = '40';
        if (nodeSizeValue) nodeSizeValue.value = '40';
        
        const nodeLabelFontSize = document.getElementById('node-labelFontSize');
        const nodeLabelFontSizeValue = document.getElementById('node-labelFontSize-value');
        if (nodeLabelFontSize) nodeLabelFontSize.value = '10';
        if (nodeLabelFontSizeValue) nodeLabelFontSizeValue.value = '10';
        
        const nodeLabelColor = document.getElementById('node-labelColor');
        if (nodeLabelColor) nodeLabelColor.value = '#000000';
        
        const nodeLabelPosition = document.getElementById('node-labelPosition');
        if (nodeLabelPosition) nodeLabelPosition.value = 'top';
        
        const nodeLabelWidth = document.getElementById('node-labelWidth');
        const nodeLabelWidthValue = document.getElementById('node-labelWidth-value');
        if (nodeLabelWidth) nodeLabelWidth.value = '80';
        if (nodeLabelWidthValue) nodeLabelWidthValue.value = '80';
        
        const nodeBorderWidth = document.getElementById('node-borderWidth');
        const nodeBorderWidthValue = document.getElementById('node-borderWidth-value');
        if (nodeBorderWidth) nodeBorderWidth.value = '0';
        if (nodeBorderWidthValue) nodeBorderWidthValue.value = '0';
        
        const nodeBorderColor = document.getElementById('node-borderColor');
        if (nodeBorderColor) nodeBorderColor.value = '#000000';
        
        const nodeOpacity = document.getElementById('node-opacity');
        const nodeOpacityValue = document.getElementById('node-opacity-value');
        if (nodeOpacity) nodeOpacity.value = '100';
        if (nodeOpacityValue) nodeOpacityValue.value = '100';
        
        // Edge Tab - デフォルト値に戻す
        const edgeLineColor = document.getElementById('edge-lineColor');
        if (edgeLineColor) edgeLineColor.value = '#94a3b8';
        
        const edgeWidth = document.getElementById('edge-width');
        const edgeWidthValue = document.getElementById('edge-width-value');
        if (edgeWidth) edgeWidth.value = '2';
        if (edgeWidthValue) edgeWidthValue.value = '2';
        
        const edgeStyle = document.getElementById('edge-style');
        if (edgeStyle) edgeStyle.value = 'solid';
        
        const edgeTargetArrow = document.getElementById('edge-targetArrow');
        if (edgeTargetArrow) edgeTargetArrow.value = 'none';
        
        const edgeOpacity = document.getElementById('edge-opacity');
        const edgeOpacityValue = document.getElementById('edge-opacity-value');
        if (edgeOpacity) edgeOpacity.value = '100';
        if (edgeOpacityValue) edgeOpacityValue.value = '100';
        
        const edgeCurveStyle = document.getElementById('edge-curveStyle');
        if (edgeCurveStyle) edgeCurveStyle.value = 'bezier';
        
        // すべてのマッピングタイプをDefaultに戻す
        document.querySelectorAll('.style-mapping-type').forEach(select => {
            select.value = 'default';
            const propertyGroup = select.closest('.style-property-group');
            if (propertyGroup) {
                const controlDiv = propertyGroup.querySelector('.style-property-control');
                if (controlDiv) {
                    const attrSelect = controlDiv.querySelector('.style-attribute-select');
                    const directInputs = Array.from(controlDiv.querySelectorAll('input, select')).filter(el => 
                        !el.classList.contains('style-attribute-select') && !el.classList.contains('style-mapping-type')
                    );
                    const rangeDiv = propertyGroup.querySelector('.style-continuous-range');
                    const discreteDiv = propertyGroup.querySelector('.style-discrete-mapping');
                    
                    // すべて非表示にしてからデフォルトモードに
                    directInputs.forEach(input => input.classList.remove('hidden'));
                    if (attrSelect) attrSelect.classList.add('hidden');
                    if (rangeDiv) rangeDiv.classList.add('hidden');
                    if (discreteDiv) discreteDiv.classList.add('hidden');
                }
            }
        });
        
        // すべての属性セレクトをリセット
        document.querySelectorAll('.style-attribute-select').forEach(select => {
            select.value = '';
        });
    }

    applyStyles() {
        this.applyNodeStyles();
        this.applyEdgeStyles();
    }

    applyNodeStyles() {
        if (!networkManager || !networkManager.cy) return;
        const nodes = networkManager.cy.nodes();
        if (nodes.length === 0) return;

        nodes.forEach(node => {
            const style = {};

            // Fill Color
            style['background-color'] = this.getStyleValue(node, 'fillColor', this.nodeStyles.fillColor);
            
            // Shape
            style['shape'] = this.getStyleValue(node, 'shape', this.nodeStyles.shape);
            
            // Size
            const size = this.getStyleValue(node, 'size', this.nodeStyles.size);
            style['width'] = size;
            style['height'] = size;
            
            // Label Font Size
            style['font-size'] = this.getStyleValue(node, 'labelFontSize', this.nodeStyles.labelFontSize) + 'px';
            
            // Label Color
            style['color'] = this.getStyleValue(node, 'labelColor', this.nodeStyles.labelColor);
            
            // Label Position
            const labelPos = this.nodeStyles.labelPosition.value;
            style['text-valign'] = labelPos;
            if (labelPos === 'center') {
                style['text-margin-y'] = 0;
            } else if (labelPos === 'top') {
                style['text-margin-y'] = -5;
            } else {
                style['text-margin-y'] = 5;
            }
            
            // Label Width
            style['text-max-width'] = this.nodeStyles.labelWidth.value + 'px';
            
            // Border Width
            style['border-width'] = this.getStyleValue(node, 'borderWidth', this.nodeStyles.borderWidth);
            
            // Border Color
            style['border-color'] = this.getStyleValue(node, 'borderColor', this.nodeStyles.borderColor);
            
            // Opacity
            style['opacity'] = this.getStyleValue(node, 'opacity', this.nodeStyles.opacity) / 100;

            node.style(style);
        });
        
        // 選択スタイルを再適用
        if (networkManager) {
            networkManager.updateSelectionStyles();
        }
    }

    applyEdgeStyles() {
        if (!networkManager || !networkManager.cy) return;
        const edges = networkManager.cy.edges();
        if (edges.length === 0) return;

        edges.forEach(edge => {
            const style = {};
            
            // Edge Bendsが設定されているかチェック
            const hasControlPoints = edge.style('control-point-distances') !== undefined && 
                                     edge.style('control-point-distances') !== 'undefined';

            // Line Color
            style['line-color'] = this.getStyleValue(edge, 'lineColor', this.edgeStyles.lineColor);
            style['target-arrow-color'] = style['line-color'];
            
            // Width
            style['width'] = this.getStyleValue(edge, 'width', this.edgeStyles.width);
            
            // Style (line-style)
            style['line-style'] = this.getStyleValue(edge, 'style', this.edgeStyles.style);
            
            // Target Arrow
            style['target-arrow-shape'] = this.getStyleValue(edge, 'targetArrow', this.edgeStyles.targetArrow);
            
            // Opacity
            style['opacity'] = this.getStyleValue(edge, 'opacity', this.edgeStyles.opacity) / 100;
            
            // Curve Style: Bendsが設定されている場合は上書きしない
            if (!hasControlPoints) {
                style['curve-style'] = this.edgeStyles.curveStyle.value;
            }

            edge.style(style);
        });
        
        // 複数エッジの配置を再計算して再描画
        if (networkManager.cy) {
            networkManager.cy.edges().updateStyle();
            networkManager.cy.style().update();
        }
        
        // 選択スタイルを再適用
        if (networkManager) {
            networkManager.updateSelectionStyles();
        }
    }

    getStyleValue(element, property, styleConfig) {
        const { type, value, attribute, mapping } = styleConfig;

        // Defaultモードまたは属性が選択されていない場合はデフォルト値を返す
        if (type === 'default' || !attribute) {
            return value;
        }

        const dataValue = element.data(attribute);
        if (dataValue === undefined || dataValue === null) {
            return value;
        }

        if (type === 'discrete') {
            // Discreteマッピング: マッピングテーブルから値を取得
            if (mapping && mapping[dataValue] !== undefined) {
                return mapping[dataValue];
            }
            return value; // デフォルト値
        }

        if (type === 'passthrough') {
            // パススルー: データ値をそのまま使用
            return dataValue;
        }

        if (type === 'continuous') {
            // 連続マッピング: 数値データを範囲にマップ
            return this.mapContinuousValue(element, property, styleConfig, dataValue);
        }

        return value;
    }

    mapContinuousValue(element, property, styleConfig, dataValue) {
        const numValue = parseFloat(dataValue);
        if (isNaN(numValue)) return styleConfig.value;

        // データの最小・最大値を取得
        const elements = element.isNode() ? networkManager.cy.nodes() : networkManager.cy.edges();
        const allValues = elements.map(el => parseFloat(el.data(styleConfig.attribute))).filter(v => !isNaN(v));
        
        if (allValues.length === 0) return styleConfig.value;
        
        const dataMin = Math.min(...allValues);
        const dataMax = Math.max(...allValues);
        
        if (dataMin === dataMax) return styleConfig.value;

        // 正規化 (0-1)
        const normalized = (numValue - dataMin) / (dataMax - dataMin);

        // プロパティに応じた範囲マッピング
        if (property === 'size') {
            const minSize = styleConfig.mapping?.min || parseInt(document.getElementById('node-size-min')?.value) || 20;
            const maxSize = styleConfig.mapping?.max || parseInt(document.getElementById('node-size-max')?.value) || 60;
            return minSize + normalized * (maxSize - minSize);
        } else if (property === 'width') {
            const minWidth = styleConfig.mapping?.min || parseFloat(document.getElementById('edge-width-min')?.value) || 0.5;
            const maxWidth = styleConfig.mapping?.max || parseFloat(document.getElementById('edge-width-max')?.value) || 5;
            return minWidth + normalized * (maxWidth - minWidth);
        } else if (property === 'opacity') {
            // Opacity: 20-100% (パーセント表示)
            return 20 + normalized * 80;
        } else if (property === 'labelFontSize') {
            // Label Font Size: 6-50 (デフォルト範囲)
            return 6 + normalized * 44;
        } else if (property === 'borderWidth') {
            // Border Width: 0-50 (デフォルト範囲)
            return normalized * 50;
        } else if (property === 'fillColor') {
            // Fill Colorのグラデーション
            const minColor = styleConfig.mapping?.min || document.getElementById('node-fillColor-min')?.value || '#2563eb';
            const maxColor = styleConfig.mapping?.max || document.getElementById('node-fillColor-max')?.value || '#dc2626';
            return this.interpolateColor(minColor, maxColor, normalized);
        } else if (property === 'labelColor') {
            // Label Colorのグラデーション
            const minColor = styleConfig.mapping?.min || document.getElementById('node-labelColor-min')?.value || '#000000';
            const maxColor = styleConfig.mapping?.max || document.getElementById('node-labelColor-max')?.value || '#dc2626';
            return this.interpolateColor(minColor, maxColor, normalized);
        } else if (property === 'borderColor') {
            // Border Colorのグラデーション
            const minColor = styleConfig.mapping?.min || document.getElementById('node-borderColor-min')?.value || '#000000';
            const maxColor = styleConfig.mapping?.max || document.getElementById('node-borderColor-max')?.value || '#dc2626';
            return this.interpolateColor(minColor, maxColor, normalized);
        } else if (property === 'lineColor') {
            // Line Colorのグラデーション
            const minColor = styleConfig.mapping?.min || document.getElementById('edge-lineColor-min')?.value || '#94a3b8';
            const maxColor = styleConfig.mapping?.max || document.getElementById('edge-lineColor-max')?.value || '#dc2626';
            return this.interpolateColor(minColor, maxColor, normalized);
        }

        return styleConfig.value;
    }

    interpolateColor(color1, color2, factor) {
        // hex to rgb
        const hex2rgb = (hex) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : null;
        };

        const rgb1 = hex2rgb(color1);
        const rgb2 = hex2rgb(color2);

        if (!rgb1 || !rgb2) return color1;

        const r = Math.round(rgb1.r + factor * (rgb2.r - rgb1.r));
        const g = Math.round(rgb1.g + factor * (rgb2.g - rgb1.g));
        const b = Math.round(rgb1.b + factor * (rgb2.b - rgb1.b));

        return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    }

    // スタイル設定をデフォルトにリセット
    resetToDefault() {
        console.log('Resetting styles to default');
        
        // ノードスタイルをデフォルトにリセット
        this.nodeStyles = {
            fillColor: { type: 'default', value: '#2563eb', mapping: null, attribute: null },
            shape: { type: 'default', value: 'ellipse', mapping: null, attribute: null },
            size: { type: 'default', value: 40, mapping: null, attribute: null },
            labelFontSize: { type: 'default', value: 10, mapping: null, attribute: null },
            labelColor: { type: 'default', value: '#000000', mapping: null, attribute: null },
            labelPosition: { type: 'default', value: 'top', mapping: null, attribute: null },
            labelWidth: { type: 'default', value: 80, mapping: null, attribute: null },
            borderWidth: { type: 'default', value: 0, mapping: null, attribute: null },
            borderColor: { type: 'default', value: '#000000', mapping: null, attribute: null },
            opacity: { type: 'default', value: 100, mapping: null, attribute: null }
        };
        
        // エッジスタイルをデフォルトにリセット
        this.edgeStyles = {
            lineColor: { type: 'default', value: '#94a3b8', mapping: null, attribute: null },
            width: { type: 'default', value: 2, mapping: null, attribute: null },
            style: { type: 'default', value: 'solid', mapping: null, attribute: null },
            targetArrow: { type: 'default', value: 'none', mapping: null, attribute: null },
            opacity: { type: 'default', value: 100, mapping: null, attribute: null },
            curveStyle: { type: 'default', value: 'bezier', mapping: null, attribute: null }
        };
    }

    // 外部からスタイルを適用（ネットワーク読み込み時など）
    reapplyStyles() {
        console.log('reapplyStyles called with nodeStyles:', this.nodeStyles, 'edgeStyles:', this.edgeStyles);
        this.refreshAttributes();
        this.updateUIFromStyles(); // UIコントロールを更新
        this.applyStyles();
    }

    // スタイル設定からUIコントロールを更新
    updateUIFromStyles() {
        // Node Stylesを更新
        Object.entries(this.nodeStyles).forEach(([property, config]) => {
            this.updateUIControl('node', property, config);
        });

        // Edge Stylesを更新
        Object.entries(this.edgeStyles).forEach(([property, config]) => {
            this.updateUIControl('edge', property, config);
        });
    }

    // 個別のUIコントロールを更新
    updateUIControl(elementType, property, config) {
        const { type, value, attribute, mapping } = config;
        
        console.log(`updateUIControl: ${elementType}-${property}, type=${type}, value=${value}, attribute=${attribute}, mapping=`, mapping);
        
        // マッピングタイプのセレクトボックスを更新
        const mappingSelect = document.querySelector(`.style-mapping-type[data-property="${property}"][data-element="${elementType}"]`);
        if (mappingSelect) {
            if (mappingSelect.value !== type) {
                console.log(`  Updating mapping type from ${mappingSelect.value} to ${type}`);
                mappingSelect.value = type;
            }
        } else {
            console.log(`  Mapping select not found for ${elementType}-${property}`);
        }

        // プロパティに応じた入力フィールドを更新
        if (property === 'fillColor' || property === 'labelColor' || property === 'borderColor' || property === 'lineColor') {
            // カラー入力
            const colorInput = document.getElementById(`${elementType}-${property}`);
            console.log(`  Color input found: ${!!colorInput}, current value: ${colorInput?.value}, new value: ${value}`);
            if (colorInput && colorInput.value !== value) {
                console.log(`  Updating color from ${colorInput.value} to ${value}`);
                colorInput.value = value;
            }
            
            // Continuousマッピングの場合、min/maxカラーを更新
            if (type === 'continuous' && mapping) {
                const minInput = document.getElementById(`${elementType}-${property}-min`);
                const maxInput = document.getElementById(`${elementType}-${property}-max`);
                if (minInput && mapping.min !== undefined) {
                    console.log(`  Updating min color to ${mapping.min}`);
                    minInput.value = mapping.min;
                }
                if (maxInput && mapping.max !== undefined) {
                    console.log(`  Updating max color to ${mapping.max}`);
                    maxInput.value = mapping.max;
                }
            }
        } else if (property === 'size' || property === 'labelFontSize' || property === 'labelWidth' || 
                   property === 'borderWidth' || property === 'opacity' || property === 'width') {
            // 数値入力
            const numberInput = document.getElementById(`${elementType}-${property}`);
            if (numberInput && numberInput.value != value) {
                numberInput.value = value;
            }
            
            // Continuousマッピングの場合、min/max値を更新
            if (type === 'continuous' && mapping) {
                const minInput = document.getElementById(`${elementType}-${property}-min`);
                const maxInput = document.getElementById(`${elementType}-${property}-max`);
                if (minInput && mapping.min !== undefined) {
                    console.log(`  Updating min value to ${mapping.min}`);
                    minInput.value = mapping.min;
                }
                if (maxInput && mapping.max !== undefined) {
                    console.log(`  Updating max value to ${mapping.max}`);
                    maxInput.value = mapping.max;
                }
            }
        } else if (property === 'shape' || property === 'labelPosition' || property === 'style' || 
                   property === 'targetArrow' || property === 'curveStyle') {
            // セレクトボックス
            const selectInput = document.getElementById(`${elementType}-${property}`);
            if (selectInput && selectInput.value !== value) {
                selectInput.value = value;
            }
        }

        // 属性セレクトを更新
        const attrSelect = document.getElementById(`${elementType}-${property}-attr`);
        if (attrSelect && attribute) {
            console.log(`  Updating attribute select to ${attribute}`);
            attrSelect.value = attribute;
        }

        // マッピングタイプに応じた表示/非表示を更新
        const propertyGroup = mappingSelect?.closest('.style-property-group');
        if (propertyGroup) {
            const colorInput = propertyGroup.querySelector('.style-color-input, .style-number-input, .style-select-input');
            const attrSelectElement = propertyGroup.querySelector('.style-attribute-select');
            const discreteDiv = propertyGroup.querySelector('.style-discrete-mapping');
            const rangeDiv = propertyGroup.querySelector('.style-continuous-range, .style-color-range');

            if (type === 'default') {
                if (colorInput) colorInput.classList.remove('hidden');
                if (attrSelectElement) attrSelectElement.classList.add('hidden');
                if (discreteDiv) discreteDiv.classList.add('hidden');
                if (rangeDiv) rangeDiv.classList.add('hidden');
            } else if (type === 'discrete') {
                if (colorInput) colorInput.classList.add('hidden');
                if (attrSelectElement) attrSelectElement.classList.remove('hidden');
                if (discreteDiv && attribute) {
                    console.log(`  Building discrete mapping table for ${attribute}`);
                    this.buildDiscreteMappingTable(discreteDiv, property, elementType, attribute);
                    discreteDiv.classList.remove('hidden');
                }
                if (rangeDiv) rangeDiv.classList.add('hidden');
            } else if (type === 'passthrough') {
                if (colorInput) colorInput.classList.add('hidden');
                if (attrSelectElement) attrSelectElement.classList.remove('hidden');
                if (discreteDiv) discreteDiv.classList.add('hidden');
                if (rangeDiv) rangeDiv.classList.add('hidden');
            } else if (type === 'continuous') {
                if (colorInput) colorInput.classList.add('hidden');
                if (attrSelectElement) attrSelectElement.classList.remove('hidden');
                if (discreteDiv) discreteDiv.classList.add('hidden');
                if (rangeDiv) rangeDiv.classList.remove('hidden');
                console.log(`  Continuous mapping UI updated, range div visible`);
            }
        }
    }
}

// グローバルインスタンス
let stylePanel;

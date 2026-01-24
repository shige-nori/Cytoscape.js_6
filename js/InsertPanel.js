import { appContext } from './AppContext.js';

/**
 * InsertPanel - 図形・画像のプロパティ編集パネル
 */
export class InsertPanel {
    constructor() {
        this.panel = null;
        this.isInitialized = false;
        this.currentObject = null;
    }

    /**
     * 初期化
     */
    initialize() {
        if (this.isInitialized) return;
        this.createPanel();
        this.isInitialized = true;
    }

    /**
     * パネルHTMLを作成
     */
    createPanel() {
        const panelHTML = `
            <div class="insert-panel" id="insert-panel">
                <div class="tools-panel-header">
                    <h3>Properties</h3>
                    <button class="tools-panel-close" id="insert-panel-close-btn">&times;</button>
                </div>
                <div class="insert-panel-body">
                    <div class="insert-no-selection">
                        <p>Select an object to edit its properties</p>
                    </div>
                    <div class="insert-properties" style="display: none;">
                        <!-- Position -->
                        <div class="property-group">
                            <h4>Position</h4>
                            <div class="property-row">
                                <label>X:</label>
                                <input type="number" id="prop-x" class="property-input">
                            </div>
                            <div class="property-row">
                                <label>Y:</label>
                                <input type="number" id="prop-y" class="property-input">
                            </div>
                        </div>
                        
                        <!-- Size -->
                        <div class="property-group size-group">
                            <h4>Size</h4>
                            <div class="property-row">
                                <label>Width:</label>
                                <input type="number" id="prop-width" class="property-input" min="1">
                            </div>
                            <div class="property-row">
                                <label>Height:</label>
                                <input type="number" id="prop-height" class="property-input" min="1">
                            </div>
                        </div>
                        
                        <!-- Appearance -->
                        <div class="property-group appearance-group">
                            <h4>Appearance</h4>
                            <div class="property-row">
                                <label>Fill:</label>
                                <input type="color" id="prop-fill-color" class="property-color">
                            </div>
                            <div class="property-row">
                                <label>Stroke:</label>
                                <input type="color" id="prop-stroke-color" class="property-color">
                            </div>
                            <div class="property-row">
                                <label>Stroke Width:</label>
                                <input type="number" id="prop-stroke-width" class="property-input" min="0" max="20" step="1">
                            </div>
                            <div class="property-row">
                                <label>Opacity:</label>
                                <input type="range" id="prop-opacity" class="property-slider" min="0" max="1" step="0.1">
                                <span id="prop-opacity-value">1</span>
                            </div>
                            <div class="property-row">
                                <label>Rotation:</label>
                                <input type="number" id="prop-rotation" class="property-input" min="-180" max="180">°
                            </div>
                        </div>
                        
                        <!-- Text Properties -->
                        <div class="property-group text-group" style="display: none;">
                            <h4>Text</h4>
                            <div class="property-row">
                                <label>Content:</label>
                                <textarea id="prop-text" class="property-textarea" rows="3"></textarea>
                            </div>
                            <div class="property-row">
                                <label>Font Size:</label>
                                <input type="number" id="prop-font-size" class="property-input" min="8" max="72">
                            </div>
                            <div class="property-row">
                                <label>Color:</label>
                                <input type="color" id="prop-text-color" class="property-color">
                            </div>
                        </div>
                        
                        <!-- Name -->
                        <div class="property-group">
                            <h4>Layer</h4>
                            <div class="property-row">
                                <label>Name:</label>
                                <input type="text" id="prop-name" class="property-input property-name-input">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', panelHTML);
        this.panel = document.getElementById('insert-panel');
        this.setupEventListeners();
    }

    /**
     * イベントリスナーをセットアップ
     */
    setupEventListeners() {
        // 閉じるボタン
        document.getElementById('insert-panel-close-btn')?.addEventListener('click', () => {
            this.closePanel();
        });

        // プロパティ変更イベント
        const propInputs = {
            'prop-x': 'x',
            'prop-y': 'y',
            'prop-width': 'width',
            'prop-height': 'height',
            'prop-fill-color': 'fillColor',
            'prop-stroke-color': 'strokeColor',
            'prop-stroke-width': 'strokeWidth',
            'prop-opacity': 'opacity',
            'prop-rotation': 'rotation',
            'prop-text': 'text',
            'prop-font-size': 'fontSize',
            'prop-text-color': 'textColor',
            'prop-name': 'name'
        };

        Object.entries(propInputs).forEach(([inputId, property]) => {
            const input = document.getElementById(inputId);
            if (!input) return;

            const eventType = input.type === 'color' || input.type === 'range' ? 'input' : 'change';
            
            input.addEventListener(eventType, () => {
                if (!this.currentObject) return;
                
                let value = input.value;
                
                // 数値型への変換
                if (['x', 'y', 'width', 'height', 'strokeWidth', 'rotation', 'fontSize'].includes(property)) {
                    value = parseFloat(value) || 0;
                } else if (property === 'opacity') {
                    value = parseFloat(value);
                    document.getElementById('prop-opacity-value').textContent = value.toFixed(1);
                }
                
                appContext.layerManager?.updateObjectProperty(this.currentObject.id, property, value);
                
                // 名前が変更された場合はレイヤーパネルを更新
                if (property === 'name') {
                    appContext.layersPanel?.refresh();
                }
            });
        });
    }

    /**
     * パネルを開く
     */
    openPanel() {
        if (!this.panel) this.initialize();
        this.panel.classList.add('active');
    }

    /**
     * パネルを閉じる
     */
    closePanel() {
        if (this.panel) {
            this.panel.classList.remove('active');
        }
    }

    /**
     * プロパティを更新
     */
    updateProperties(obj) {
        this.currentObject = obj;
        
        const noSelection = this.panel?.querySelector('.insert-no-selection');
        const properties = this.panel?.querySelector('.insert-properties');
        
        if (!obj) {
            if (noSelection) noSelection.style.display = 'block';
            if (properties) properties.style.display = 'none';
            return;
        }
        
        if (noSelection) noSelection.style.display = 'none';
        if (properties) properties.style.display = 'block';
        
        // 値を設定
        this.setInputValue('prop-x', Math.round(obj.x));
        this.setInputValue('prop-y', Math.round(obj.y));
        this.setInputValue('prop-width', Math.round(obj.width));
        this.setInputValue('prop-height', Math.round(obj.height));
        this.setInputValue('prop-fill-color', obj.fillColor);
        this.setInputValue('prop-stroke-color', obj.strokeColor);
        this.setInputValue('prop-stroke-width', obj.strokeWidth);
        this.setInputValue('prop-opacity', obj.opacity);
        this.setInputValue('prop-rotation', obj.rotation);
        this.setInputValue('prop-name', obj.name);
        
        document.getElementById('prop-opacity-value').textContent = obj.opacity.toFixed(1);
        
        // タイプに応じた表示制御
        const sizeGroup = this.panel?.querySelector('.size-group');
        const appearanceGroup = this.panel?.querySelector('.appearance-group');
        const textGroup = this.panel?.querySelector('.text-group');
        
        // ライン/矢印はサイズグループを非表示
        if (sizeGroup) {
            sizeGroup.style.display = (obj.type === 'line' || obj.type === 'arrow') ? 'none' : 'block';
        }
        
        // テキストグループ
        if (textGroup) {
            if (obj.type === 'text') {
                textGroup.style.display = 'block';
                this.setInputValue('prop-text', obj.text);
                this.setInputValue('prop-font-size', obj.fontSize);
                this.setInputValue('prop-text-color', obj.textColor);
            } else {
                textGroup.style.display = 'none';
            }
        }
        
        // 画像はfill/strokeを非表示
        if (appearanceGroup) {
            const fillRow = appearanceGroup.querySelector('[id="prop-fill-color"]')?.closest('.property-row');
            if (fillRow) {
                fillRow.style.display = obj.type === 'image' ? 'none' : 'flex';
            }
        }
    }

    /**
     * 入力値を設定
     */
    setInputValue(id, value) {
        const input = document.getElementById(id);
        if (input) {
            input.value = value;
        }
    }
}

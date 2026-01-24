import { appContext } from './AppContext.js';

/**
 * AnnotationPanel - Appearance（プロパティ）とLayers（レイヤー一覧）を統合したパネル
 */
export class AnnotationPanel {
    constructor() {
        this.panel = null;
        this.isInitialized = false;
        this.currentTab = 'appearance'; // 'appearance' or 'layers'
        this.currentObject = null;
    }

    /**
     * 初期化
     */
    initialize() {
        if (this.isInitialized) return;
        this.createPanel();
        this.makeDraggable();
        this.isInitialized = true;
    }

    /**
     * Appearanceタブの図形追加ボタン
     */
    setupInsertButtons() {
        const buttons = this.panel.querySelectorAll('.annotation-insert-btn');
        buttons.forEach(button => {
            button.addEventListener('click', () => {
                if (!appContext.networkManager.hasNetwork() || !appContext.layerManager) return;

                const shape = button.dataset.shape;
                if (!shape) return;

                appContext.layerManager.addObject(shape);
                this.openPanel();
            });
        });
    }

    /**
     * パネルHTMLを作成
     */
    createPanel() {
        const panelHTML = `
            <div class="annotation-panel" id="annotation-panel">
                <div class="tools-panel-header">
                    <h3>Annotation</h3>
                    <button class="tools-panel-close" id="annotation-panel-close-btn">&times;</button>
                </div>
                
                <!-- タブヘッダー -->
                <div class="annotation-tabs">
                    <div class="annotation-tab active" data-tab="appearance">Appearance</div>
                    <div class="annotation-tab" data-tab="layers">Layers</div>
                </div>
                
                <div class="annotation-panel-body">
                    <!-- Appearanceタブ内容 -->
                    <div class="annotation-tab-content active" id="appearance-tab">
                        <div class="annotation-insert-toolbar" role="group" aria-label="Insert shapes">
                            <button class="annotation-insert-btn" type="button" data-shape="rectangle" title="Rectangle" aria-label="Rectangle">
                                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5">
                                    <rect x="3" y="4" width="12" height="10" rx="1" />
                                </svg>
                            </button>
                            <button class="annotation-insert-btn" type="button" data-shape="ellipse" title="Ellipse" aria-label="Ellipse">
                                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5">
                                    <ellipse cx="9" cy="9" rx="6" ry="4" />
                                </svg>
                            </button>
                            <button class="annotation-insert-btn" type="button" data-shape="line" title="Diagram" aria-label="Diagram">
                                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M3 13L8 8l3 3 4-4" />
                                    <circle cx="3" cy="13" r="1.5" fill="currentColor" />
                                    <circle cx="8" cy="8" r="1.5" fill="currentColor" />
                                    <circle cx="11" cy="11" r="1.5" fill="currentColor" />
                                    <circle cx="15" cy="7" r="1.5" fill="currentColor" />
                                </svg>
                            </button>
                        </div>
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
                                    <button type="button" id="prop-fill-transparent" class="property-transparent-btn" title="No Fill">No Fill</button>
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
                    
                    <!-- Layersタブ内容 -->
                    <div class="annotation-tab-content" id="layers-tab">
                        <div class="layers-toolbar">
                            <button class="layers-toolbar-btn" id="layer-bring-front" title="Bring to Front">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M3 11h10V9H3v2zm0-4h10V5H3v2zm5-5l4 4H4l4-4z"/>
                                </svg>
                            </button>
                            <button class="layers-toolbar-btn" id="layer-send-back" title="Send to Back">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M3 5h10v2H3V5zm0 4h10v2H3V9zm5 5l-4-4h8l-4 4z"/>
                                </svg>
                            </button>
                            <button class="layers-toolbar-btn" id="layer-delete" title="Delete">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/>
                                    <path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1z"/>
                                </svg>
                            </button>
                            <span class="layers-toolbar-separator"></span>
                            <button class="layers-toolbar-btn" id="layer-lock" title="Lock/Unlock">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M8 1a2 2 0 00-2 2v4H5a2 2 0 00-2 2v3a2 2 0 002 2h6a2 2 0 002-2V9a2 2 0 00-2-2H6V3a2 2 0 012-2h.01a2 2 0 012 2v1h1V3a3 3 0 00-3-3z"/>
                                </svg>
                            </button>
                        </div>
                        <div class="layers-list" id="layers-list">
                            <div class="layers-empty">No layers</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', panelHTML);
        this.panel = document.getElementById('annotation-panel');
        this.setupEventListeners();
        this.setupInsertButtons();
    }

    /**
     * イベントリスナーをセットアップ
     */
    setupEventListeners() {
        // 閉じるボタン
        document.getElementById('annotation-panel-close-btn')?.addEventListener('click', () => {
            this.closePanel();
        });

        // タブ切り替え
        document.querySelectorAll('.annotation-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // Appearanceタブのプロパティ変更
        this.setupAppearanceEvents();
        
        // Layersタブのツールバー
        this.setupLayersEvents();
    }

    /**
     * Appearanceタブのイベント設定
     */
    setupAppearanceEvents() {
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
                
                if (['x', 'y', 'width', 'height', 'strokeWidth', 'rotation', 'fontSize'].includes(property)) {
                    value = parseFloat(value) || 0;
                } else if (property === 'opacity') {
                    value = parseFloat(value);
                    document.getElementById('prop-opacity-value').textContent = value.toFixed(1);
                }
                
                appContext.layerManager?.updateObjectProperty(this.currentObject.id, property, value);

                if (property === 'fillColor') {
                    this.setTransparentState(false);
                }
                
                if (property === 'name') {
                    this.refreshLayers();
                }
            });
        });

        const transparentBtn = document.getElementById('prop-fill-transparent');
        transparentBtn?.addEventListener('click', () => {
            if (!this.currentObject) return;
            appContext.layerManager?.updateObjectProperty(this.currentObject.id, 'fillColor', 'transparent');
            this.setTransparentState(true);
        });
    }

    /**
     * Layersタブのイベント設定
     */
    setupLayersEvents() {
        document.getElementById('layer-bring-front')?.addEventListener('click', () => {
            const selected = appContext.layerManager?.selectedLayer;
            if (selected) {
                appContext.layerManager.bringToFront(selected.id);
            }
        });

        document.getElementById('layer-send-back')?.addEventListener('click', () => {
            const selected = appContext.layerManager?.selectedLayer;
            if (selected) {
                appContext.layerManager.sendToBack(selected.id);
            }
        });

        document.getElementById('layer-delete')?.addEventListener('click', () => {
            const selected = appContext.layerManager?.selectedLayer;
            if (selected) {
                appContext.layerManager.removeObject(selected.id);
            }
        });

        document.getElementById('layer-lock')?.addEventListener('click', () => {
            const selected = appContext.layerManager?.selectedLayer;
            if (selected) {
                selected.locked = !selected.locked;
                appContext.layerManager.renderObject(selected);
                this.refreshLayers();
            }
        });
    }

    /**
     * タブを切り替え
     */
    switchTab(tabName) {
        this.currentTab = tabName;
        
        // タブボタンの状態更新
        document.querySelectorAll('.annotation-tab').forEach(tab => {
            if (tab.dataset.tab === tabName) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
        
        // タブコンテンツの表示切り替え
        document.querySelectorAll('.annotation-tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        const activeContent = document.getElementById(`${tabName}-tab`);
        if (activeContent) {
            activeContent.classList.add('active');
        }
        
        // Layersタブに切り替えたら最新状態を反映
        if (tabName === 'layers') {
            this.refreshLayers();
        }
    }

    /**
     * パネルを開く
     */
    openPanel() {
        if (!this.panel) this.initialize();
        this.panel.classList.add('active');
        
        // 開いたときに適切なタブを表示
        if (this.currentTab === 'layers') {
            this.refreshLayers();
        }
    }

    /**
     * パネルをドラッグ可能にする
     */
    makeDraggable() {
        const header = this.panel.querySelector('.tools-panel-header');
        let isDragging = false;
        let startX, startY, startLeft, startTop;

        header.style.cursor = 'move';

        header.addEventListener('mousedown', (e) => {
            // 閉じるボタンをクリックした場合はドラッグしない
            if (e.target.closest('.tools-panel-close')) return;

            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            
            const rect = this.panel.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;

            // fixed positionに変更し、現在の位置を設定
            this.panel.style.left = startLeft + 'px';
            this.panel.style.top = startTop + 'px';
            this.panel.style.right = 'auto';

            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            let newLeft = startLeft + dx;
            let newTop = startTop + dy;

            // 画面外に出ないように制限
            const panelRect = this.panel.getBoundingClientRect();
            newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - panelRect.width));
            newTop = Math.max(0, Math.min(newTop, window.innerHeight - panelRect.height));

            this.panel.style.left = newLeft + 'px';
            this.panel.style.top = newTop + 'px';
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
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
     * パネルのトグル
     */
    togglePanel() {
        if (this.panel?.classList.contains('active')) {
            this.closePanel();
        } else {
            this.openPanel();
        }
    }

    /**
     * Appearanceタブのプロパティを更新
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
        const isTransparent = obj.fillColor === 'transparent';
        this.setInputValue('prop-fill-color', isTransparent ? '#ffffff' : obj.fillColor);
        this.setTransparentState(isTransparent);
        this.setInputValue('prop-stroke-color', obj.strokeColor);
        this.setInputValue('prop-stroke-width', obj.strokeWidth);
        this.setInputValue('prop-opacity', obj.opacity);
        this.setInputValue('prop-rotation', obj.rotation);
        this.setInputValue('prop-name', obj.name);
        
        const opacityValue = document.getElementById('prop-opacity-value');
        if (opacityValue) opacityValue.textContent = obj.opacity.toFixed(1);
        
        // タイプに応じた表示制御
        const sizeGroup = this.panel?.querySelector('.size-group');
        const appearanceGroup = this.panel?.querySelector('.appearance-group');
        const textGroup = this.panel?.querySelector('.text-group');
        
        if (sizeGroup) {
            sizeGroup.style.display = (obj.type === 'line' || obj.type === 'arrow') ? 'none' : 'block';
        }
        
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
        
        if (appearanceGroup) {
            const fillRow = appearanceGroup.querySelector('[id="prop-fill-color"]')?.closest('.property-row');
            if (fillRow) {
                fillRow.style.display = obj.type === 'image' ? 'none' : 'flex';
            }
        }
    }

    /**
     * 塗りつぶし透明ボタンの状態を更新
     */
    setTransparentState(isTransparent) {
        const btn = document.getElementById('prop-fill-transparent');
        if (!btn) return;
        btn.classList.toggle('active', isTransparent);
    }

    /**
     * Layersタブを更新
     */
    refreshLayers() {
        const listContainer = document.getElementById('layers-list');
        if (!listContainer) return;

        const layers = appContext.layerManager?.layers || [];
        
        if (layers.length === 0) {
            listContainer.innerHTML = '<div class="layers-empty">No layers</div>';
            return;
        }

        const sortedLayers = [...layers].reverse();
        
        listContainer.innerHTML = sortedLayers.map(layer => {
            const plane = layer.plane ?? 'foreground';
            const planeLabel = plane === 'background' ? 'BG' : 'FG';
            const planeTitle = plane === 'background' ? 'Background Layer' : 'Foreground Layer';
            return `
            <div class="layer-item ${layer.id === appContext.layerManager?.selectedLayer?.id ? 'selected' : ''} ${layer.locked ? 'locked' : ''}" 
                 data-layer-id="${layer.id}">
                <button class="layer-visibility-btn ${layer.visible ? 'visible' : ''}" 
                        data-layer-id="${layer.id}" title="Toggle Visibility">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        ${layer.visible ? 
                            '<path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 011.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0114.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 011.172 8z"/><path d="M8 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM4.5 8a3.5 3.5 0 117 0 3.5 3.5 0 01-7 0z"/>' :
                            '<path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 00-2.79.588l.77.771A5.944 5.944 0 018 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0114.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/><path d="M11.297 9.176a3.5 3.5 0 00-4.474-4.474l.823.823a2.5 2.5 0 012.829 2.829l.822.822zm-2.943 1.299l.822.822a3.5 3.5 0 01-4.474-4.474l.823.823a2.5 2.5 0 002.829 2.829z"/><path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 001.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 018 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884l-12-12 .708-.708 12 12-.708.708z"/>'
                        }
                    </svg>
                </button>
                <span class="layer-icon">${this.getLayerIcon(layer.type)}</span>
                <span class="layer-name">${this.escapeHtml(layer.name)}</span>
                <button class="layer-plane-btn" data-layer-id="${layer.id}" data-plane="${plane}" title="${planeTitle}">${planeLabel}</button>
                ${layer.locked ? '<span class="layer-lock-icon">🔒</span>' : ''}
            </div>
        `;
        }).join('');

        // イベントを設定
        listContainer.querySelectorAll('.layer-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.layer-visibility-btn')) return;
                const layerId = item.dataset.layerId;
                const layer = appContext.layerManager?.layers.find(l => l.id === layerId);
                if (layer) {
                    appContext.layerManager.selectObject(layer);
                    this.refreshLayers();
                }
            });
        });

        listContainer.querySelectorAll('.layer-visibility-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const layerId = btn.dataset.layerId;
                const layer = appContext.layerManager?.layers.find(l => l.id === layerId);
                if (layer) {
                    layer.visible = !layer.visible;
                    appContext.layerManager.renderObject(layer);
                    this.refreshLayers();
                }
            });
        });

        listContainer.querySelectorAll('.layer-plane-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const layerId = btn.dataset.layerId;
                const layer = appContext.layerManager?.layers.find(l => l.id === layerId);
                if (layer) {
                    const nextPlane = (layer.plane ?? 'foreground') === 'foreground' ? 'background' : 'foreground';
                    appContext.layerManager.setLayerPlane(layer.id, nextPlane);
                    this.refreshLayers();
                }
            });
        });
    }

    /**
     * レイヤー選択状態を更新
     */
    updateSelection(selectedLayer) {
        // Appearanceタブを更新
        this.updateProperties(selectedLayer);
        
        // Layersタブを更新
        if (this.currentTab === 'layers') {
            const items = document.querySelectorAll('.layer-item');
            items.forEach(item => {
                if (item.dataset.layerId === selectedLayer?.id) {
                    item.classList.add('selected');
                } else {
                    item.classList.remove('selected');
                }
            });
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

    /**
     * レイヤータイプアイコン取得
     */
    getLayerIcon(type) {
        const icons = {
            rectangle: '▢',
            ellipse: '○',
            line: '─',
            arrow: '→',
            text: 'T',
            image: '🖼'
        };
        return icons[type] || '?';
    }

    /**
     * HTMLエスケープ
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

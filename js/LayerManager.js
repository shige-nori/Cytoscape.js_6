import { appContext } from './AppContext.js';

/**
 * LayerManager - オーバーレイオブジェクト（図形・画像・テキスト）を管理するクラス
 * Cytoscape.jsとは別レイヤーでDOM/SVG要素を管理し、pan/zoomと同期させる
 */
export class LayerManager {
    constructor() {
        this.layers = [];           // 全オーバーレイオブジェクト配列
        this.selectedLayer = null;  // 現在選択中のオブジェクト
        this.nextId = 1;            // 次のID
        this.frontContainer = null; // overlay-container要素（前景）
        this.backContainer = null;  // overlay-container-back要素（背景）
        this.isInitialized = false;
        this.hasCyTapListener = false;
        
        // ドラッグ状態
        this.isDragging = false;
        this.dragTarget = null;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragStartObjX = 0;
        this.dragStartObjY = 0;
        
        // リサイズ状態
        this.isResizing = false;
        this.resizeHandle = null;
        this.resizeStartX = 0;
        this.resizeStartY = 0;
        this.resizeStartWidth = 0;
        this.resizeStartHeight = 0;
    }

    /**
     * 初期化
     */
    initialize() {
        if (this.isInitialized) return;
        
        this.frontContainer = document.getElementById('overlay-container');
        this.backContainer = document.getElementById('overlay-container-back');
        if (!this.frontContainer || !this.backContainer) {
            console.error('overlay-container not found');
            return;
        }
        
        this.setupEventListeners();
        this.isInitialized = true;
    }

    /**
     * イベントリスナーをセットアップ
     */
    setupEventListeners() {
        // コンテナクリックで選択解除
        this.getContainers().forEach(container => {
            container.addEventListener('click', (e) => {
                if (e.target === container) {
                    this.deselectAll();
                }
            });

            // ドラッグ処理
            container.addEventListener('mousedown', (e) => this.onMouseDown(e));
        });
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        document.addEventListener('mouseup', (e) => this.onMouseUp(e));
        
        // キーボード操作
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        
        // Cytoscape pan/zoom同期
        this.syncWithCytoscape();
    }

    /**
     * すべてのオーバーレイコンテナを取得
     */
    getContainers() {
        return [this.frontContainer, this.backContainer].filter(Boolean);
    }

    /**
     * レイヤーの表示面に応じたコンテナを取得
     */
    getContainerForLayer(layer) {
        return (layer.plane === 'background') ? this.backContainer : this.frontContainer;
    }

    /**
     * Cytoscapeのpan/zoomと同期
     */
    syncWithCytoscape() {
        if (!appContext.networkManager || !appContext.networkManager.cy) {
            // Cytoscapeが初期化されるまで待機
            setTimeout(() => this.syncWithCytoscape(), 100);
            return;
        }
        
        const cy = appContext.networkManager.cy;

        if (!this.hasCyTapListener) {
            cy.on('tap', (event) => {
                if (event.target === cy) {
                    this.deselectAll();
                }
            });
            this.hasCyTapListener = true;
        }
        
        const updateTransform = () => {
            if (!this.frontContainer || !this.backContainer) return;
            const pan = cy.pan();
            const zoom = cy.zoom();
            [this.frontContainer, this.backContainer].forEach(container => {
                container.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
                container.style.transformOrigin = '0 0';
            });
        };
        
        cy.on('pan zoom', updateTransform);
        updateTransform();
    }

    /**
     * オーバーレイオブジェクトを追加
     * @param {string} type - 'rectangle', 'ellipse', 'line', 'arrow', 'text', 'image'
     * @param {Object} options - オブジェクト設定
     * @returns {Object} 作成されたオブジェクト
     */
    addObject(type, options = {}) {
        const id = `overlay-${this.nextId++}`;
        
        // デフォルト位置（画面中央のワールド座標）
        const cy = appContext.networkManager?.cy;
        let defaultX = 0, defaultY = 0;
        if (cy) {
            const extent = cy.extent();
            defaultX = (extent.x1 + extent.x2) / 2;
            defaultY = (extent.y1 + extent.y2) / 2;
        }
        
        const obj = {
            id,
            type,
            x: options.x ?? defaultX,
            y: options.y ?? defaultY,
            width: options.width ?? 100,
            height: options.height ?? 80,
            rotation: options.rotation ?? 0,
            visible: options.visible ?? true,
            locked: options.locked ?? false,
            zIndex: this.layers.length,
            plane: options.plane ?? 'foreground',
            
            // スタイル
            fillColor: options.fillColor ?? '#3b82f6',
            strokeColor: options.strokeColor ?? '#1e40af',
            strokeWidth: options.strokeWidth ?? 2,
            opacity: options.opacity ?? 1,
            
            // テキスト用
            text: options.text ?? '',
            fontSize: options.fontSize ?? 14,
            fontFamily: options.fontFamily ?? 'Arial',
            textColor: options.textColor ?? '#000000',
            
            // 画像用
            imageData: options.imageData ?? null, // base64
            
            // ライン/矢印用
            x2: options.x2 ?? (options.x ?? defaultX) + 100,
            y2: options.y2 ?? (options.y ?? defaultY),
            arrowHead: options.arrowHead ?? (type === 'arrow'),
            
            // 名前（レイヤーパネル表示用）
            name: options.name ?? `${type.charAt(0).toUpperCase() + type.slice(1)} ${this.nextId - 1}`
        };
        
        this.layers.push(obj);
        this.renderObject(obj);
        this.selectObject(obj);
        
        // レイヤーパネルを更新
        this.notifyLayersChanged();
        
        return obj;
    }

    /**
     * オブジェクトをDOMにレンダリング
     */
    renderObject(obj) {
        if (!this.frontContainer || !this.backContainer) return;
        
        // 既存要素を削除
        const existing = document.getElementById(obj.id);
        if (existing) existing.remove();
        
        if (!obj.visible) return;
        
        let element;
        
        switch (obj.type) {
            case 'rectangle':
                element = this.createRectangle(obj);
                break;
            case 'ellipse':
                element = this.createEllipse(obj);
                break;
            case 'line':
            case 'arrow':
                element = this.createLine(obj);
                break;
            case 'text':
                element = this.createText(obj);
                break;
            case 'image':
                element = this.createImage(obj);
                break;
            default:
                console.warn('Unknown object type:', obj.type);
                return;
        }
        
        if (element) {
            element.id = obj.id;
            element.classList.add('overlay-object');
            element.dataset.objectId = obj.id;
            element.style.zIndex = obj.zIndex;
            
            if (obj.locked) {
                element.classList.add('locked');
            }
            
            const container = this.getContainerForLayer(obj);
            container?.appendChild(element);
        }
    }

    /**
     * 矩形を作成
     */
    createRectangle(obj) {
        const div = document.createElement('div');
        div.className = 'overlay-shape overlay-rectangle';
        div.style.cssText = `
            position: absolute;
            left: ${obj.x}px;
            top: ${obj.y}px;
            width: ${obj.width}px;
            height: ${obj.height}px;
            background-color: ${obj.fillColor};
            border: ${obj.strokeWidth}px solid ${obj.strokeColor};
            opacity: ${obj.opacity};
            transform: rotate(${obj.rotation}deg);
            cursor: move;
            box-sizing: border-box;
        `;
        this.addResizeHandles(div, obj);
        return div;
    }

    /**
     * 楕円を作成
     */
    createEllipse(obj) {
        const div = document.createElement('div');
        div.className = 'overlay-shape overlay-ellipse';
        div.style.cssText = `
            position: absolute;
            left: ${obj.x}px;
            top: ${obj.y}px;
            width: ${obj.width}px;
            height: ${obj.height}px;
            background-color: ${obj.fillColor};
            border: ${obj.strokeWidth}px solid ${obj.strokeColor};
            opacity: ${obj.opacity};
            transform: rotate(${obj.rotation}deg);
            border-radius: 50%;
            cursor: move;
            box-sizing: border-box;
        `;
        this.addResizeHandles(div, obj);
        return div;
    }

    /**
     * ライン/矢印を作成（SVG）
     */
    createLine(obj) {
        const wrapper = document.createElement('div');
        wrapper.classList.add('overlay-shape', 'overlay-line');

        const minX = Math.min(obj.x, obj.x2);
        const minY = Math.min(obj.y, obj.y2);
        const maxX = Math.max(obj.x, obj.x2);
        const maxY = Math.max(obj.y, obj.y2);
        const padding = 10;
        
        const width = maxX - minX + padding * 2;
        const height = maxY - minY + padding * 2;

        wrapper.style.cssText = `
            position: absolute;
            left: ${minX - padding}px;
            top: ${minY - padding}px;
            width: ${width}px;
            height: ${height}px;
            overflow: visible;
            cursor: move;
        `;

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', width);
        svg.setAttribute('height', height);
        svg.style.width = '100%';
        svg.style.height = '100%';
        
        // 矢印マーカー
        if (obj.arrowHead) {
            const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
            marker.setAttribute('id', `arrow-${obj.id}`);
            marker.setAttribute('markerWidth', '10');
            marker.setAttribute('markerHeight', '10');
            marker.setAttribute('refX', '9');
            marker.setAttribute('refY', '3');
            marker.setAttribute('orient', 'auto');
            marker.setAttribute('markerUnits', 'strokeWidth');
            
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', 'M0,0 L0,6 L9,3 z');
            path.setAttribute('fill', obj.strokeColor);
            
            marker.appendChild(path);
            defs.appendChild(marker);
            svg.appendChild(defs);
        }
        
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', obj.x - minX + padding);
        line.setAttribute('y1', obj.y - minY + padding);
        line.setAttribute('x2', obj.x2 - minX + padding);
        line.setAttribute('y2', obj.y2 - minY + padding);
        line.setAttribute('stroke', obj.strokeColor);
        line.setAttribute('stroke-width', obj.strokeWidth);
        line.setAttribute('opacity', obj.opacity);
        
        if (obj.arrowHead) {
            line.setAttribute('marker-end', `url(#arrow-${obj.id})`);
        }
        
        svg.appendChild(line);
        wrapper.appendChild(svg);
        this.addResizeHandles(wrapper, obj);
        return wrapper;
    }

    /**
     * テキストを作成
     */
    createText(obj) {
        const div = document.createElement('div');
        div.className = 'overlay-shape overlay-text';
        div.contentEditable = 'true';
        div.style.cssText = `
            position: absolute;
            left: ${obj.x}px;
            top: ${obj.y}px;
            min-width: 50px;
            min-height: 20px;
            padding: 5px;
            font-size: ${obj.fontSize}px;
            font-family: ${obj.fontFamily};
            color: ${obj.textColor};
            background-color: ${obj.fillColor === 'transparent' ? 'transparent' : obj.fillColor};
            border: ${obj.strokeWidth}px solid ${obj.strokeColor === 'transparent' ? 'transparent' : obj.strokeColor};
            opacity: ${obj.opacity};
            transform: rotate(${obj.rotation}deg);
            cursor: move;
            white-space: pre-wrap;
            outline: none;
            box-sizing: border-box;
        `;
        div.textContent = obj.text || 'Text';
        
        // テキスト変更時に保存
        div.addEventListener('input', () => {
            obj.text = div.textContent;
        });
        
        return div;
    }

    /**
     * 画像を作成
     */
    createImage(obj) {
        const div = document.createElement('div');
        div.className = 'overlay-shape overlay-image';
        div.style.cssText = `
            position: absolute;
            left: ${obj.x}px;
            top: ${obj.y}px;
            width: ${obj.width}px;
            height: ${obj.height}px;
            opacity: ${obj.opacity};
            transform: rotate(${obj.rotation}deg);
            cursor: move;
            background-image: url(${obj.imageData});
            background-size: contain;
            background-repeat: no-repeat;
            background-position: center;
            border: ${obj.strokeWidth}px solid ${obj.strokeColor === 'transparent' ? 'transparent' : obj.strokeColor};
            box-sizing: border-box;
        `;
        this.addResizeHandles(div, obj);
        return div;
    }

    /**
     * リサイズハンドルを追加
     */
    addResizeHandles(element, obj) {
        if (obj.locked) return;
        
        const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
        handles.forEach(pos => {
            const handle = document.createElement('div');
            handle.className = `resize-handle resize-${pos}`;
            handle.dataset.handle = pos;
            handle.dataset.objectId = obj.id;
            element.appendChild(handle);
        });
    }

    /**
     * マウスダウンイベント
     */
    onMouseDown(e) {
        const target = e.target.closest('.overlay-object');
        if (!target) return;
        
        const objId = target.dataset.objectId;
        const obj = this.layers.find(l => l.id === objId);
        if (!obj || obj.locked) return;
        
        // リサイズハンドルをクリックした場合
        if (e.target.classList.contains('resize-handle')) {
            this.isResizing = true;
            this.resizeHandle = e.target.dataset.handle;
            this.dragTarget = obj;
            this.resizeStartX = e.clientX;
            this.resizeStartY = e.clientY;
            this.resizeStartWidth = obj.width;
            this.resizeStartHeight = obj.height;
            this.resizeStartObjX = obj.x;
            this.resizeStartObjY = obj.y;
            this.resizeStartObjX2 = obj.x2;
            this.resizeStartObjY2 = obj.y2;
            e.stopPropagation();
            e.preventDefault();
            return;
        }
        
        // オブジェクトをクリック → 選択 + ドラッグ開始
        this.selectObject(obj);
        
        // テキストの場合は編集モードなのでドラッグしない
        if (obj.type === 'text' && e.target.contentEditable === 'true') {
            return;
        }
        
        this.isDragging = true;
        this.dragTarget = obj;
        
        const cy = appContext.networkManager?.cy;
        const zoom = cy ? cy.zoom() : 1;
        
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.dragStartObjX = obj.x;
        this.dragStartObjY = obj.y;
        
        // ライン用
        if (obj.type === 'line' || obj.type === 'arrow') {
            this.dragStartObjX2 = obj.x2;
            this.dragStartObjY2 = obj.y2;
        }
        
        e.stopPropagation();
        e.preventDefault();
    }

    /**
     * マウス移動イベント
     */
    onMouseMove(e) {
        if (!this.dragTarget) return;
        
        const cy = appContext.networkManager?.cy;
        const zoom = cy ? cy.zoom() : 1;
        
        const dx = (e.clientX - (this.isResizing ? this.resizeStartX : this.dragStartX)) / zoom;
        const dy = (e.clientY - (this.isResizing ? this.resizeStartY : this.dragStartY)) / zoom;
        
        if (this.isResizing) {
            this.handleResize(dx, dy);
        } else if (this.isDragging) {
            this.handleDrag(dx, dy);
        }
    }

    /**
     * ドラッグ処理
     */
    handleDrag(dx, dy) {
        const obj = this.dragTarget;
        obj.x = this.dragStartObjX + dx;
        obj.y = this.dragStartObjY + dy;
        
        if (obj.type === 'line' || obj.type === 'arrow') {
            obj.x2 = this.dragStartObjX2 + dx;
            obj.y2 = this.dragStartObjY2 + dy;
        }
        
        this.renderObject(obj);
        this.selectObject(obj); // 選択状態を維持
    }

    /**
     * リサイズ処理
     */
    handleResize(dx, dy) {
        const obj = this.dragTarget;
        const handle = this.resizeHandle;

        if (obj.type === 'line' || obj.type === 'arrow') {
            let newX = this.resizeStartObjX;
            let newY = this.resizeStartObjY;
            let newX2 = this.resizeStartObjX2;
            let newY2 = this.resizeStartObjY2;

            if (handle.includes('e')) {
                newX2 = this.resizeStartObjX2 + dx;
            }
            if (handle.includes('w')) {
                newX = this.resizeStartObjX + dx;
            }
            if (handle.includes('s')) {
                newY2 = this.resizeStartObjY2 + dy;
            }
            if (handle.includes('n')) {
                newY = this.resizeStartObjY + dy;
            }

            obj.x = newX;
            obj.y = newY;
            obj.x2 = newX2;
            obj.y2 = newY2;

            this.renderObject(obj);
            this.selectObject(obj);
            return;
        }
        
        let newWidth = this.resizeStartWidth;
        let newHeight = this.resizeStartHeight;
        let newX = this.resizeStartObjX;
        let newY = this.resizeStartObjY;
        
        if (handle.includes('e')) {
            newWidth = Math.max(20, this.resizeStartWidth + dx);
        }
        if (handle.includes('w')) {
            newWidth = Math.max(20, this.resizeStartWidth - dx);
            newX = this.resizeStartObjX + dx;
        }
        if (handle.includes('s')) {
            newHeight = Math.max(20, this.resizeStartHeight + dy);
        }
        if (handle.includes('n')) {
            newHeight = Math.max(20, this.resizeStartHeight - dy);
            newY = this.resizeStartObjY + dy;
        }
        
        obj.width = newWidth;
        obj.height = newHeight;
        obj.x = newX;
        obj.y = newY;
        
        this.renderObject(obj);
        this.selectObject(obj);
    }

    /**
     * マウスアップイベント
     */
    onMouseUp(e) {
        this.isDragging = false;
        this.isResizing = false;
        this.dragTarget = null;
        this.resizeHandle = null;
    }

    /**
     * キーボードイベント
     */
    onKeyDown(e) {
        if (!this.selectedLayer) return;
        
        // Delete/Backspaceで削除
        if (e.key === 'Delete' || e.key === 'Backspace') {
            // テキスト編集中は除外
            if (document.activeElement.contentEditable === 'true') return;
            
            this.removeObject(this.selectedLayer.id);
            e.preventDefault();
        }
    }

    /**
     * オブジェクトを選択
     */
    selectObject(obj) {
        this.deselectAll();
        this.selectedLayer = obj;
        
        const element = document.getElementById(obj.id);
        if (element) {
            element.classList.add('selected');
        }
        
        // プロパティパネルを更新
        this.notifySelectionChanged();
    }

    /**
     * 全選択解除
     */
    deselectAll() {
        this.getContainers().forEach(container => {
            container.querySelectorAll('.overlay-object.selected')
                .forEach(el => el.classList.remove('selected'));
        });
        this.selectedLayer = null;
        this.notifySelectionChanged();
    }

    /**
     * オブジェクトを削除
     */
    removeObject(id) {
        const index = this.layers.findIndex(l => l.id === id);
        if (index === -1) return;
        
        this.layers.splice(index, 1);
        
        const element = document.getElementById(id);
        if (element) element.remove();
        
        if (this.selectedLayer?.id === id) {
            this.selectedLayer = null;
        }
        
        // z-indexを再計算
        this.layers.forEach((layer, i) => {
            layer.zIndex = i;
        });
        
        this.notifyLayersChanged();
    }

    /**
     * オブジェクトを前面へ
     */
    bringToFront(id) {
        const index = this.layers.findIndex(l => l.id === id);
        if (index === -1 || index === this.layers.length - 1) return;
        
        const [obj] = this.layers.splice(index, 1);
        this.layers.push(obj);
        this.updateZIndices();
    }

    /**
     * オブジェクトを背面へ
     */
    sendToBack(id) {
        const index = this.layers.findIndex(l => l.id === id);
        if (index === -1 || index === 0) return;
        
        const [obj] = this.layers.splice(index, 1);
        this.layers.unshift(obj);
        this.updateZIndices();
    }

    /**
     * 表示面（前景/背景）を切り替え
     */
    setLayerPlane(id, plane) {
        const layer = this.layers.find(l => l.id === id);
        if (!layer) return;
        const nextPlane = plane === 'background' ? 'background' : 'foreground';
        if ((layer.plane ?? 'foreground') === nextPlane) return;

        layer.plane = nextPlane;
        this.renderObject(layer);
        this.updateZIndices();
    }

    /**
     * z-indexを更新
     */
    updateZIndices() {
        const applyPlaneZ = (plane) => {
            let z = 0;
            this.layers
                .filter(layer => (layer.plane ?? 'foreground') === plane)
                .forEach(layer => {
                    layer.zIndex = z;
                    const element = document.getElementById(layer.id);
                    if (element) {
                        element.style.zIndex = z;
                    }
                    z += 1;
                });
        };
        applyPlaneZ('background');
        applyPlaneZ('foreground');
        this.notifyLayersChanged();
    }

    /**
     * 全オブジェクトを再描画
     */
    renderAll() {
        if (!this.frontContainer || !this.backContainer) return;
        this.frontContainer.innerHTML = '';
        this.backContainer.innerHTML = '';
        this.layers.forEach(obj => this.renderObject(obj));
        
        if (this.selectedLayer) {
            const element = document.getElementById(this.selectedLayer.id);
            if (element) element.classList.add('selected');
        }
    }

    /**
     * レイヤーデータをエクスポート（CX2保存用）
     */
    exportLayers() {
        return this.layers.map(layer => ({ ...layer }));
    }

    /**
     * レイヤーデータをインポート（CX2読込用）
     */
    importLayers(layersData) {
        this.layers = [];
        this.selectedLayer = null;
        this.nextId = 1;
        
        if (!layersData || !Array.isArray(layersData)) return;
        
        layersData.forEach(data => {
            const id = parseInt(data.id?.replace('overlay-', '')) || this.nextId;
            if (id >= this.nextId) {
                this.nextId = id + 1;
            }
            this.layers.push({
                ...data,
                plane: data.plane ?? 'foreground'
            });
        });
        
        this.renderAll();
        this.notifyLayersChanged();
    }

    /**
     * すべてのレイヤーをクリア
     */
    clearAll() {
        this.layers = [];
        this.selectedLayer = null;
        this.nextId = 1;
        if (this.frontContainer) {
            this.frontContainer.innerHTML = '';
        }
        if (this.backContainer) {
            this.backContainer.innerHTML = '';
        }
        this.notifyLayersChanged();
    }

    /**
     * 画像ファイルを読み込んでbase64として追加
     */
    async addImageFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const obj = this.addObject('image', {
                        imageData: e.target.result,
                        width: Math.min(img.width, 400),
                        height: Math.min(img.height, 300),
                        name: file.name
                    });
                    resolve(obj);
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * レイヤー変更を通知
     */
    notifyLayersChanged() {
        if (appContext.annotationPanel) {
            appContext.annotationPanel.refreshLayers();
        }
    }

    /**
     * 選択変更を通知
     */
    notifySelectionChanged() {
        if (appContext.annotationPanel) {
            appContext.annotationPanel.updateSelection(this.selectedLayer);
        }
    }

    /**
     * オブジェクトのプロパティを更新
     */
    updateObjectProperty(id, property, value) {
        const obj = this.layers.find(l => l.id === id);
        if (!obj) return;
        
        obj[property] = value;
        this.renderObject(obj);
        
        if (this.selectedLayer?.id === id) {
            this.selectObject(obj);
        }
    }

    /**
     * キャンバス（Cytoscape + Overlay）をPNG画像として合成
     */
    async exportAsPng() {
        const cy = appContext.networkManager?.cy;
        if (!cy) return null;
        
        // Cytoscapeをキャンバスに描画
        const cyPng = cy.png({ full: true, scale: 2 });
        
        // オーバーレイをキャンバスに描画
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Cytoscapeの画像を読み込み
        const cyImg = await this.loadImage(cyPng);
        canvas.width = cyImg.width;
        canvas.height = cyImg.height;
        
        // 背景としてCytoscapeを描画
        ctx.drawImage(cyImg, 0, 0);
        
        // オーバーレイの各オブジェクトを描画
        // Note: 完全な実装にはhtml2canvasなどのライブラリが必要
        // ここでは簡易版として基本的な図形のみ対応
        const extent = cy.extent();
        const zoom = cy.zoom();
        const pan = cy.pan();
        
        for (const obj of this.layers) {
            if (!obj.visible) continue;
            
            ctx.save();
            ctx.globalAlpha = obj.opacity;
            
            // ワールド座標からキャンバス座標へ変換
            const canvasX = (obj.x - extent.x1) * 2; // scale: 2
            const canvasY = (obj.y - extent.y1) * 2;
            const canvasWidth = obj.width * 2;
            const canvasHeight = obj.height * 2;
            
            switch (obj.type) {
                case 'rectangle':
                    ctx.fillStyle = obj.fillColor;
                    ctx.strokeStyle = obj.strokeColor;
                    ctx.lineWidth = obj.strokeWidth * 2;
                    ctx.fillRect(canvasX, canvasY, canvasWidth, canvasHeight);
                    ctx.strokeRect(canvasX, canvasY, canvasWidth, canvasHeight);
                    break;
                    
                case 'ellipse':
                    ctx.fillStyle = obj.fillColor;
                    ctx.strokeStyle = obj.strokeColor;
                    ctx.lineWidth = obj.strokeWidth * 2;
                    ctx.beginPath();
                    ctx.ellipse(
                        canvasX + canvasWidth / 2,
                        canvasY + canvasHeight / 2,
                        canvasWidth / 2,
                        canvasHeight / 2,
                        0, 0, Math.PI * 2
                    );
                    ctx.fill();
                    ctx.stroke();
                    break;
                    
                case 'image':
                    if (obj.imageData) {
                        try {
                            const img = await this.loadImage(obj.imageData);
                            ctx.drawImage(img, canvasX, canvasY, canvasWidth, canvasHeight);
                        } catch (e) {
                            console.warn('Failed to draw image:', e);
                        }
                    }
                    break;
                    
                case 'text':
                    ctx.fillStyle = obj.textColor;
                    ctx.font = `${obj.fontSize * 2}px ${obj.fontFamily}`;
                    ctx.fillText(obj.text, canvasX, canvasY + obj.fontSize * 2);
                    break;
            }
            
            ctx.restore();
        }
        
        return canvas.toDataURL('image/png');
    }

    /**
     * 画像をロード
     */
    loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }
}

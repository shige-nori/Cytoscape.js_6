import { appContext } from './AppContext.js';

/**
 * NetworkManager - Cytoscape.jsグラフの管理クラス
 */
export class NetworkManager {
    constructor() {
        this.cy = null;
        this.isSelectingNodesFromEdge = false; // エッジ選択によるノード選択中フラグ
        this.hoveredElements = null; // ホバー中のハイライト要素
        this.hoverHighlightEnabled = false; // ホバーハイライト機能の有効/無効（初期設定はOFF）
        this.init();
    }

    /**
     * Cytoscape.jsインスタンスを初期化
     */
    init() {
        this.cy = cytoscape({
            container: document.getElementById('cy'),
            elements: [],
            style: this.getDefaultStyle(),
            layout: { name: 'preset' },
            minZoom: 0.05,
            maxZoom: 10,
            wheelSensitivity: 0.1,
            boxSelectionEnabled: true
        });

        this.setupEventListeners();
    }

    /**
     * デフォルトスタイルを取得
     */
    getDefaultStyle() {
        return [
            {
                selector: 'core',
                style: {
                    'background-color': 'transparent'
                }
            },
            {
                selector: 'node',
                style: {
                    'background-color': '#2563eb',
                    'width': 40,
                    'height': 40,
                    'label': 'data(id)',
                    'text-valign': 'top',
                    'text-halign': 'center',
                    'font-size': '10px',
                    'color': '#000',
                    'text-outline-width': 0,
                    'text-wrap': 'ellipsis',
                    'text-max-width': '80px',
                    'text-margin-y': -5
                }
            },
            {
                selector: 'node:selected',
                style: {
                    'background-color': '#eab308',
                    'border-width': 3,
                    'border-color': '#ca8a04'
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 2,
                    'line-color': '#94a3b8',
                    'curve-style': 'bezier',
                    'target-arrow-shape': 'none'
                }
            },
            {
                selector: 'edge:selected',
                style: {
                    'line-color': '#ef4444',
                    'target-arrow-color': '#ef4444',
                    'width': 3
                }
            }
        ];
    }

    /**
     * イベントリスナーを設定
     */
    setupEventListeners() {
        // 選択時のスタイル変更
        this.cy.on('select', 'node', (event) => {
            const node = event.target;
            // ホバー中ならピンク色ではなく、ホバー前の色を保存
            const hoverBg = node.data('_hoverOriginalBg');
            const currentBg = node.style('background-color');
            if (node.data('_originalBg') === undefined) {
                const baseBg = appContext.stylePanel
                    ? appContext.stylePanel.getStyleValue(node, 'fillColor', appContext.stylePanel.nodeStyles.fillColor)
                    : currentBg;
                node.data('_originalBg', hoverBg !== undefined ? hoverBg : baseBg);
            }
            node.style({
                'background-color': '#eab308',
                'border-width': 3,
                'border-color': '#ca8a04'
            });
            
            // エッジ選択によるノード選択の場合は、エッジ自動選択をスキップ
            if (!this.isSelectingNodesFromEdge) {
                // 隣接ノード間のエッジを自動選択
                this.selectEdgesBetweenSelectedNodes();
            }
        });

        this.cy.on('unselect', 'node', (event) => {
            const node = event.target;
            const originalBg = node.data('_originalBg');
            if (typeof originalBg !== 'undefined') {
                node.style('background-color', originalBg);
            }
            node.style({
                'border-width': appContext.stylePanel ? appContext.stylePanel.nodeStyles.borderWidth.value : 0,
                'border-color': appContext.stylePanel ? appContext.stylePanel.getStyleValue(node, 'borderColor', appContext.stylePanel.nodeStyles.borderColor) : '#000000'
            });
            
            // 選択解除されたノードに接続されたエッジをチェック
            this.deselectOrphanEdges();
        });

        this.cy.on('select', 'edge', (event) => {
            const edge = event.target;
            const currentColor = edge.style('line-color');
            const currentWidth = edge.style('width');
            if (edge.data('_originalLineColor') === undefined) {
                edge.data('_originalLineColor', currentColor);
            }
            if (edge.data('_originalWidth') === undefined) {
                edge.data('_originalWidth', currentWidth);
            }
            edge.style({
                'line-color': '#ef4444',
                'target-arrow-color': '#ef4444',
                'width': currentWidth
            });
            
            // 両端のノードも選択（フラグを立てて他のエッジが選択されないようにする）
            this.isSelectingNodesFromEdge = true;
            const source = edge.source();
            const target = edge.target();
            if (!source.selected()) {
                source.select();
            }
            if (!target.selected()) {
                target.select();
            }
            this.isSelectingNodesFromEdge = false;
        });

        this.cy.on('unselect', 'edge', (event) => {
            const edge = event.target;
            const originalColor = edge.data('_originalLineColor');
            const originalWidth = edge.data('_originalWidth');
            if (typeof originalColor !== 'undefined') {
                edge.style('line-color', originalColor);
                edge.style('target-arrow-color', originalColor);
            }
            if (typeof originalWidth !== 'undefined') {
                edge.style('width', originalWidth);
            }
        });

        // 背景クリックで選択解除
        this.cy.on('tap', (event) => {
            if (event.target === this.cy) {
                if (appContext.tablePanel && typeof appContext.tablePanel.clearSelection === 'function') {
                    appContext.tablePanel.clearSelection();
                } else {
                    this.cy.elements().unselect();
                }
                this.resetSelectionStyles();
            }
        });

        // ノードホバー時の論文ID経路ハイライト
        this.cy.on('mouseover', 'node', (event) => {
            const node = event.target;
            // ホバーハイライトが無効な場合は何もしない
            if (!this.hoverHighlightEnabled) {
                return;
            }
            // フィルターがアクティブな場合はハイライトしない
            if (this.isFilterActive()) {
                return;
            }
            // 選択中ノードはホバーでピンクにしない
            if (!node.selected()) {
                this.highlightPaperIdPath(node);
            }
        });

        this.cy.on('mouseout', 'node', (event) => {
            const node = event.target;
            // ホバー解除時、選択中なら黄色に戻す（ピンク解除）
            if (node.selected()) {
                // 選択スタイルを再適用
                node.style({
                    'background-color': '#eab308',
                    'border-width': 3,
                    'border-color': '#ca8a04'
                });
            }
            this.clearHighlight();
        });

        // ドラッグ完了時に履歴を保存
        this.cy.on('dragfree', 'node', () => {
            if (appContext.historyManager) {
                appContext.historyManager.captureSoon('node-drag');
            }
        });

        // キーボード操作（矢印キーで移動）
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
    }

    /**
     * キーボードイベント
     */
    onKeyDown(e) {
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.isContentEditable || ['INPUT', 'TEXTAREA'].includes(activeElement.tagName))) {
            return;
        }

        const key = e.key;
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) return;

        const step = e.shiftKey ? 10 : 5;
        let dx = 0;
        let dy = 0;
        if (key === 'ArrowUp') dy = -step;
        if (key === 'ArrowDown') dy = step;
        if (key === 'ArrowLeft') dx = -step;
        if (key === 'ArrowRight') dx = step;

        let moved = false;

        if (this.cy) {
            const selectedNodes = this.cy.nodes(':selected');
            if (selectedNodes.length > 0) {
                this.cy.batch(() => {
                    selectedNodes.forEach(node => {
                        const pos = node.position();
                        node.position({ x: pos.x + dx, y: pos.y + dy });
                    });
                });
                moved = true;
            }
        }

        if (appContext.layerManager && typeof appContext.layerManager.moveSelectedLayers === 'function') {
            const layerMoved = appContext.layerManager.moveSelectedLayers(dx, dy);
            if (layerMoved) moved = true;
        }

        if (moved) {
            if (appContext.historyManager) {
                appContext.historyManager.captureSoon('move-arrow');
            }
            e.preventDefault();
        }
    }

    /**
     * 選択されたノード間のエッジを自動選択
     */
    selectEdgesBetweenSelectedNodes() {
        const selectedNodes = this.cy.nodes(':selected');
        
        // 選択されたノード間のすべてのエッジを取得
        selectedNodes.forEach(node1 => {
            selectedNodes.forEach(node2 => {
                if (node1.id() !== node2.id()) {
                    // node1とnode2を接続するエッジを取得
                    const edges = this.cy.edges(`[source="${node1.id()}"][target="${node2.id()}"], [source="${node2.id()}"][target="${node1.id()}"]`);
                    edges.forEach(edge => {
                        if (!edge.selected()) {
                            edge.select();
                        }
                    });
                }
            });
        });
    }

    /**
     * 両端のノードが選択されていないエッジの選択を解除
     */
    deselectOrphanEdges() {
        const selectedEdges = this.cy.edges(':selected');
        
        selectedEdges.forEach(edge => {
            const source = edge.source();
            const target = edge.target();
            
            // 両端のノードが両方とも選択されていない場合は選択解除
            if (!source.selected() || !target.selected()) {
                edge.unselect();
            }
        });
    }

    /**
     * 論文ID経路の上流/下流パスをハイライト
     * @param {Object} node - ホバーされたノード
     */
    highlightPaperIdPath(node) {
        // 既存のハイライトをクリア
        this.clearHighlight();

        // 論文IDを持つノードかチェック
        const hoveredPaperIds = node.data('論文ID');
        if (!hoveredPaperIds) {
            return; // 論文IDがない場合は何もしない
        }

        // 論文IDを配列に正規化
        const paperIdArray = Array.isArray(hoveredPaperIds) ? hoveredPaperIds : [hoveredPaperIds];
        if (paperIdArray.length === 0) {
            return;
        }

        // ホバーされたノードの論文IDをSetに変換（高速検索用）
        const paperIdSet = new Set(paperIdArray);

        // ハイライト対象の要素を収集
        const pathElements = this.cy.collection();
        
        // ホバーされたノード自身を追加
        pathElements.merge(node);
        
        // 上流と下流のすべてのエッジを取得
        const allPathEdges = node.predecessors('edge').union(node.successors('edge'));
        
        // 論文IDが一致するエッジのみをフィルタリングして追加
        const matchedEdges = this.cy.collection();
        allPathEdges.forEach(edge => {
            const edgePaperIds = edge.data('論文ID');
            if (edgePaperIds) {
                // エッジの論文IDを配列に正規化
                const edgePaperIdArray = Array.isArray(edgePaperIds) ? edgePaperIds : [edgePaperIds];
                // エッジの論文IDのいずれかがホバーされたノードの論文IDと一致するかチェック
                const hasMatch = edgePaperIdArray.some(id => paperIdSet.has(id));
                if (hasMatch) {
                    matchedEdges.merge(edge);
                }
            }
        });
        
        // マッチしたエッジをハイライト対象に追加
        pathElements.merge(matchedEdges);
        
        // マッチしたエッジで接続されているノードを追加
        matchedEdges.forEach(edge => {
            pathElements.merge(edge.source());
            pathElements.merge(edge.target());
        });

        // ハイライト対象のIDをSetに変換（高速検索用）
        const highlightIds = new Set();
        pathElements.forEach(ele => highlightIds.add(ele.id()));

        // すべての要素を取得
        const allElements = this.cy.elements();
        
        // ハイライトされない要素の透明度を80%に
        allElements.forEach(ele => {
            const isHighlighted = highlightIds.has(ele.id());
            if (!isHighlighted) {
                // 元の透明度を保存（まだ保存されていない場合のみ）
                if (ele.data('_hoverOriginalOpacity') === undefined) {
                    ele.data('_hoverOriginalOpacity', ele.style('opacity'));
                }
                ele.style('opacity', 0.2);
            }
        });

        // ハイライト対象要素の色を変更
        pathElements.forEach(ele => {
            if (ele.isNode()) {
                // ノードの元の色を保存（まだ保存されていない場合のみ）
                if (ele.data('_hoverOriginalBg') === undefined) {
                    ele.data('_hoverOriginalBg', ele.style('background-color'));
                }
                ele.style('background-color', '#ec4899'); // ピンク色
            } else if (ele.isEdge()) {
                // エッジの元の色を保存（まだ保存されていない場合のみ）
                if (ele.data('_hoverOriginalLineColor') === undefined) {
                    ele.data('_hoverOriginalLineColor', ele.style('line-color'));
                }
                ele.style('line-color', '#ec4899'); // ピンク色
                ele.style('target-arrow-color', '#ec4899');
            }
        });

        // ハイライトされた要素を保存
        this.hoveredElements = pathElements;
    }

    /**
     * ハイライトをクリア
     */
    clearHighlight() {
        // すべての要素の透明度を元に戻す（先に実行）
        this.cy.elements().forEach(ele => {
            const originalOpacity = ele.data('_hoverOriginalOpacity');
            if (originalOpacity !== undefined) {
                ele.style('opacity', originalOpacity);
                ele.removeData('_hoverOriginalOpacity');
            }
        });
        if (this.hoveredElements) {
            // ハイライトされた要素の色を元に戻す
            this.hoveredElements.forEach(ele => {
                if (ele.isNode()) {
                    const originalBg = ele.data('_hoverOriginalBg');
                    if (originalBg !== undefined) {
                        // 選択中ノードは黄色を維持
                        if (!ele.selected()) {
                            ele.style('background-color', originalBg);
                        }
                        ele.removeData('_hoverOriginalBg');
                    }
                } else if (ele.isEdge()) {
                    const originalLineColor = ele.data('_hoverOriginalLineColor');
                    if (originalLineColor !== undefined) {
                        ele.style('line-color', originalLineColor);
                        ele.style('target-arrow-color', originalLineColor);
                        ele.removeData('_hoverOriginalLineColor');
                    }
                }
            });
            this.hoveredElements = null;
        }
    }

    /**
     * 選択スタイルを強制的に復元
     * @param {Collection} elements
     */
    resetSelectionStyles(elements = null) {
        const targetElements = elements || this.cy.elements();

        targetElements.forEach(ele => {
            if (ele.isNode()) {
                const originalBg = ele.data('_originalBg');
                if (typeof originalBg !== 'undefined') {
                    ele.style('background-color', originalBg);
                    ele.removeData('_originalBg');
                }
                ele.style({
                    'border-width': appContext.stylePanel ? appContext.stylePanel.nodeStyles.borderWidth.value : 0,
                    'border-color': appContext.stylePanel ? appContext.stylePanel.getStyleValue(ele, 'borderColor', appContext.stylePanel.nodeStyles.borderColor) : '#000000'
                });
            } else if (ele.isEdge()) {
                const originalColor = ele.data('_originalLineColor');
                const originalWidth = ele.data('_originalWidth');
                if (typeof originalColor !== 'undefined') {
                    ele.style('line-color', originalColor);
                    ele.style('target-arrow-color', originalColor);
                    ele.removeData('_originalLineColor');
                }
                if (typeof originalWidth !== 'undefined') {
                    ele.style('width', originalWidth);
                    ele.removeData('_originalWidth');
                }
            }
        });
    }

    /**
     * フィルターがアクティブかどうかをチェック
     */
    isFilterActive() {
        // 透明度が1未満の要素があればフィルターがアクティブ
        const elements = this.cy.elements();
        for (let i = 0; i < elements.length; i++) {
            const opacity = elements[i].style('opacity');
            if (opacity < 1) {
                return true;
            }
        }
        return false;
    }

    /**
     * 選択スタイルをスタイルシートに追加
     */
    updateSelectionStyles() {
        // このメソッドは不要になったが、互換性のため残す
    }

    /**
     * ネットワークデータからグラフを作成
     * @param {Array} data - 行データの配列
     * @param {Object} mappings - カラムマッピング設定
     */
    async createNetwork(data, mappings, onProgress = null, onPhase = null) {
        // StylePanelをリセット
        if (appContext.stylePanel) {
            appContext.stylePanel.resetStyles();
        }
        
        // FileHandlerのファイルパスをクリア（Import時）
        if (appContext.fileHandler) {
            appContext.fileHandler.currentFilePath = null;
        }
        
        // オーバーレイ（図形）が残っている場合に備え、ネットワーク作成開始時にレイヤーをクリア
        if (appContext.layerManager) {
            console.debug('NetworkManager.createNetwork: calling layerManager.clearAll()');
            appContext.layerManager.clearAll();
        }
        
        const nodes = new Map();
        const edges = [];

        // Source/Targetカラムを取得
        const sourceColumn = Object.keys(mappings).find(col => mappings[col].role === 'Source');
        const targetColumn = Object.keys(mappings).find(col => mappings[col].role === 'Target');

        if (!sourceColumn) {
            throw new Error('Source column is required');
        }

        const totalRows = data.length;
        const chunkSize = 5000;

        for (let index = 0; index < data.length; index++) {
            const row = data[index];
            const sourceId = String(row[sourceColumn] || '').trim();
            if (!sourceId) continue;

            // Sourceノードを追加
            if (!nodes.has(sourceId)) {
                nodes.set(sourceId, {
                    data: { id: sourceId }
                });
            }

            // Targetがあればエッジを作成
            if (targetColumn && row[targetColumn]) {
                const targetId = String(row[targetColumn]).trim();
                if (targetId) {
                    // Targetノードを追加
                    if (!nodes.has(targetId)) {
                        nodes.set(targetId, {
                            data: { id: targetId }
                        });
                    }

                    // エッジを追加（属性も含む）
                    const edgeData = {
                        id: `edge-${index}`,
                        source: sourceId,
                        target: targetId
                    };
                    
                    // エッジにAttributeを追加（ネットワークモードではAttributeはエッジ属性）
                    Object.keys(mappings).forEach(column => {
                        const mapping = mappings[column];
                        if (mapping.role === 'Attribute' && column !== sourceColumn && column !== targetColumn) {
                            const value = this.convertValue(row[column], mapping.dataType, mapping.delimiter);
                            edgeData[column] = value;
                        }
                    });
                    
                    edges.push({ data: edgeData });
                }
            }

            if (index > 0 && index % chunkSize === 0) {
                if (onProgress) {
                    onProgress(index / totalRows);
                }
                await this.yieldToBrowser();
            }
        }

        // グラフをクリアして要素を追加
        this.cy.elements().remove();
        if (onPhase) {
            onPhase('elements');
        }
        await this.addElementsInBatches(
            [...nodes.values(), ...edges],
            2000,
            onProgress
        );

        // Style Panelのスタイルを適用
        if (appContext.stylePanel) {
            setTimeout(() => appContext.stylePanel.reapplyStyles(), 100);
        }

        return {
            nodeCount: nodes.size,
            edgeCount: edges.length
        };
    }

    /**
     * ノードに属性を追加
     */
    addAttributesToNode(node, row, mappings, sourceColumn) {
        Object.keys(mappings).forEach(column => {
            const mapping = mappings[column];
            if (mapping.role === 'Attribute' && column !== sourceColumn) {
                const value = this.convertValue(row[column], mapping.dataType, mapping.delimiter);
                node.data[column] = value;
            }
        });
    }

    /**
     * 値をデータ型に変換
     */
    convertValue(value, dataType, delimiter = '|') {
        if (value === null || value === undefined || value === '') {
            return null;
        }

        switch (dataType) {
            case 'Number':
                return Number(value) || 0;
            case 'Boolean':
                return Boolean(value) && value !== 'false' && value !== '0';
            case 'String Array':
                return String(value).split(delimiter).map(s => s.trim());
            case 'Number Array':
                return String(value).split(delimiter).map(s => Number(s.trim()) || 0);
            default:
                return String(value);
        }
    }

    /**
     * 既存ノードにテーブルデータを追加
     * @param {Array} data - 行データの配列
     * @param {Object} mappings - カラムマッピング設定
     */
    async addTableData(data, mappings, onProgress = null, onPhase = null) {
        const sourceColumn = Object.keys(mappings).find(col => mappings[col].role === 'Source');
        
        if (!sourceColumn) {
            throw new Error('Source column is required');
        }

        let matchedCount = 0;
        const totalRows = data.length;
        const chunkSize = 5000;

        for (let index = 0; index < data.length; index++) {
            const row = data[index];
            const nodeId = String(row[sourceColumn] || '').trim();
            const node = this.cy.getElementById(nodeId);

            if (node.length > 0) {
                matchedCount++;
                Object.keys(mappings).forEach(column => {
                    const mapping = mappings[column];
                    if (mapping.role === 'Attribute' && column !== sourceColumn) {
                        const value = this.convertValue(row[column], mapping.dataType, mapping.delimiter);
                        node.data(column, value);
                    }
                });
            }

            if (index > 0 && index % chunkSize === 0) {
                if (onProgress) {
                    onProgress(index / totalRows);
                }
                await this.yieldToBrowser();
            }
        }

        if (onPhase) {
            onPhase('elements');
        }

        // Style Panelのスタイルを再適用
        if (appContext.stylePanel) {
            setTimeout(() => appContext.stylePanel.reapplyStyles(), 100);
        }

        return {
            matchedCount,
            totalRows: data.length
        };
    }

    /**
     * 要素を分割して追加（応答性維持）
     * @param {Array} elements
     * @param {number} batchSize
     * @param {(progress: number) => void} onProgress
     */
    async addElementsInBatches(elements, batchSize = 2000, onProgress = null) {
        const total = elements.length || 1;
        for (let i = 0; i < elements.length; i += batchSize) {
            const batch = elements.slice(i, i + batchSize);
            this.cy.batch(() => {
                this.cy.add(batch);
            });

            if (onProgress) {
                onProgress(Math.min(1, (i + batch.length) / total));
            }

            await this.yieldToBrowser();
        }
    }

    /**
     * ブラウザに制御を返してUIの応答性を保つ
     */
    async yieldToBrowser() {
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    /**
     * ネットワークが存在するかチェック
     */
    hasNetwork() {
        return this.cy.nodes().length > 0;
    }

    /**
     * ネットワークをクローズし、すべての設定をクリア
     */
    closeNetwork() {
        // グラフをクリア
        if (this.cy) {
            this.cy.elements().remove();
            this.cy.reset();
        }
        
        // テーブルパネルをクリア
        if (appContext.tablePanel) {
            appContext.tablePanel.clearTable();
        }
        
        // Layout Toolsパネルをクリア
        if (appContext.layoutTools) {
            appContext.layoutTools.closePanel();
            appContext.layoutTools.resetOriginalPositions();
        }
        
        // StylePanelをリセット
        if (appContext.stylePanel) {
            appContext.stylePanel.resetStyles();
        }
        
        // FileHandlerのファイルパスをクリア
        if (appContext.fileHandler) {
            appContext.fileHandler.currentFilePath = null;
            appContext.fileHandler.currentFileHandle = null;
        }

        // オーバーレイレイヤーをクリア
        if (appContext.layerManager) {
            appContext.layerManager.clearAll();
        }
        
        // Edge Bendsパネルをクリア
        if (appContext.edgeBends) {
            appContext.edgeBends.closePanel();
        }
        
        // Sort Nodesパネルをクリア
        if (appContext.sortNodesPanel) {
            appContext.sortNodesPanel.closePanel();
        }
        
        // Style Panelをクリア
        if (appContext.stylePanel) {
            appContext.stylePanel.closePanel();
        }
        
        // Layout Managerの設定をクリア
        if (appContext.layoutManager) {
            appContext.layoutManager.currentLayout = null;
            if (appContext.menuManager) {
                appContext.menuManager.updateLayoutCheckmarks();
            }
        }

        if (appContext.historyManager) {
            appContext.historyManager.captureState('close-network');
        }
    }

    /**
     * ホバーハイライト機能の有効/無効を切り替え
     * @param {boolean} enabled - trueで有効、falseで無効
     */
    toggleHoverHighlight(enabled) {
        this.hoverHighlightEnabled = enabled;
        // 無効にするときは現在のハイライトをクリア
        if (!enabled) {
            this.clearHighlight();
        }
    }

    /**
     * 選択機能の有効/無効を切り替え
     * @param {boolean} enabled - trueで有効、falseで無効
     */
    toggleSelection(enabled) {
        if (this.cy) {
            // ボックス選択の有効/無効
            this.cy.boxSelectionEnabled(enabled);
            // ノードとエッジの選択可能/不可を設定
            this.cy.elements().selectify();
            if (!enabled) {
                this.cy.elements().unselectify();
                // 現在の選択を解除
                this.cy.elements().unselect();
            }
        }
    }
}

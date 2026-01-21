/**
 * NetworkManager - Cytoscape.jsグラフの管理クラス
 */
class NetworkManager {
    constructor() {
        this.cy = null;
        this.isSelectingNodesFromEdge = false; // エッジ選択によるノード選択中フラグ
        this.hoveredElements = null; // ホバー中のハイライト要素
        this.isHoverHighlightEnabled = false; // ホバーハイライト機能のON/OFF
        this.isSelectionEnabled = true; // 選択機能のON/OFF
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
            // 選択が無効化されている場合は選択をキャンセル
            if (!this.isSelectionEnabled) {
                event.target.unselect();
                return;
            }
            
            const node = event.target;
            
            // 元の色を保存（初回のみ）
            if (node.data('_baseColor') === undefined) {
                node.data('_baseColor', node.style('background-color'));
            }
            
            // 選択状態の色を適用（2層目）
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
            
            // 元の色に戻す（1層目）
            const baseColor = node.data('_baseColor') || '#2563eb';
            node.style({
                'background-color': baseColor,
                'border-width': stylePanel ? stylePanel.nodeStyles.borderWidth.value : 0,
                'border-color': stylePanel ? stylePanel.getStyleValue(node, 'borderColor', stylePanel.nodeStyles.borderColor) : '#000000'
            });
            
            // 選択解除されたノードに接続されたエッジをチェック
            this.deselectOrphanEdges();
        });

        this.cy.on('select', 'edge', (event) => {
            // 選択が無効化されている場合は選択をキャンセル
            if (!this.isSelectionEnabled) {
                event.target.unselect();
                return;
            }
            
            const edge = event.target;
            
            // 元の色を保存（初回のみ）
            if (edge.data('_baseLineColor') === undefined) {
                edge.data('_baseLineColor', edge.style('line-color'));
            }
            if (edge.data('_baseWidth') === undefined) {
                edge.data('_baseWidth', edge.style('width'));
            }
            
            // 選択状態の色を適用
            edge.style({
                'line-color': '#ef4444',
                'target-arrow-color': '#ef4444',
                'width': 3
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
            
            // 元の色に戻す
            const baseColor = edge.data('_baseLineColor') || '#94a3b8';
            const baseWidth = edge.data('_baseWidth') || 2;
            edge.style({
                'line-color': baseColor,
                'target-arrow-color': baseColor,
                'width': baseWidth
            });
        });

        // 背景クリックで選択解除と色リセット
        this.cy.on('tap', (event) => {
            if (event.target === this.cy) {
                // ホバーハイライトをクリア
                this.clearHighlight();
                
                // すべての選択を解除
                this.cy.elements().unselect();
                
                // 全要素の色を元に戻す（念のため）
                this.resetAllColors();
            }
        });

        // ノードホバー時の論文ID経路ハイライト
        this.cy.on('mouseover', 'node', (event) => {
            const node = event.target;
            
            // ホバーハイライトが無効な場合はスキップ
            if (!this.isHoverHighlightEnabled) {
                return;
            }
            
            // フィルターがアクティブな場合はハイライトしない
            if (this.isFilterActive()) {
                return;
            }
            
            // ホバーハイライトを適用（3層目）
            this.highlightPaperIdPath(node);
        });

        this.cy.on('mouseout', 'node', (event) => {
            const node = event.target;
            
            // ホバーハイライトをクリア（3層目を透明に）
            this.clearHighlight();
        });
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
     * ハイライトをクリア（3層目を透明に）
     */
    clearHighlight() {
        // すべての要素の透明度を元に戻す
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
                        ele.style('background-color', originalBg);
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
     * 全要素の色を元に戻す（1層目に戻す）
     */
    resetAllColors() {
        this.cy.elements().forEach(ele => {
            if (ele.isNode()) {
                const baseColor = ele.data('_baseColor') || '#2563eb';
                ele.style({
                    'background-color': baseColor,
                    'border-width': stylePanel ? stylePanel.nodeStyles.borderWidth.value : 0,
                    'border-color': stylePanel ? stylePanel.getStyleValue(ele, 'borderColor', stylePanel.nodeStyles.borderColor) : '#000000'
                });
                // ホバー用の一時データもクリア
                ele.removeData('_hoverOriginalBg');
                ele.removeData('_hoverOriginalOpacity');
            } else if (ele.isEdge()) {
                const baseColor = ele.data('_baseLineColor') || '#94a3b8';
                const baseWidth = ele.data('_baseWidth') || 2;
                ele.style({
                    'line-color': baseColor,
                    'target-arrow-color': baseColor,
                    'width': baseWidth
                });
                // ホバー用の一時データもクリア
                ele.removeData('_hoverOriginalLineColor');
                ele.removeData('_hoverOriginalOpacity');
            }
            // 透明度を完全にリセット
            ele.style('opacity', 1);
        });
    }

    /**
     * ホバーハイライト機能のON/OFF
     */
    toggleHoverHighlight(enabled) {
        this.isHoverHighlightEnabled = enabled;
        if (!enabled) {
            this.clearHighlight();
        }
    }

    /**
     * 選択機能のON/OFF
     */
    setSelectionEnabled(enabled) {
        this.isSelectionEnabled = enabled;
        if (!enabled) {
            // 選択を無効化するときは、現在の選択を解除
            this.cy.elements().unselect();
        }
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
    createNetwork(data, mappings) {
        // StylePanelをリセット
        if (typeof stylePanel !== 'undefined' && stylePanel) {
            stylePanel.resetStyles();
        }
        
        // FileHandlerのファイルパスをクリア（Import時）
        if (typeof fileHandler !== 'undefined' && fileHandler) {
            fileHandler.currentFilePath = null;
        }
        
        const nodes = new Map();
        const edges = [];

        // Source/Targetカラムを取得
        const sourceColumn = Object.keys(mappings).find(col => mappings[col].role === 'Source');
        const targetColumn = Object.keys(mappings).find(col => mappings[col].role === 'Target');

        if (!sourceColumn) {
            throw new Error('Source column is required');
        }

        data.forEach((row, index) => {
            const sourceId = String(row[sourceColumn] || '').trim();
            if (!sourceId) return;

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
        });

        // グラフをクリアして要素を追加
        this.cy.elements().remove();
        this.cy.add([...nodes.values(), ...edges]);

        // Style Panelのスタイルを適用
        if (typeof stylePanel !== 'undefined' && stylePanel) {
            setTimeout(() => stylePanel.reapplyStyles(), 100);
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
            case 'Date':
                return new Date(value).toISOString();
            case 'String Array':
                return String(value).split(delimiter).map(s => s.trim());
            case 'Number Array':
                return String(value).split(delimiter).map(s => Number(s.trim()) || 0);
            case 'Date Array':
                return String(value).split(delimiter).map(s => new Date(s.trim()).toISOString());
            default:
                return String(value);
        }
    }

    /**
     * 既存ノードにテーブルデータを追加
     * @param {Array} data - 行データの配列
     * @param {Object} mappings - カラムマッピング設定
     */
    addTableData(data, mappings) {
        const sourceColumn = Object.keys(mappings).find(col => mappings[col].role === 'Source');
        
        if (!sourceColumn) {
            throw new Error('Source column is required');
        }

        let matchedCount = 0;

        data.forEach(row => {
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
        });

        // Style Panelのスタイルを再適用
        if (typeof stylePanel !== 'undefined' && stylePanel) {
            setTimeout(() => stylePanel.reapplyStyles(), 100);
        }

        return {
            matchedCount,
            totalRows: data.length
        };
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
        if (window.tablePanel) {
            tablePanel.clearTable();
        }
        
        // Layout Toolsパネルをクリア
        if (window.layoutTools) {
            layoutTools.closePanel();
            layoutTools.resetOriginalPositions();
        }
        
        // StylePanelをリセット
        if (window.stylePanel) {
            stylePanel.resetStyles();
        }
        
        // FileHandlerのファイルパスをクリア
        if (window.fileHandler) {
            fileHandler.currentFilePath = null;
            fileHandler.currentFileHandle = null;
        }
        
        // Edge Bendsパネルをクリア
        if (window.edgeBends) {
            edgeBends.closePanel();
        }
        
        // Sort Nodesパネルをクリア
        if (window.sortNodesPanel) {
            sortNodesPanel.closePanel();
        }
        
        // Style Panelをクリア
        if (window.stylePanel) {
            stylePanel.closePanel();
        }
        
        // Layout Managerの設定をクリア
        if (window.layoutManager) {
            layoutManager.currentLayout = null;
            if (window.menuManager) {
                menuManager.updateLayoutCheckmarks();
            }
        }
    }

    /**
     * グラフをビューにフィット
     */
    fit(padding = 50) {
        this.cy.fit(padding);
    }

    /**
     * ノードを取得
     */
    getNodes() {
        return this.cy.nodes();
    }

    /**
     * エッジを取得
     */
    getEdges() {
        return this.cy.edges();
    }
}

// グローバルインスタンス
let networkManager;

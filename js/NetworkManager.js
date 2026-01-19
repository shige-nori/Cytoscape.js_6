/**
 * NetworkManager - Cytoscape.jsグラフの管理クラス
 */
class NetworkManager {
    constructor() {
        this.cy = null;
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
            boxSelectionEnabled: true,
            selectionType: 'single'
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
            const node = event.target;
            const currentBg = node.style('background-color');
            node.data('_originalBg', currentBg);
            node.style({
                'background-color': '#eab308',
                'border-width': 3,
                'border-color': '#ca8a04'
            });
        });

        this.cy.on('unselect', 'node', (event) => {
            const node = event.target;
            const originalBg = node.data('_originalBg');
            if (originalBg) {
                node.style('background-color', originalBg);
            }
            node.style({
                'border-width': stylePanel ? stylePanel.nodeStyles.borderWidth.value : 0,
                'border-color': stylePanel ? stylePanel.getStyleValue(node, 'borderColor', stylePanel.nodeStyles.borderColor) : '#000000'
            });
        });

        this.cy.on('select', 'edge', (event) => {
            const edge = event.target;
            const currentColor = edge.style('line-color');
            const currentWidth = edge.style('width');
            edge.data('_originalLineColor', currentColor);
            edge.data('_originalWidth', currentWidth);
            edge.style({
                'line-color': '#ef4444',
                'target-arrow-color': '#ef4444',
                'width': 3
            });
        });

        this.cy.on('unselect', 'edge', (event) => {
            const edge = event.target;
            const originalColor = edge.data('_originalLineColor');
            const originalWidth = edge.data('_originalWidth');
            if (originalColor) {
                edge.style('line-color', originalColor);
                edge.style('target-arrow-color', originalColor);
            }
            if (originalWidth) {
                edge.style('width', originalWidth);
            }
        });

        // Ctrl+クリックで複数選択
        this.cy.on('tap', 'node, edge', (event) => {
            if (!event.originalEvent.ctrlKey && !event.originalEvent.metaKey) {
                this.cy.elements().unselect();
            }
            event.target.select();
        });

        // 背景クリックで選択解除
        this.cy.on('tap', (event) => {
            if (event.target === this.cy) {
                this.cy.elements().unselect();
            }
        });
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

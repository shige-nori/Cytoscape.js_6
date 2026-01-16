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
            minZoom: 0.1,
            maxZoom: 5,
            wheelSensitivity: 0.3,
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
                    'text-valign': 'center',
                    'text-halign': 'center',
                    'font-size': '10px',
                    'color': '#fff',
                    'text-outline-width': 0,
                    'text-wrap': 'ellipsis',
                    'text-max-width': '80px'
                }
            },
            {
                selector: 'node:selected',
                style: {
                    'background-color': '#f97316',
                    'border-width': 3,
                    'border-color': '#ea580c'
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
                    'line-color': '#f97316',
                    'width': 3
                }
            }
        ];
    }

    /**
     * イベントリスナーを設定
     */
    setupEventListeners() {
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
     * ネットワークデータからグラフを作成
     * @param {Array} data - 行データの配列
     * @param {Object} mappings - カラムマッピング設定
     */
    createNetwork(data, mappings) {
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

            // Sourceノードに属性を追加
            this.addAttributesToNode(nodes.get(sourceId), row, mappings, sourceColumn);

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

                    // エッジを追加
                    edges.push({
                        data: {
                            id: `edge-${index}`,
                            source: sourceId,
                            target: targetId
                        }
                    });
                }
            }
        });

        // グラフをクリアして要素を追加
        this.cy.elements().remove();
        this.cy.add([...nodes.values(), ...edges]);

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

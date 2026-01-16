/**
 * LayoutManager - レイアウト管理クラス
 */
class LayoutManager {
    constructor() {
        // cytoscape-dagre拡張を登録
        if (typeof cytoscape !== 'undefined' && typeof cytoscapeDagre !== 'undefined') {
            cytoscape.use(cytoscapeDagre);
        }
    }

    /**
     * Dagreレイアウトを適用（デフォルト）
     */
    applyDagreLayout() {
        if (!networkManager || !networkManager.cy) return;
        
        const layout = networkManager.cy.layout({
            name: 'dagre',
            rankDir: 'TB',          // Top to Bottom
            nodeSep: 50,            // ノード間の水平間隔
            rankSep: 80,            // 階層間の垂直間隔
            edgeSep: 10,            // エッジ間の間隔
            ranker: 'network-simplex',
            animate: true,
            animationDuration: 500,
            fit: true,
            padding: 50
        });
        
        layout.run();
    }

    /**
     * Equalレイアウトを適用（縦横比1:1で均等配置）
     */
    applyEqualLayout() {
        if (!networkManager || !networkManager.cy) return;

        const nodes = networkManager.cy.nodes();
        if (nodes.length === 0) return;

        // 現在のY座標で階層をグループ化
        const layers = this.groupNodesByLayer(nodes);
        
        // 最大のノード数を持つ階層を取得
        const maxNodesInLayer = Math.max(...Array.from(layers.values()).map(l => l.length));
        
        // 全体のサイズを計算（縦横比1:1）
        const spacing = 100;  // ノード間隔
        const totalWidth = maxNodesInLayer * spacing;
        const totalHeight = layers.size * spacing;
        
        // 正方形に近づけるためのスケーリング
        const size = Math.max(totalWidth, totalHeight);
        
        // 各階層内でノードを均等配置
        const layerArray = Array.from(layers.entries()).sort((a, b) => a[0] - b[0]);
        const layerSpacing = size / (layers.size + 1);
        
        layerArray.forEach(([layerY, layerNodes], layerIndex) => {
            const y = (layerIndex + 1) * layerSpacing;
            const nodeSpacing = size / (layerNodes.length + 1);
            
            layerNodes.forEach((node, nodeIndex) => {
                const x = (nodeIndex + 1) * nodeSpacing;
                node.position({ x, y });
            });
        });

        // アニメーションでビューをフィット
        networkManager.cy.animate({
            fit: {
                eles: networkManager.cy.elements(),
                padding: 50
            },
            duration: 500
        });
    }

    /**
     * Y座標でノードを階層にグループ化
     * @param {Object} nodes - Cytoscapeノードコレクション
     * @returns {Map} 階層マップ
     */
    groupNodesByLayer(nodes) {
        const layers = new Map();
        const tolerance = 10; // Y座標の許容誤差
        
        nodes.forEach(node => {
            const y = Math.round(node.position('y') / tolerance) * tolerance;
            
            if (!layers.has(y)) {
                layers.set(y, []);
            }
            layers.get(y).push(node);
        });
        
        return layers;
    }
}

// グローバルインスタンス
let layoutManager;

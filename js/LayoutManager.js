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
        
        // 縦横比1:1になるように正方形のサイズを計算
        const layerCount = layers.size;
        const size = 1000;  // 正方形の一辺のサイズ
        
        // 各階層内でノードを均等配置（両端のノードの端を揃える）
        const layerArray = Array.from(layers.entries()).sort((a, b) => a[0] - b[0]);
        
        layerArray.forEach(([layerY, layerNodes], layerIndex) => {
            // Y座標：ノードの高さを考慮して両端を揃える
            if (layerCount > 1) {
                if (layerIndex === 0) {
                    // 最初の階層：上端を0に揃える
                    const nodeHeight = layerNodes[0].height();
                    const y = nodeHeight / 2;
                    layerNodes.forEach(node => node.position('y', y));
                } else if (layerIndex === layerCount - 1) {
                    // 最後の階層：下端をsizeに揃える
                    const nodeHeight = layerNodes[0].height();
                    const y = size - nodeHeight / 2;
                    layerNodes.forEach(node => node.position('y', y));
                } else {
                    // 中間の階層：上下の端に揃えた階層間で均等配置
                    const firstNodeHeight = nodes[0].height();
                    const lastNodeHeight = nodes[nodes.length - 1].height();
                    const availableHeight = size - firstNodeHeight / 2 - lastNodeHeight / 2;
                    const y = firstNodeHeight / 2 + (layerIndex / (layerCount - 1)) * availableHeight;
                    layerNodes.forEach(node => node.position('y', y));
                }
            } else {
                // 階層が1つの場合は中央に配置
                const y = size / 2;
                layerNodes.forEach(node => node.position('y', y));
            }
            
            // X座標：ノードの幅を考慮して両端を揃える
            layerNodes.forEach((node, nodeIndex) => {
                const nodeWidth = node.width();
                
                if (layerNodes.length > 1) {
                    if (nodeIndex === 0) {
                        // 最初のノード：左端を0に揃える
                        const x = nodeWidth / 2;
                        node.position('x', x);
                    } else if (nodeIndex === layerNodes.length - 1) {
                        // 最後のノード：右端をsizeに揃える
                        const x = size - nodeWidth / 2;
                        node.position('x', x);
                    } else {
                        // 中間のノード：左右の端に揃えたノード間で均等配置
                        const firstNodeWidth = layerNodes[0].width();
                        const lastNodeWidth = layerNodes[layerNodes.length - 1].width();
                        const availableWidth = size - firstNodeWidth / 2 - lastNodeWidth / 2;
                        const x = firstNodeWidth / 2 + (nodeIndex / (layerNodes.length - 1)) * availableWidth;
                        node.position('x', x);
                    }
                } else {
                    // ノードが1つの場合は中央に配置
                    const x = size / 2;
                    node.position('x', x);
                }
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

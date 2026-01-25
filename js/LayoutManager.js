import { appContext } from './AppContext.js';

/**
 * LayoutManager - レイアウト管理クラス
 */
export class LayoutManager {
    constructor() {
        // cytoscape-dagre拡張を登録
        if (typeof cytoscape !== 'undefined' && typeof cytoscapeDagre !== 'undefined') {
            cytoscape.use(cytoscapeDagre);
        }
        
        // 現在適用されているレイアウトの状態
        this.currentLayout = null; // 'dagre' or 'equal'
    }

    /**
     * Dagreレイアウトを適用（デフォルト）
     */
    async applyDagreLayout(options = {}) {
        if (!appContext.networkManager || !appContext.networkManager.cy) return;

        const {
            animate = true,
            fit = true,
            padding = 50,
            animationDuration = 500
        } = options;

        const layout = appContext.networkManager.cy.layout({
            name: 'dagre',
            rankDir: 'TB',          // Top to Bottom
            nodeSep: 50,            // ノード間の水平間隔
            rankSep: 80,            // 階層間の垂直間隔
            edgeSep: 10,            // エッジ間の間隔
            ranker: 'network-simplex',
            animate,
            animationDuration,
            fit,
            padding
        });

        await new Promise(resolve => {
            layout.one('layoutstop', resolve);
            layout.run();
        });

        // 現在のレイアウトを記録
        this.currentLayout = 'dagre';

        // メニューのチェックマークを更新
        if (appContext.menuManager) {
            appContext.menuManager.updateLayoutCheckmarks();
        }

        if (appContext.historyManager) {
            appContext.historyManager.captureState('layout-dagre');
        }
    }

    /**
     * Equalレイアウトを適用（縦横比1:1で均等配置）
     */
    applyEqualLayout() {
        if (!appContext.networkManager || !appContext.networkManager.cy) return;

        const nodes = appContext.networkManager.cy.nodes();
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
        appContext.networkManager.cy.animate({
            fit: {
                eles: appContext.networkManager.cy.elements(),
                padding: 50
            },
            duration: 500
        });
        
        // 現在のレイアウトを記録
        this.currentLayout = 'equal';
        
        // メニューのチェックマークを更新
        if (appContext.menuManager) {
            appContext.menuManager.updateLayoutCheckmarks();
        }

        if (appContext.historyManager) {
            appContext.historyManager.captureState('layout-equal');
        }
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

    /**
     * 階層ごとにノードID順にノードを並び替え
     * 注意: 並び替えは常に階層単位で実施され、階層間の順序は変更しない
     */
    sortNodesAZ() {
        if (!appContext.networkManager || !appContext.networkManager.cy) return;

        const nodes = appContext.networkManager.cy.nodes();
        if (nodes.length === 0) return;

        // ステップ1: 現在のY座標で階層をグループ化（階層間の順序は変更しない）
        const layers = this.groupNodesByLayer(nodes);
        
        // ステップ2: 階層をY座標順に並べる
        const layerArray = Array.from(layers.entries()).sort((a, b) => a[0] - b[0]);
        
        // ステップ3: 各階層内でのみノードをID順にソート（常に昇順）
        layerArray.forEach(([layerY, layerNodes]) => {
            // 階層内のノードをID順に昇順ソート
            layerNodes.sort((a, b) => {
                const idA = a.id();
                const idB = b.id();
                return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
            });
            
            // 階層内の現在のX座標範囲を取得（階層の幅を維持）
            const xPositions = layerNodes.map(node => node.position('x')).sort((a, b) => a - b);
            const minX = xPositions[0];
            const maxX = xPositions[xPositions.length - 1];
            const spacing = layerNodes.length > 1 ? (maxX - minX) / (layerNodes.length - 1) : 0;
            
            // 階層内でソートされた順序でX座標を再配置（Y座標は変更しない）
            layerNodes.forEach((node, index) => {
                const x = layerNodes.length > 1 ? minX + (index * spacing) : minX;
                node.position({ x, y: layerY }); // Y座標は階層のまま維持
            });
        });

        // アニメーションでビューをフィット
        appContext.networkManager.cy.animate({
            fit: {
                eles: appContext.networkManager.cy.elements(),
                padding: 50
            },
            duration: 500
        });
        
        // Layout Toolsの基準位置をリセット（並び替えを維持するため）
        if (appContext.layoutTools) {
            appContext.layoutTools.resetOriginalPositions();
        }

        if (appContext.historyManager) {
            appContext.historyManager.captureState('sort-az');
        }
    }

    /**
     * 列単位（Y-axis）でノードID順にノードを並び替え
     * 注意: 並び替えは常に列単位で実施され、列間の順序は変更しない
     */
    sortNodesByColumn() {
        if (!appContext.networkManager || !appContext.networkManager.cy) return;

        const nodes = appContext.networkManager.cy.nodes();
        if (nodes.length === 0) return;

        // ステップ1: X座標で列をグループ化（列間の順序は変更しない）
        const columns = new Map();
        const tolerance = 10; // X座標の許容誤差
        
        nodes.forEach(node => {
            const x = Math.round(node.position('x') / tolerance) * tolerance;
            if (!columns.has(x)) {
                columns.set(x, []);
            }
            columns.get(x).push(node);
        });
        
        // ステップ2: 列をX座標順に並べる
        const columnArray = Array.from(columns.entries()).sort((a, b) => a[0] - b[0]);
        
        // ステップ3: 各列内でのみノードをID順にソート（常に昇順）
        columnArray.forEach(([columnX, columnNodes]) => {
            // 列内のノードをID順に昇順ソート
            columnNodes.sort((a, b) => {
                const idA = a.id();
                const idB = b.id();
                return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
            });
            
            // 列内の現在のY座標範囲を取得（列の高さを維持）
            const yPositions = columnNodes.map(node => node.position('y')).sort((a, b) => a - b);
            const minY = yPositions[0];
            const maxY = yPositions[yPositions.length - 1];
            const spacing = columnNodes.length > 1 ? (maxY - minY) / (columnNodes.length - 1) : 0;
            
            // 列内でソートされた順序でY座標を再配置（X座標は変更しない）
            columnNodes.forEach((node, index) => {
                const y = columnNodes.length > 1 ? minY + (index * spacing) : minY;
                node.position({ x: columnX, y }); // X座標は列のまま維持
            });
        });

        // アニメーションでビューをフィット
        appContext.networkManager.cy.animate({
            fit: {
                eles: appContext.networkManager.cy.elements(),
                padding: 50
            },
            duration: 500
        });
        
        // Layout Toolsの基準位置をリセット（並び替えを維持するため）
        if (appContext.layoutTools) {
            appContext.layoutTools.resetOriginalPositions();
        }

        if (appContext.historyManager) {
            appContext.historyManager.captureState('sort-column');
        }
    }
}

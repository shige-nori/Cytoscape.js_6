/**
 * Selection utilities for filter/table synchronization
 */
import { appContext } from './AppContext.js';

export function expandSelectionWithConnections(cy, nodes, edges) {
    const nodeMap = new Map();
    const edgeMap = new Map();
    const hasExplicitEdges = Array.isArray(edges) && edges.length > 0;

    (nodes || []).forEach(node => {
        if (node) nodeMap.set(node.id(), node);
    });

    (edges || []).forEach(edge => {
        if (edge) edgeMap.set(edge.id(), edge);
    });

    if (!hasExplicitEdges && nodeMap.size >= 2) {
        cy.edges().forEach(edge => {
            const src = edge.source();
            const tgt = edge.target();
            if (src && tgt && nodeMap.has(src.id()) && nodeMap.has(tgt.id())) {
                edgeMap.set(edge.id(), edge);
            }
        });
    }

    if (edgeMap.size > 0) {
        edgeMap.forEach(edge => {
            const src = edge.source();
            const tgt = edge.target();
            if (src) nodeMap.set(src.id(), src);
            if (tgt) nodeMap.set(tgt.id(), tgt);
        });
    }

    return {
        nodes: Array.from(nodeMap.values()),
        edges: Array.from(edgeMap.values())
    };
}

export function applySelectionToCy(cy, nodes, edges, options = {}) {
    const { setOpacity = false } = options;

    // 外部でフィルター解除等の操作中にプログラム的な選択を抑止する場合がある
    if (appContext && appContext.suppressProgrammaticSelection) {
        return;
    }

    const nodeIds = new Set((nodes || []).map(node => node.id()));
    const edgeIds = new Set((edges || []).map(edge => edge.id()));

    // まず全選択解除（視覚的なクリーンアップ）
    cy.elements().unselect();

    // 選択フラグを付ける順序に注意:
    // エッジを先に選択→エッジの select ハンドラが両端ノードを選択する場合、
    // ノード選択ハンドラが誤って並列エッジを自動選択するのを抑制するため
    (edges || []).forEach(edge => edge.select());
    (nodes || []).forEach(node => node.select());

    // NetworkManager のイベントハンドラが抑止されている場合でも
    // 選択スタイルが反映されるように、ここで元スタイルを保存して
    // 選択スタイルを直接適用する
    (nodes || []).forEach(node => {
        try {
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
        } catch (e) {
            // 応急処置: 個別要素で失敗しても他に影響を与えない
            console.warn('applySelectionToCy: node style apply failed', e);
        }
    });

    (edges || []).forEach(edge => {
        try {
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
        } catch (e) {
            console.warn('applySelectionToCy: edge style apply failed', e);
        }
    });

    if (setOpacity) {
        cy.nodes().forEach(node => {
            node.style('opacity', nodeIds.has(node.id()) ? 1 : 0.8);
        });
        cy.edges().forEach(edge => {
            edge.style('opacity', edgeIds.has(edge.id()) ? 1 : 0.8);
        });
    }
}

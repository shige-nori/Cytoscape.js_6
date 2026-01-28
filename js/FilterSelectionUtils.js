/**
 * Selection utilities for filter/table synchronization
 */
export function expandSelectionWithConnections(cy, nodes, edges) {
    const nodeMap = new Map();
    const edgeMap = new Map();

    (nodes || []).forEach(node => {
        if (node) nodeMap.set(node.id(), node);
    });

    (edges || []).forEach(edge => {
        if (edge) edgeMap.set(edge.id(), edge);
    });

    if (nodeMap.size >= 2) {
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

    const nodeIds = new Set((nodes || []).map(node => node.id()));
    const edgeIds = new Set((edges || []).map(edge => edge.id()));

    cy.elements().unselect();

    (nodes || []).forEach(node => node.selectify());
    (edges || []).forEach(edge => edge.selectify());

    (nodes || []).forEach(node => node.select());
    (edges || []).forEach(edge => edge.select());

    if (setOpacity) {
        cy.nodes().forEach(node => {
            node.style('opacity', nodeIds.has(node.id()) ? 1 : 0.8);
        });
        cy.edges().forEach(edge => {
            edge.style('opacity', edgeIds.has(edge.id()) ? 1 : 0.8);
        });
    }
}

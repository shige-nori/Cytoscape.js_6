import { appContext } from './AppContext.js';

/**
 * HistoryManager - Undo/Redo履歴管理
 */
export class HistoryManager {
    constructor(maxHistory = 10) {
        this.maxHistory = maxHistory;
        this.undoStack = [];
        this.redoStack = [];
        this.isRestoring = false;
        this.pendingTimer = null;
        this.lastSerialized = null;
        this.restoreGuardTimer = null;
    }

    canUndo() {
        return this.undoStack.length > 1;
    }

    canRedo() {
        return this.redoStack.length > 0;
    }

    captureState(reason = '') {
        if (this.isRestoring) return;
        const snapshot = this.createSnapshot();
        if (!snapshot) return;

        const serialized = JSON.stringify(snapshot);
        if (serialized === this.lastSerialized) return;

        this.lastSerialized = serialized;
        this.undoStack.push({ snapshot, reason, serialized });
        if (this.undoStack.length > this.maxHistory) {
            this.undoStack.shift();
        }
        this.redoStack = [];
        this.notifyStateChanged();
    }

    captureSoon(reason = '') {
        if (this.isRestoring) return;
        if (this.pendingTimer) {
            clearTimeout(this.pendingTimer);
        }
        this.pendingTimer = setTimeout(() => {
            this.pendingTimer = null;
            this.captureState(reason);
        }, 300);
    }

    undo() {
        this.pruneDuplicateTails();
        if (!this.canUndo()) return;
        this.isRestoring = true;
        const current = this.undoStack.pop();
        this.redoStack.push(current);
        const prev = this.undoStack[this.undoStack.length - 1];
        this.applySnapshot(prev.snapshot);
        this.setRestoreGuard();
        this.notifyStateChanged();
    }

    redo() {
        if (!this.canRedo()) return;
        this.isRestoring = true;
        const next = this.redoStack.pop();
        this.undoStack.push(next);
        this.applySnapshot(next.snapshot);
        this.setRestoreGuard();
        this.notifyStateChanged();
    }

    setRestoreGuard() {
        if (this.restoreGuardTimer) {
            clearTimeout(this.restoreGuardTimer);
        }
        this.restoreGuardTimer = setTimeout(() => {
            this.isRestoring = false;
            this.restoreGuardTimer = null;
        }, 400);
    }

    pruneDuplicateTails() {
        while (this.undoStack.length >= 2) {
            const last = this.undoStack[this.undoStack.length - 1];
            const prev = this.undoStack[this.undoStack.length - 2];
            if (last && prev && last.serialized && prev.serialized && last.serialized === prev.serialized) {
                this.undoStack.pop();
            } else {
                break;
            }
        }
        const last = this.undoStack[this.undoStack.length - 1];
        if (last?.serialized) {
            this.lastSerialized = last.serialized;
        }
    }

    notifyStateChanged() {
        if (appContext.menuManager && typeof appContext.menuManager.updateHistoryButtons === 'function') {
            appContext.menuManager.updateHistoryButtons();
        }
    }

    createSnapshot() {
        if (!appContext.networkManager || !appContext.networkManager.cy) return null;

        const cy = appContext.networkManager.cy;

        const nodes = cy.nodes().map(node => ({
            data: { ...node.data() },
            position: { ...node.position() }
        }));

        const edges = cy.edges().map(edge => ({
            data: { ...edge.data() }
        }));

        const edgeBendsSettings = appContext.edgeBends ? {
            bendStrength: appContext.edgeBends.currentBendStrength,
            edgeStyles: cy.edges().map(edge => ({
                id: edge.id(),
                curveStyle: edge.style('curve-style'),
                controlPointDistances: edge.style('control-point-distances'),
                controlPointWeights: edge.style('control-point-weights')
            }))
        } : null;

        const styleSettings = appContext.stylePanel ? {
            nodeStyles: appContext.stylePanel.nodeStyles,
            edgeStyles: appContext.stylePanel.edgeStyles,
            networkStyles: appContext.stylePanel.networkStyles
        } : null;

        const overlayLayers = appContext.layerManager ? appContext.layerManager.exportLayers() : [];

        return JSON.parse(JSON.stringify({
            nodes,
            edges,
            edgeBendsSettings,
            styleSettings,
            overlayLayers
        }));
    }

    applySnapshot(snapshot) {
        if (!snapshot || !appContext.networkManager || !appContext.networkManager.cy) return;

        const cy = appContext.networkManager.cy;

        cy.elements().remove();

        const elements = [
            ...snapshot.nodes.map(n => ({ data: n.data, position: n.position })),
            ...snapshot.edges.map(e => ({ data: e.data }))
        ];

        if (elements.length > 0) {
            cy.add(elements);
        }

        if (snapshot.edgeBendsSettings && appContext.edgeBends) {
            appContext.edgeBends.currentBendStrength = snapshot.edgeBendsSettings.bendStrength || 40;
            const slider = document.getElementById('bend-strength-slider');
            const valueInput = document.getElementById('bend-strength-value');
            if (slider) slider.value = appContext.edgeBends.currentBendStrength;
            if (valueInput) valueInput.value = appContext.edgeBends.currentBendStrength;

            if (snapshot.edgeBendsSettings.edgeStyles) {
                snapshot.edgeBendsSettings.edgeStyles.forEach(edgeStyle => {
                    const edge = cy.getElementById(edgeStyle.id);
                    if (edge.length > 0) {
                        const style = {};
                        if (edgeStyle.curveStyle && edgeStyle.curveStyle !== 'undefined') {
                            style['curve-style'] = edgeStyle.curveStyle;
                        }
                        if (edgeStyle.controlPointDistances !== undefined && edgeStyle.controlPointDistances !== 'undefined') {
                            style['control-point-distances'] = edgeStyle.controlPointDistances;
                        }
                        if (edgeStyle.controlPointWeights !== undefined && edgeStyle.controlPointWeights !== 'undefined') {
                            style['control-point-weights'] = edgeStyle.controlPointWeights;
                        }
                        if (Object.keys(style).length > 0) {
                            edge.style(style);
                        }
                    }
                });
            }
        }

        if (snapshot.styleSettings && appContext.stylePanel) {
            appContext.stylePanel.nodeStyles = snapshot.styleSettings.nodeStyles || appContext.stylePanel.nodeStyles;
            appContext.stylePanel.edgeStyles = snapshot.styleSettings.edgeStyles || appContext.stylePanel.edgeStyles;
            if (snapshot.styleSettings.networkStyles) {
                appContext.stylePanel.networkStyles = snapshot.styleSettings.networkStyles;
            }
            appContext.stylePanel.reapplyStyles();
        } else if (appContext.stylePanel) {
            appContext.stylePanel.reapplyStyles();
        }

        if (appContext.layerManager) {
            if (snapshot.overlayLayers && Array.isArray(snapshot.overlayLayers)) {
                appContext.layerManager.importLayers(snapshot.overlayLayers);
            } else {
                appContext.layerManager.clearAll();
            }
        }

        cy.resize();
    }
}

import { appContext } from './AppContext.js';

/**
 * WebPageExporter - ネットワーク図をスタンドアロンHTMLとしてエクスポート
 */
export class WebPageExporter {
    constructor() {
        // No initialization needed
    }

    /**
     * 現在のネットワークをWebページとしてエクスポート
     * @returns {Promise<void>}
     */
    async exportNetworkToWebPage() {
        const cy = appContext.networkManager?.cy;
        if (!cy) {
            throw new Error('No network loaded');
        }

        // ネットワークデータを取得（JSON形式で完全にエクスポート）
        const elements = [];
        // Style設定の「真の情報源」
        // - nodes/edges の見た目は applyNodeStyles/applyEdgeStyles が element に直接バイパス適用している
        // - Edge Bends は edge.style に保存される
        // よって、エクスポート時は「現在の element の computed style」を取得してHTML側で適用する
        const elementStyleOverrides = { nodes: {}, edges: {} };

        const normalizeNumberOrArray = (value) => {
            if (value === undefined || value === null) return null;
            if (Array.isArray(value)) return value.map(v => parseFloat(v)).filter(v => !Number.isNaN(v));
            if (typeof value === 'number') return Number.isNaN(value) ? null : value;
            if (typeof value === 'string') {
                const trimmed = value.trim();
                if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return null;
                if (trimmed.includes(',') || trimmed.includes(' ')) {
                    const parts = trimmed.split(/[ ,]+/).map(v => parseFloat(v)).filter(v => !Number.isNaN(v));
                    return parts.length ? parts : null;
                }
                const num = parseFloat(trimmed);
                return Number.isNaN(num) ? null : num;
            }
            return null;
        };

        const safeStyleValue = (value) => {
            if (value === undefined || value === null) return null;
            if (typeof value === 'string') {
                const trimmed = value.trim();
                if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return null;
                return value;
            }
            return value;
        };

        cy.elements().forEach(ele => {
            const data = { ...ele.data() };
            if (!data.id) data.id = ele.id();

            if (ele.isEdge()) {
                if (!data.source) data.source = ele.source().id();
                if (!data.target) data.target = ele.target().id();
                if (!data.source || !data.target) {
                    return; // 無効なエッジはスキップ
                }
            }

            const eleData = {
                group: ele.group(),
                data,
                classes: ele.classes()
            };

            if (ele.isNode()) {
                eleData.position = {
                    x: ele.position('x'),
                    y: ele.position('y')
                };
            }

            // element に適用済みの computed style を取得して保存
            const props = ele.style();
            const customStyle = {};

            if (ele.isNode()) {
                const nodeProps = [
                    'background-color',
                    'width',
                    'height',
                    'shape',
                    'border-width',
                    'border-color',
                    'label',
                    'font-size',
                    'color',
                    'text-valign',
                    'text-halign',
                    'text-outline-width',
                    'text-outline-color',
                    'text-wrap',
                    'text-max-width',
                    'text-margin-y',
                    'opacity'
                ];
                nodeProps.forEach((prop) => {
                    const value = safeStyleValue(props[prop]);
                    if (value !== null) customStyle[prop] = value;
                });
                if (Object.keys(customStyle).length > 0) {
                    elementStyleOverrides.nodes[data.id] = customStyle;
                }
            } else if (ele.isEdge()) {
                const edgeProps = [
                    'line-color',
                    'width',
                    'line-style',
                    'target-arrow-shape',
                    'target-arrow-color',
                    'source-arrow-shape',
                    'source-arrow-color',
                    'opacity',
                    'curve-style'
                ];
                edgeProps.forEach((prop) => {
                    const value = safeStyleValue(props[prop]);
                    if (value !== null) customStyle[prop] = value;
                });

                const cpDist = normalizeNumberOrArray(props['control-point-distances']);
                const cpWeights = normalizeNumberOrArray(props['control-point-weights']);
                const cpStepSize = normalizeNumberOrArray(props['control-point-step-size']);
                if (cpDist !== null) customStyle['control-point-distances'] = cpDist;
                if (cpWeights !== null) customStyle['control-point-weights'] = cpWeights;
                if (cpStepSize !== null) customStyle['control-point-step-size'] = cpStepSize;

                if (Object.keys(customStyle).length > 0) {
                    elementStyleOverrides.edges[data.id] = customStyle;
                }
            }

            elements.push(eleData);
        });

        // スタイル情報を取得（グローバルスタイル定義）
        const styles = cy.style().json();

        // Network background color (StylePanelで管理)
        const backgroundColor = appContext.stylePanel?.networkStyles?.backgroundPaint?.value
            || document.getElementById('network-background')?.style?.backgroundColor
            || '#ffffff';

        // オーバーレイレイヤーを取得
        const layers = appContext.layerManager ? appContext.layerManager.exportLayers() : [];

        // Edge width設定を取得（Edge Weight Switcher用）
        const edgeWidthConfig = {
            attribute: appContext.stylePanel?.edgeStyles?.width?.attribute || null,
            type: appContext.stylePanel?.edgeStyles?.width?.type || 'default',
            value: appContext.stylePanel?.edgeStyles?.width?.value || 2,
            mapping: appContext.stylePanel?.edgeStyles?.width?.mapping || null
        };

        // HTMLを生成
        const html = this.generateHTML(elements, styles, layers, elementStyleOverrides, backgroundColor, edgeWidthConfig);

        // ダウンロード
        this.downloadHTML(html, 'network.html');
    }

    /**
     * スタンドアロンHTMLを生成
     * @param {Array} elements - Cytoscapeの要素配列
     * @param {Array} styles - Cytoscapeのスタイル配列
     * @param {Array} layers - オーバーレイレイヤーデータ
     * @param {Object} elementStyleOverrides - element単位のstyle（computed）
     * @param {string} backgroundColor - ネットワーク背景色
     * @param {Object} edgeWidthConfig - Edge width設定情報
     * @returns {string} HTML文字列
     */
    generateHTML(elements, styles, layers, elementStyleOverrides, backgroundColor, edgeWidthConfig) {
        // JSONはapplication/jsonスクリプトタグに安全に埋め込むため、base64化
        const toBase64 = (value) => btoa(unescape(encodeURIComponent(value)));
        const elementsJson = toBase64(JSON.stringify(elements));
        const stylesJson = toBase64(JSON.stringify(styles));
        const layersJson = toBase64(JSON.stringify(layers));
        const overridesJson = toBase64(JSON.stringify(elementStyleOverrides));
        const backgroundJson = toBase64(JSON.stringify(backgroundColor));
        const edgeWidthConfigJson = toBase64(JSON.stringify(edgeWidthConfig));

        return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Network Visualization</title>
    <script src="https://unpkg.com/cytoscape@3.28.1/dist/cytoscape.min.js"></script>
    <style>
        * {
            margin: 0;
                if (val.includes(String.fromCharCode(10))) return val.split(String.fromCharCode(10)).map(v => String(v));
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            overflow: hidden;
            background-color: #f8fafc;
        }
        #cy {
            width: 100vw;
            height: 100vh;
            position: absolute;
            top: 40px;
            left: 0;
            background-color: transparent;
            z-index: 2;
        }
        #network-background {
            position: absolute;
            top: 40px;
            left: 0;
            width: 100vw;
            height: 100vh;
            background-color: #ffffff;
            z-index: 0;
        }
        .overlay-container {
            position: absolute;
            top: 40px;
            left: 0;
            width: 100vw;
            height: 100vh;
            pointer-events: none;
            transform-origin: 0 0;
        }
        #overlay-container-back {
            z-index: 1;
        }
        #overlay-container {
            z-index: 3;
        }
        .overlay-object {
            position: absolute;
            box-sizing: border-box;
        }
        .overlay-shape {
            position: absolute;
            box-sizing: border-box;
        }
        .overlay-table-grid {
            border-collapse: collapse;
            width: 100%;
            height: 100%;
        }
        .overlay-table-cell {
            box-sizing: border-box;
            padding: 2px 4px;
            white-space: pre-wrap;
        }
        .top-menubar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 40px;
            background-color: #1e293b;
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 0 12px;
            color: #ffffff;
            z-index: 1100;
            font-size: 14px;
        }
        .top-menubar .menu-item {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .top-menubar .menu-label {
            font-weight: 600;
        }
        .path-trace-toggle {
            border: 1px solid #94a3b8;
            background: #2563eb;
            color: #ffffff;
            padding: 2px 10px;
            border-radius: 999px;
            font-size: 12px;
            cursor: pointer;
        }
        .path-trace-toggle.off {
            background: #e2e8f0;
            color: #0f172a;
        }
        .table-toggle {
            border: 1px solid #94a3b8;
            background: #2563eb;
            color: #ffffff;
            padding: 2px 10px;
            border-radius: 999px;
            font-size: 12px;
            cursor: pointer;
        }
        .table-toggle.off {
            background: #e2e8f0;
            color: #0f172a;
        }
        /* Edge Weight Switcher Modal */
        .weight-switcher-modal-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: transparent;
            z-index: 10000;
            pointer-events: none;
        }
        .weight-switcher-modal-overlay.active {
            display: block;
        }
        .weight-switcher-modal-content {
            position: absolute;
            top: 60px;
            right: 20px;
            background-color: #fff;
            border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            width: 350px;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
            font-size: 14px;
            overflow: hidden;
            pointer-events: auto;
        }
        .weight-switcher-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 12px;
            border-bottom: 1px solid #e2e8f0;
            background-color: #1e293b;
            color: #ffffff;
            border-top-left-radius: 8px;
            border-top-right-radius: 8px;
            cursor: move;
            user-select: none;
        }
        .weight-switcher-modal-header h2 {
            font-size: 16px;
            font-weight: 600;
            color: #ffffff;
            margin: 0;
        }
        .weight-switcher-modal-close {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #ffffff;
            line-height: 1;
            padding: 0;
            width: 24px;
            height: 24px;
        }
        .weight-switcher-modal-close:hover {
            color: #e6eefc;
        }
        .weight-switcher-modal-body {
            padding: 20px;
            overflow-y: auto;
            flex: 1 1 auto;
        }
        .weight-switcher-modal-body label {
            display: block;
            font-weight: 600;
            margin-bottom: 8px;
            color: #0f172a;
        }
        .weight-switcher-modal-body select {
            width: 100%;
            padding: 8px;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            font-size: 14px;
            background-color: #ffffff;
        }
        .weight-switcher-modal-footer {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            padding: 12px 16px;
            border-top: 1px solid #e2e8f0;
        }
        .weight-switcher-modal-footer .btn {
            padding: 6px 16px;
            font-size: 14px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.15s ease;
            font-weight: 600;
        }
        .weight-switcher-modal-footer .btn-primary {
            background-color: #2563eb;
            color: #fff;
        }
        .weight-switcher-modal-footer .btn-primary:hover {
            background-color: #1d4ed8;
        }
        .weight-switcher-modal-footer .btn-secondary {
            background-color: #fff;
            color: #0f172a;
            border: 1px solid #e2e8f0;
        }
        .weight-switcher-modal-footer .btn-secondary:hover {
            background-color: #f8fafc;
        }
        :root {
            --table-panel-height: 0px;
        }
        #cy,
        .overlay-container {
            height: calc(100vh - var(--table-panel-height) - 40px);
        }
        .table-panel {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: var(--table-panel-height);
            background: #ffffff;
            border-top: 1px solid #e2e8f0;
            display: none;
            flex-direction: column;
            z-index: 1001;
        }
        .table-panel.active {
            display: flex;
        }
        .table-panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            background-color: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
            min-height: 40px;
        }
        .table-tabs {
            display: flex;
            gap: 4px;
        }
        .table-tab {
            padding: 6px 16px;
            cursor: pointer;
            border-radius: 4px;
            font-size: 14px;
            color: #64748b;
            user-select: none;
        }
        .table-tab.active {
            background-color: #2563eb;
            color: #ffffff;
            font-weight: 500;
        }
        .table-panel-actions {
            display: flex;
            gap: 8px;
            align-items: center;
        }
        .table-panel-body {
            flex: 1;
            overflow: hidden;
        }
        .table-wrapper {
            width: 100%;
            height: 100%;
            overflow: auto;
        }
        .data-table {
            width: 100%;
            min-width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            background: white;
            table-layout: fixed;
        }
        .data-table thead {
            position: sticky;
            top: 0;
            background: #f3f4f6;
            z-index: 10;
        }
        .data-table thead tr {
            background: #f3f4f6;
        }
        .data-table th {
            position: relative;
            padding: 8px 8px 4px 8px;
            text-align: left;
            font-weight: 600;
            border-bottom: none;
            background: #f3f4f6;
            white-space: nowrap;
            user-select: none;
            overflow: hidden;
            text-overflow: ellipsis;
            min-width: 80px;
        }
        .data-table .filter-row th {
            padding: 0px 8px 8px 8px;
            background-color: #f3f4f6;
            border-top: none;
            border-bottom: 2px solid #e2e8f0;
        }
        .data-table td {
            padding: 8px 8px;
            border-bottom: 1px solid #e2e8f0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            max-width: 200px;
            vertical-align: top;
            user-select: text;
            cursor: text;
        }
        .data-table tbody tr {
            cursor: default;
            transition: background-color 0.15s;
        }
        .data-table tbody tr:hover {
            background-color: rgba(37, 99, 235, 0.05);
        }
        .data-table tbody tr.selected {
            background-color: rgba(249, 115, 22, 0.15);
        }
        .data-table tbody tr.selected:hover {
            background-color: rgba(249, 115, 22, 0.25);
        }
        .resize-handle {
            position: absolute;
            top: 0;
            right: 0;
            width: 5px;
            height: 100%;
            cursor: col-resize;
            user-select: none;
            z-index: 20;
        }
        .resize-handle:hover,
        .resize-handle.active {
            background-color: #2563eb;
        }
        .cell-content {
            display: block;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .cell-array {
            display: flex;
            flex-direction: column;
            gap: 0;
        }
        .cell-array-item {
            padding: 2px 0;
            border-bottom: 1px solid #e2e8f0;
            line-height: 1.4;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .cell-array-item:last-child {
            border-bottom: none;
        }
        .column-filter {
            width: 100%;
            padding: 4px 0px;
            border: 1px solid #e2e8f0;
            border-radius: 3px;
            font-size: 12px;
            box-sizing: border-box;
            transition: border-color 0.2s;
        }
        .column-filter:focus {
            outline: none;
            border-color: #2563eb;
            box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
        }
        .column-filter::placeholder {
            color: #94a3b8;
            font-size: 11px;
        }
        /* Progress Overlay */
        .progress-overlay {
            display: none;
            position: fixed;
            top: 40px; /* Below menu bar */
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(255, 255, 255, 0.9);
            z-index: 3000;
            justify-content: center;
            align-items: center;
            flex-direction: column;
        }
        .progress-overlay.active {
            display: flex;
        }
        .spinner {
            width: 48px;
            height: 48px;
            border: 4px solid #e2e8f0;
            border-top-color: #2563eb;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            to {
                transform: rotate(360deg);
            }
        }
        .progress-text {
            margin-top: 16px;
            color: #64748b;
            font-size: 14px;
        }
        /* Table panel vertical resize handle */
        .table-resize-handle {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 6px;
            cursor: ns-resize;
            z-index: 1200;
            background: transparent;
        }
        .table-resize-handle.active {
            background: rgba(37,99,235,0.12);
        }

        /* Filter Panel Styles */
        .filter-panel {
            display: none;
            position: fixed;
            top: 60px;
            left: 20px;
            width: 500px;
            max-height: 70vh;
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 2500;
            overflow: hidden;
            flex-direction: column;
            font-size: 14px;
        }

        .filter-panel.active {
            display: flex;
        }

        .filter-panel-header {
            padding: 6px 8px;
            background-color: #1e293b;
            border-bottom: 1px solid #e2e8f0;
            border-radius: 6px 6px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: grab;
            user-select: none;
        }

        .filter-panel-header h3 {
            margin: 0;
            font-size: 14px;
            font-weight: 600;
            color: white;
        }

        .filter-panel-close-btn {
            background: none;
            border: none;
            color: white;
            font-size: 18px;
            cursor: pointer;
            padding: 0;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 3px;
            transition: background-color 0.2s;
        }

        .filter-panel-close-btn:hover {
            background-color: rgba(255, 255, 255, 0.2);
        }

        .filter-panel-body {
            padding: 8px;
            overflow-y: auto;
            flex: 1;
        }

        .filter-conditions-container {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .filter-condition {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .filter-condition-row {
            display: flex;
            gap: 4px;
            align-items: center;
        }

        .filter-column-select,
        .filter-operator-select,
        .filter-logical-select {
            padding: 4px 6px;
            height: 28px;
            line-height: 18px;
            border: 1px solid #e2e8f0;
            border-radius: 3px;
            font-size: 14px;
            background-color: white;
            cursor: pointer;
        }

        .filter-column-select { flex: 2; }
        .filter-operator-select { flex: 0.8; }

        .filter-value-input {
            flex: 1.5;
            padding: 4px 6px;
            height: 28px;
            line-height: 18px;
            border: 1px solid #e2e8f0;
            border-radius: 3px;
            font-size: 14px;
        }

        .filter-remove-btn {
            background-color: #ef4444;
            color: white;
            border: none;
            border-radius: 3px;
            width: 22px;
            height: 22px;
            cursor: pointer;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background-color 0.2s;
            flex-shrink: 0;
        }

        .filter-remove-btn:hover {
            background-color: #dc2626;
        }
        
        .filter-logical-row {
            display: flex;
            justify-content: center;
            padding: 3px 0;
        }

        .filter-logical-select {
            width: 100px;
        }

        .filter-add-row {
            display: flex;
            justify-content: center;
            padding: 4px 0;
        }

        .filter-add-btn {
            padding: 8px 12px;
            background-color: #2563eb;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 14px;
            cursor: pointer;
            transition: background-color 0.2s;
            min-height: 36px;
        }

        .filter-add-btn:hover {
            background-color: #1d4ed8;
        }

        .filter-panel-footer {
            padding: 6px 8px;
            border-top: 1px solid #e2e8f0;
            display: flex;
            justify-content: flex-end;
            gap: 6px;
        }

        #filter-clear-btn {
            background-color: #64748b;
            color: white;
            padding: 8px 12px;
            border: none;
            border-radius: 4px;
            font-size: 14px;
            cursor: pointer;
            min-height: 36px;
        }

        #filter-clear-btn:hover {
            background-color: #475569;
        }

        #filter-apply-btn {
            background-color: #2563eb;
            color: white;
            padding: 8px 12px;
            border: none;
            border-radius: 4px;
            font-size: 14px;
            cursor: pointer;
            transition: background-color 0.2s;
            min-height: 36px;
        }

        #filter-apply-btn:hover {
            background-color: #1d4ed8;
        }

        /* Confirm Modal */
        .confirm-modal-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 10000;
            justify-content: center;
            align-items: center;
        }
        .confirm-modal-overlay.active {
            display: flex;
        }
        .confirm-modal-content {
            background-color: #fff;
            border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
            max-width: 400px;
            min-width: 300px;
            width: 90%;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
            font-size: 14px;
            overflow: hidden;
        }
        .confirm-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 8px;
            border-bottom: 1px solid #e2e8f0;
            background-color: #1e293b;
            color: #ffffff;
            border-top-left-radius: 8px;
            border-top-right-radius: 8px;
        }
        .confirm-modal-header h2 {
            font-size: 14px;
            font-weight: 600;
            color: #ffffff;
            margin: 0;
        }
        .confirm-modal-close {
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            color: #ffffff;
            line-height: 1;
        }
        .confirm-modal-close:hover {
            color: #e6eefc;
        }
        .confirm-modal-body {
            padding: 10px 20px;
            overflow-y: auto;
            flex: 1 1 auto;
            white-space: pre-wrap;
            word-break: break-word;
        }
        .confirm-modal-body p {
            margin: 0;
        }
        .confirm-modal-footer {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            padding: 8px 10px;
            border-top: 1px solid #e2e8f0;
        }
        .confirm-modal-footer .btn {
            padding: 5px 12px;
            font-size: 14px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.15s ease;
        }
        .confirm-modal-footer .btn-primary {
            background-color: #2563eb;
            color: #fff;
        }
        .confirm-modal-footer .btn-primary:hover {
            background-color: #1d4ed8;
        }
        .confirm-modal-footer .btn-secondary {
            background-color: #fff;
            color: #0f172a;
            border: 1px solid #e2e8f0;
        }
        .confirm-modal-footer .btn-secondary:hover {
            background-color: #f8fafc;
        }
    </style>
</head>
<body>
    <div class="progress-overlay active" id="progress-overlay">
        <div class="spinner"></div>
        <p class="progress-text">Loading...</p>
    </div>
    <div class="top-menubar">
        <div class="menu-item">
            <span class="menu-label">Table Panel</span>
            <button id="table-panel-toggle" class="table-toggle off">OFF</button>
        </div>
        <div class="menu-item">
            <span class="menu-label">Filter Panel</span>
            <button id="filter-panel-toggle" class="table-toggle off">OFF</button>
        </div>
        <div class="menu-item">
            <span class="menu-label">Path Trace</span>
            <button id="path-trace-toggle" class="path-trace-toggle off">OFF</button>
        </div>
        <div class="menu-item" id="weight-switcher-menu-item" style="display: none; margin-left: 10px;">
            <span class="menu-label">Edge Weight Switcher</span>
            <button id="weight-switcher-toggle" class="table-toggle off">OFF</button>
        </div>
    </div>
    <div id="network-background"></div>
    <div id="cy"></div>
    <div id="overlay-container-back" class="overlay-container"></div>
    <div id="overlay-container" class="overlay-container"></div>

    <div id="filter-panel" class="filter-panel">
        <div class="filter-panel-header">
            <h3>Filter</h3>
            <button id="filter-close-btn" class="filter-panel-close-btn">×</button>
        </div>
        <div class="filter-panel-body">
            <div id="filter-conditions-container" class="filter-conditions-container"></div>
        </div>
        <div class="filter-panel-footer">
            <button id="filter-clear-btn">Clear</button>
            <button id="filter-apply-btn">Apply</button>
        </div>
    </div>

    <div class="table-panel" id="table-panel">
        <div class="table-panel-header">
            <div class="table-tabs">
                <div class="table-tab active" id="node-table-tab">Node Table</div>
                <div class="table-tab" id="edge-table-tab">Edge Table</div>
            </div>
            <div class="table-panel-actions">
                <button class="table-toggle" id="table-filter-apply-btn">Filter</button>
                <button class="table-toggle off" id="table-filter-clear-btn">Clear</button>
            </div>
        </div>
        <div class="table-panel-body">
            <div class="table-wrapper">
                <table class="data-table">
                    <thead></thead>
                    <tbody></tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- Confirm Modal -->
    <div class="confirm-modal-overlay" id="confirm-modal">
        <div class="confirm-modal-content">
            <div class="confirm-modal-header">
                <h2>確認</h2>
                <button class="confirm-modal-close" id="confirm-modal-close">×</button>
            </div>
            <div class="confirm-modal-body">
                <p id="confirm-modal-message"></p>
            </div>
            <div class="confirm-modal-footer">
                <button class="btn btn-secondary" id="confirm-modal-cancel">キャンセル</button>
                <button class="btn btn-primary" id="confirm-modal-ok">OK</button>
            </div>
        </div>
    </div>

    <!-- Edge Weight Switcher Modal -->
    <div class="weight-switcher-modal-overlay" id="weight-switcher-modal">
        <div class="weight-switcher-modal-content">
            <div class="weight-switcher-modal-header">
                <h2>Edge Weight Switcher</h2>
                <button class="weight-switcher-modal-close" id="weight-switcher-modal-close">×</button>
            </div>
            <div class="weight-switcher-modal-body">
                <label for="weight-column-select">Select Weight Column:</label>
                <select id="weight-column-select"></select>
            </div>
            <div class="weight-switcher-modal-footer">
                <button class="btn btn-secondary" id="weight-switcher-cancel">Cancel</button>
                <button class="btn btn-primary" id="weight-switcher-apply">Apply</button>
            </div>
        </div>
    </div>

    <script type="application/json" id="elements-json">${elementsJson}</script>
    <script type="application/json" id="styles-json">${stylesJson}</script>
    <script type="application/json" id="layers-json">${layersJson}</script>
    <script type="application/json" id="overrides-json">${overridesJson}</script>
    <script type="application/json" id="background-json">${backgroundJson}</script>
    <script type="application/json" id="edge-width-config-json">${edgeWidthConfigJson}</script>
    <script>
        try {
            // Loading Overlay Helpers
            const progressOverlay = document.getElementById('progress-overlay');
            const showLoading = (msg = 'Loading...') => {
                if(progressOverlay) {
                    progressOverlay.querySelector('.progress-text').textContent = msg;
                    progressOverlay.classList.add('active');
                }
            };
            const hideLoading = () => {
                if(progressOverlay) progressOverlay.classList.remove('active');
            };

            // Global error handlers to ensure loading overlay is hidden on runtime errors
            window.addEventListener('error', (ev) => {
                try {
                    console.error('Exported page error:', ev.error || ev.message || ev);
                } catch (e) {}
                try { hideLoading(); } catch (e) {}
            });
            window.addEventListener('unhandledrejection', (ev) => {
                try {
                    console.error('Exported page unhandledrejection:', ev.reason);
                } catch (e) {}
                try { hideLoading(); } catch (e) {}
            });

            // Confirm Modal Helper
            const showConfirm = (message) => {
                return new Promise((resolve) => {
                    const modal = document.getElementById('confirm-modal');
                    const messageEl = document.getElementById('confirm-modal-message');
                    const okBtn = document.getElementById('confirm-modal-ok');
                    const cancelBtn = document.getElementById('confirm-modal-cancel');
                    const closeBtn = document.getElementById('confirm-modal-close');
                    
                    if (!modal || !messageEl || !okBtn || !cancelBtn || !closeBtn) {
                        resolve(window.confirm(message));
                        return;
                    }
                    
                    messageEl.textContent = message;
                    modal.classList.add('active');
                    
                    const handleOk = () => {
                        cleanup();
                        resolve(true);
                    };
                    
                    const handleCancel = () => {
                        cleanup();
                        resolve(false);
                    };
                    
                    const cleanup = () => {
                        okBtn.removeEventListener('click', handleOk);
                        cancelBtn.removeEventListener('click', handleCancel);
                        closeBtn.removeEventListener('click', handleCancel);
                        modal.classList.remove('active');
                    };
                    
                    okBtn.addEventListener('click', handleOk);
                    cancelBtn.addEventListener('click', handleCancel);
                    closeBtn.addEventListener('click', handleCancel);
                    
                    // Close on background click
                    modal.addEventListener('click', function bgClick(e) {
                        if (e.target === modal) {
                            modal.removeEventListener('click', bgClick);
                            handleCancel();
                        }
                    });
                });
            };

            // Global Filter Variables
            let filterPanel;
            let externalFilterResults = null;

            // --- FilterEval Logic ---
            function evaluateSingleValue(value, operator, targetValue) {
                if (value === null || value === undefined) value = '';
                const numValue = Number(value);
                const numTarget = Number(targetValue);
                const isNumeric = !isNaN(numValue) && !isNaN(numTarget) && value !== '' && targetValue !== '';
                if (isNumeric) {
                    switch (operator) {
                        case '=': return numValue === numTarget;
                        case '>=': return numValue >= numTarget;
                        case '>': return numValue > numTarget;
                        case '<': return numValue < numTarget;
                        case '<=': return numValue <= numTarget;
                        case '<>': return numValue !== numTarget;
                        default: return false;
                    }
                }
                const ymdRegex = /^\d{4}-\d{2}-\d{2}$/;
                const rawValue = String(value);
                const rawTarget = String(targetValue);
                if (ymdRegex.test(rawValue) && ymdRegex.test(rawTarget)) {
                    switch (operator) {
                        case '=': return rawValue === rawTarget;
                        case '>=': return rawValue >= rawTarget;
                        case '>': return rawValue > rawTarget;
                        case '<': return rawValue < rawTarget;
                        case '<=': return rawValue <= rawTarget;
                        case '<>': return rawValue !== rawTarget;
                        default: return false;
                    }
                }
                const strValue = rawValue.toLowerCase();
                const strTarget = rawTarget.toLowerCase();
                switch (operator) {
                    case '=': return strValue === strTarget;
                    case '>=': return strValue >= strTarget;
                    case '>': return strValue > strTarget;
                    case '<': return strValue < strTarget;
                    case '<=': return strValue <= strTarget;
                    case '<>': return strValue !== strTarget;
                    case 'contains': return strValue.includes(strTarget);
                    default: return false;
                }
            }
            function evaluateCondition(value, operator, targetValue) {
                if (value === null || value === undefined) value = '';
                if (Array.isArray(value)) {
                    return value.some(item => evaluateSingleValue(item, operator, targetValue));
                }
                return evaluateSingleValue(value, operator, targetValue);
            }

            // Evaluate a sequence of external conditions (preserve AND/OR/NOT sequencing)
            function evaluateExternalConditionSequence(value, conditions) {
                if (!conditions || conditions.length === 0) return false;
                let result = true;
                let lastLogicalOp = 'OR';
                for (let i = 0; i < conditions.length; i++) {
                    const condition = conditions[i];
                    const conditionResult = evaluateCondition(value, condition.operator, condition.value);
                    if (i === 0) {
                        result = conditionResult;
                    } else if (lastLogicalOp === 'AND') {
                        result = result && conditionResult;
                    } else if (lastLogicalOp === 'OR') {
                        result = result || conditionResult;
                    } else if (lastLogicalOp === 'NOT') {
                        result = result && !conditionResult;
                    }
                    lastLogicalOp = condition.logicalOp || 'OR';
                }
                return result;
            }

            // Return matched element indices for array-like column given conditions
            function getMatchedIndicesForArray(items, conditions) {
                if (!items || items.length === 0 || !conditions || conditions.length === 0) return [];
                let resultSet = null;
                let lastLogicalOp = 'OR';
                conditions.forEach((condition, index) => {
                    const matched = items
                        .map((item, idx) => ({ item, idx }))
                        .filter(({ item }) => evaluateSingleValue(item, condition.operator, condition.value))
                        .map(({ idx }) => idx);
                    const matchedSet = new Set(matched);
                    if (index === 0) {
                        resultSet = new Set(matched);
                    } else if (lastLogicalOp === 'AND') {
                        resultSet = new Set([...resultSet].filter(i => matchedSet.has(i)));
                    } else if (lastLogicalOp === 'OR') {
                        resultSet = new Set([...resultSet, ...matchedSet]);
                    } else if (lastLogicalOp === 'NOT') {
                        resultSet = new Set([...resultSet].filter(i => !matchedSet.has(i)));
                    }
                    lastLogicalOp = condition.logicalOp || 'OR';
                });
                return resultSet ? Array.from(resultSet).sort((a, b) => a - b) : [];
            }

            // --- FilterSelectionUtils Logic ---
            function expandSelectionWithConnections(cy, nodes, edges) {
                const nodeMap = new Map();
                const edgeMap = new Map();
                const hasExplicitEdges = Array.isArray(edges) && edges.length > 0;
                if(nodes) nodes.forEach(node => { if (node) nodeMap.set(node.id(), node); });
                if(edges) edges.forEach(edge => { if (edge) edgeMap.set(edge.id(), edge); });
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
            
            function applySelectionToCy(cy, nodes, edges, options = {}) {
                if(!cy) return;
                cy.elements().unselect();
                cy.elements().style('opacity', 1);
                
                if(options.setOpacity) {
                   // Gray out non-selected if needed? 
                   // The original applySelectionToCy logic also handles opacity styles if highlighted
                   // Here for export:
                   // We need to replicate the 'highlight' effect.
                   // All elements are visible by default. If filter is applied, only results are opaque?
                   // Currently export doesn't implement dimming for non-selected unless Highlighting (Path Trace) does it.
                   // But Filter Logic says "applySelection".
                }
                
                // Select elements
                const toSelect = cy.collection();
                if(edges) edges.forEach(edge => toSelect.merge(edge));
                if(nodes) nodes.forEach(node => toSelect.merge(node));
                
                isFilterSelecting = true; // IMPORTANT: Prevent recursive logic loops
                toSelect.select();
                isFilterSelecting = false;

                const bringToFront = options.bringToFront !== undefined ? options.bringToFront : true;
                if (bringToFront && Array.isArray(edges) && edges.length > 0) {
                    try {
                        edges.forEach(edge => {
                            const currentZIndex = edge.style('z-index');
                            if (edge.data('_selectionOriginalZIndex') === undefined) {
                                edge.data('_selectionOriginalZIndex', currentZIndex);
                            }
                            edge.style('z-index', 9999);
                        });
                    } catch (e) {
                        console.warn('applySelectionToCy: z-index setting failed', e);
                    }
                }
            }

            // --- FilterPanel Class ---
            class FilterPanel {
                constructor(cyInstance) {
                    this.cy = cyInstance;
                    this.panel = document.getElementById('filter-panel');
                    this.conditions = [];
                    this.initialize();
                }

                initialize() {
                    this.setupEventListeners();
                    // setupPanelDrag
                    const header = this.panel.querySelector('.filter-panel-header');
                    if(header) {
                        let isDragging = false;
                        let currentX;
                        let currentY;
                        let initialX;
                        let initialY;
                        let xOffset = 0;
                        let yOffset = 0;
                        header.addEventListener('mousedown', (e) => {
                            initialX = e.clientX - xOffset;
                            initialY = e.clientY - yOffset;
                            if (e.target === header || e.target.parentNode === header) {
                                isDragging = true;
                            }
                        });
                        document.addEventListener('mousemove', (e) => {
                            if (isDragging) {
                                e.preventDefault();
                                currentX = e.clientX - initialX;
                                currentY = e.clientY - initialY;
                                xOffset = currentX;
                                yOffset = currentY;
                                this.panel.style.transform = \`translate3d(\${currentX}px, \${currentY}px, 0)\`;
                            }
                        });
                        document.addEventListener('mouseup', () => {
                            initialX = currentX;
                            initialY = currentY;
                            isDragging = false;
                        });
                    }
                    this.addCondition(); 
                }

                setupEventListeners() {
                    const closeBtn = document.getElementById('filter-close-btn');
                    if(closeBtn) closeBtn.addEventListener('click', () => this.toggle(false));
                    const applyBtn = document.getElementById('filter-apply-btn');
                    if(applyBtn) applyBtn.addEventListener('click', () => this.applyFilter());
                    const clearBtn = document.getElementById('filter-clear-btn');
                    if(clearBtn) clearBtn.addEventListener('click', () => this.clearFilter());
                }

                hasActiveConditions() {
                    return this.conditions.some(c => c.column && c.value);
                }

                toggle(show) {
                    const isVisible = show !== undefined ? show : !this.panel.classList.contains('active');
                    if (isVisible) {
                        this.panel.classList.add('active');
                        this.updateAllColumnSelects();
                    } else {
                        this.panel.classList.remove('active');
                    }
                    const toggleBtn = document.getElementById('filter-panel-toggle');
                    if(toggleBtn) {
                        toggleBtn.textContent = isVisible ? 'ON' : 'OFF';
                        toggleBtn.classList.toggle('off', !isVisible);
                    }
                }

                addCondition(afterId = null) {
                    const condition = {
                        id: Date.now() + Math.random(),
                        column: '',
                        operator: '=',
                        value: '',
                        logicalOp: 'AND'
                    };
                    if (afterId) {
                        const index = this.conditions.findIndex(c => c.id === afterId);
                        if (index !== -1) {
                            this.conditions.splice(index + 1, 0, condition);
                        } else {
                            this.conditions.push(condition);
                        }
                    } else {
                        this.conditions.push(condition);
                    }
                    this.renderConditions();
                }

                removeCondition(id) {
                    this.conditions = this.conditions.filter(c => c.id !== id);
                    if (this.conditions.length === 0) {
                        this.addCondition();
                    } else {
                        this.renderConditions();
                    }
                }

                renderConditions() {
                    this.syncConditionsFromUI();
                    const container = document.getElementById('filter-conditions-container');
                    if(!container) return;
                    container.innerHTML = '';
                    this.conditions.forEach((condition, index) => {
                        container.appendChild(this.createConditionElement(condition, index));
                    });
                }

                syncConditionsFromUI() {
                    const container = document.getElementById('filter-conditions-container');
                    if (!container) return;
                    container.querySelectorAll('.filter-condition').forEach(div => {
                        const id = Number(div.dataset.conditionId);
                        const condition = this.conditions.find(c => c.id === id);
                        if (!condition) return;
                        const colParam = div.querySelector('.filter-column-select');
                        const opParam = div.querySelector('.filter-operator-select');
                        const valParam = div.querySelector('.filter-value-input');
                        const logParam = div.querySelector('.filter-logical-select');
                        if (colParam) condition.column = colParam.value;
                        if (opParam) condition.operator = opParam.value;
                        if (valParam) condition.value = valParam.value;
                        if (logParam) condition.logicalOp = logParam.value;
                    });
                }

                createConditionElement(condition, index) {
                    const div = document.createElement('div');
                    div.className = 'filter-condition';
                    div.dataset.conditionId = condition.id;

                    const columnSelect = document.createElement('select');
                    columnSelect.className = 'filter-column-select';
                    columnSelect.innerHTML = '<option value="">Choose Column</option>';
                    this.populateColumnOptions(columnSelect);
                    columnSelect.value = condition.column;
                    columnSelect.addEventListener('change', (e) => {
                       condition.column = e.target.value;
                       const opSel = div.querySelector('.filter-operator-select');
                       if(opSel) this.updateOperatorSelectOptions(opSel, condition.column);
                    });

                    const operatorSelect = document.createElement('select');
                    operatorSelect.className = 'filter-operator-select';
                    this.updateOperatorSelectOptions(operatorSelect, condition.column);
                    operatorSelect.addEventListener('change', (e) => condition.operator = e.target.value);
                    if(condition.operator) operatorSelect.value = condition.operator;

                    const valueInput = document.createElement('input');
                    valueInput.type = 'text';
                    valueInput.className = 'filter-value-input';
                    valueInput.value = condition.value;
                    valueInput.placeholder = 'Value';
                    valueInput.addEventListener('input', (e) => condition.value = e.target.value);

                    let removeBtn = null;
                    if(this.conditions.length > 1) {
                        removeBtn = document.createElement('button');
                        removeBtn.className = 'filter-remove-btn';
                        removeBtn.textContent = '✕';
                        removeBtn.title = 'Remove';
                        removeBtn.addEventListener('click', () => this.removeCondition(condition.id));
                    }

                    const row = document.createElement('div');
                    row.className = 'filter-condition-row';
                    row.appendChild(columnSelect);
                    row.appendChild(operatorSelect);
                    row.appendChild(valueInput);
                    if(removeBtn) row.appendChild(removeBtn);
                    div.appendChild(row);

                    if(index < this.conditions.length - 1) {
                         const logicalRow = document.createElement('div');
                         logicalRow.className = 'filter-logical-row';
                         const logicalSelect = document.createElement('select');
                         logicalSelect.className = 'filter-logical-select';
                         logicalSelect.innerHTML = '<option value="AND">AND</option><option value="OR" selected>OR</option>';
                         logicalSelect.value = condition.logicalOp;
                         logicalSelect.addEventListener('change', (e) => condition.logicalOp = e.target.value);
                         logicalRow.appendChild(logicalSelect);
                         div.appendChild(logicalRow);
                    } else {
                         const addRow = document.createElement('div');
                         addRow.className = 'filter-add-row';
                         const addBtn = document.createElement('button');
                         addBtn.className = 'filter-add-btn';
                         addBtn.textContent = '+ Add Condition';
                         addBtn.addEventListener('click', () => {
                             condition.logicalOp = 'AND';
                             this.addCondition(condition.id);
                         });
                         addRow.appendChild(addBtn);
                         div.appendChild(addRow);
                    }
                    return div;
                }

                getAvailableColumns() {
                     if(!this.cy) return [];
                     const columns = [];
                     const nodeSample = this.cy.nodes().slice(0, 100);
                     const edgeSample = this.cy.edges().slice(0, 100);
                     const nodeKeys = new Set();
                     const edgeKeys = new Set();
                     const excluded = ['id', 'source', 'target', 'parent', '_hoverOriginalBg', '_hoverOriginalOpacity', '_selectionOriginalBg', 'name', 'label', 'Label'];
                     
                     nodeSample.forEach(ele => Object.keys(ele.data()).forEach(k => {
                        if(!k.startsWith('_') && !excluded.includes(k)) nodeKeys.add(k);
                     }));
                     edgeSample.forEach(ele => Object.keys(ele.data()).forEach(k => {
                        if(!k.startsWith('_') && !excluded.includes(k)) edgeKeys.add(k);
                     }));
                     
                     [...nodeKeys].sort().forEach(k => columns.push({value: 'node.'+k, label: 'Node '+k}));
                     [...edgeKeys].sort().forEach(k => columns.push({value: 'edge.'+k, label: 'Edge '+k}));
                     return columns;
                }

                populateColumnOptions(select) {
                     const cols = this.getAvailableColumns();
                     cols.forEach(c => {
                         const opt = document.createElement('option');
                         opt.value = c.value;
                         opt.textContent = c.label;
                         select.appendChild(opt);
                     });
                }

                updateAllColumnSelects() {
                     this.panel.querySelectorAll('.filter-column-select').forEach(sel => {
                         const v = sel.value;
                         sel.innerHTML = '<option value="">Choose Column</option>';
                         this.populateColumnOptions(sel);
                         sel.value = v;
                     });
                }
                
                updateOperatorSelectOptions(select, columnValue) {
                    select.innerHTML = \`
                        <option value="=">=</option>
                        <option value=">=">≧</option>
                        <option value=">">></option>
                        <option value="<"><</option>
                        <option value="<=">≦</option>
                        <option value="<>"><></option>
                    \`;
                }

                async applyFilter() {
                    this.syncConditionsFromUI();
                    const valid = this.conditions.filter(c => c.column && c.value);
                    if(valid.length === 0) { alert('Please specify at least one filter condition.'); return; }

                    // If Path Trace is enabled, confirm turning it off before applying filter
                    if (typeof pathTraceEnabled !== 'undefined' && pathTraceEnabled) {
                        const confirmMsg = 'Path Trace機能はOFFになります。よろしいですか？';
                        const ok = await showConfirm(confirmMsg);
                        if (!ok) return;
                        // turn off path trace
                        setPathTraceMode(false);
                    }

                    showLoading('Applying filter...');
                    setTimeout(() => {
                         const nodes = this.cy.nodes();
                         const edges = this.cy.edges();
                         const matchedNodes = [];
                         const matchedEdges = [];
                         
                         nodes.forEach(node => {
                             if(this.evaluateConditions(node, 'node', valid)) matchedNodes.push(node);
                         });
                         edges.forEach(edge => {
                             if(this.evaluateConditions(edge, 'edge', valid)) matchedEdges.push(edge);
                         });
                         
                         this.applyFilterResults(matchedNodes, matchedEdges, valid);
                         hideLoading();
                    }, 50);
                }
                
                evaluateConditions(ele, type, conditions) {
                    const relevant = conditions.filter(c => c.column.startsWith(type + '.'));
                    if (relevant.length === 0) return false;
                    // Group conditions by column
                    const condMap = new Map();
                    relevant.forEach(c => {
                        const col = c.column.split('.')[1];
                        if (!col) return;
                        if (!condMap.has(col)) condMap.set(col, []);
                        condMap.get(col).push(c);
                    });

                    // Helpers
                    const normalizeToItems = (val) => {
                        if (val === null || val === undefined) return null;
                        if (Array.isArray(val)) return val.map(v => String(v));
                        if (typeof val === 'string') {
                            if (val.includes(String.fromCharCode(10))) return val.split(String.fromCharCode(10)).map(v => String(v));
                            if (val.includes('|')) return val.split('|').map(v => String(v));
                        }
                        return null;
                    };

                    const arrayIndexSets = [];
                    const nonArrayResults = [];

                    for (const [colName, conds] of condMap.entries()) {
                        let value = null;
                        try { value = ele.data(colName); } catch (e) { value = undefined; }
                        const items = normalizeToItems(value);
                        if (items && items.length > 0) {
                            const matched = getMatchedIndicesForArray(items, conds);
                            arrayIndexSets.push(new Set(matched));
                        } else {
                            const boolResult = evaluateExternalConditionSequence(value, conds);
                            nonArrayResults.push(boolResult);
                        }
                    }

                    if (nonArrayResults.some(r => !r)) return false;

                    if (arrayIndexSets.length > 0) {
                        let inter = arrayIndexSets[0];
                        for (let i = 1; i < arrayIndexSets.length; i++) {
                            inter = new Set([...inter].filter(x => arrayIndexSets[i].has(x)));
                            if (inter.size === 0) return false;
                        }
                        return inter.size > 0;
                    }

                    return true;
                }

                applyFilterResults(nodes, edges, conditions) {
                    // Turn off path trace if on
                    if(typeof pathTraceEnabled !== 'undefined' && pathTraceEnabled) {
                        setPathTraceMode(false);
                    }
                    
                    let resNodes = nodes;
                    let resEdges = edges;
                    const hasEdgeWeights = (() => {
                        try {
                            const edges = cy.edges();
                            const limit = Math.min(edges.length, 200);
                            const weightKeyRegex = /weight|重み|ウェイト/i;
                            for (let i = 0; i < limit; i++) {
                                const data = edges[i].data();
                                if (!data) continue;
                                for (const key of Object.keys(data)) {
                                    if (!weightKeyRegex.test(key)) continue;
                                    const v = data[key];
                                    if (v !== '' && v !== null && v !== undefined) {
                                        return true;
                                    }
                                }
                            }
                        } catch (e) {}
                        return false;
                    })();

                    // Specialized logic for explicit selection
                    if (Array.isArray(edges) && edges.length > 0) {
                        // If edges are explicitly matched, select ONLY those edges and their connected nodes.
                        // Do NOT expand to all parallel edges.
                        const nodeSet = new Set();
                        edges.forEach(edge => {
                            if(edge.source()) nodeSet.add(edge.source());
                            if(edge.target()) nodeSet.add(edge.target());
                        });
                        resNodes = Array.from(nodeSet);
                        resEdges = edges;
                    } else {
                        // Unweighted graph: map node conditions to edge conditions when no explicit edge conditions exist
                        let mappedEdgeMatches = false;
                        if (!hasEdgeWeights && Array.isArray(conditions) && conditions.length > 0) {
                            const hasEdgeConds = conditions.some(c => typeof c.column === 'string' && c.column.startsWith('edge.'));
                            const nodeCondsForMap = conditions.filter(c => typeof c.column === 'string' && c.column.startsWith('node.'));
                            if (!hasEdgeConds && nodeCondsForMap.length > 0) {
                                const edgeConds = nodeCondsForMap.map(c => ({ ...c, column: c.column.replace(/^node\./, 'edge.') }));
                                const edgeMatches = [];
                                cy.edges().forEach(edge => {
                                    if (this.evaluateConditions(edge, 'edge', edgeConds)) edgeMatches.push(edge);
                                });
                                if (edgeMatches.length > 0) {
                                    resEdges = edgeMatches;
                                    const nodeSet2 = new Set();
                                    edgeMatches.forEach(edge => {
                                        if(edge.source()) nodeSet2.add(edge.source());
                                        if(edge.target()) nodeSet2.add(edge.target());
                                    });
                                    resNodes = Array.from(nodeSet2);
                                    mappedEdgeMatches = true;
                                    // continue to apply selection below
                                }
                            }
                        }

                        // If no edges matched explicitly, check if we can infer edges from node conditions
                        // e.g., if filtering by "PaperID" on nodes, also find edges with that "PaperID"
                        let foundEdges = [];
                        if (!mappedEdgeMatches && Array.isArray(conditions) && conditions.length > 0 && Array.isArray(nodes) && nodes.length > 0) {
                            const nodeConds = conditions.filter(c => typeof c.column === 'string' && c.column.startsWith('node.') && c.value);
                            if (nodeConds.length > 0) {
                                const edgeSeen = new Set();
                                // Group node conditions by column name
                                const nodeCondMap = new Map();
                                nodeConds.forEach(cond => {
                                    const colName = cond.column.split('.')[1];
                                    if (!colName) return;
                                    if (!nodeCondMap.has(colName)) nodeCondMap.set(colName, []);
                                    nodeCondMap.get(colName).push(cond);
                                });

                                const edgeMatchesNodeConds = (edge) => {
                                    if (hasEdgeWeights) {
                                        const arrayIndexSets = [];
                                        const nonArrayResults = [];
                                        for (const [colName, conds] of nodeCondMap.entries()) {
                                            const edgeVal = edge.data(colName);
                                            if (edgeVal === undefined || edgeVal === null) return false;
                                            if (Array.isArray(edgeVal) || (typeof edgeVal === 'string' && (String(edgeVal).includes('|') || String(edgeVal).includes(String.fromCharCode(10))))) {
                                                let items = Array.isArray(edgeVal) ? edgeVal.map(v => String(v)) : String(edgeVal).split(/\|/).map(v => String(v));
                                                const matchedIdx = getMatchedIndicesForArray(items, conds);
                                                arrayIndexSets.push(new Set(matchedIdx));
                                            } else {
                                                nonArrayResults.push(evaluateExternalConditionSequence(edgeVal, conds));
                                            }
                                        }
                                        if (nonArrayResults.some(r => !r)) return false;
                                        if (arrayIndexSets.length > 0) {
                                            let inter = arrayIndexSets[0];
                                            for (let i = 1; i < arrayIndexSets.length; i++) {
                                                inter = new Set([...inter].filter(x => arrayIndexSets[i].has(x)));
                                                if (inter.size === 0) return false;
                                            }
                                            return inter.size > 0;
                                        }
                                        return true;
                                    }

                                    // Unweighted graph logic
                                    for (const [colName, conds] of nodeCondMap.entries()) {
                                        const edgeVal = edge.data(colName);
                                        if (edgeVal === undefined || edgeVal === null) return false;
                                        if (Array.isArray(edgeVal) || (typeof edgeVal === 'string' && (String(edgeVal).includes('|') || String(edgeVal).includes(String.fromCharCode(10))))) {
                                            let items = Array.isArray(edgeVal) ? edgeVal.map(v => String(v)) : String(edgeVal).split(/\|/).map(v => String(v));
                                            const matchedIdx = getMatchedIndicesForArray(items, conds);
                                            if (!matchedIdx || matchedIdx.length === 0) return false;
                                        } else {
                                            if (!evaluateExternalConditionSequence(edgeVal, conds)) return false;
                                        }
                                    }
                                    return true;
                                };

                                nodes.forEach(node => {
                                    try {
                                        const incident = node.connectedEdges();
                                        incident.forEach(edge => {
                                            try {
                                                if (!edgeMatchesNodeConds(edge)) return;
                                                if (!edgeSeen.has(edge.id())) { edgeSeen.add(edge.id()); foundEdges.push(edge); }
                                            } catch (e) {
                                            }
                                        });
                                    } catch (e) {
                                    }
                                });
                            }
                        }

                            if (foundEdges.length > 0) {
                             resEdges = foundEdges;
                             const nodeSet2 = new Set();
                             foundEdges.forEach(edge => {
                                 if(edge.source()) nodeSet2.add(edge.source());
                                 if(edge.target()) nodeSet2.add(edge.target());
                             });
                             resNodes = Array.from(nodeSet2);
                            } else if (!mappedEdgeMatches) {
                                 // If no edges were found by incident-edge checks, try global pass
                                 const matchedNodeIdSet = new Set((nodes || []).map(n => (typeof n.id === 'function') ? n.id() : n.id));
                                 const globalMatches = [];
                                 
                                 // Group node conditions by column name for global pass
                                 const nodeConds = conditions.filter(c => typeof c.column === 'string' && c.column.startsWith('node.') && c.value);
                                 if (nodeConds.length > 0) {
                                     const nodeCondMap = new Map();
                                     nodeConds.forEach(cond => {
                                         const colName = cond.column.split('.')[1];
                                         if (!colName) return;
                                         if (!nodeCondMap.has(colName)) nodeCondMap.set(colName, []);
                                         nodeCondMap.get(colName).push(cond);
                                     });

                                     const edgeMatchesNodeConds = (edge) => {
                                         if (hasEdgeWeights) {
                                             const arrayIndexSets = [];
                                             const nonArrayResults = [];
                                             for (const [colName, conds] of nodeCondMap.entries()) {
                                                 const edgeVal = edge.data(colName);
                                                 if (edgeVal === undefined || edgeVal === null) return false;
                                                 if (Array.isArray(edgeVal) || (typeof edgeVal === 'string' && (String(edgeVal).includes('|') || String(edgeVal).includes(String.fromCharCode(10))))) {
                                                     let items = Array.isArray(edgeVal) ? edgeVal.map(v => String(v)) : String(edgeVal).split(/\|/).map(v => String(v));
                                                     const matchedIdx = getMatchedIndicesForArray(items, conds);
                                                     arrayIndexSets.push(new Set(matchedIdx));
                                                 } else {
                                                     nonArrayResults.push(evaluateExternalConditionSequence(edgeVal, conds));
                                                 }
                                             }
                                             if (nonArrayResults.some(r => !r)) return false;
                                             if (arrayIndexSets.length > 0) {
                                                 let inter = arrayIndexSets[0];
                                                 for (let i = 1; i < arrayIndexSets.length; i++) {
                                                     inter = new Set([...inter].filter(x => arrayIndexSets[i].has(x)));
                                                     if (inter.size === 0) return false;
                                                 }
                                                 return inter.size > 0;
                                             }
                                             return true;
                                         }

                                         for (const [colName, conds] of nodeCondMap.entries()) {
                                             const edgeVal = edge.data(colName);
                                             if (edgeVal === undefined || edgeVal === null) return false;
                                             if (Array.isArray(edgeVal) || (typeof edgeVal === 'string' && (String(edgeVal).includes('|') || String(edgeVal).includes(String.fromCharCode(10))))) {
                                                 let items = Array.isArray(edgeVal) ? edgeVal.map(v => String(v)) : String(edgeVal).split(/\|/).map(v => String(v));
                                                 const matchedIdx = getMatchedIndicesForArray(items, conds);
                                                 if (!matchedIdx || matchedIdx.length === 0) return false;
                                             } else {
                                                 if (!evaluateExternalConditionSequence(edgeVal, conds)) return false;
                                             }
                                         }
                                         return true;
                                     };

                                     cy.edges().forEach(edge => {
                                         try {
                                             const s = edge.source(); const t = edge.target();
                                             const sid = (s && typeof s.id === 'function') ? s.id() : (s ? s : null);
                                             const tid = (t && typeof t.id === 'function') ? t.id() : (t ? t : null);
                                             if (!matchedNodeIdSet.has(sid) && !matchedNodeIdSet.has(tid)) return;
                                             if (edgeMatchesNodeConds(edge)) globalMatches.push(edge);
                                         } catch (e) {
                                         }
                                     });
                                 }

                                 if (globalMatches.length > 0) {
                                     resEdges = globalMatches;
                                     const nodeSet2 = new Set();
                                     globalMatches.forEach(edge => {
                                         if(edge.source()) nodeSet2.add(edge.source());
                                         if(edge.target()) nodeSet2.add(edge.target());
                                     });
                                     resNodes = Array.from(nodeSet2);
                                 } else {
                                     if (hasEdgeWeights) {
                                         const expanded = expandSelectionWithConnections(this.cy, nodes, edges);
                                         resNodes = expanded.nodes;
                                         resEdges = expanded.edges;
                                     } else {
                                         resNodes = nodes;
                                         resEdges = [];
                                     }
                                 }
                            }
                        }

                    applySelectionToCy(this.cy, resNodes, resEdges, {setOpacity: true, bringToFront: true});
                    
                    externalFilterResults = { nodes: resNodes, edges: resEdges, conditions: conditions };
                    if(typeof renderTable === 'function') renderTable();
                }

                clearFilter() {
                    this.conditions = [];
                    this.addCondition();
                    this.cy.elements().unselect();
                    this.cy.elements().style('opacity', 1);
                    externalFilterResults = null;
                    if(typeof renderTable === 'function') renderTable();
                }
            }
            // Force redraw for UI update
            const withLoading = (fn, msg) => {
                showLoading(msg);
                // Ensure browser paints the overlay before blocking
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        fn();
                        hideLoading();
                    }, 0);
                });
            };

            // Network data
            const elements = JSON.parse(decodeURIComponent(escape(atob(document.getElementById('elements-json').textContent || ''))));

            // Style data
            const styles = JSON.parse(decodeURIComponent(escape(atob(document.getElementById('styles-json').textContent || ''))));
            const layers = JSON.parse(decodeURIComponent(escape(atob(document.getElementById('layers-json').textContent || ''))));
            const styleOverrides = JSON.parse(decodeURIComponent(escape(atob(document.getElementById('overrides-json').textContent || ''))));
            const backgroundColor = JSON.parse(decodeURIComponent(escape(atob(document.getElementById('background-json').textContent || ''))));
            const edgeWidthConfig = JSON.parse(decodeURIComponent(escape(atob(document.getElementById('edge-width-config-json').textContent || '{}'))));

            console.log('Elements loaded:', elements.length);
            console.log('Styles loaded:', styles.length);

            // Initialize Cytoscape
            const cy = cytoscape({
                container: document.getElementById('cy'),
                elements: elements,
                style: styles,
                layout: { name: 'preset' },
                minZoom: 0.05,
                maxZoom: 10,
                wheelSensitivity: 0.05,
                boxSelectionEnabled: true
            });

            console.log('Cytoscape initialized');
            console.log('Nodes:', cy.nodes().length);
            console.log('Edges:', cy.edges().length);

            // Table Panel state
            const tablePanel = document.getElementById('table-panel');
            const tableToggle = document.getElementById('table-panel-toggle');
            const nodeTab = document.getElementById('node-table-tab');
            const edgeTab = document.getElementById('edge-table-tab');
            const tableApplyBtn = document.getElementById('table-filter-apply-btn');
            const tableClearBtn = document.getElementById('table-filter-clear-btn');
            const thead = document.querySelector('#table-panel thead');
            const tbody = document.querySelector('#table-panel tbody');

            let tableVisible = false;
            let currentTab = 'node';
            const filters = { node: {}, edge: {} };
            const columnWidths = { node: {}, edge: {} };
            let selectionEnabled = false;
            let isFilterSelecting = false;
            let isEdgeSelectingNodes = false;
            let renderTableDebounceTimer = null;
            // Table panel height state (px)
            let tablePanelHeight = 300;

            const setTableVisible = (visible) => {
                tableVisible = visible;
                if (tablePanel) {
                    tablePanel.classList.toggle('active', visible);
                }
                if (tableToggle) {
                    tableToggle.textContent = visible ? 'ON' : 'OFF';
                    tableToggle.classList.toggle('off', !visible);
                }
                // respect previously set height
                document.documentElement.style.setProperty('--table-panel-height', visible ? (tablePanelHeight + 'px') : '0px');
                cy.resize();
                renderTable();
            };

            // Create vertical resize handle for table panel
            const ensureTableResizeHandle = () => {
                if (!tablePanel) return;
                let handle = document.getElementById('table-resize-handle');
                if (!handle) {
                    handle = document.createElement('div');
                    handle.id = 'table-resize-handle';
                    handle.className = 'table-resize-handle';
                    // insert at top of panel
                    tablePanel.insertBefore(handle, tablePanel.firstChild);

                    let startY = 0;
                    let startH = 0;
                    const onMouseMove = (ev) => {
                        const dy = startY - ev.clientY; // dragging upwards increases height
                        let newH = Math.max(80, startH + dy);
                        tablePanelHeight = newH;
                        document.documentElement.style.setProperty('--table-panel-height', newH + 'px');
                        cy.resize();
                    };
                    const onMouseUp = () => {
                        document.removeEventListener('mousemove', onMouseMove);
                        document.removeEventListener('mouseup', onMouseUp);
                        handle.classList.remove('active');
                    };

                    handle.addEventListener('mousedown', (e) => {
                        e.preventDefault();
                        startY = e.clientY;
                        startH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--table-panel-height')) || tablePanelHeight;
                        handle.classList.add('active');
                        document.addEventListener('mousemove', onMouseMove);
                        document.addEventListener('mouseup', onMouseUp);
                    });
                }
            };

            const shouldIncludeColumn = (col) => col && !String(col).startsWith('_');

            const collectColumns = (type) => {
                const cols = new Set();
                if (type === 'node') {
                    cols.add('id');
                    cy.nodes().forEach(n => {
                        Object.keys(n.data() || {}).forEach(key => {
                            if (shouldIncludeColumn(key)) cols.add(key);
                        });
                    });
                } else {
                    cols.add('id');
                    cols.add('source');
                    cols.add('target');
                    cy.edges().forEach(e => {
                        Object.keys(e.data() || {}).forEach(key => {
                            if (shouldIncludeColumn(key)) cols.add(key);
                        });
                    });
                }
                return Array.from(cols);
            };

            const isNumericQuery = (query) => {
                const s = String(query ?? '').trim();
                return s !== '' && !Number.isNaN(Number(s));
            };

            const itemMatches = (item, query) => {
                if (!query) return true;
                const itemStr = String(item ?? '').trim();
                const queryStr = String(query ?? '').trim();

                if (isNumericQuery(query)) {
                    if (itemStr === '' || Number.isNaN(Number(itemStr))) return false;
                    if (itemStr === queryStr) return true;
                    return Number(itemStr) === Number(queryStr);
                }

                return itemStr.toLowerCase().includes(String(query).toLowerCase());
            };

            const valueMatches = (value, query) => {
                if (!query) return true;
                if (Array.isArray(value)) {
                    return value.some(v => itemMatches(v, query));
                }
                return itemMatches(value, query);
            };

            const formatCellValue = (value) => {
                if (value === null || value === undefined) return '';
                if (Array.isArray(value)) {
                    return value.map(v => String(v)).join(String.fromCharCode(10));
                }
                if (typeof value === 'object') {
                    try {
                        return JSON.stringify(value);
                    } catch (e) {
                        return String(value);
                    }
                }
                return String(value);
            };

            const createCellContent = (value) => {
                const container = document.createElement('div');
                container.className = 'cell-content';

                if (value === null || value === undefined) {
                    container.textContent = '';
                    return container;
                }

                let items = null;
                if (Array.isArray(value)) {
                    items = value.map(v => String(v));
                } else if (typeof value === 'string' && value.includes(String.fromCharCode(10))) {
                    items = value.split(String.fromCharCode(10)).map(v => v.trim()).filter(v => v !== '');
                }

                if (items && items.length > 0) {
                    container.classList.add('cell-array');
                    const allZeroOrBlank = items.every((item) => {
                        const s = String(item).trim();
                        return s === '' || s === '0';
                    });
                    items.forEach((item) => {
                        const row = document.createElement('div');
                        row.className = 'cell-array-item';
                        const raw = String(item);
                        const trimmed = raw.trim();
                        if (trimmed === '' || (allZeroOrBlank && trimmed === '0')) {
                            row.textContent = '\\u00a0';
                        } else {
                            row.textContent = trimmed;
                        }
                        container.appendChild(row);
                    });
                    return container;
                }

                container.textContent = formatCellValue(value);
                return container;
            };

            const getDisplayElements = (type) => {
                if (externalFilterResults && externalFilterResults.conditions && externalFilterResults.conditions.length > 0) {
                     return type === 'node' ? externalFilterResults.nodes : externalFilterResults.edges;
                }
                const selected = type === 'node' ? cy.nodes(':selected') : cy.edges(':selected');
                return selected.length > 0 ? selected : (type === 'node' ? cy.nodes() : cy.edges());
            };

            const renderTableHeader = (columns, type) => {
                if (!thead) return;

                // New logic: Manage table width mode based on state presence
                const table = thead.closest('table');
                // Check if we have any saved width for THIS session/type
                const hasSavedState = Object.keys(columnWidths[type]).length > 0;
                table.style.width = hasSavedState ? 'auto' : ''; 

                thead.innerHTML = '';
                const headerRow = document.createElement('tr');
                columns.forEach(col => {
                    const th = document.createElement('th');
                    // Restore saved width if available
                    if (columnWidths[type][col]) {
                        th.style.width = columnWidths[type][col];
                        th.style.minWidth = columnWidths[type][col];
                        th.style.maxWidth = columnWidths[type][col];
                    }
                    
                    const textDiv = document.createElement('div');
                    textDiv.textContent = col;
                    textDiv.style.overflow = 'hidden';
                    textDiv.style.textOverflow = 'ellipsis';
                    th.appendChild(textDiv);

                    const resizer = document.createElement('div');
                    resizer.className = 'resize-handle';
                    resizer.addEventListener('mousedown', (e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        // Lock all column widths if this is the first resize action
                        const table = thead.closest('table');
                        if (table.style.width !== 'auto') {
                            const allTh = thead.querySelectorAll('th');
                            allTh.forEach((h, idx) => {
                                const w = h.offsetWidth;
                                const widthVal = w + 'px';
                                h.style.width = widthVal;
                                h.style.minWidth = widthVal;
                                h.style.maxWidth = widthVal;
                                
                                // Save initial layout to state so it persists
                                const cName = columns[idx];
                                if (cName) {
                                    columnWidths[type][cName] = widthVal;
                                }
                            });
                            table.style.width = 'auto'; 
                        }

                        const startX = e.pageX;
                        const startWidth = th.offsetWidth;
                        resizer.classList.add('active');

                        const onMouseMove = (moveEvent) => {
                            const diffX = moveEvent.pageX - startX;
                            const newWidth = Math.max(30, startWidth + diffX);
                            const widthVal = newWidth + 'px';
                            th.style.width = widthVal;
                            th.style.minWidth = widthVal;
                            th.style.maxWidth = widthVal;
                            // Save width
                            columnWidths[type][col] = widthVal;
                        };

                        const onMouseUp = () => {
                            document.removeEventListener('mousemove', onMouseMove);
                            document.removeEventListener('mouseup', onMouseUp);
                            resizer.classList.remove('active');
                        };

                        document.addEventListener('mousemove', onMouseMove);
                        document.addEventListener('mouseup', onMouseUp);
                    });
                    th.appendChild(resizer);
                    
                    headerRow.appendChild(th);
                });
                thead.appendChild(headerRow);

                const filterRow = document.createElement('tr');
                columns.forEach(col => {
                    const th = document.createElement('th');
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.className = 'column-filter';
                    input.value = filters[type][col] || '';
                    input.addEventListener('input', (e) => {
                        filters[type][col] = e.target.value;
                    });
                    th.appendChild(input);
                    filterRow.appendChild(th);
                });
                thead.appendChild(filterRow);
            };

            const renderTableBody = (columns, type) => {
                if (!tbody) return;
                tbody.innerHTML = '';

                // Helpers for array detection
                const getArrayItems = (val) => {
                    if (Array.isArray(val)) return val.map(v => String(v));
                    if (typeof val === 'string' && val.includes(String.fromCharCode(10))) return val.split(String.fromCharCode(10));
                    if (typeof val === 'string' && val.includes('|')) return val.split('|');
                    return null;
                };

                const calculateValidIndices = (targetType) => {
                    const activeFs = filters[targetType];
                    const hasFs = Object.values(activeFs).some(v => v && v.trim() !== '');
                    if (!hasFs) return null;

                    let globalIndices = null;
                    const targetElements = targetType === 'node' ? cy.nodes() : cy.edges();
                    
                    // We need to find the intersection of indices across all rows that match the filter
                    // But actually, valid indices are usually calculating per-row or per-filter match.
                    // The requirement says: "When extracting with one element of the array, display records extracted with one element on the reverse table side as well"
                    // This implies we want to find "Which indices are active globally based on current filters"
                    // Let's union all matched indices from all matched rows for the target type.
                    
                    const matchedIndices = new Set();
                    let anyArrayFilterMatches = false;

                    targetElements.forEach(ele => {
                        const data = ele.data();
                        
                        // Check if this element matches all filters (row-level)
                        const rowMatches = Object.keys(activeFs).every(col => {
                            const query = activeFs[col];
                            if (!query) return true;
                            const val = data[col];
                            // Basic value match logic
                            if (val === undefined) return false;
                            
                            const items = getArrayItems(val);
                            if (items) {
                                // If array, does it have at least one match?
                                return items.some(v => itemMatches(v, query));
                            }
                            return itemMatches(val, query);
                        });

                        if (!rowMatches) return;

                        // Now collect indices from array columns that have filters
                        Object.keys(activeFs).forEach(col => {
                            const query = activeFs[col];
                            if (!query) return;
                            const items = getArrayItems(data[col]);
                            if (items) {
                                anyArrayFilterMatches = true;
                                items.forEach((item, i) => {
                                    if (itemMatches(item, query)) {
                                        matchedIndices.add(i);
                                    }
                                });
                            }
                        });

                        // Logic 2: If we are filtering edges, and this edge matches, record its parallel index
                        // This allows "Edge Table Filter -> Parallel Edge Index -> Node Table Array Index" syncing.
                        if (targetType === 'edge' && ele.isEdge()) {
                            const parallels = ele.parallelEdges();
                            if (parallels.length > 1) {
                                // Sort by ID to establish consistent index
                                const sorted = parallels.sort((a,b) => {
                                    return a.id().localeCompare(b.id(), undefined, { numeric: true, sensitivity: 'base' });
                                });
                                const idx = sorted.indexOf(ele);
                                if (idx !== -1) {
                                    matchedIndices.add(idx);
                                    anyArrayFilterMatches = true; // Use array flag to signal we found valid indices
                                }
                            }
                        }
                    });

                    return anyArrayFilterMatches ? matchedIndices : null;
                };

                const myIndices = calculateValidIndices(type);
                const crossType = type === 'node' ? 'edge' : 'node';
                const crossIndices = calculateValidIndices(crossType);

                // calculate final allowed indices (Intersection of active constraints)
                let allowedIndices = null;
                if (myIndices !== null && crossIndices !== null) {
                    // Intersection
                    allowedIndices = new Set([...myIndices].filter(x => crossIndices.has(x)));
                } else if (myIndices !== null) {
                    allowedIndices = myIndices;
                } else if (crossIndices !== null) {
                    allowedIndices = crossIndices;
                }

                // Build External Condition Map for Scalar Checks
                const externalScalarChecks = new Map();
                if (externalFilterResults && externalFilterResults.conditions) {
                     externalFilterResults.conditions.forEach(c => {
                         if (!c.column) return;
                         const [cType, cCol] = c.column.split('.');
                         if (cType === type && cCol) {
                             if (!externalScalarChecks.has(cCol)) externalScalarChecks.set(cCol, []);
                             externalScalarChecks.get(cCol).push(c);
                         }
                     });
                }


                const elements = getDisplayElements(type);
                const dataRows = elements.map(ele => {
                    const data = ele.data();
                    const row = { _element: ele };
                    columns.forEach(col => {
                        row[col] = data[col] !== undefined ? data[col] : '';
                    });
                    return row;
                });

                const activeFilters = filters[type];
                const hasActiveFilters = Object.values(activeFilters).some(v => v && v.trim() !== '');

                const filtered = dataRows.filter(row => {
                    return columns.every(col => {
                        const query = activeFilters[col] || '';
                        if (!query) return true;
                        return valueMatches(row[col], query);
                    });
                });

                // Update selection based on filters
                if (hasActiveFilters && !isFilterSelecting && selectionEnabled) {
                    const currentSelection = cy.elements(':selected');
                    const filteredIds = new Set(filtered.map(r => r._element ? r._element.id() : null).filter(id => id));
                    const currentIds = new Set(currentSelection.map(e => e.id()));
                    
                    let changed = false;
                    if (filteredIds.size !== currentIds.size) {
                        changed = true;
                    } else {
                        for (let id of filteredIds) {
                            if (!currentIds.has(id)) { changed = true; break; }
                        }
                    }

                    if (changed) {
                        isFilterSelecting = true;
                        cy.batch(() => {
                           cy.elements().unselect();
                           
                           const selectedElements = cy.collection();
                           filtered.forEach(row => {
                               if (row._element) selectedElements.merge(row._element);
                           });

                           
                           selectedElements.select();
                           
                           // Helper to filter related elements by index
                           const filterByAllowedIndices = (eles) => {
                               if (!allowedIndices || allowedIndices.size === 0) return eles;
                               return eles.filter(ele => {
                                   if (ele.isEdge()) {
                                       const parallels = ele.parallelEdges();
                                       if (parallels.length > 1) {
                                            // Handle parallel edges: assume strict index mapping
                                            const sorted = parallels.sort((a,b) => {
                                                return a.id().localeCompare(b.id(), undefined, { numeric: true, sensitivity: 'base' });
                                            });
                                            const idx = sorted.indexOf(ele);
                                            // If the edge's parallel index matches an allowed array index
                                            if (idx !== -1 && allowedIndices.has(idx)) {
                                                return true;
                                            }
                                            return false;
                                       }
                                   }

                                   const data = ele.data();
                                   let hasArray = false;
                                   let matchesIndex = false;
                                   for (let key in data) {
                                       const val = data[key];
                                       const items = getArrayItems(val);
                                       if (items && items.length > 0) {
                                           hasArray = true;
                                           if ([...allowedIndices].some(idx => items[idx] !== undefined && items[idx] !== '')) {
                                               matchesIndex = true;
                                               break;
                                           }
                                       }
                                   }
                                   return hasArray ? matchesIndex : true; 
                               });
                           };

                           if (type === 'node') {
                               // [New Logic]: Propagate to edges matching the node filter
                               const activeEntries = Object.entries(activeFilters).filter(([k,v]) => v && v.trim() !== '');
                               if (activeEntries.length > 0) {
                                   const nodesToCheck = selectedElements.toArray();
                                   const edgesToSelect = cy.collection();
                                   
                                   nodesToCheck.forEach(node => {
                                       const incident = node.connectedEdges();
                                       incident.forEach(edge => {
                                            activeEntries.forEach(([col, query]) => {
                                                const val = edge.data(col);
                                                if (val === undefined || val === null) return;
                                                
                                                const items = getArrayItems(val);
                                                if (items) {
                                                    // Array item using itemMatches for consistent logic (numeric=exact, string=substring)
                                                    if (items.some(item => itemMatches(item, query))) {
                                                        edgesToSelect.merge(edge);
                                                    }
                                                } else {
                                                    // Scalar match using itemMatches (numeric=exact, string=substring)
                                                    if (itemMatches(val, query)) {
                                                        edgesToSelect.merge(edge);
                                                    }
                                                }
                                            });
                                       });
                                   });
                                   
                                   if (edgesToSelect.length > 0) {
                                       edgesToSelect.select();
                                       edgesToSelect.connectedNodes().select();
                                   }
                               }

                               // For node filter, also select induced edges (edges between selected nodes)
                               const currentSelectedNodes = cy.nodes(':selected');
                               let inducedEdges = currentSelectedNodes.edgesWith(currentSelectedNodes);
                               
                               // Filter induced edges: They must match the active filter criteria if they possess the filtered property
                               // This prevents selecting unrelated edges (e.g. "Peptide sequencing") just because they connect selected nodes
                               if (activeEntries.length > 0) {
                                   inducedEdges = inducedEdges.filter(edge => {
                                       return activeEntries.every(([col, query]) => {
                                            const val = edge.data(col);
                                            // If edge does not have this property, we assume it's just a structural connection and keep it.
                                            // If edge HAS this property, it MUST match the query.
                                            if (val === undefined || val === null) return true;
                                            
                                            // Use shared matching logic
                                            const items = getArrayItems(val);
                                            if (items) {
                                                return items.some(item => itemMatches(item, query));
                                            }
                                            return itemMatches(val, query);
                                       });
                                   });
                               }

                               inducedEdges = filterByAllowedIndices(inducedEdges);
                               inducedEdges.select();
                           } else if (type === 'edge') {
                               // For edge filter, also select connected nodes (source and target)
                               let connectedNodes = selectedElements.connectedNodes();
                               connectedNodes = filterByAllowedIndices(connectedNodes);
                               connectedNodes.select();
                           }
                        });
                        isFilterSelecting = false;
                    }
                }

                const crossTypeFilters = filters[crossType] || {};

                const getArrayColumns = (row) => {
                    return columns.filter(col => {
                        if (col === 'id' || col === 'source' || col === 'target') return false;
                        const items = getArrayItems(row[col]);
                        return items && items.length > 0;
                    });
                };

                const computeArrayMatchedIndices = (row) => {
                    const arrayColumns = getArrayColumns(row);
                    let arrayMatchedIndices = null;

                    // External filter conditions from Filter Panel (grouped by column)
                    if (externalFilterResults && externalFilterResults.conditions && externalFilterResults.conditions.length > 0) {
                        const externalConditions = externalFilterResults.conditions.filter(c => {
                            if (!c.column) return false;
                            const [condType] = c.column.split('.');
                            return condType === type;
                        });

                        const externalByColumn = new Map();
                        externalConditions.forEach(condition => {
                            const [, columnName] = condition.column.split('.');
                            if (!columnName) return;
                            if (!externalByColumn.has(columnName)) externalByColumn.set(columnName, []);
                            externalByColumn.get(columnName).push(condition);
                        });

                        externalByColumn.forEach((conditions, columnName) => {
                            if (row[columnName] === undefined) return;
                            const items = getArrayItems(row[columnName]);
                            if (!items || items.length === 0) return;

                            const matchedIndices = getMatchedIndicesForArray(items, conditions);
                            if (matchedIndices.length === 0) return;

                            if (arrayMatchedIndices === null) {
                                arrayMatchedIndices = matchedIndices;
                            } else {
                                arrayMatchedIndices = arrayMatchedIndices.filter(i => matchedIndices.includes(i));
                            }
                        });

                        // Cross-type conditions from Filter Panel (grouped by column)
                        const crossExternalConditions = externalFilterResults.conditions.filter(c => {
                            if (!c.column) return false;
                            const [condType] = c.column.split('.');
                            return condType === crossType;
                        });

                        const crossExternalByColumn = new Map();
                        crossExternalConditions.forEach(condition => {
                            const [, columnName] = condition.column.split('.');
                            if (!columnName) return;
                            if (!crossExternalByColumn.has(columnName)) crossExternalByColumn.set(columnName, []);
                            crossExternalByColumn.get(columnName).push(condition);
                        });

                        if (crossExternalByColumn.size > 0 && arrayColumns.length > 0) {
                            let crossMatchedIndices = null;
                            arrayColumns.forEach(colName => {
                                const conditionsForColumn = crossExternalByColumn.get(colName);
                                if (!conditionsForColumn || conditionsForColumn.length === 0) return;
                                if (row[colName] === undefined) return;
                                const items = getArrayItems(row[colName]);
                                if (!items || items.length === 0) return;

                                const matchedIndices = getMatchedIndicesForArray(items, conditionsForColumn);
                                if (matchedIndices.length === 0) return;

                                if (crossMatchedIndices === null) {
                                    crossMatchedIndices = matchedIndices;
                                } else {
                                    crossMatchedIndices = crossMatchedIndices.filter(i => matchedIndices.includes(i));
                                }
                            });

                            if (crossMatchedIndices !== null) {
                                if (arrayMatchedIndices === null) {
                                    arrayMatchedIndices = crossMatchedIndices;
                                } else {
                                    arrayMatchedIndices = arrayMatchedIndices.filter(i => crossMatchedIndices.includes(i));
                                }
                            }
                        }
                    }

                    // Current table filters
                    Object.keys(activeFilters).forEach(col => {
                        const query = activeFilters[col];
                        if (!query) return;
                        if (row[col] === undefined) return;
                        const items = getArrayItems(row[col]);
                        if (!items || items.length === 0) return;

                        const matchedIndices = items
                            .map((item, idx) => ({ item, idx }))
                            .filter(({ item }) => itemMatches(item, query))
                            .map(({ idx }) => idx);

                        if (matchedIndices.length === 0) return;

                        if (arrayMatchedIndices === null) {
                            arrayMatchedIndices = matchedIndices;
                        } else {
                            arrayMatchedIndices = arrayMatchedIndices.filter(i => matchedIndices.includes(i));
                        }
                    });

                    // Cross table filters (only for matching column names)
                    let crossMatchedIndices = null;
                    arrayColumns.forEach(col => {
                        const query = crossTypeFilters[col];
                        if (!query) return;
                        const items = getArrayItems(row[col]);
                        if (!items || items.length === 0) return;

                        const matchedIndices = items
                            .map((item, idx) => ({ item, idx }))
                            .filter(({ item }) => itemMatches(item, query))
                            .map(({ idx }) => idx);

                        if (matchedIndices.length === 0) return;

                        if (crossMatchedIndices === null) {
                            crossMatchedIndices = matchedIndices;
                        } else {
                            crossMatchedIndices = crossMatchedIndices.filter(i => matchedIndices.includes(i));
                        }
                    });

                    if (crossMatchedIndices !== null) {
                        if (arrayMatchedIndices === null) {
                            arrayMatchedIndices = crossMatchedIndices;
                        } else {
                            arrayMatchedIndices = arrayMatchedIndices.filter(i => crossMatchedIndices.includes(i));
                        }
                    }

                    return { arrayMatchedIndices, arrayColumns };
                };

                filtered.forEach(row => {
                    const { arrayMatchedIndices, arrayColumns } = computeArrayMatchedIndices(row);

                    const tr = document.createElement('tr');
                    tr.dataset.elementId = row._element.id();
                    tr.addEventListener('click', (e) => {
                        if (!selectionEnabled) return;
                        const selection = window.getSelection();
                        if (selection && selection.toString().length > 0) return;
                        if (e.ctrlKey || e.metaKey) {
                            row._element.selected() ? row._element.unselect() : row._element.select();
                        } else {
                            cy.elements().unselect();
                            row._element.select();
                        }
                    });
                    
                    columns.forEach(col => {
                        const td = document.createElement('td');
                        let value = row[col];
                        
                        const items = getArrayItems(value);

                        // Apply array filtering for this row if indices are matched
                        if (items && arrayMatchedIndices) {
                                const newItems = arrayMatchedIndices
                                    .map(i => items[i])
                                    .filter(v => v !== undefined);
                                value = newItems;
                        }

                        // Scalar Logic: Blank out if external condition fails
                        if (!items && externalScalarChecks.has(col)) {
                            if (!evaluateExternalConditionSequence(value, externalScalarChecks.get(col))) {
                                value = '';
                            }
                        }

                        // Pass value without query since we pre-filtered
                        td.appendChild(createCellContent(value));
                        tr.appendChild(td);
                    });
                    tbody.appendChild(tr);
                });
            };

            const renderTable = () => {
                if (!tableVisible) return;
                const type = currentTab;
                const columns = collectColumns(type);
                renderTableHeader(columns, type);
                renderTableBody(columns, type);
            };

            if (nodeTab) {
                nodeTab.addEventListener('click', () => {
                    currentTab = 'node';
                    nodeTab.classList.add('active');
                    edgeTab.classList.remove('active');
                    renderTable();
                });
            }
            if (edgeTab) {
                edgeTab.addEventListener('click', () => {
                    currentTab = 'edge';
                    edgeTab.classList.add('active');
                    nodeTab.classList.remove('active');
                    renderTable();
                });
            }
            if (tableApplyBtn) {
                tableApplyBtn.addEventListener('click', () => renderTable());
            }
            if (tableClearBtn) {
                tableClearBtn.addEventListener('click', () => {
                    withLoading(() => {
                        // Clear table filters
                        filters.node = {};
                        filters.edge = {};
                        
                        // Clear filter input fields
                        const filterInputs = document.querySelectorAll('.column-filter');
                        filterInputs.forEach(input => input.value = '');
                        
                        // Unselect elements
                        cy.elements().unselect();
                        
                        // Clear external filter results
                        externalFilterResults = null;
                        
                        // Cancel pending debounced render since we render immediately
                        if (renderTableDebounceTimer) {
                            clearTimeout(renderTableDebounceTimer);
                            renderTableDebounceTimer = null;
                        }
                        renderTable();
                    }, 'Clearing...');
                });
            }
            if (tableToggle) {
                tableToggle.addEventListener('click', () => setTableVisible(!tableVisible));
            }

            // Apply network background
            if (backgroundColor) {
                const bgLayer = document.getElementById('network-background');
                if (bgLayer) bgLayer.style.backgroundColor = backgroundColor;
                document.body.style.backgroundColor = backgroundColor;
            }

            // Apply element-level styles (computed)
            const applyOverrides = (map) => {
                if (!map) return;
                Object.keys(map).forEach((id) => {
                    const ele = cy.getElementById(id);
                    if (ele && ele.length > 0) {
                        ele.style(map[id]);
                    }
                });
            };
            applyOverrides(styleOverrides.nodes);
            applyOverrides(styleOverrides.edges);

            // Render overlay layers
            const frontContainer = document.getElementById('overlay-container');
            const backContainer = document.getElementById('overlay-container-back');

            const renderOverlay = (layersData) => {
                frontContainer.innerHTML = '';
                backContainer.innerHTML = '';

                const createRectangle = (obj) => {
                    const div = document.createElement('div');
                    div.className = 'overlay-shape overlay-rectangle';
                    div.style.left = obj.x + 'px';
                    div.style.top = obj.y + 'px';
                    div.style.width = obj.width + 'px';
                    div.style.height = obj.height + 'px';
                    div.style.backgroundColor = obj.fillColor;
                    div.style.border = obj.strokeWidth + 'px solid ' + obj.strokeColor;
                    div.style.opacity = obj.opacity;
                    div.style.transform = 'rotate(' + obj.rotation + 'deg)';
                    return div;
                };

                const createEllipse = (obj) => {
                    const div = document.createElement('div');
                    div.className = 'overlay-shape overlay-ellipse';
                    div.style.left = obj.x + 'px';
                    div.style.top = obj.y + 'px';
                    div.style.width = obj.width + 'px';
                    div.style.height = obj.height + 'px';
                    div.style.backgroundColor = obj.fillColor;
                    div.style.border = obj.strokeWidth + 'px solid ' + obj.strokeColor;
                    div.style.opacity = obj.opacity;
                    div.style.transform = 'rotate(' + obj.rotation + 'deg)';
                    div.style.borderRadius = '50%';
                    return div;
                };

                const createLine = (obj) => {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'overlay-shape overlay-line';
                    const minX = Math.min(obj.x, obj.x2);
                    const minY = Math.min(obj.y, obj.y2);
                    const maxX = Math.max(obj.x, obj.x2);
                    const maxY = Math.max(obj.y, obj.y2);
                    const padding = 10;
                    const width = maxX - minX + padding * 2;
                    const height = maxY - minY + padding * 2;

                    wrapper.style.left = (minX - padding) + 'px';
                    wrapper.style.top = (minY - padding) + 'px';
                    wrapper.style.width = width + 'px';
                    wrapper.style.height = height + 'px';
                    wrapper.style.overflow = 'visible';

                    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                    svg.setAttribute('width', width);
                    svg.setAttribute('height', height);
                    svg.style.width = '100%';
                    svg.style.height = '100%';

                    if (obj.arrowHead) {
                        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
                        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
                        marker.setAttribute('id', 'arrow-' + obj.id);
                        marker.setAttribute('markerWidth', '10');
                        marker.setAttribute('markerHeight', '10');
                        marker.setAttribute('refX', '9');
                        marker.setAttribute('refY', '3');
                        marker.setAttribute('orient', 'auto');
                        marker.setAttribute('markerUnits', 'strokeWidth');
                        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                        path.setAttribute('d', 'M0,0 L0,6 L9,3 z');
                        path.setAttribute('fill', obj.strokeColor);
                        marker.appendChild(path);
                        defs.appendChild(marker);
                        svg.appendChild(defs);
                    }

                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line.setAttribute('x1', obj.x - minX + padding);
                    line.setAttribute('y1', obj.y - minY + padding);
                    line.setAttribute('x2', obj.x2 - minX + padding);
                    line.setAttribute('y2', obj.y2 - minY + padding);
                    line.setAttribute('stroke', obj.strokeColor);
                    line.setAttribute('stroke-width', obj.strokeWidth);
                    line.setAttribute('opacity', obj.opacity);
                    if (obj.arrowHead) {
                        line.setAttribute('marker-end', 'url(#arrow-' + obj.id + ')');
                    }
                    svg.appendChild(line);
                    wrapper.appendChild(svg);
                    return wrapper;
                };

                const createText = (obj) => {
                    const div = document.createElement('div');
                    div.className = 'overlay-shape overlay-text';
                    div.style.left = obj.x + 'px';
                    div.style.top = obj.y + 'px';
                    div.style.width = obj.width + 'px';
                    div.style.height = obj.height + 'px';
                    div.style.padding = '5px';
                    div.style.fontSize = (obj.fontSize || 12) + 'px';
                    div.style.fontFamily = obj.fontFamily;
                    div.style.color = obj.textColor;
                    div.style.backgroundColor = obj.fillColor === 'transparent' ? 'transparent' : obj.fillColor;
                    div.style.border = obj.strokeWidth + 'px solid ' + (obj.strokeColor === 'transparent' ? 'transparent' : obj.strokeColor);
                    div.style.opacity = obj.opacity;
                    div.style.transform = 'rotate(' + obj.rotation + 'deg)';
                    div.style.whiteSpace = 'pre-wrap';
                    div.style.textAlign = obj.textAlign || 'left';
                    div.style.display = 'flex';
                    div.style.alignItems = obj.textVAlign === 'middle' ? 'center' : obj.textVAlign === 'bottom' ? 'flex-end' : 'flex-start';
                    div.style.justifyContent = obj.textAlign === 'center' ? 'center' : obj.textAlign === 'right' ? 'flex-end' : 'flex-start';
                    div.style.boxSizing = 'border-box';
                    
                    const span = document.createElement('span');
                    span.style.width = '100%';
                    span.style.textAlign = obj.textAlign || 'left';
                    span.textContent = obj.text || 'Text';
                    div.appendChild(span);
                    
                    return div;
                };

                const createImage = (obj) => {
                    const div = document.createElement('div');
                    div.className = 'overlay-shape overlay-image';
                    div.style.left = obj.x + 'px';
                    div.style.top = obj.y + 'px';
                    div.style.width = obj.width + 'px';
                    div.style.height = obj.height + 'px';
                    div.style.opacity = obj.opacity;
                    div.style.transform = 'rotate(' + obj.rotation + 'deg)';
                    div.style.backgroundImage = 'url(' + obj.imageData + ')';
                    div.style.backgroundSize = 'contain';
                    div.style.backgroundRepeat = 'no-repeat';
                    div.style.backgroundPosition = 'center';
                    div.style.border = obj.strokeWidth + 'px solid ' + (obj.strokeColor === 'transparent' ? 'transparent' : obj.strokeColor);
                    return div;
                };

                const createTable = (obj) => {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'overlay-shape overlay-table';
                    wrapper.style.left = obj.x + 'px';
                    wrapper.style.top = obj.y + 'px';
                    wrapper.style.width = obj.width + 'px';
                    wrapper.style.height = obj.height + 'px';
                    wrapper.style.backgroundColor = obj.fillColor === 'transparent' ? 'transparent' : obj.fillColor;
                    wrapper.style.border = obj.strokeWidth + 'px solid ' + (obj.strokeColor === 'transparent' ? 'transparent' : obj.strokeColor);
                    wrapper.style.opacity = obj.opacity;
                    wrapper.style.overflow = 'hidden';

                    if (!obj.table) return wrapper;

                    const table = document.createElement('table');
                    table.className = 'overlay-table-grid';
                    table.style.fontSize = (obj.fontSize || 12) + 'px';
                    table.style.color = obj.textColor || '#000000';

                    const colgroup = document.createElement('colgroup');
                    for (let c = 0; c < obj.table.cols; c++) {
                        const col = document.createElement('col');
                        const width = (obj.table.colWidths && obj.table.colWidths[c] != null)
                            ? obj.table.colWidths[c]
                            : (obj.width / obj.table.cols);
                        col.style.width = width + 'px';
                        colgroup.appendChild(col);
                    }
                    table.appendChild(colgroup);

                    for (let r = 0; r < obj.table.rows; r++) {
                        const tr = document.createElement('tr');
                        const height = (obj.table.rowHeights && obj.table.rowHeights[r] != null)
                            ? obj.table.rowHeights[r]
                            : (obj.height / obj.table.rows);
                        tr.style.height = height + 'px';
                        for (let c = 0; c < obj.table.cols; c++) {
                            const cell = obj.table.cells && obj.table.cells[r] ? obj.table.cells[r][c] : null;
                            if (!cell || cell.hidden) continue;
                            const td = document.createElement('td');
                            td.className = 'overlay-table-cell';
                            td.rowSpan = cell.rowspan || 1;
                            td.colSpan = cell.colspan || 1;
                            td.textContent = cell.text || '';
                            td.style.border = obj.strokeWidth + 'px solid ' + (obj.strokeColor === 'transparent' ? 'transparent' : obj.strokeColor);
                            td.style.backgroundColor = obj.fillColor === 'transparent' ? 'transparent' : obj.fillColor;
                            tr.appendChild(td);
                        }
                        table.appendChild(tr);
                    }

                    wrapper.appendChild(table);
                    return wrapper;
                };

                layersData.forEach(obj => {
                    if (!obj.visible) return;
                    let element = null;
                    switch (obj.type) {
                        case 'rectangle':
                            element = createRectangle(obj);
                            break;
                        case 'ellipse':
                            element = createEllipse(obj);
                            break;
                        case 'line':
                        case 'arrow':
                            element = createLine(obj);
                            break;
                        case 'text':
                            element = createText(obj);
                            break;
                        case 'table':
                            element = createTable(obj);
                            break;
                        case 'image':
                            element = createImage(obj);
                            break;
                        default:
                            return;
                    }
                    if (!element) return;
                    element.id = obj.id;
                    element.classList.add('overlay-object');
                    element.style.zIndex = obj.zIndex ?? 0;
                    const container = (obj.plane === 'background') ? backContainer : frontContainer;
                    container.appendChild(element);
                });
            };

            const syncOverlayWithCy = () => {
                const pan = cy.pan();
                const zoom = cy.zoom();
                [frontContainer, backContainer].forEach(container => {
                    container.style.transform = 'translate(' + pan.x + 'px, ' + pan.y + 'px) scale(' + zoom + ')';
                });
            };

            renderOverlay(layers);
            syncOverlayWithCy();
            cy.on('pan zoom', syncOverlayWithCy);

            const fitToViewWithOverlays = (paddingPx) => {
                const pad = (typeof paddingPx === 'number') ? paddingPx : 50;
                const elements = cy.elements();
                const cyBounds = elements.length > 0 ? elements.boundingBox() : null;

                let overlayBounds = null;
                if (layers && Array.isArray(layers) && layers.length > 0) {
                    layers.forEach(obj => {
                        if (!obj || obj.visible === false) return;
                        let x1 = obj.x || 0;
                        let y1 = obj.y || 0;
                        let x2 = x1;
                        let y2 = y1;

                        if (obj.type === 'line' || obj.type === 'arrow') {
                            const ox2 = (obj.x2 !== undefined) ? obj.x2 : x1;
                            const oy2 = (obj.y2 !== undefined) ? obj.y2 : y1;
                            x1 = Math.min(x1, ox2);
                            y1 = Math.min(y1, oy2);
                            x2 = Math.max(x2, ox2);
                            y2 = Math.max(y2, oy2);
                        } else {
                            const w = obj.width || 0;
                            const h = obj.height || 0;
                            x2 = x1 + w;
                            y2 = y1 + h;
                        }

                        if (!overlayBounds) {
                            overlayBounds = { x1: x1, y1: y1, x2: x2, y2: y2 };
                        } else {
                            overlayBounds.x1 = Math.min(overlayBounds.x1, x1);
                            overlayBounds.y1 = Math.min(overlayBounds.y1, y1);
                            overlayBounds.x2 = Math.max(overlayBounds.x2, x2);
                            overlayBounds.y2 = Math.max(overlayBounds.y2, y2);
                        }
                    });
                }

                if (!cyBounds && !overlayBounds) return;

                const bounds = {
                    x1: cyBounds ? cyBounds.x1 : overlayBounds.x1,
                    y1: cyBounds ? cyBounds.y1 : overlayBounds.y1,
                    x2: cyBounds ? cyBounds.x2 : overlayBounds.x2,
                    y2: cyBounds ? cyBounds.y2 : overlayBounds.y2
                };

                if (overlayBounds) {
                    bounds.x1 = Math.min(bounds.x1, overlayBounds.x1);
                    bounds.y1 = Math.min(bounds.y1, overlayBounds.y1);
                    bounds.x2 = Math.max(bounds.x2, overlayBounds.x2);
                    bounds.y2 = Math.max(bounds.y2, overlayBounds.y2);
                }

                const width = bounds.x2 - bounds.x1;
                const height = bounds.y2 - bounds.y1;
                if (width <= 0 || height <= 0) {
                    cy.fit();
                    syncOverlayWithCy();
                    return;
                }

                const viewportW = cy.width();
                const viewportH = cy.height();
                const usableW = Math.max(1, viewportW - pad * 2);
                const usableH = Math.max(1, viewportH - pad * 2);
                const zoom = Math.min(usableW / width, usableH / height);
                cy.zoom(zoom);
                const pan = {
                    x: -bounds.x1 * zoom + (viewportW - width * zoom) / 2,
                    y: -bounds.y1 * zoom + (viewportH - height * zoom) / 2
                };
                cy.pan(pan);
                syncOverlayWithCy();
            };

            // Hover highlight functionality (full upstream/downstream path)
            let hoveredElements = null;

            function clearHighlight() {
                cy.elements().forEach(ele => {
                    const originalOpacity = ele.data('_hoverOriginalOpacity');
                    if (originalOpacity !== undefined) {
                        ele.style('opacity', originalOpacity);
                        ele.removeData('_hoverOriginalOpacity');
                    }
                });

                if (hoveredElements) {
                    hoveredElements.forEach(ele => {
                        if (ele.isNode()) {
                            const originalBg = ele.data('_hoverOriginalBg');
                            if (originalBg !== undefined) {
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
                }
                hoveredElements = null;
            }

            function highlightPaperIdPath(node) {
                clearHighlight();

                const paperIdKeys = ['論文ID', 'paperId', 'PaperID', 'PaperId', 'pmid'];
                let hoveredPaperIds = null;
                for (let k of paperIdKeys) {
                    const v = node.data(k);
                    if (v !== undefined && v !== null && v !== '') {
                        hoveredPaperIds = v;
                        break;
                    }
                }
                if (!hoveredPaperIds) return;

                const paperIdArray = Array.isArray(hoveredPaperIds) ? hoveredPaperIds : [hoveredPaperIds];
                if (paperIdArray.length === 0) return;

                const paperIdSet = new Set(paperIdArray);
                const pathElements = cy.collection();
                pathElements.merge(node);

                const allPathEdges = node.predecessors('edge').union(node.successors('edge'));
                const matchedEdges = cy.collection();
                allPathEdges.forEach(edge => {
                    let edgePaperIds = null;
                    for (let k of paperIdKeys) {
                        const v = edge.data(k);
                        if (v !== undefined && v !== null && v !== '') {
                            edgePaperIds = v;
                            break;
                        }
                    }
                    if (edgePaperIds) {
                        const edgePaperIdArray = Array.isArray(edgePaperIds) ? edgePaperIds : [edgePaperIds];
                        const hasMatch = edgePaperIdArray.some(id => paperIdSet.has(id));
                        if (hasMatch) {
                            matchedEdges.merge(edge);
                        }
                    }
                });

                pathElements.merge(matchedEdges);
                matchedEdges.forEach(edge => {
                    pathElements.merge(edge.source());
                    pathElements.merge(edge.target());
                });

                const highlightIds = new Set();
                pathElements.forEach(ele => highlightIds.add(ele.id()));

                const allElements = cy.elements();
                allElements.forEach(ele => {
                    const isHighlighted = highlightIds.has(ele.id());
                    if (!isHighlighted) {
                        if (ele.data('_hoverOriginalOpacity') === undefined) {
                            ele.data('_hoverOriginalOpacity', ele.style('opacity'));
                        }
                        ele.style('opacity', 0.2);
                    }
                });

                pathElements.forEach(ele => {
                    if (ele.isNode()) {
                        if (ele.data('_hoverOriginalBg') === undefined) {
                            ele.data('_hoverOriginalBg', ele.style('background-color'));
                        }
                        ele.style('background-color', '#ec4899');
                    } else if (ele.isEdge()) {
                        if (ele.data('_hoverOriginalLineColor') === undefined) {
                            ele.data('_hoverOriginalLineColor', ele.style('line-color'));
                        }
                        ele.style('line-color', '#ec4899');
                        ele.style('target-arrow-color', '#ec4899');
                    }
                });

                hoveredElements = pathElements;
            }

            // Path Trace toggle
            let pathTraceEnabled = true;
            const pathTraceToggle = document.getElementById('path-trace-toggle');
            const setPathTraceMode = (enabled) => {
                pathTraceEnabled = enabled;
                if (pathTraceToggle) {
                    pathTraceToggle.textContent = enabled ? 'ON' : 'OFF';
                    pathTraceToggle.classList.toggle('off', !enabled);
                }
                // Selection ON/OFF
                cy.autounselectify(enabled);
                cy.boxSelectionEnabled(!enabled);
                cy.nodes().selectable(!enabled);
                cy.edges().selectable(!enabled);
                selectionEnabled = !enabled;
                if (!enabled && typeof clearHighlight === 'function') {
                    clearHighlight();
                }
                if (enabled) {
                    cy.elements().unselect();
                }
                renderTable();
            };
            if (pathTraceToggle) {
                pathTraceToggle.addEventListener('click', async () => {
                    const requestEnable = !pathTraceEnabled;
                    if (requestEnable) {
                        // If enabling Path Trace, check for active filter or selection
                        const hasFilter = externalFilterResults && (externalFilterResults.nodes && externalFilterResults.nodes.length > 0 || externalFilterResults.edges && externalFilterResults.edges.length > 0);
                        const hasSelection = cy.elements(':selected').length > 0;
                        if (hasFilter || hasSelection) {
                            const confirmMsg = 'フィルター機能、ノード・エッジ選択機能は解除されます。よろしいですか？';
                            const ok = await showConfirm(confirmMsg);
                            if (!ok) return; // abort enabling
                            // Clear filters and selections before enabling
                            if (typeof clearFilter === 'function') clearFilter();
                            cy.elements().unselect();
                        }
                    }
                    setPathTraceMode(requestEnable);
                });
            }
            setPathTraceMode(false);
            setTableVisible(false);
            // ensure resize handle exists
            ensureTableResizeHandle();

            // Edge Weight Switcher
            const weightSwitcherToggle = document.getElementById('weight-switcher-toggle');
            const weightSwitcherModal = document.getElementById('weight-switcher-modal');
            const weightSwitcherClose = document.getElementById('weight-switcher-modal-close');
            const weightColumnSelect = document.getElementById('weight-column-select');
            const weightSwitcherApply = document.getElementById('weight-switcher-apply');
            const weightSwitcherCancel = document.getElementById('weight-switcher-cancel');
            const weightSwitcherMenuItem = document.getElementById('weight-switcher-menu-item');
            let currentWeightColumn = null;
            let weightColumns = [];
            let initialWeightColumn = null;
            let initialMinWidth = null;
            let initialMaxWidth = null;

            // Check if edges have weight columns
            const detectWeightColumns = () => {
                const columns = new Set();
                const edges = cy.edges();
                edges.forEach(edge => {
                    const data = edge.data();
                    Object.keys(data).forEach(key => {
                        if (/weight|重み|ウェイト/i.test(key)) {
                            columns.add(key);
                        }
                    });
                });
                return Array.from(columns).sort();
            };

            weightColumns = detectWeightColumns();
            if (weightColumns.length > 0) {
                // Show the Edge Weight Switcher button
                if (weightSwitcherMenuItem) {
                    weightSwitcherMenuItem.style.display = 'flex';
                }
                // Set initial weight column from edgeWidthConfig or first one found
                if (edgeWidthConfig && edgeWidthConfig.type === 'continuous' && edgeWidthConfig.attribute) {
                    initialWeightColumn = edgeWidthConfig.attribute;
                    currentWeightColumn = edgeWidthConfig.attribute;
                    // Get initial min/max from mapping config
                    if (edgeWidthConfig.mapping && edgeWidthConfig.mapping.min !== undefined && edgeWidthConfig.mapping.max !== undefined) {
                        // Extract numeric values from color or size range
                        // For width, these should be numbers directly
                        const minVal = parseFloat(edgeWidthConfig.mapping.min);
                        const maxVal = parseFloat(edgeWidthConfig.mapping.max);
                        if (!isNaN(minVal) && !isNaN(maxVal)) {
                            initialMinWidth = minVal;
                            initialMaxWidth = maxVal;
                        }
                    }
                    // If not found in mapping or invalid, calculate from current edge widths
                    if (initialMinWidth === null || initialMaxWidth === null) {
                        const currentWidths = [];
                        cy.edges().forEach(edge => {
                            const width = edge.style('width');
                            const numWidth = parseFloat(width);
                            if (!isNaN(numWidth)) {
                                currentWidths.push(numWidth);
                            }
                        });
                        if (currentWidths.length > 0) {
                            initialMinWidth = Math.min(...currentWidths);
                            initialMaxWidth = Math.max(...currentWidths);
                        }
                    }
                } else {
                    currentWeightColumn = weightColumns[0];
                }
            }

            // Modal drag functionality
            const weightSwitcherContent = document.querySelector('.weight-switcher-modal-content');
            const weightSwitcherHeader = document.querySelector('.weight-switcher-modal-header');
            let isDraggingWeightModal = false;
            let dragOffsetX = 0;
            let dragOffsetY = 0;

            if (weightSwitcherHeader && weightSwitcherContent) {
                weightSwitcherHeader.addEventListener('mousedown', (e) => {
                    isDraggingWeightModal = true;
                    const rect = weightSwitcherContent.getBoundingClientRect();
                    dragOffsetX = e.clientX - rect.left;
                    dragOffsetY = e.clientY - rect.top;
                    e.preventDefault();
                });

                document.addEventListener('mousemove', (e) => {
                    if (isDraggingWeightModal && weightSwitcherContent) {
                        const newLeft = e.clientX - dragOffsetX;
                        const newTop = e.clientY - dragOffsetY;
                        weightSwitcherContent.style.left = newLeft + 'px';
                        weightSwitcherContent.style.top = newTop + 'px';
                        weightSwitcherContent.style.right = 'auto';
                    }
                });

                document.addEventListener('mouseup', () => {
                    isDraggingWeightModal = false;
                });
            }

            // Toggle modal
            let weightSwitcherVisible = false;
            if (weightSwitcherToggle) {
                weightSwitcherToggle.addEventListener('click', () => {
                    weightSwitcherVisible = !weightSwitcherVisible;
                    
                    if (weightSwitcherVisible) {
                        // Populate select with weight columns
                        if (weightColumnSelect) {
                            weightColumnSelect.innerHTML = '';
                            weightColumns.forEach(col => {
                                const option = document.createElement('option');
                                option.value = col;
                                option.textContent = col;
                                if (col === currentWeightColumn) {
                                    option.selected = true;
                                }
                                weightColumnSelect.appendChild(option);
                            });
                        }
                        if (weightSwitcherModal) {
                            weightSwitcherModal.classList.add('active');
                        }
                        // Update button state
                        weightSwitcherToggle.textContent = 'ON';
                        weightSwitcherToggle.classList.remove('off');
                    } else {
                        if (weightSwitcherModal) {
                            weightSwitcherModal.classList.remove('active');
                        }
                        // Update button state
                        weightSwitcherToggle.textContent = 'OFF';
                        weightSwitcherToggle.classList.add('off');
                    }
                });
            }

            // Close modal
            const closeWeightSwitcherModal = () => {
                weightSwitcherVisible = false;
                if (weightSwitcherModal) {
                    weightSwitcherModal.classList.remove('active');
                }
                // Update button state
                if (weightSwitcherToggle) {
                    weightSwitcherToggle.textContent = 'OFF';
                    weightSwitcherToggle.classList.add('off');
                }
            };
            if (weightSwitcherClose) {
                weightSwitcherClose.addEventListener('click', closeWeightSwitcherModal);
            }
            if (weightSwitcherCancel) {
                weightSwitcherCancel.addEventListener('click', closeWeightSwitcherModal);
            }
            // Remove background click to close functionality for non-modal behavior
            // if (weightSwitcherModal) {
            //     weightSwitcherModal.addEventListener('click', (e) => {
            //         if (e.target === weightSwitcherModal) {
            //             closeWeightSwitcherModal();
            //         }
            //     });
            // }

            // Apply weight column change
            if (weightSwitcherApply) {
                weightSwitcherApply.addEventListener('click', () => {
                    const selectedColumn = weightColumnSelect ? weightColumnSelect.value : null;
                    if (selectedColumn) {
                        currentWeightColumn = selectedColumn;
                        
                        // Collect all weight values to determine min/max
                        const weightValues = [];
                        cy.edges().forEach(edge => {
                            const weightValue = edge.data(selectedColumn);
                            if (weightValue !== undefined && weightValue !== null && weightValue !== '') {
                                const numValue = parseFloat(weightValue);
                                if (!isNaN(numValue)) {
                                    weightValues.push(numValue);
                                }
                            }
                        });
                        
                        if (weightValues.length > 0) {
                            // Calculate min and max values
                            const minValue = Math.min(...weightValues);
                            const maxValue = Math.max(...weightValues);
                            
                            // Define edge width range (min width to max width)
                            let minWidth, maxWidth;
                            // If returning to initial column, use saved min/max
                            if (selectedColumn === initialWeightColumn && initialMinWidth !== null && initialMaxWidth !== null) {
                                minWidth = initialMinWidth;
                                maxWidth = initialMaxWidth;
                            } else {
                                // Auto-calculate for other columns
                                minWidth = 0.5;
                                maxWidth = 20;
                            }
                            
                            // Apply continuous mapping
                            cy.edges().forEach(edge => {
                                const weightValue = edge.data(selectedColumn);
                                if (weightValue !== undefined && weightValue !== null && weightValue !== '') {
                                    const numValue = parseFloat(weightValue);
                                    if (!isNaN(numValue)) {
                                        // Linear interpolation for continuous mapping
                                        let scaledWidth;
                                        if (maxValue === minValue) {
                                            // All values are the same
                                            scaledWidth = (minWidth + maxWidth) / 2;
                                        } else {
                                            // Map value from [minValue, maxValue] to [minWidth, maxWidth]
                                            const ratio = (numValue - minValue) / (maxValue - minValue);
                                            scaledWidth = minWidth + ratio * (maxWidth - minWidth);
                                        }
                                        edge.style('width', scaledWidth);
                                    }
                                } else {
                                    // No value, set to minimum width
                                    edge.style('width', minWidth);
                                }
                            });
                        }
                    }
                    // Don't close modal after applying - user may want to try different columns
                });
            }

            cy.on('mouseover', 'node', function(event) {
                if (!pathTraceEnabled) return;
                highlightPaperIdPath(event.target);
            });

            cy.on('mouseout', 'node', function() {
                if (!pathTraceEnabled) return;
                clearHighlight();
            });

            // Selection Styling Logic
            cy.on('select', 'node', (e) => {
                if (!selectionEnabled) return;
                
                // Select induced edges when manually selecting nodes
                // Skip if this node selection was triggered by edge selection
                if (!isFilterSelecting && !isEdgeSelectingNodes) {
                    const selectedNodes = cy.nodes(':selected');
                    if (selectedNodes.length > 1) {
                        const inducedEdges = selectedNodes.edgesWith(selectedNodes);
                        inducedEdges.select();
                    }
                }

                const node = e.target;
                if (node.data('_selectionOriginalBg') === undefined) {
                    node.data('_selectionOriginalBg', node.style('background-color'));
                    node.data('_selectionOriginalBorderColor', node.style('border-color'));
                    node.data('_selectionOriginalBorderWidth', node.style('border-width'));
                }
                node.style({
                    'background-color': '#eab308',
                    'border-color': '#ca8a04',
                    'border-width': 3
                });
            });

            cy.on('unselect', 'node', (e) => {
                const node = e.target;
                const bg = node.data('_selectionOriginalBg');
                const bc = node.data('_selectionOriginalBorderColor');
                const bw = node.data('_selectionOriginalBorderWidth');
                
                if (bg !== undefined) node.style('background-color', bg);
                if (bc !== undefined) node.style('border-color', bc);
                if (bw !== undefined) node.style('border-width', bw);
                
                node.removeData('_selectionOriginalBg');
                node.removeData('_selectionOriginalBorderColor');
                node.removeData('_selectionOriginalBorderWidth');
            });

            cy.on('select', 'edge', (e) => {
                if (!selectionEnabled) return;

                // When an edge is selected, select its connected nodes
                if (!isFilterSelecting) {
                     // Use flag to prevent infinite loop or unwanted induced edge selection by the node handler
                     isEdgeSelectingNodes = true;
                     const connectedNodes = e.target.connectedNodes();
                     connectedNodes.select();
                     isEdgeSelectingNodes = false;
                }

                const edge = e.target;
                if (edge.data('_selectionOriginalLineColor') === undefined) {
                    edge.data('_selectionOriginalLineColor', edge.style('line-color'));
                    edge.data('_selectionOriginalTargetArrowColor', edge.style('target-arrow-color'));
                    edge.data('_selectionOriginalWidth', edge.style('width'));
                    edge.data('_selectionOriginalZIndex', edge.style('z-index'));
                }
                
                // 本ツールと同じ選択色 (#ef4444) と元の太さを維持
                const currentWidth = edge.style('width');
                
                edge.style({
                    'line-color': '#ef4444',
                    'target-arrow-color': '#ef4444',
                    'width': currentWidth,
                    'z-index': 9999
                });
            });

            cy.on('unselect', 'edge', (e) => {
                const edge = e.target;
                const lc = edge.data('_selectionOriginalLineColor');
                const tc = edge.data('_selectionOriginalTargetArrowColor');
                const w = edge.data('_selectionOriginalWidth');
                const zi = edge.data('_selectionOriginalZIndex');
                
                if (lc !== undefined) edge.style('line-color', lc);
                if (tc !== undefined) edge.style('target-arrow-color', tc);
                if (w !== undefined) edge.style('width', w);
                if (zi !== undefined) edge.style('z-index', zi);
                
                edge.removeData('_selectionOriginalLineColor');
                edge.removeData('_selectionOriginalTargetArrowColor');
                edge.removeData('_selectionOriginalWidth');
                edge.removeData('_selectionOriginalZIndex');
            });

            // Selection -> Table Panel sync
            cy.on('select unselect', () => {
                if (!selectionEnabled) return;
                if (isFilterSelecting) return;
                
                // Clear table filters and external filter results when selection changes
                filters.node = {};
                filters.edge = {};
                externalFilterResults = null;
                
                if (renderTableDebounceTimer) clearTimeout(renderTableDebounceTimer);
                renderTableDebounceTimer = setTimeout(() => {
                    renderTable();
                    renderTableDebounceTimer = null;
                }, 100);
            });

            // Background click: clear selection and filters
            cy.on('tap', (evt) => {
                if (evt.target !== cy) return;
                
                // Check if there are active items to clear
                const currSel = cy.elements(':selected');
                const hasSelection = currSel && currSel.length > 0;
                const hasTableFilters = Object.values(filters.node || {}).some(v => v && String(v).trim() !== '') ||
                                       Object.values(filters.edge || {}).some(v => v && String(v).trim() !== '');
                const hasExternalFilter = externalFilterResults !== null;
                
                // If nothing is selected and no filters are active, do nothing
                if (!hasSelection && !hasTableFilters && !hasExternalFilter) return;

                withLoading(() => {
                    // Clear table filters
                    filters.node = {};
                    filters.edge = {};
                    
                    // Clear filter input fields
                    const filterInputs = document.querySelectorAll('.column-filter');
                    filterInputs.forEach(input => input.value = '');
                    
                    // Unselect elements
                    cy.elements().unselect();
                    cy.elements().style('opacity', 1);
                    
                    // Clear external filter results
                    externalFilterResults = null;
                    
                    // Cancel pending debounced render since we render immediately
                    if (renderTableDebounceTimer) {
                        clearTimeout(renderTableDebounceTimer);
                        renderTableDebounceTimer = null;
                    }
                    renderTable();
                }, 'Clearing...');
            });

            // Fit to view on load (including overlays)
            cy.ready(function() {
                console.log('Cytoscape ready');
                
                // Initialize Filter Panel
                filterPanel = new FilterPanel(cy);
                const filterToggle = document.getElementById('filter-panel-toggle');
                if (filterToggle) {
                    filterToggle.addEventListener('click', () => {
                        const show = !filterPanel.panel.classList.contains('active');
                        filterPanel.toggle(show);
                    });
                }

                fitToViewWithOverlays(50);
                setTimeout(hideLoading, 500);
            });
        } catch (error) {
            try { hideLoading(); } catch (e) {}
            console.error('Error initializing network:', error);
            alert('Failed to load network: ' + (error && error.message ? error.message : String(error)));
        }
    </script>
</body>
</html>`;
    }

    /**
     * HTMLをファイルとしてダウンロード
     * @param {string} html - HTML文字列
     * @param {string} filename - ファイル名
     */
    downloadHTML(html, filename) {
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }
}

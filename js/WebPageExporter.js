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

        // HTMLを生成
        const html = this.generateHTML(elements, styles, layers, elementStyleOverrides, backgroundColor);

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
     * @returns {string} HTML文字列
     */
    generateHTML(elements, styles, layers, elementStyleOverrides, backgroundColor) {
        // JSONはapplication/jsonスクリプトタグに安全に埋め込むため、base64化
        const toBase64 = (value) => btoa(unescape(encodeURIComponent(value)));
        const elementsJson = toBase64(JSON.stringify(elements));
        const stylesJson = toBase64(JSON.stringify(styles));
        const layersJson = toBase64(JSON.stringify(layers));
        const overridesJson = toBase64(JSON.stringify(elementStyleOverrides));
        const backgroundJson = toBase64(JSON.stringify(backgroundColor));

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
            padding: 0;
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
            background-color: #ffffff;
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
            height: 300px;
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
        .data-table th,
        .data-table td {
            padding: 6px 8px;
            border-bottom: 1px solid #e2e8f0;
            white-space: nowrap;
            vertical-align: top;
            position: relative;
            overflow: hidden;
            text-overflow: ellipsis;
            min-width: 30px;
            box-sizing: border-box;
            max-width: 0; /* Allow shrinking below content width in some browsers */
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
            max-width: 100%;
        }
        .cell-array {
            display: flex;
            flex-direction: column;
            gap: 0;
            min-width: 0;
        }
        .cell-array-item {
            padding: 2px 0;
            border-bottom: 1px solid #e2e8f0;
            line-height: 1.4;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            min-width: 0;
        }
        .cell-array-item:last-child {
            border-bottom: none;
        }
        .data-table tr:hover {
            background: #f8fafc;
        }
        .column-filter {
            width: 100%;
            padding: 4px 6px;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            font-size: 12px;
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
    </style>
</head>
<body>
    <div class="progress-overlay active" id="progress-overlay">
        <div class="spinner"></div>
        <p class="progress-text">Loading...</p>
    </div>
    <div class="top-menubar">
        <div class="menu-item">
            <span class="menu-label">Path Trace</span>
            <button id="path-trace-toggle" class="path-trace-toggle off">OFF</button>
        </div>
        <div class="menu-item">
            <span class="menu-label">Table Panel</span>
            <button id="table-panel-toggle" class="table-toggle off">OFF</button>
        </div>
    </div>
    <div id="cy"></div>
    <div id="overlay-container-back" class="overlay-container"></div>
    <div id="overlay-container" class="overlay-container"></div>

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

    <script type="application/json" id="elements-json">${elementsJson}</script>
    <script type="application/json" id="styles-json">${stylesJson}</script>
    <script type="application/json" id="layers-json">${layersJson}</script>
    <script type="application/json" id="overrides-json">${overridesJson}</script>
    <script type="application/json" id="background-json">${backgroundJson}</script>
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
            let renderTableDebounceTimer = null;

            const setTableVisible = (visible) => {
                tableVisible = visible;
                if (tablePanel) {
                    tablePanel.classList.toggle('active', visible);
                }
                if (tableToggle) {
                    tableToggle.textContent = visible ? 'ON' : 'OFF';
                    tableToggle.classList.toggle('off', !visible);
                }
                document.documentElement.style.setProperty('--table-panel-height', visible ? '300px' : '0px');
                cy.resize();
                renderTable();
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

            const valueMatches = (value, query) => {
                if (!query) return true;
                const q = String(query).toLowerCase();
                if (Array.isArray(value)) {
                    return value.some(v => String(v).toLowerCase().includes(q));
                }
                return String(value ?? '').toLowerCase().includes(q);
            };

            const formatCellValue = (value) => {
                if (value === null || value === undefined) return '';
                if (Array.isArray(value)) {
                    return value.map(v => String(v)).join('\\n');
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
                } else if (typeof value === 'string' && value.includes('\\n')) {
                    items = value.split('\\n').map(v => v.trim()).filter(v => v !== '');
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
                    if (typeof val === 'string' && val.includes('\\n')) return val.split('\\n');
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
                                return items.some(v => String(v).toLowerCase().includes(String(query).toLowerCase()));
                            }
                            return String(val).toLowerCase().includes(String(query).toLowerCase());
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
                                    if (String(item).toLowerCase().includes(String(query).toLowerCase())) {
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
                               // For node filter, also select induced edges (edges between selected nodes)
                               let inducedEdges = selectedElements.edgesWith(selectedElements);
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

                filtered.forEach(row => {
                    // Start with global allowed indices
                    let validIndices = allowedIndices ? new Set(allowedIndices) : null;
                    
                    // Also consider row-local matches for self-type filters (to be precise)
                    // But users asked for "global" sync. 
                    // Let's refine local matching: if "myIndices" exists, we should ensure the row content matches specific query too.
                    // Actually, "allowedIndices" already contains the union of all matches. 
                    // But specific row might have match only on index 5, while allowedIndices has {5, 6}.
                    // We should intersect allowedIndices with row-specific matches if any active filter applies.

                    if (allowedIndices !== null) {
                         // Refine per row: Intersect global allowed indices with row-local matches
                         Object.keys(activeFilters).forEach(col => {
                             const query = activeFilters[col];
                             if (!query) return;
                             const colVal = row[col];
                             const items = getArrayItems(colVal);
                             
                             if (items) {
                                 // Identify indices in this row's array that match the filter for this column
                                 const rowMatchedIndices = new Set();
                                 items.forEach((item, i) => {
                                     if (String(item).toLowerCase().includes(String(query).toLowerCase())) {
                                         rowMatchedIndices.add(i);
                                     }
                                 });
                                 
                                 // Intersect with validIndices
                                 // If validIndices has {0, 1} (Global Union) but this row only matches at {0},
                                 // we must restrict display to {0}.
                                 if (validIndices) {
                                     const next = new Set();
                                     validIndices.forEach(idx => {
                                         if (rowMatchedIndices.has(idx)) {
                                             next.add(idx);
                                         }
                                     });
                                     validIndices = next;
                                 }
                             }
                         });
                    }

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
                        
                        // Apply linked index filtering for arrays
                        if (validIndices !== null) {
                             let items = getArrayItems(value);
                             if (items) {
                                 const newItems = [];
                                 items.forEach((item, i) => {
                                     if (validIndices.has(i)) newItems.push(item);
                                 });
                                 value = newItems;
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
                        filters.node = {};
                        filters.edge = {};
                        cy.elements().unselect();
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
                const cyContainer = document.getElementById('cy');
                if (cyContainer) cyContainer.style.backgroundColor = backgroundColor;
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
                    div.textContent = obj.text || 'Text';
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
                pathTraceToggle.addEventListener('click', () => {
                    setPathTraceMode(!pathTraceEnabled);
                });
            }
            setPathTraceMode(false);
            setTableVisible(false);

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
                if (!isFilterSelecting) {
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
                const edge = e.target;
                if (edge.data('_selectionOriginalLineColor') === undefined) {
                    edge.data('_selectionOriginalLineColor', edge.style('line-color'));
                    edge.data('_selectionOriginalTargetArrowColor', edge.style('target-arrow-color'));
                    edge.data('_selectionOriginalWidth', edge.style('width'));
                }
                edge.style({
                    'line-color': '#ef4444',
                    'target-arrow-color': '#ef4444',
                    'width': 3
                });
            });

            cy.on('unselect', 'edge', (e) => {
                const edge = e.target;
                const lc = edge.data('_selectionOriginalLineColor');
                const tc = edge.data('_selectionOriginalTargetArrowColor');
                const w = edge.data('_selectionOriginalWidth');
                
                if (lc !== undefined) edge.style('line-color', lc);
                if (tc !== undefined) edge.style('target-arrow-color', tc);
                if (w !== undefined) edge.style('width', w);
                
                edge.removeData('_selectionOriginalLineColor');
                edge.removeData('_selectionOriginalTargetArrowColor');
                edge.removeData('_selectionOriginalWidth');
            });

            // Selection -> Table Panel sync
            cy.on('select unselect', () => {
                if (!selectionEnabled) return;
                if (isFilterSelecting) return;
                
                if (renderTableDebounceTimer) clearTimeout(renderTableDebounceTimer);
                renderTableDebounceTimer = setTimeout(() => {
                    renderTable();
                    renderTableDebounceTimer = null;
                }, 100);
            });

            // Background click clears selection and shows all rows
            cy.on('tap', (evt) => {
                if (evt.target !== cy) return;
                withLoading(() => {
                    filters.node = {};
                    filters.edge = {};
                    cy.elements().unselect();
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
                fitToViewWithOverlays(50);
                setTimeout(hideLoading, 500);
            });
        } catch (error) {
            console.error('Error initializing network:', error);
            alert('Failed to load network: ' + error.message);
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

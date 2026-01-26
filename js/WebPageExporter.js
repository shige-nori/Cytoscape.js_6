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
        // データとスタイルをJSON文字列化（特殊文字をエスケープ）
        const elementsJson = JSON.stringify(elements, null, 2);
        const stylesJson = JSON.stringify(styles, null, 2);
        const layersJson = JSON.stringify(layers, null, 2);
        const overridesJson = JSON.stringify(elementStyleOverrides, null, 2);
        const backgroundJson = JSON.stringify(backgroundColor);

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
            top: 0;
            left: 0;
            background-color: #ffffff;
        }
        .overlay-container {
            position: absolute;
            top: 0;
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
        .info-panel {
            position: absolute;
            top: 20px;
            left: 20px;
            background: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            font-size: 14px;
            color: #334155;
            z-index: 1000;
        }
        .info-panel h3 {
            margin: 0 0 10px 0;
            font-size: 16px;
            color: #0f172a;
        }
        .info-panel .stats {
            display: grid;
            gap: 5px;
        }
        .info-panel .stat-item {
            display: flex;
            justify-content: space-between;
            gap: 15px;
        }
        .info-panel .stat-label {
            font-weight: 500;
        }
        .info-panel .stat-value {
            color: #2563eb;
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
    </style>
</head>
<body>
    <div id="cy"></div>
    <div id="overlay-container-back" class="overlay-container"></div>
    <div id="overlay-container" class="overlay-container"></div>
    <div class="info-panel">
        <h3>Network Info</h3>
        <div class="stats">
            <div class="stat-item">
                <span class="stat-label">Nodes:</span>
                <span class="stat-value" id="node-count">-</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Edges:</span>
                <span class="stat-value" id="edge-count">-</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Path Trace:</span>
                <button id="path-trace-toggle" class="path-trace-toggle">ON</button>
            </div>
        </div>
    </div>

    <script>
        try {
            // Network data
            const elements = ${elementsJson};

            // Style data
            const styles = ${stylesJson};
            const layers = ${layersJson};
            const styleOverrides = ${overridesJson};
            const backgroundColor = ${backgroundJson};

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

            // Update stats
            document.getElementById('node-count').textContent = cy.nodes().length;
            document.getElementById('edge-count').textContent = cy.edges().length;

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
                if (!enabled) {
                    clearHighlight();
                }
            };
            if (pathTraceToggle) {
                pathTraceToggle.addEventListener('click', () => {
                    setPathTraceMode(!pathTraceEnabled);
                });
            }
            setPathTraceMode(true);

            // Hover highlight functionality (full upstream/downstream path)
            let hoveredElements = null;

            const clearHighlight = () => {
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
            };

            const highlightPaperIdPath = (node) => {
                clearHighlight();

                const hoveredPaperIds = node.data('論文ID');
                if (!hoveredPaperIds) return;

                const paperIdArray = Array.isArray(hoveredPaperIds) ? hoveredPaperIds : [hoveredPaperIds];
                if (paperIdArray.length === 0) return;

                const paperIdSet = new Set(paperIdArray);
                const pathElements = cy.collection();
                pathElements.merge(node);

                const allPathEdges = node.predecessors('edge').union(node.successors('edge'));
                const matchedEdges = cy.collection();
                allPathEdges.forEach(edge => {
                    const edgePaperIds = edge.data('論文ID');
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
            };

            cy.on('mouseover', 'node', function(event) {
                if (!pathTraceEnabled) return;
                highlightPaperIdPath(event.target);
            });

            cy.on('mouseout', 'node', function() {
                if (!pathTraceEnabled) return;
                clearHighlight();
            });

            // Fit to view on load
            cy.ready(function() {
                console.log('Cytoscape ready');
                if (cy.elements().length > 0) {
                    cy.fit(cy.elements(), 50);
                    console.log('Fitted to view');
                } else {
                    console.warn('No elements to display');
                }
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

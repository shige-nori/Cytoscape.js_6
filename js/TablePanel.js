/**
 * TablePanel - データテーブルパネル
 */
class TablePanel {
    constructor() {
        this.panel = null;
        this.currentTab = 'nodes';
        this.nodeColumns = [];
        this.edgeColumns = [];
        this.visibleNodeColumns = new Set();
        this.visibleEdgeColumns = new Set();
        this.sortColumn = null;
        this.sortDirection = 'asc';
        this.filters = {};
        this.globalSearchValue = '';
        this.showSelectedOnly = false;
        this.panelHeight = 300;
        this.minPanelHeight = 100;
        this.maxPanelHeight = 600;
        this.resizing = false;
        this.columnWidths = {};
        this.columnResizing = false;
        this.isPopout = false;
        this.popoutWindow = null;
        this.init();
    }

    /**
     * 初期化
     */
    init() {
        this.panel = document.getElementById('table-panel');
        this.setupEventListeners();
        this.setupCytoscapeListeners();
    }

    /**
     * イベントリスナーを設定
     */
    setupEventListeners() {
        // タブ切り替え
        this.panel.querySelectorAll('.table-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchTab(tab.dataset.tab);
            });
        });

        // グローバル検索
        document.getElementById('table-global-search').addEventListener('input', (e) => {
            this.globalSearchValue = e.target.value;
            this.renderTable();
        });

        // (Show Selected button removed) 

        // カラム設定
        document.getElementById('table-columns-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleColumnDropdown();
        });

        // フィルタークリア
        document.getElementById('table-clear-filter-btn').addEventListener('click', () => {
            this.clearAllFilters();
        });

        // ポップアウト
        document.getElementById('table-popout-btn').addEventListener('click', () => {
            this.togglePopout();
        });

        // カラム全選択/解除
        document.getElementById('column-select-all').addEventListener('click', () => {
            this.selectAllColumns(true);
        });
        document.getElementById('column-select-none').addEventListener('click', () => {
            this.selectAllColumns(false);
        });

        // ドロップダウン外クリックで閉じる
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('column-dropdown');
            const btn = document.getElementById('table-columns-btn');
            if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        });

        // パネルリサイズ
        document.getElementById('table-panel-resizer').addEventListener('mousedown', (e) => {
            this.startResize(e);
        });

        document.addEventListener('mousemove', (e) => {
            if (this.resizing) {
                this.doResize(e);
            }
            if (this.columnResizing) {
                this.doColumnResize(e);
            }
        });

        document.addEventListener('mouseup', () => {
            this.stopResize();
            this.stopColumnResize();
        });
    }

    /**
     * Cytoscapeイベントリスナーを設定
     */
    setupCytoscapeListeners() {
        const checkCy = setInterval(() => {
            if (window.networkManager && networkManager.cy) {
                clearInterval(checkCy);

                // 選択変更時
                networkManager.cy.on('select unselect', 'node, edge', () => {
                    this.syncTableSelectionFromCy();
                    if (this.showSelectedOnly) {
                        this.renderTable();
                    }
                });

                // 要素追加時
                networkManager.cy.on('add', () => {
                    this.refresh();
                });

                // 要素削除時
                networkManager.cy.on('remove', () => {
                    this.refresh();
                });
            }
        }, 100);
    }

    /**
     * タブ切り替え
     */
    switchTab(tab) {
        this.currentTab = tab;
        this.panel.querySelectorAll('.table-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });
        this.sortColumn = null;
        this.sortDirection = 'asc';
        this.renderTable();
    }

    /**
     * テーブルを更新
     */
    refresh() {
        this.updateColumns();
        this.renderTable();
    }

    /**
     * カラム情報を更新
     */
    updateColumns() {
        if (!networkManager || !networkManager.cy) return;

        // ノードカラムを取得
        const nodeColumns = new Set(['id']);
        networkManager.cy.nodes().forEach(node => {
            Object.keys(node.data()).forEach(key => {
                nodeColumns.add(key);
            });
        });
        this.nodeColumns = Array.from(nodeColumns);
        
        if (this.visibleNodeColumns.size === 0) {
            this.visibleNodeColumns = new Set(this.nodeColumns);
        } else {
            // 新しいカラムを追加
            this.nodeColumns.forEach(col => {
                if (!this.visibleNodeColumns.has(col)) {
                    this.visibleNodeColumns.add(col);
                }
            });
        }

        // エッジカラムを取得
        const edgeColumns = new Set(['id', 'source', 'target']);
        networkManager.cy.edges().forEach(edge => {
            Object.keys(edge.data()).forEach(key => {
                edgeColumns.add(key);
            });
        });
        this.edgeColumns = Array.from(edgeColumns);
        
        if (this.visibleEdgeColumns.size === 0) {
            this.visibleEdgeColumns = new Set(this.edgeColumns);
        } else {
            this.edgeColumns.forEach(col => {
                if (!this.visibleEdgeColumns.has(col)) {
                    this.visibleEdgeColumns.add(col);
                }
            });
        }
    }

    /**
     * テーブルを描画
     */
    renderTable() {
        if (!networkManager || !networkManager.cy) return;

        const columns = this.currentTab === 'nodes' ? this.nodeColumns : this.edgeColumns;
        const visibleColumns = this.currentTab === 'nodes' ? this.visibleNodeColumns : this.visibleEdgeColumns;
        const elements = this.currentTab === 'nodes' ? networkManager.cy.nodes() : networkManager.cy.edges();

        // ヘッダー描画
        const thead = document.getElementById('data-table-head');
        thead.innerHTML = '';
        
        const headerRow = document.createElement('tr');
        const filterRow = document.createElement('tr');
        filterRow.className = 'filter-row';

        let visibleColumnCount = 0;
        columns.forEach(col => {
            if (!visibleColumns.has(col)) return;
            visibleColumnCount++;

            // ヘッダーセル
            const th = document.createElement('th');
            th.dataset.column = col;
            th.style.position = 'relative';
            
            if (this.columnWidths[col]) {
                th.style.width = this.columnWidths[col] + 'px';
                th.style.minWidth = this.columnWidths[col] + 'px';
            }

            th.innerHTML = `
                <div class="th-content">
                    <span class="th-label">${col}</span>
                    <span class="sort-icon">${this.getSortIcon(col)}</span>
                </div>
                <div class="column-resizer" data-column="${col}"></div>
            `;

            th.querySelector('.th-content').addEventListener('click', () => this.toggleSort(col));
            th.querySelector('.column-resizer').addEventListener('mousedown', (e) => {
                e.stopPropagation();
                this.startColumnResize(e, col, th);
            });

            headerRow.appendChild(th);

            // フィルターセル
            const filterTd = document.createElement('td');
            filterTd.className = 'filter-cell';
            
            const filterInput = document.createElement('input');
            filterInput.type = 'text';
            filterInput.className = 'filter-input';
            filterInput.placeholder = 'Filter...';
            filterInput.value = this.filters[col] || '';
            filterInput.addEventListener('input', (e) => {
                this.setFilter(col, e.target.value);
            });
            filterTd.appendChild(filterInput);
            filterRow.appendChild(filterTd);
        });

        thead.appendChild(headerRow);
        thead.appendChild(filterRow);

        // データ取得
        let data = elements.map(el => {
            const rowData = { _element: el, id: el.id() };
            columns.forEach(col => {
                rowData[col] = el.data(col);
            });
            return rowData;
        });

        // 選択のみ表示
        if (this.showSelectedOnly) {
            data = data.filter(row => row._element.selected());
        }

        // グローバル検索
        if (this.globalSearchValue) {
            const search = this.globalSearchValue.toLowerCase();
            data = data.filter(row => {
                return columns.some(col => {
                    const val = row[col];
                    if (val == null) return false;
                    return String(val).toLowerCase().includes(search);
                });
            });
        }

        // カラムフィルター
        Object.entries(this.filters).forEach(([col, filterValue]) => {
            if (!filterValue) return;
            const filter = filterValue.toLowerCase();
            data = data.filter(row => {
                const val = row[col];
                if (val == null) return false;
                return String(val).toLowerCase().includes(filter);
            });
        });

        // ソート
        if (this.sortColumn) {
            data.sort((a, b) => {
                const valA = a[this.sortColumn];
                const valB = b[this.sortColumn];
                
                if (valA == null && valB == null) return 0;
                if (valA == null) return 1;
                if (valB == null) return -1;
                
                let comparison = 0;
                if (typeof valA === 'number' && typeof valB === 'number') {
                    comparison = valA - valB;
                } else {
                    comparison = String(valA).localeCompare(String(valB), 'ja', { numeric: true });
                }
                
                return this.sortDirection === 'asc' ? comparison : -comparison;
            });
        }

        // ボディ描画
        const tbody = document.getElementById('data-table-body');
        tbody.innerHTML = '';

        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.dataset.id = row.id;
            
            if (row._element.selected()) {
                tr.classList.add('selected');
            }

            columns.forEach(col => {
                if (!visibleColumns.has(col)) return;
                
                const td = document.createElement('td');
                const value = row[col];
                
                let displayText = '';
                if (value == null) {
                    displayText = '';
                } else if (Array.isArray(value)) {
                    displayText = value.join(', ');
                } else {
                    displayText = String(value);
                }
                
                td.textContent = displayText;
                td.title = displayText;
                
                if (this.columnWidths[col]) {
                    td.style.width = this.columnWidths[col] + 'px';
                    td.style.minWidth = this.columnWidths[col] + 'px';
                    td.style.maxWidth = this.columnWidths[col] + 'px';
                }
                
                tr.appendChild(td);
            });

            tr.addEventListener('click', (e) => {
                this.selectRow(tr, row._element, e.ctrlKey || e.metaKey);
            });

            tbody.appendChild(tr);
        });

        // フッター更新
        document.getElementById('table-row-count').textContent = `${data.length} rows`;
        document.getElementById('table-column-count').textContent = `${visibleColumnCount} columns`;
    }

    /**
     * ソートアイコンを取得
     */
    getSortIcon(col) {
        if (this.sortColumn !== col) return '↕';
        return this.sortDirection === 'asc' ? '↑' : '↓';
    }

    /**
     * ソート切り替え
     */
    toggleSort(col) {
        if (this.sortColumn === col) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = col;
            this.sortDirection = 'asc';
        }
        this.renderTable();
    }

    /**
     * フィルター設定
     */
    setFilter(col, value) {
        this.filters[col] = value;
        this.renderTable();
    }

    /**
     * 全フィルタークリア
     */
    clearAllFilters() {
        this.filters = {};
        this.globalSearchValue = '';
        document.getElementById('table-global-search').value = '';
        this.showSelectedOnly = false;
        // showSelectedOnly button removed: no DOM update needed
        this.renderTable();
    }

    /**
     * 行選択
     */
    selectRow(tr, element, isMulti) {
        if (!isMulti) {
            networkManager.cy.elements().unselect();
        }
        
        if (element.selected()) {
            element.unselect();
            tr.classList.remove('selected');
        } else {
            element.select();
            tr.classList.add('selected');
        }
        
        this.updateSelectedCount();
    }

    /**
     * Cytoscapeの選択をテーブルに同期
     */
    syncTableSelectionFromCy() {
        const selectedElements = this.currentTab === 'nodes' 
            ? networkManager.cy.nodes(':selected')
            : networkManager.cy.edges(':selected');
        
        const selectedIds = new Set();
        selectedElements.forEach(el => selectedIds.add(el.id()));

        document.querySelectorAll('#data-table-body tr').forEach(row => {
            row.classList.toggle('selected', selectedIds.has(row.dataset.id));
        });

        this.updateSelectedCount();
    }

    /**
     * 選択件数を更新
     */
    updateSelectedCount() {
        const count = networkManager.cy.elements(':selected').length;
        document.getElementById('table-selected-count').textContent = 
            count > 0 ? `(${count} selected)` : '';
    }

    /**
     * カラムドロップダウン表示切替
     */
    toggleColumnDropdown() {
        const dropdown = document.getElementById('column-dropdown');
        dropdown.classList.toggle('active');
        
        if (dropdown.classList.contains('active')) {
            this.renderColumnDropdown();
        }
    }

    /**
     * カラムドロップダウン描画
     */
    renderColumnDropdown() {
        const columns = this.currentTab === 'nodes' ? this.nodeColumns : this.edgeColumns;
        const visibleColumns = this.currentTab === 'nodes' ? this.visibleNodeColumns : this.visibleEdgeColumns;
        
        const body = document.getElementById('column-dropdown-body');
        body.innerHTML = '';

        columns.forEach(col => {
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = visibleColumns.has(col);
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    visibleColumns.add(col);
                } else {
                    visibleColumns.delete(col);
                }
                this.renderTable();
            });
            
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(col));
            body.appendChild(label);
        });
    }

    /**
     * 全カラム選択/解除
     */
    selectAllColumns(select) {
        const columns = this.currentTab === 'nodes' ? this.nodeColumns : this.edgeColumns;
        const visibleColumns = this.currentTab === 'nodes' ? this.visibleNodeColumns : this.visibleEdgeColumns;
        
        if (select) {
            columns.forEach(col => visibleColumns.add(col));
        } else {
            visibleColumns.clear();
        }
        
        this.renderColumnDropdown();
        this.renderTable();
    }

    /**
     * パネルリサイズ開始
     */
    startResize(e) {
        this.resizing = true;
        this.resizeStartY = e.clientY;
        this.resizeStartHeight = this.panelHeight;
        document.body.style.cursor = 'ns-resize';
        e.preventDefault();
    }

    /**
     * パネルリサイズ中
     */
    doResize(e) {
        const delta = this.resizeStartY - e.clientY;
        let newHeight = this.resizeStartHeight + delta;
        newHeight = Math.max(this.minPanelHeight, Math.min(this.maxPanelHeight, newHeight));
        this.panelHeight = newHeight;
        this.panel.style.height = newHeight + 'px';
        this.updateCyHeight();
    }

    /**
     * パネルリサイズ終了
     */
    stopResize() {
        if (this.resizing) {
            this.resizing = false;
            document.body.style.cursor = '';
        }
    }

    /**
     * カラムリサイズ開始
     */
    startColumnResize(e, col, th) {
        this.columnResizing = true;
        this.resizingColumn = col;
        this.resizeStartX = e.clientX;
        this.resizeStartWidth = th.offsetWidth;
        document.body.style.cursor = 'col-resize';
        e.preventDefault();
    }

    /**
     * カラムリサイズ中
     */
    doColumnResize(e) {
        if (!this.columnResizing) return;
        
        const delta = e.clientX - this.resizeStartX;
        const newWidth = Math.max(50, this.resizeStartWidth + delta);
        this.columnWidths[this.resizingColumn] = newWidth;
        
        // 同じカラムの全てのセルに幅を適用
        document.querySelectorAll(`[data-column="${this.resizingColumn}"]`).forEach(cell => {
            cell.style.width = newWidth + 'px';
            cell.style.minWidth = newWidth + 'px';
            cell.style.maxWidth = newWidth + 'px';
        });
    }

    /**
     * カラムリサイズ終了
     */
    stopColumnResize() {
        if (this.columnResizing) {
            this.columnResizing = false;
            document.body.style.cursor = '';
        }
    }

    /**
     * ポップアウト切替
     */
    togglePopout() {
        if (this.isPopout && this.popoutWindow && !this.popoutWindow.closed) {
            this.popoutWindow.close();
            this.isPopout = false;
            return;
        }

        const width = 800;
        const height = 500;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        this.popoutWindow = window.open('', 'TablePanel', 
            `width=${width},height=${height},left=${left},top=${top},resizable=yes`);

        if (this.popoutWindow) {
            this.isPopout = true;
            this.renderPopoutWindow();
            
            this.popoutWindow.onbeforeunload = () => {
                this.isPopout = false;
            };
        }
    }

    /**
     * ポップアウトウィンドウを描画
     */
    renderPopoutWindow() {
        if (!this.popoutWindow) return;

        const doc = this.popoutWindow.document;
        doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Table Panel - Network Visualizer</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 16px; }
                    table { width: 100%; border-collapse: collapse; font-size: 12px; }
                    th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
                    th { background: #f8fafc; font-weight: 600; }
                    tr:hover { background: #f1f5f9; }
                    tr.selected { background: #dbeafe; }
                </style>
            </head>
            <body>
                <h3>${this.currentTab === 'nodes' ? 'Node' : 'Edge'} Table</h3>
                <table id="popout-table"></table>
            </body>
            </html>
        `);
        doc.close();

        this.renderPopoutTable();
    }

    /**
     * ポップアウトテーブルを描画
     */
    renderPopoutTable() {
        if (!this.popoutWindow || this.popoutWindow.closed) return;

        const columns = this.currentTab === 'nodes' ? this.nodeColumns : this.edgeColumns;
        const visibleColumns = this.currentTab === 'nodes' ? this.visibleNodeColumns : this.visibleEdgeColumns;
        const elements = this.currentTab === 'nodes' ? networkManager.cy.nodes() : networkManager.cy.edges();

        const table = this.popoutWindow.document.getElementById('popout-table');
        if (!table) return;

        let html = '<thead><tr>';
        columns.forEach(col => {
            if (visibleColumns.has(col)) {
                html += `<th>${col}</th>`;
            }
        });
        html += '</tr></thead><tbody>';

        elements.forEach(el => {
            html += `<tr class="${el.selected() ? 'selected' : ''}">`;
            columns.forEach(col => {
                if (visibleColumns.has(col)) {
                    const val = el.data(col);
                    const display = val == null ? '' : (Array.isArray(val) ? val.join(', ') : String(val));
                    html += `<td>${display}</td>`;
                }
            });
            html += '</tr>';
        });

        html += '</tbody>';
        table.innerHTML = html;
    }

    /**
     * Cytoscape表示領域の高さを更新
     */
    updateCyHeight() {
        const cyContainer = document.getElementById('cy-container');
        cyContainer.style.bottom = this.panelHeight + 'px';
        if (networkManager && networkManager.cy) {
            networkManager.cy.resize();
        }
    }

    /**
     * Cytoscape表示領域の高さをリセット
     */
    resetCyHeight() {
        const cyContainer = document.getElementById('cy-container');
        cyContainer.style.bottom = '0';
        if (networkManager && networkManager.cy) {
            networkManager.cy.resize();
        }
    }

    /**
     * パネル表示
     */
    show() {
        this.panel.classList.add('active');
        this.panel.style.height = this.panelHeight + 'px';
        this.updateCyHeight();
        this.refresh();
    }

    /**
     * パネル非表示
     */
    hide() {
        this.panel.classList.remove('active');
        this.resetCyHeight();
    }

    /**
     * 表示/非表示切替
     */
    toggle() {
        if (this.panel.classList.contains('active')) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * 表示中かどうか
     */
    isVisible() {
        return this.panel.classList.contains('active');
    }
}

// グローバルインスタンス
let tablePanel;

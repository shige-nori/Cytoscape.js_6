/**
 * TablePanel - テーブルパネル管理クラス
 * 画面下部にNode/Edge tableを表示し、ソート・選択連動・カラム設定などを提供
 */
class TablePanel {
    constructor() {
        this.panel = null;
        this.resizeHandle = null;
        this.isVisible = false;
        this.currentTab = 'node'; // 'node' or 'edge'
        this.sortColumn = null;
        this.sortOrder = 'asc'; // 'asc' or 'desc'
        // 除外カラム
        this.excludedNodeColumns = ['_originalBg', 'name', 'label', 'Label'];
        this.excludedEdgeColumns = ['_originalLineColor', '_originalWidth', 'interaction'];
        this.nodeColumns = ['id']; // デフォルトカラム（除外済み）
        this.edgeColumns = ['id', 'source', 'target']; // デフォルトカラム（除外済み）
        this.visibleNodeColumns = new Set(this.nodeColumns);
        this.visibleEdgeColumns = new Set(this.edgeColumns);
        this.nodeColumnWidths = {}; // ノードカラムの幅を保存
        this.edgeColumnWidths = {}; // エッジカラムの幅を保存
        this.nodeFilters = {}; // ノードカラムのフィルター値を保存
        this.edgeFilters = {}; // エッジカラムのフィルター値を保存
        this.isResizing = false;
        this.startY = 0;
        this.startHeight = 0;
        this.minHeight = 150;
        this.defaultHeight = 300;
        // キャッシュ用
        this._lastNodeSelectionIds = '';
        this._lastNodeFilterString = '';
        this._lastNodeVisibleColumns = '';
        this._lastEdgeSelectionIds = '';
        this._lastEdgeFilterString = '';
        this._lastEdgeVisibleColumns = '';
    }

    initialize() {
        this.panel = document.getElementById('table-panel');
        this.resizeHandle = document.getElementById('table-resize-handle');
        
        if (!this.panel || !this.resizeHandle) {
            console.error('Table panel elements not found');
            return;
        }

        this.setupEventListeners();
        
        // 初期高さ設定
        this.panel.style.height = `${this.defaultHeight}px`;
        
        // 互換性のためグローバルに登録
        window.tablePanel = this;
    }

    setupEventListeners() {
        // タブ切り替え
        const nodeTblTab = document.getElementById('node-table-tab');
        const edgeTableTab = document.getElementById('edge-table-tab');
        
        if (nodeTblTab) {
            nodeTblTab.addEventListener('click', () => this.switchTab('node'));
        }
        if (edgeTableTab) {
            edgeTableTab.addEventListener('click', () => this.switchTab('edge'));
        }

        // リサイズハンドル
        this.resizeHandle.addEventListener('mousedown', (e) => this.startResize(e));
        document.addEventListener('mousemove', (e) => this.doResize(e));
        document.addEventListener('mouseup', () => this.stopResize());

        // カラム設定ボタン
        const columnBtn = document.getElementById('table-column-settings-btn');
        if (columnBtn) {
            columnBtn.addEventListener('click', () => this.openColumnSettings());
        }

        // 閉じるボタン
        const closeBtn = document.getElementById('table-panel-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closePanel());
        }

        // カラム設定モーダルのイベント
        const columnModal = document.getElementById('column-settings-modal');
        if (columnModal) {
            const closeBtn = columnModal.querySelector('.modal-close');
            const applyBtn = document.getElementById('column-settings-apply');
            const cancelBtn = document.getElementById('column-settings-cancel');
            
            if (closeBtn) closeBtn.addEventListener('click', () => this.closeColumnSettings());
            if (applyBtn) applyBtn.addEventListener('click', () => this.applyColumnSettings());
            if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeColumnSettings());
            
            // モーダル外クリックで閉じる
            columnModal.addEventListener('click', (e) => {
                if (e.target === columnModal) {
                    this.closeColumnSettings();
                }
            });
        }

        // Cytoscape選択イベントとの連動
        if (networkManager && networkManager.cy) {
            // ネットワーク図の空き領域クリックでフィルタークリア
            networkManager.cy.on('tap', (e) => {
                if (e.target === networkManager.cy && this.isVisible) {
                    // フィルターが空かつ全ノード・エッジ未選択なら何もしない
                    const hasNodeFilter = Object.values(this.nodeFilters).some(v => v);
                    const hasEdgeFilter = Object.values(this.edgeFilters).some(v => v);
                    const anySelected = networkManager.cy.$(':selected').length > 0;
                    if (!hasNodeFilter && !hasEdgeFilter && !anySelected) return;
                    this.clearAllFilters();
                    // 選択があればテーブル再描画
                    if (anySelected) this.refreshTable();
                }
            });
            
            networkManager.cy.on('select', (e) => {
                if (this.isVisible) {
                    // 選択されたノード/エッジのみテーブルに表示（遅延描画）
                    this.clearAllFilters();
                    window.requestAnimationFrame(() => {
                        if (this.currentTab === 'node') {
                            this.renderNodeTable(true);
                        } else {
                            this.renderEdgeTable(true);
                        }
                    });
                }
            });
            
            networkManager.cy.on('unselect', (e) => {
                if (this.isVisible) {
                    // 選択解除時は全ノード/エッジをテーブルに表示（遅延描画）
                    this.clearAllFilters();
                    window.requestAnimationFrame(() => {
                        if (this.currentTab === 'node') {
                            this.renderNodeTable(true);
                        } else {
                            this.renderEdgeTable(true);
                        }
                    });
                }
            });
        }
    }

    openPanel() {
        if (!this.panel) return;
        this.isVisible = true;
        this.panel.classList.add('active');
        
        // cy-containerのサイズを調整
        const cyContainer = document.getElementById('cy-container');
        if (cyContainer) {
            const panelHeight = this.panel.offsetHeight;
            cyContainer.style.bottom = `${panelHeight}px`;
        }
        
        // Cytoscapeをリサイズ
        if (networkManager && networkManager.cy) {
            networkManager.cy.resize();
        }
        
        // テーブルデータを更新
        this.refreshTable();
        
        // メニューのチェックマークを更新
        if (menuManager) {
            menuManager.updateTablePanelCheckmark();
        }
    }

    closePanel() {
        if (!this.panel) return;
        this.isVisible = false;
        this.panel.classList.remove('active');
        
        // cy-containerのサイズを元に戻す
        const cyContainer = document.getElementById('cy-container');
        if (cyContainer) {
            cyContainer.style.bottom = '0';
        }
        
        // Cytoscapeをリサイズ
        if (networkManager && networkManager.cy) {
            networkManager.cy.resize();
        }
        
        // メニューのチェックマークを更新
        if (menuManager) {
            menuManager.updateTablePanelCheckmark();
        }
    }

    togglePanel() {
        if (this.isVisible) {
            this.closePanel();
        } else {
            this.openPanel();
        }
    }

    switchTab(tab) {
        this.currentTab = tab;
        
        // タブのアクティブ状態を更新
        const nodeTab = document.getElementById('node-table-tab');
        const edgeTab = document.getElementById('edge-table-tab');
        
        if (nodeTab && edgeTab) {
            if (tab === 'node') {
                nodeTab.classList.add('active');
                edgeTab.classList.remove('active');
            } else {
                nodeTab.classList.remove('active');
                edgeTab.classList.add('active');
            }
        }
        
        // テーブルを更新
        this.refreshTable();
    }

    refreshTable() {
        if (!networkManager || !networkManager.hasNetwork()) {
            this.renderEmptyTable();
            return;
        }

        if (this.currentTab === 'node') {
            this.renderNodeTable();
        } else {
            this.renderEdgeTable();
        }
    }

    /**
     * セルの値をフォーマット（配列は改行で表示）
     * @param {*} value - セルの値
     * @returns {string} フォーマットされた値
     */
    formatCellValue(value) {
        if (value === null || value === undefined) {
            return '';
        }
        
        // 配列の場合は改行で区切る
        if (Array.isArray(value)) {
            return value.map(v => String(v)).join('\n');
        }
        
        // オブジェクトの場合はJSON文字列化
        if (typeof value === 'object') {
            try {
                return JSON.stringify(value);
            } catch (e) {
                return String(value);
            }
        }
        
        return String(value);
    }

    /**
     * 全カラムを表示するようにリセット（ファイル読み込み時に使用）
     */
    resetToShowAllColumns() {
        if (!networkManager || !networkManager.hasNetwork()) return;
        
        const nodes = networkManager.cy.nodes();
        const edges = networkManager.cy.edges();
        
        // 全カラムを表示するよう更新
        this.updateAvailableColumns('node', nodes, true);
        this.updateAvailableColumns('edge', edges, true);
        
        // キャッシュをクリア（新しいネットワークが読み込まれた時のため）
        this._lastNodeSelectionIds = null;
        this._lastNodeFilterString = null;
        this._lastNodeVisibleColumns = null;
        this._lastEdgeSelectionIds = null;
        this._lastEdgeFilterString = null;
        this._lastEdgeVisibleColumns = null;
        
        // テーブルを更新（表示されていない場合でも次回表示時に正しく描画されるよう準備）
        if (this.isVisible) {
            this.refreshTable();
        }
    }

    renderNodeTable(recreateHeader = true) {
        const tbody = document.querySelector('#table-panel tbody');
        const thead = document.querySelector('#table-panel thead');
        
        if (!tbody || !thead) return;

        // 選択されたノードがあればそれらのみ、なければ全て
        const selectedNodes = networkManager.cy.nodes(':selected');
        const nodes = selectedNodes.length > 0 ? selectedNodes : networkManager.cy.nodes();
        
        // キャッシュ用: 選択ID、フィルター状態、表示カラムを文字列化
        const selectedIds = Array.from(selectedNodes).map(n => n.id()).sort().join(',');
        const filterString = JSON.stringify(this.nodeFilters);
        const visibleColumnsString = Array.from(this.visibleNodeColumns).sort().join(',');
        if (selectedIds === this._lastNodeSelectionIds && 
            filterString === this._lastNodeFilterString &&
            visibleColumnsString === this._lastNodeVisibleColumns) {
            // 前回と同じなら再描画スキップ
            return;
        }
        this._lastNodeSelectionIds = selectedIds;
        this._lastNodeFilterString = filterString;
        this._lastNodeVisibleColumns = visibleColumnsString;
        
        // 利用可能なカラムを更新
        this.updateAvailableColumns('node', nodes);
        
        if (recreateHeader) {
            // ヘッダーを生成
            thead.innerHTML = '';
            const headerRow = document.createElement('tr');
        
        // 利用可能な幅を計算（保存された幅がない場合のみ）
        const tableWrapper = document.querySelector('.table-wrapper');
        const availableWidth = tableWrapper ? tableWrapper.clientWidth - 20 : 1000; // 20pxはスクロールバー用
        const columnCount = this.visibleNodeColumns.size;
        const hasSavedWidths = Array.from(this.visibleNodeColumns).some(col => this.nodeColumnWidths[col]);
        const autoWidth = !hasSavedWidths && columnCount > 0 ? Math.max(80, Math.floor(availableWidth / columnCount)) : null;
        
        Array.from(this.visibleNodeColumns).forEach(col => {
            const th = document.createElement('th');
            th.textContent = col;
            th.classList.add('sortable');
            th.dataset.column = col;
            
            // 保存された幅があればそれを使用、なければ自動調整またはデフォルト
            const savedWidth = this.nodeColumnWidths[col];
            const width = savedWidth || (autoWidth ? `${autoWidth}px` : '120px');
            th.style.width = width;
            if (savedWidth) {
                th.style.minWidth = width;
            }
            
            // ソートアイコン
            if (this.sortColumn === col) {
                th.classList.add(this.sortOrder);
                const icon = this.sortOrder === 'asc' ? ' ▲' : ' ▼';
                th.textContent += icon;
            }
            
            // ソートイベント（リサイザークリック時は除外）
            th.addEventListener('click', (e) => {
                // リサイザーまたはその子要素がクリックされた場合はソートしない
                if (e.target.classList.contains('column-resizer') || 
                    e.target.closest('.column-resizer')) {
                    return;
                }
                this.sortTable(col);
            });
            
            // カラム幅リサイズ
            this.makeColumnResizable(th, 'node');
            
            headerRow.appendChild(th);
        });
        
        thead.appendChild(headerRow);
        
        // フィルター行を追加
        const filterRow = document.createElement('tr');
        filterRow.classList.add('filter-row');
        
        Array.from(this.visibleNodeColumns).forEach(col => {
            const th = document.createElement('th');
            const input = document.createElement('input');
            input.type = 'text';
            input.classList.add('column-filter');
            input.value = this.nodeFilters[col] || '';
            input.dataset.column = col;
            // placeholderは値が空のとき非表示
            input.placeholder = (input.value === '') ? '' : '検索...';
            let isComposing = false;
            input.addEventListener('compositionstart', () => { isComposing = true; });
            input.addEventListener('compositionend', (e) => {
                isComposing = false;
                this.nodeFilters[col] = e.target.value;
                this.applyFilters('node');
            });
            input.addEventListener('input', (e) => {
                if (isComposing) return;
                this.nodeFilters[col] = e.target.value;
                // placeholder制御
                input.placeholder = (e.target.value === '') ? '' : '検索...';
                this.applyFilters('node');
            });
            th.appendChild(input);
            filterRow.appendChild(th);
        });
        
        thead.appendChild(filterRow);
        }
        
        // データ行を生成
        tbody.innerHTML = '';
        
        let nodeData = nodes.map(node => {
            const data = node.data();
            const row = {};
            Array.from(this.visibleNodeColumns).forEach(col => {
                row[col] = data[col] !== undefined ? data[col] : '';
            });
            row._element = node;
            return row;
        });
        
        // ソート適用
        if (this.sortColumn && this.visibleNodeColumns.has(this.sortColumn)) {
            nodeData = this.sortData(nodeData, this.sortColumn);
        }
        
        // フィルター適用
        nodeData = this.filterData(nodeData, this.nodeFilters);
        
        nodeData.forEach(rowData => {
            const tr = document.createElement('tr');
            tr.dataset.elementId = rowData._element.id();
            
            // 行クリックで選択
            tr.addEventListener('click', (e) => {
                // テキスト選択中の場合はスキップ
                const selection = window.getSelection();
                if (selection && selection.toString().length > 0) {
                    return;
                }
                
                if (e.ctrlKey || e.metaKey) {
                    // Ctrl/Cmdキーで複数選択
                    if (rowData._element.selected()) {
                        rowData._element.unselect();
                    } else {
                        rowData._element.select();
                    }
                } else {
                    // 通常クリックで単一選択
                    networkManager.cy.elements().unselect();
                    rowData._element.select();
                }
            });
            
            Array.from(this.visibleNodeColumns).forEach(col => {
                const td = document.createElement('td');
                td.textContent = this.formatCellValue(rowData[col]);
                tr.appendChild(td);
            });
            
            tbody.appendChild(tr);
        });
    }

    renderEdgeTable(recreateHeader = true) {
        const tbody = document.querySelector('#table-panel tbody');
        const thead = document.querySelector('#table-panel thead');
        
        if (!tbody || !thead) return;

        // 選択されたエッジがあればそれらのみ、なければ全て
        const selectedEdges = networkManager.cy.edges(':selected');
        const edges = selectedEdges.length > 0 ? selectedEdges : networkManager.cy.edges();
        
        // キャッシュ用: 選択ID、フィルター状態、表示カラムを文字列化
        const selectedIds = Array.from(selectedEdges).map(e => e.id()).sort().join(',');
        const filterString = JSON.stringify(this.edgeFilters);
        const visibleColumnsString = Array.from(this.visibleEdgeColumns).sort().join(',');
        if (selectedIds === this._lastEdgeSelectionIds && 
            filterString === this._lastEdgeFilterString &&
            visibleColumnsString === this._lastEdgeVisibleColumns) {
            // 前回と同じなら再描画スキップ
            return;
        }
        this._lastEdgeSelectionIds = selectedIds;
        this._lastEdgeFilterString = filterString;
        this._lastEdgeVisibleColumns = visibleColumnsString;
        
        // 利用可能なカラムを更新
        this.updateAvailableColumns('edge', edges);
        
        if (recreateHeader) {
            // ヘッダーを生成
            thead.innerHTML = '';
            const headerRow = document.createElement('tr');
        
        // 利用可能な幅を計算（保存された幅がない場合のみ）
        const tableWrapper = document.querySelector('.table-wrapper');
        const availableWidth = tableWrapper ? tableWrapper.clientWidth - 20 : 1000; // 20pxはスクロールバー用
        const columnCount = this.visibleEdgeColumns.size;
        const hasSavedWidths = Array.from(this.visibleEdgeColumns).some(col => this.edgeColumnWidths[col]);
        const autoWidth = !hasSavedWidths && columnCount > 0 ? Math.max(80, Math.floor(availableWidth / columnCount)) : null;
        
        Array.from(this.visibleEdgeColumns).forEach(col => {
            const th = document.createElement('th');
            th.textContent = col;
            th.classList.add('sortable');
            th.dataset.column = col;
            
            // 保存された幅があればそれを使用、なければ自動調整またはデフォルト
            const savedWidth = this.edgeColumnWidths[col];
            const width = savedWidth || (autoWidth ? `${autoWidth}px` : '120px');
            th.style.width = width;
            if (savedWidth) {
                th.style.minWidth = width;
            }
            
            // ソートアイコン
            if (this.sortColumn === col) {
                th.classList.add(this.sortOrder);
                const icon = this.sortOrder === 'asc' ? ' ▲' : ' ▼';
                th.textContent += icon;
            }
            
            // ソートイベント（リサイザークリック時は除外）
            th.addEventListener('click', (e) => {
                // リサイザーまたはその子要素がクリックされた場合はソートしない
                if (e.target.classList.contains('column-resizer') || 
                    e.target.closest('.column-resizer')) {
                    return;
                }
                this.sortTable(col);
            });
            
            // カラム幅リサイズ
            this.makeColumnResizable(th, 'edge');
            
            headerRow.appendChild(th);
        });
        
        thead.appendChild(headerRow);
        
        // フィルター行を追加
        const filterRow = document.createElement('tr');
        filterRow.classList.add('filter-row');
        
        Array.from(this.visibleEdgeColumns).forEach(col => {
            const th = document.createElement('th');
            const input = document.createElement('input');
            input.type = 'text';
            input.classList.add('column-filter');
            input.value = this.edgeFilters[col] || '';
            input.dataset.column = col;
            input.placeholder = (input.value === '') ? '' : '検索...';
            let isComposing = false;
            input.addEventListener('compositionstart', () => { isComposing = true; });
            input.addEventListener('compositionend', (e) => {
                isComposing = false;
                this.edgeFilters[col] = e.target.value;
                this.applyFilters('edge');
            });
            input.addEventListener('input', (e) => {
                if (isComposing) return;
                this.edgeFilters[col] = e.target.value;
                input.placeholder = (e.target.value === '') ? '' : '検索...';
                this.applyFilters('edge');
            });
            th.appendChild(input);
            filterRow.appendChild(th);
        });
        
        thead.appendChild(filterRow);
        }
        
        // データ行を生成
        tbody.innerHTML = '';
        
        let edgeData = edges.map(edge => {
            const data = edge.data();
            const row = {};
            Array.from(this.visibleEdgeColumns).forEach(col => {
                row[col] = data[col] !== undefined ? data[col] : '';
            });
            row._element = edge;
            return row;
        });
        
        // ソート適用
        if (this.sortColumn && this.visibleEdgeColumns.has(this.sortColumn)) {
            edgeData = this.sortData(edgeData, this.sortColumn);
        }
        
        // フィルター適用
        edgeData = this.filterData(edgeData, this.edgeFilters);
        
        edgeData.forEach(rowData => {
            const tr = document.createElement('tr');
            tr.dataset.elementId = rowData._element.id();
            
            // 行クリックで選択
            tr.addEventListener('click', (e) => {
                // テキスト選択中の場合はスキップ
                const selection = window.getSelection();
                if (selection && selection.toString().length > 0) {
                    return;
                }
                
                if (e.ctrlKey || e.metaKey) {
                    // Ctrl/Cmdキーで複数選択
                    if (rowData._element.selected()) {
                        rowData._element.unselect();
                    } else {
                        rowData._element.select();
                    }
                } else {
                    // 通常クリックで単一選択
                    networkManager.cy.elements().unselect();
                    rowData._element.select();
                }
            });
            
            Array.from(this.visibleEdgeColumns).forEach(col => {
                const td = document.createElement('td');
                td.textContent = this.formatCellValue(rowData[col]);
                tr.appendChild(td);
            });
            
            tbody.appendChild(tr);
        });
    }

    renderEmptyTable() {
        const tbody = document.querySelector('#table-panel tbody');
        const thead = document.querySelector('#table-panel thead');
        
        if (thead) thead.innerHTML = '';
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="100" style="text-align: center; padding: 20px; color: #999;">No data available</td></tr>';
        }
    }

    /**
     * テーブルをクリア（ネットワーククローズ時に使用）
     */
    clearTable() {
        this.renderEmptyTable();
        // ソート状態をリセット
        this.sortColumn = null;
        this.sortOrder = 'asc';
        // カラム幅をリセット
        this.nodeColumnWidths = {};
        this.edgeColumnWidths = {};
        // フィルターをリセット
        this.nodeFilters = {};
        this.edgeFilters = {};
    }

    updateAvailableColumns(type, elements, showAll = false) {
        const allColumns = new Set();
        elements.forEach(ele => {
            const data = ele.data();
            Object.keys(data).forEach(key => {
                allColumns.add(key);
            });
        });
        if (type === 'node') {
            ['id'].forEach(col => allColumns.add(col));
            this.nodeColumns = Array.from(allColumns).filter(col => !this.excludedNodeColumns.includes(col));
            if (showAll) {
                this.visibleNodeColumns = new Set(this.nodeColumns);
            } else {
                this.visibleNodeColumns = new Set(
                    this.nodeColumns.filter(col => this.visibleNodeColumns.has(col))
                );
            }
        } else {
            ['id', 'source', 'target'].forEach(col => allColumns.add(col));
            this.edgeColumns = Array.from(allColumns).filter(col => !this.excludedEdgeColumns.includes(col));
            if (showAll) {
                this.visibleEdgeColumns = new Set(this.edgeColumns);
            } else {
                this.visibleEdgeColumns = new Set(
                    this.edgeColumns.filter(col => this.visibleEdgeColumns.has(col))
                );
            }
        }
    }

    sortTable(column) {
        if (this.sortColumn === column) {
            // 同じカラムをクリックした場合は昇順/降順を切り替え
            this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortOrder = 'asc';
        }
        
        this.refreshTable();
    }

    /**
     * データをフィルタリング
     */
    filterData(data, filters) {
        return data.filter(row => {
            // すべてのフィルター条件をANDで適用
            return Object.keys(filters).every(col => {
                const filterValue = filters[col];
                if (!filterValue || filterValue.trim() === '') {
                    return true; // フィルターが空の場合は全て通過
                }
                
                const cellValue = this.formatCellValue(row[col]);
                // 大文字小文字を区別しない部分一致検索
                return cellValue.toLowerCase().includes(filterValue.toLowerCase());
            });
        });
    }

    /**
     * フィルターを適用してテーブルを再描画
     */
    applyFilters(type) {
        if (type === this.currentTab) {
            // フィルター適用時はヘッダーを再生成せず、tbodyのみ更新
            if (type === 'node') {
                this.renderNodeTable(false);
            } else {
                this.renderEdgeTable(false);
            }
        }
    }

    /**
     * すべてのフィルターをクリア
     */
    /**
     * すべてのフィルターをクリア
     */
    clearAllFilters() {
        // 検索ボックスに値が入っている場合のみクリア
        let cleared = false;
        if (this.currentTab === 'node') {
            for (const key in this.nodeFilters) {
                if (this.nodeFilters[key]) {
                    cleared = true;
                    break;
                }
            }
            if (cleared) this.nodeFilters = {};
        } else {
            for (const key in this.edgeFilters) {
                if (this.edgeFilters[key]) {
                    cleared = true;
                    break;
                }
            }
            if (cleared) this.edgeFilters = {};
        }
        if (cleared) this.refreshTable();
    }

    sortData(data, column) {
        return data.sort((a, b) => {
            let valA = a[column];
            let valB = b[column];
            
            // 数値として比較可能か確認
            const numA = parseFloat(valA);
            const numB = parseFloat(valB);
            
            if (!isNaN(numA) && !isNaN(numB)) {
                return this.sortOrder === 'asc' ? numA - numB : numB - numA;
            }
            
            // 文字列として比較
            valA = String(valA).toLowerCase();
            valB = String(valB).toLowerCase();
            
            if (this.sortOrder === 'asc') {
                return valA < valB ? -1 : valA > valB ? 1 : 0;
            } else {
                return valA > valB ? -1 : valA < valB ? 1 : 0;
            }
        });
    }

    openColumnSettings() {
        const modal = document.getElementById('column-settings-modal');
        if (!modal) return;

        // チェックボックスリストを生成
        const checkboxList = document.getElementById('column-checkboxes');
        if (!checkboxList) return;

        checkboxList.innerHTML = '';
        
        const columns = this.currentTab === 'node' ? this.nodeColumns : this.edgeColumns;
        const visibleColumns = this.currentTab === 'node' ? this.visibleNodeColumns : this.visibleEdgeColumns;
        
        columns.forEach(col => {
            const label = document.createElement('label');
            label.classList.add('column-checkbox-item');
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = col;
            checkbox.checked = visibleColumns.has(col);
            
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(col));
            
            checkboxList.appendChild(label);
        });
        
        modal.classList.add('active');
    }

    closeColumnSettings() {
        const modal = document.getElementById('column-settings-modal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    applyColumnSettings() {
        const checkboxList = document.getElementById('column-checkboxes');
        if (!checkboxList) return;

        const checkboxes = checkboxList.querySelectorAll('input[type="checkbox"]');
        const selectedColumns = new Set();
        
        checkboxes.forEach(cb => {
            if (cb.checked) {
                selectedColumns.add(cb.value);
            }
        });
        
        if (this.currentTab === 'node') {
            this.visibleNodeColumns = selectedColumns;
        } else {
            this.visibleEdgeColumns = selectedColumns;
        }
        
        this.closeColumnSettings();
        this.refreshTable();
    }

    makeColumnResizable(th, type) {
        const resizer = document.createElement('div');
        resizer.classList.add('column-resizer');
        th.appendChild(resizer);
        
        let startX = 0;
        let startWidth = 0;
        
        resizer.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            startX = e.pageX;
            startWidth = th.offsetWidth;
            
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            
            const mouseMoveHandler = (e) => {
                const newWidth = startWidth + (e.pageX - startX);
                if (newWidth > 50) { // 最小幅
                    th.style.width = `${newWidth}px`;
                    th.style.minWidth = `${newWidth}px`;
                }
            };
            
            const mouseUpHandler = () => {
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                
                // リサイズ後の幅を保存
                const columnName = th.dataset.column;
                const finalWidth = th.style.width;
                if (type === 'node') {
                    this.nodeColumnWidths[columnName] = finalWidth;
                } else {
                    this.edgeColumnWidths[columnName] = finalWidth;
                }
                
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);
            };
            
            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
        });
    }

    startResize(e) {
        this.isResizing = true;
        this.startY = e.clientY;
        this.startHeight = this.panel.offsetHeight;
        e.preventDefault();
    }

    doResize(e) {
        if (!this.isResizing) return;
        
        const deltaY = this.startY - e.clientY; // 上にドラッグで高さが増える
        const newHeight = this.startHeight + deltaY;
        
        if (newHeight >= this.minHeight) {
            this.panel.style.height = `${newHeight}px`;
            
            // cy-containerのサイズを調整
            const cyContainer = document.getElementById('cy-container');
            if (cyContainer) {
                cyContainer.style.bottom = `${newHeight}px`;
            }
            
            // Cytoscapeをリサイズ
            if (networkManager && networkManager.cy) {
                networkManager.cy.resize();
            }
        }
    }

    stopResize() {
        if (this.isResizing) {
            this.isResizing = false;
        }
    }
}

// グローバルインスタンスは app.js で生成

import { appContext } from './AppContext.js';
import { progressOverlay } from './ProgressOverlay.js';
import { applySelectionToCy, expandSelectionWithConnections } from './FilterSelectionUtils.js';
import { evaluateCondition, getMatchedIndicesForArray, evaluateExternalConditionSequence } from './FilterEval.js';

/**
 * FilterPanel - フィルターパネル管理クラス
 * ノードとエッジのデータをフィルタリングして選択・表示を制御
 */
export class FilterPanel {
    constructor() {
        this.panel = null;
        this.isVisible = false;
        this.conditions = []; // フィルター条件の配列
        this.nextConditionId = 0;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
    }

    initialize() {
        this.panel = document.getElementById('filter-panel');
        
        if (!this.panel) {
            console.error('Filter panel element not found');
            return;
        }

        this.setupEventListeners();
        this.setupPanelDrag();
        
        // 初期条件を1つ追加
        this.addCondition();
        
    }

    setupEventListeners() {
        // Applyボタン
        const applyBtn = document.getElementById('filter-apply-btn');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => this.applyFilter());
        }

        // Clearボタン
        const clearBtn = document.getElementById('filter-clear-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearFilter());
        }

        // 閉じるボタン
        const closeBtn = document.getElementById('filter-panel-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closePanel());
        }
    }

    setupPanelDrag() {
        if (!this.panel) return;
        const header = this.panel.querySelector('.filter-panel-header');
        if (!header) return;

        header.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('filter-panel-close-btn')) return;
            this.isDragging = true;
            const rect = this.panel.getBoundingClientRect();
            this.dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
            header.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            const x = e.clientX - this.dragOffset.x;
            const y = e.clientY - this.dragOffset.y;
            this.panel.style.left = `${x}px`;
            this.panel.style.top = `${y}px`;
        });

        document.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                const header = this.panel.querySelector('.filter-panel-header');
                if (header) header.style.cursor = 'grab';
            }
        });
    }

    /**
     * パネルを開く
     */
    openPanel() {
        if (!this.panel) return;
        
        if (!appContext.networkManager || !appContext.networkManager.hasNetwork()) {
            alert('Please load a network first.');
            return;
        }

        this.panel.classList.add('active');
        this.isVisible = true;
        
        // 最初の条件のカラムリストを更新
        this.updateAllColumnSelects();
    }

    /**
     * パネルを閉じる
     */
    closePanel() {
        if (!this.panel) return;
        this.panel.classList.remove('active');
        this.isVisible = false;
    }

    /**
     * パネルの表示/非表示を切り替え
     */
    togglePanel() {
        if (this.isVisible) {
            this.closePanel();
        } else {
            this.openPanel();
        }
    }

    hasActiveConditions() {
        return this.conditions.some(c => c.column && c.value);
    }

    /**
     * フィルター条件を追加
     */
    addCondition(afterId = null) {
        const conditionId = this.nextConditionId++;
        const condition = {
            id: conditionId,
            column: '',
            operator: '=',
            value: '',
            logicalOp: 'OR'
        };
        
        if (afterId !== null) {
            const index = this.conditions.findIndex(c => c.id === afterId);
            this.conditions.splice(index + 1, 0, condition);
        } else {
            this.conditions.push(condition);
        }
        
        this.renderConditions();
    }

    /**
     * フィルター条件を削除
     */
    removeCondition(conditionId) {
        const index = this.conditions.findIndex(c => c.id === conditionId);
        if (index !== -1) {
            this.conditions.splice(index, 1);
        }
        
        // 最低1つは条件を残す
        if (this.conditions.length === 0) {
            this.addCondition();
        }
        
        this.renderConditions();
    }

    /**
     * 全ての条件を描画
     */
    renderConditions() {
        const container = document.getElementById('filter-conditions-container');
        if (!container) return;
        
        container.innerHTML = '';
        
        this.conditions.forEach((condition, index) => {
            const conditionDiv = this.createConditionElement(condition, index);
            container.appendChild(conditionDiv);
        });
    }

    /**
     * 条件要素を作成
     */
    createConditionElement(condition, index) {
        const div = document.createElement('div');
        div.className = 'filter-condition';
        div.dataset.conditionId = condition.id;
        
        // Choose Column
        const columnSelect = document.createElement('select');
        columnSelect.className = 'filter-column-select';
        columnSelect.innerHTML = '<option value="">Choose Column</option>';
        this.populateColumnOptions(columnSelect);
        columnSelect.value = condition.column;
        columnSelect.addEventListener('change', (e) => {
            condition.column = e.target.value;
            this.updateOperatorOptions(condition.id);
        });
        
        // Operator
        const operatorSelect = document.createElement('select');
        operatorSelect.className = 'filter-operator-select';
        operatorSelect.addEventListener('change', (e) => {
            condition.operator = e.target.value;
        });
        this.updateOperatorSelectOptions(operatorSelect, condition.column);
        // updateOperatorSelectOptions recreates options; reapply the saved value
        if (condition.operator) {
            operatorSelect.value = condition.operator;
        }
        
        // Value
        const valueInput = document.createElement('input');
        valueInput.type = 'text';
        valueInput.className = 'filter-value-input';
        valueInput.placeholder = 'Value';
        valueInput.value = condition.value;
        valueInput.addEventListener('input', (e) => {
            condition.value = e.target.value;
        });
        
        // 削除ボタン（最初の条件以外）
        let removeBtn = null;
        if (this.conditions.length > 1) {
            removeBtn = document.createElement('button');
            removeBtn.className = 'filter-remove-btn';
            removeBtn.textContent = '✕';
            removeBtn.title = 'Remove condition';
            removeBtn.addEventListener('click', () => {
                this.removeCondition(condition.id);
            });
        }
        
        // 条件の行
        const conditionRow = document.createElement('div');
        conditionRow.className = 'filter-condition-row';
        conditionRow.appendChild(columnSelect);
        conditionRow.appendChild(operatorSelect);
        conditionRow.appendChild(valueInput);
        if (removeBtn) {
            conditionRow.appendChild(removeBtn);
        }
        
        div.appendChild(conditionRow);
        
        // 論理演算子（最後の条件以外）
        if (index < this.conditions.length - 1) {
            const logicalRow = document.createElement('div');
            logicalRow.className = 'filter-logical-row';
            
            const logicalSelect = document.createElement('select');
            logicalSelect.className = 'filter-logical-select';
            logicalSelect.innerHTML = `
                <option value="AND">AND</option>
                <option value="OR" selected>OR</option>
            `;
            logicalSelect.value = condition.logicalOp;
            logicalSelect.addEventListener('change', (e) => {
                condition.logicalOp = e.target.value;
            });
            
            logicalRow.appendChild(logicalSelect);
            div.appendChild(logicalRow);
        } else {
            // 最後の条件には「+」ボタンを追加
            const addRow = document.createElement('div');
            addRow.className = 'filter-add-row';
            
            const addBtn = document.createElement('button');
            addBtn.className = 'filter-add-btn';
            addBtn.textContent = '+ Add Condition';
            addBtn.addEventListener('click', () => {
                // この条件に論理演算子を追加
                condition.logicalOp = 'AND';
                this.addCondition(condition.id);
            });
            
            addRow.appendChild(addBtn);
            div.appendChild(addRow);
        }
        
        return div;
    }

    /**
     * カラム選択肢を設定
     */
    populateColumnOptions(selectElement) {
        if (!appContext.networkManager || !appContext.networkManager.hasNetwork()) return;
        
        const columns = this.getAvailableColumns();
        
        columns.forEach(col => {
            const option = document.createElement('option');
            option.value = col.value;
            option.textContent = col.label;
            selectElement.appendChild(option);
        });
    }

    /**
     * 利用可能なカラムを取得
     */
    getAvailableColumns() {
        const columns = [];
        
        if (!appContext.networkManager || !appContext.networkManager.hasNetwork()) return columns;
        
        const nodes = appContext.networkManager.cy.nodes();
        const edges = appContext.networkManager.cy.edges();
        const nodeColumnMap = new Map();
        const edgeColumnMap = new Map();
        
        // ノードのカラム
        if (nodes.length > 0) {
            const excludedColumns = ['_originalBg', '_hoverOriginalBg', '_hoverOriginalOpacity', 'name', 'label', 'Label'];

            nodes.forEach(node => {
                const nodeData = node.data();
                Object.keys(nodeData).forEach(key => {
                    // `_bypass_` で始まるカラムはフィルターの選択肢に含めない
                    if (key && String(key).startsWith('_bypass_')) return;
                    if (excludedColumns.includes(key)) return;
                    if (!nodeColumnMap.has(key)) {
                        nodeColumnMap.set(key, this.detectDataType(nodeData[key]));
                    }
                });
            });
        }
        
        // エッジのカラム
        if (edges.length > 0) {
            const excludedColumns = ['_originalLineColor', '_originalWidth', '_hoverOriginalLineColor', '_hoverOriginalOpacity', 'interaction'];

            edges.forEach(edge => {
                const edgeData = edge.data();
                Object.keys(edgeData).forEach(key => {
                    // `_bypass_` で始まるカラムはフィルターの選択肢に含めない
                    if (key && String(key).startsWith('_bypass_')) return;
                    if (excludedColumns.includes(key)) return;
                    if (!edgeColumnMap.has(key)) {
                        edgeColumnMap.set(key, this.detectDataType(edgeData[key]));
                    }
                });
            });
        }

        nodeColumnMap.forEach((type, key) => {
            columns.push({
                value: `node.${key}`,
                label: `Node ${key}`,
                type
            });
        });

        edgeColumnMap.forEach((type, key) => {
            columns.push({
                value: `edge.${key}`,
                label: `Edge ${key}`,
                type
            });
        });
        
        return columns;
    }

    /**
     * データ型を検出
     */
    detectDataType(value) {
        if (value === null || value === undefined) return 'string';
        
        if (typeof value === 'number') return 'number';
        
        // 日付の自動判定は行わない（CSVの読み込みは文字列として扱う）
        return 'string';
    }

    /**
     * 演算子選択肢を更新
     */
    updateOperatorSelectOptions(selectElement, columnValue) {
        // すべてのデータ型で全ての演算子を使用可能に
        selectElement.innerHTML = `
            <option value="=">=</option>
            <option value=">=">≧</option>
            <option value=">">></option>
            <option value="<"><</option>
            <option value="<=">≦</option>
            <option value="<>"><></option>
        `;
    }

    /**
     * 特定の条件の演算子選択肢を更新
     */
    updateOperatorOptions(conditionId) {
        const condition = this.conditions.find(c => c.id === conditionId);
        if (!condition) return;
        
        const conditionDiv = this.panel.querySelector(`[data-condition-id="${conditionId}"]`);
        if (!conditionDiv) return;
        
        const operatorSelect = conditionDiv.querySelector('.filter-operator-select');
        if (operatorSelect) {
            // 現在の演算子値を保存
            const currentOperator = condition.operator;
            
            // 演算子の選択肢を更新
            this.updateOperatorSelectOptions(operatorSelect, condition.column);
            
            // 保存していた演算子値を復元（選択肢に存在する場合のみ）
            if (currentOperator) {
                const options = Array.from(operatorSelect.options).map(opt => opt.value);
                if (options.includes(currentOperator)) {
                    operatorSelect.value = currentOperator;
                    condition.operator = currentOperator;
                } else {
                    // 選択肢に存在しない場合は、新しい選択肢の最初の値を使用
                    condition.operator = operatorSelect.value;
                }
            } else {
                condition.operator = operatorSelect.value;
            }
        }
    }

    /**
     * 全てのカラム選択肢を更新
     */
    updateAllColumnSelects() {
        const selects = this.panel.querySelectorAll('.filter-column-select');
        selects.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = '<option value="">Choose Column</option>';
            this.populateColumnOptions(select);
            select.value = currentValue;
        });
    }

    /**
     * フィルターを適用
     */
    async applyFilter() {
        if (!appContext.networkManager || !appContext.networkManager.hasNetwork()) return;

        // Path TraceがONなら確認メッセージを表示してOFFにする
        if (appContext.pathTracePanel && appContext.pathTracePanel.isEnabled) {
             let confirmed = true;
             if (appContext.modalManager && typeof appContext.modalManager.showConfirm === 'function') {
                 confirmed = await appContext.modalManager.showConfirm(
                     'Path Trace機能はOFFになります。よろしいですか？'
                 );
             } else {
                 confirmed = confirm('Path Trace機能はOFFになります。よろしいですか？');
             }

             if (!confirmed) {
                 return;
             }
             
             // 確認OKならPath TraceをOFFにする
             appContext.pathTracePanel.togglePathTrace(false);
        }

        // UIの最新値を条件に反映
        this.syncConditionsFromUI();
        
        // 条件の検証
        const validConditions = this.conditions.filter(c => c.column && c.value);
        
        if (validConditions.length === 0) {
            alert('Please specify at least one filter condition.');
            return;
        }
        
        // プログレスオーバーレイを表示
        progressOverlay.show('Applying filter...');
        
        // フィルター処理を非同期で実行（UIをブロックしないため）
        setTimeout(() => {
            // フィルター処理
            const nodes = appContext.networkManager.cy.nodes();
            const edges = appContext.networkManager.cy.edges();
            
            const matchedNodes = [];
            const matchedEdges = [];
            
            // ノードをフィルタリング
            nodes.forEach(node => {
                if (this.evaluateConditions(node, 'node', validConditions)) {
                    matchedNodes.push(node);
                }
            });
            
            // エッジをフィルタリング
            console.log(`[FilterPanel] Evaluating ${edges.length} edges with ${validConditions.length} conditions`);
            
            edges.forEach((edge, idx) => {
                const result = this.evaluateConditions(edge, 'edge', validConditions);
                
                // Debug first few edges
                if (idx < 3) {
                    const edgeData = {};
                    validConditions.forEach(c => {
                        const [, colName] = c.column.split('.');
                        if (colName) {
                            edgeData[colName] = edge.data(colName);
                        }
                    });
                    console.log(`  [Edge ${idx}] Data:`, edgeData, 'Result:', result);
                }
                
                if (result) {
                    matchedEdges.push(edge);
                }
            });
            
            // 結果を適用
            this.applyFilterResults(matchedNodes, matchedEdges, validConditions);
            
            // プログレスオーバーレイを非表示
            progressOverlay.hide();
        }, 50);
    }

    /**
     * 画面上の入力値をconditionsに同期
     */
    syncConditionsFromUI() {
        const container = document.getElementById('filter-conditions-container');
        if (!container) return;

        container.querySelectorAll('.filter-condition').forEach(conditionDiv => {
            const id = Number(conditionDiv.dataset.conditionId);
            const condition = this.conditions.find(c => c.id === id);
            if (!condition) return;

            const columnSelect = conditionDiv.querySelector('.filter-column-select');
            const operatorSelect = conditionDiv.querySelector('.filter-operator-select');
            const valueInput = conditionDiv.querySelector('.filter-value-input');
            const logicalSelect = conditionDiv.querySelector('.filter-logical-select');

            if (columnSelect) condition.column = columnSelect.value;
            if (operatorSelect) condition.operator = operatorSelect.value;
            if (valueInput) condition.value = valueInput.value;
            if (logicalSelect) condition.logicalOp = logicalSelect.value;
        });
    }

    /**
     * 条件を評価
     */

    /**
     * 単一条件を評価
     */
    evaluateConditions(element, elementType, conditions) {
        // この要素タイプに関連する条件のみを抽出
        const relevantConditions = conditions.filter(c => {
            const [type] = c.column.split('.');
            return type === elementType;
        });

        // この要素タイプに関連する条件がない場合はfalseを返す
        if (relevantConditions.length === 0) {
            return false;
        }

        // 新しいロジック：同一カラムに対する複数条件はまとめて評価し、
        // 配列カラムの場合は要素単位でマッチしたインデックスを取得して
        // カラム間では AND（共通するインデックスが存在すること）で判定する。
        const condMap = new Map(); // columnName -> [conditions]
        relevantConditions.forEach(c => {
            const [, columnName] = c.column.split('.');
            if (!columnName) return;
            if (!condMap.has(columnName)) condMap.set(columnName, []);
            condMap.get(columnName).push(c);
        });

        // 配列カラムのインデックス集合を格納
        const arrayIndexSets = [];
        // 非配列カラムの真偽値結果を格納
        const nonArrayResults = [];

        // 値を配列に正規化するヘルパー
        const normalizeToItems = (val) => {
            if (val === null || val === undefined) return null;
            if (Array.isArray(val)) return val.map(v => String(v));
            if (typeof val === 'string') {
                if (val.includes('\n')) return val.split('\n').map(v => String(v));
                if (val.includes('|')) return val.split('|').map(v => String(v));
            }
            return null;
        };

        for (const [colName, conds] of condMap.entries()) {
            let value = null;
            try { value = element.data(colName); } catch (e) { value = undefined; }

            const items = normalizeToItems(value);
            if (items && items.length > 0) {
                // 配列カラム：要素単位で条件群を評価してマッチするインデックスを取得
                const matched = getMatchedIndicesForArray(items, conds);
                arrayIndexSets.push(new Set(matched));
            } else {
                // 非配列カラム：条件群をシーケンス評価して真偽を得る
                const boolResult = evaluateExternalConditionSequence(value, conds);
                nonArrayResults.push(boolResult);
            }
        }

        // 非配列カラムはすべて真でなければ合格しない（AND）
        if (nonArrayResults.some(r => !r)) return false;

        // 配列カラム間はインデックスの共通部分が存在することを要求
        if (arrayIndexSets.length > 0) {
            let inter = arrayIndexSets[0];
            for (let i = 1; i < arrayIndexSets.length; i++) {
                inter = new Set([...inter].filter(x => arrayIndexSets[i].has(x)));
                if (inter.size === 0) return false;
            }
            // 共通するインデックスがあれば合格
            return inter.size > 0;
        }

        // 配列条件が無く、非配列条件がすべて真なら合格
        return true;
        
        // Debug log for edges
        if (elementType === 'edge' && element._private && element._private.data && element._private.data.id) {
            const edgeId = element._private.data.id;
            if (parseInt(edgeId) < 3) { // Log first 3 edges
                console.log(`    [evaluateConditions Edge ${edgeId}]`, conditionEvals, '=> Final:', result);
            }
        }

        return result;
    }

    /**
     * 単一値に対する条件評価
     */
    evaluateSingleValue(value, operator, targetValue) {
        // nullやundefinedの処理
        if (value === null || value === undefined) {
            value = '';
        }
        
        // 数値変換を試みる
        const numValue = Number(value);
        const numTarget = Number(targetValue);
        const isNumeric = !isNaN(numValue) && !isNaN(numTarget) && value !== '' && targetValue !== '';
        
        if (isNumeric) {
            // 数値比較
            switch (operator) {
                case '=': return numValue === numTarget;
                case '>=': return numValue >= numTarget;
                case '>': return numValue > numTarget;
                case '<': return numValue < numTarget;
                case '<=': return numValue <= numTarget;
                case '<>': return numValue !== numTarget;
                default: return false;
            }
        } else {
            // yyyy-mm-dd 形式（厳密）なら日付比較（文字列順と同等）を行う
            const ymdRegex = /^\d{4}-\d{2}-\d{2}$/;
            const rawValue = String(value);
            const rawTarget = String(targetValue);

            if (ymdRegex.test(rawValue) && ymdRegex.test(rawTarget)) {
                // YYYY-MM-DD は辞書順で日時比較が可能
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

            // それ以外は通常の文字列比較（大文字小文字を無視）
            const strValue = rawValue.toLowerCase();
            const strTarget = rawTarget.toLowerCase();

            switch (operator) {
                case '=': return strValue === strTarget;
                case '>=': return strValue >= strTarget;
                case '>': return strValue > strTarget;
                case '<': return strValue < strTarget;
                case '<=': return strValue <= strTarget;
                case '<>': return strValue !== strTarget;
                default: return false;
            }
        }
    }

    /**
     * フィルター結果を適用
     */
    applyFilterResults(matchedNodes, matchedEdges, conditions = null) {
        if (!appContext.networkManager || !appContext.networkManager.hasNetwork()) return;

        

        const cy = appContext.networkManager.cy;
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
            } catch (e) {
                // ignore
            }
            return false;
        })();

        // エッジが明示的にフィルタで選択されている場合は、並列エッジの自動拡張を行わず
        // そのまま該当エッジのみを選択する（ネットワーク上で1本のエッジをクリックした時と同じ振る舞い）
        let resultingNodes = matchedNodes;
        let resultingEdges = matchedEdges;

        if (Array.isArray(matchedEdges) && matchedEdges.length > 0) {
            // 明示的なエッジがある場合、エッジの両端ノードを明示的に収集して使用
            const nodeSet = new Set();
            matchedEdges.forEach(edge => {
                try {
                    const s = edge.source(); if (s) nodeSet.add(s);
                    const t = edge.target(); if (t) nodeSet.add(t);
                } catch (e) {
                    // edge が element でない可能性を想定（保険）
                }
            });
            resultingNodes = Array.from(nodeSet);
            resultingEdges = matchedEdges;
        } else {
            // Unweighted graph: if only node conditions are provided, map them to edge conditions
            // so the Edge Table matches "Edge ..." behavior.
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
                        resultingEdges = edgeMatches;
                        const nodeSet2 = new Set();
                        edgeMatches.forEach(edge => {
                            const s = edge.source(); if (s) nodeSet2.add(s);
                            const t = edge.target(); if (t) nodeSet2.add(t);
                        });
                        resultingNodes = Array.from(nodeSet2);
                        // Skip the node->edge inference path
                        matchedNodes = resultingNodes;
                        matchedEdges = resultingEdges;
                        mappedEdgeMatches = true;
                    }
                }
            }

            // エッジが明示されていない場合は、まずノードフィルタ条件に一致する
            // 配列カラム検索（例: 論文ID の要素一致）を優先して、該当する隣接エッジを絞り込む
            let foundEdges = [];
            if (!mappedEdgeMatches && Array.isArray(conditions) && conditions.length > 0 && Array.isArray(matchedNodes) && matchedNodes.length > 0) {
                // node.XXX の条件を抽出（単純に '=' の場合を扱う）
                const nodeConds = conditions.filter(c => typeof c.column === 'string' && c.column.startsWith('node.') && c.value !== undefined && c.value !== null && String(c.value).trim() !== '');
                if (nodeConds.length > 0) {
                    const seen = new Set();
                    // Group node conditions by column name so we can evaluate sequences per-column
                    const nodeCondMap = new Map();
                    nodeConds.forEach(cond => {
                        const [, colName] = cond.column.split('.');
                        if (!colName) return;
                        if (!nodeCondMap.has(colName)) nodeCondMap.set(colName, []);
                        nodeCondMap.get(colName).push(cond);
                    });

                    const edgeMatchesNodeConds = (edge) => {
                        if (hasEdgeWeights) {
                            // Weighted graph: preserve index-intersection behavior for array columns.
                            const arrayIndexSets = [];
                            const nonArrayResults = [];
                            for (const [colName, conds] of nodeCondMap.entries()) {
                                const edgeVal = edge.data(colName);
                                if (edgeVal === undefined || edgeVal === null) return false;
                                if (Array.isArray(edgeVal) || (typeof edgeVal === 'string' && (String(edgeVal).includes('|') || String(edgeVal).includes('\n')))) {
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

                        // Unweighted graph: evaluate per-column AND, array columns satisfied if any element matches.
                        for (const [colName, conds] of nodeCondMap.entries()) {
                            const edgeVal = edge.data(colName);
                            if (edgeVal === undefined || edgeVal === null) return false;

                            if (Array.isArray(edgeVal) || (typeof edgeVal === 'string' && (String(edgeVal).includes('|') || String(edgeVal).includes('\n')))) {
                                let items = Array.isArray(edgeVal) ? edgeVal.map(v => String(v)) : String(edgeVal).split(/\|/).map(v => String(v));
                                const matchedIdx = getMatchedIndicesForArray(items, conds);
                                if (!matchedIdx || matchedIdx.length === 0) return false;
                            } else {
                                if (!evaluateExternalConditionSequence(edgeVal, conds)) return false;
                            }
                        }
                        return true;
                    };

                    matchedNodes.forEach(node => {
                        try {
                            const incident = node.connectedEdges();
                            incident.forEach(edge => {
                                try {
                                    if (!edgeMatchesNodeConds(edge)) return;

                                    if (!seen.has(edge.id())) { seen.add(edge.id()); foundEdges.push(edge); }
                                } catch (e) {
                                    // ignore edge-level errors
                                }
                            });
                        } catch (e) {
                            // node.connectedEdges() may fail in some contexts; ignore
                        }
                    });
                }
            }

            if (foundEdges.length > 0) {
                // 絞り込んだエッジを採用
                resultingEdges = foundEdges;
                const nodeSet2 = new Set();
                foundEdges.forEach(edge => {
                    const s = edge.source(); if (s) nodeSet2.add(s);
                    const t = edge.target(); if (t) nodeSet2.add(t);
                });
                resultingNodes = Array.from(nodeSet2);
            } else if (!mappedEdgeMatches) {
                // If no edges were found by incident-edge checks, also try a global pass:
                // include edges that satisfy the equivalent edge-level conditions and are connected to any matched node.
                const matchedNodeIdSet = new Set((matchedNodes || []).map(n => (typeof n.id === 'function' ? n.id() : n.id)));

                const globalMatches = [];
                cy.edges().forEach(edge => {
                    try {
                        // only consider edges incident to matched nodes
                        const s = edge.source(); const t = edge.target();
                        const sid = (s && typeof s.id === 'function') ? s.id() : (s ? s : null);
                        const tid = (t && typeof t.id === 'function') ? t.id() : (t ? t : null);
                        if (!matchedNodeIdSet.has(sid) && !matchedNodeIdSet.has(tid)) return;

                        if (edgeMatchesNodeConds(edge)) globalMatches.push(edge);
                    } catch (e) {
                        // ignore
                    }
                });

                if (globalMatches.length > 0) {
                    resultingEdges = globalMatches;
                    const nodeSet2 = new Set();
                    globalMatches.forEach(edge => {
                        const s = edge.source(); if (s) nodeSet2.add(s);
                        const t = edge.target(); if (t) nodeSet2.add(t);
                    });
                    resultingNodes = Array.from(nodeSet2);
                } else {
                    if (hasEdgeWeights) {
                        // 既存の拡張ロジックを使用
                        const expanded = expandSelectionWithConnections(cy, matchedNodes, matchedEdges);
                        resultingNodes = expanded.nodes;
                        resultingEdges = expanded.edges;
                    } else {
                        // Unweighted graph: do not expand edges when no matches found
                        resultingNodes = matchedNodes;
                        resultingEdges = [];
                    }
                }
            }
        }

        // すべての選択を解除して結果を適用
        if (appContext.tablePanel) {
            const expanded = appContext.tablePanel.applySelectionClosure(
                resultingNodes,
                resultingEdges,
                { setOpacity: true, fromFilter: true, bringToFront: true, skipExpand: !hasEdgeWeights }
            );
            matchedNodes = expanded.nodes;
            matchedEdges = expanded.edges;
        } else {
            applySelectionToCy(cy, resultingNodes, resultingEdges, { setOpacity: true, bringToFront: true });
            matchedNodes = resultingNodes;
            matchedEdges = resultingEdges;
        }
        
        // Table Panelを更新（抽出結果を連動）
        if (appContext.tablePanel) {
            console.log('[FilterPanel.applyFilterResults] Sending to TablePanel:',
                        'matchedNodes:', matchedNodes.length,
                        'matchedEdges:', matchedEdges.length,
                        'conditions:', conditions.length);
            appContext.tablePanel.setExternalFilterResults(matchedNodes, matchedEdges, conditions);
            if (appContext.tablePanel.isVisible) {
                appContext.tablePanel.refreshTable();
            }
        }
        
    }

    /**
     * フィルターをクリア
     */
    clearFilter() {
        if (!appContext.networkManager || !appContext.networkManager.hasNetwork()) return;
        
        // フィルター解除中に他の処理がプログラム的に選択を再適用するのを防止するフラグ
        appContext.suppressProgrammaticSelection = true;
        
        // すべての選択を解除
        if (appContext.tablePanel && typeof appContext.tablePanel.clearSelection === 'function') {
            appContext.tablePanel.clearSelection();
        } else {
            appContext.networkManager.cy.elements().unselect();
        }
        
        // すべての要素の透明度をリセット
        appContext.networkManager.cy.elements().style('opacity', 1);
        
        // 条件をリセット
        this.conditions = [];
        this.addCondition();
        
        // Table Panelを更新（外部フィルターを解除）
        if (appContext.tablePanel) {
            
            appContext.tablePanel.clearExternalFilterResults();
            appContext.tablePanel.clearAllFiltersAllTabs();
            if (appContext.tablePanel.isVisible) {
                appContext.tablePanel.refreshTable();
            }
        }
        // 少し時間を置いて抑止フラグを解除（他の同期的/非同期的な再選択が完了するのを待つ）
        setTimeout(() => {
            appContext.suppressProgrammaticSelection = false;
        }, 200);
        
    }
}

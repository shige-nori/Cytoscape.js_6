/**
 * FileHandler - ファイル読み込み処理クラス
 */
class FileHandler {
    constructor() {
        this.currentData = null;
        this.currentColumns = [];
        this.importMode = 'network'; // 'network' or 'table'
        this.currentFilePath = null; // 現在開いているcx2ファイルのパス
    }

    /**
     * Excelファイルを読み込む
     * @param {File} file - ファイルオブジェクト
     * @returns {Promise<Object>} パースされたデータ
     */
    async readExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    // 最初のシートを取得
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    
                    // JSONに変換
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
                        header: 1,
                        raw: false,
                        defval: ''
                    });
                    
                    if (jsonData.length < 2) {
                        reject(new Error('File must contain at least header row and one data row'));
                        return;
                    }
                    
                    // ヘッダーとデータを分離
                    const headers = jsonData[0].map(h => String(h).trim());
                    const rows = jsonData.slice(1).map(row => {
                        const obj = {};
                        headers.forEach((header, index) => {
                            obj[header] = row[index] !== undefined ? row[index] : '';
                        });
                        return obj;
                    });
                    
                    resolve({
                        columns: headers,
                        data: rows
                    });
                } catch (error) {
                    reject(new Error('Failed to parse Excel file: ' + error.message));
                }
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };
            
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Network Fileのインポート処理を開始
     * @param {File} file 
     */
    async startNetworkImport(file) {
        this.importMode = 'network';
        progressOverlay.show('Reading file...');
        
        try {
            const result = await this.readExcelFile(file);
            this.currentData = result.data;
            this.currentColumns = result.columns;
            
            progressOverlay.hide();
            modalManager.showColumnMapping(result.columns, this.importMode);
        } catch (error) {
            progressOverlay.hide();
            alert('Error: ' + error.message);
        }
    }

    /**
     * Table Fileのインポート処理を開始
     * @param {File} file 
     */
    async startTableImport(file) {
        if (!networkManager.hasNetwork()) {
            alert('Please import a network file first.');
            return;
        }

        this.importMode = 'table';
        progressOverlay.show('Reading file...');
        
        try {
            const result = await this.readExcelFile(file);
            this.currentData = result.data;
            this.currentColumns = result.columns;
            
            progressOverlay.hide();
            modalManager.showColumnMapping(result.columns, this.importMode);
        } catch (error) {
            progressOverlay.hide();
            alert('Error: ' + error.message);
        }
    }

    /**
     * マッピング設定でインポートを実行
     * @param {Object} mappings - カラムマッピング設定
     */
    executeImport(mappings) {
        try {
            if (this.importMode === 'network') {
                const result = networkManager.createNetwork(this.currentData, mappings);
                layoutManager.applyDagreLayout();
                progressOverlay.hide();
                console.log(`Network created: ${result.nodeCount} nodes, ${result.edgeCount} edges`);
                
                // メニュー状態を更新
                if (menuManager) {
                    menuManager.updateMenuStates();
                }
            } else {
                const result = networkManager.addTableData(this.currentData, mappings);
                progressOverlay.hide();
                console.log(`Table imported: ${result.matchedCount}/${result.totalRows} rows matched`);
            }
            
            this.currentData = null;
            this.currentColumns = [];
        } catch (error) {
            progressOverlay.hide();
            alert('Import error: ' + error.message);
        }
    }

    /**
     * データ型を推測
     * @param {Array} data - データ配列
     * @param {string} column - カラム名
     * @returns {string} 推測されたデータ型
     */
    guessDataType(data, column) {
        const sampleValues = data
            .slice(0, 10)
            .map(row => row[column])
            .filter(v => v !== null && v !== undefined && v !== '');

        if (sampleValues.length === 0) return 'String';

        // 数値チェック
        const allNumbers = sampleValues.every(v => !isNaN(Number(v)));
        if (allNumbers) return 'Number';

        // ブール値チェック
        const boolValues = ['true', 'false', '0', '1', 'yes', 'no'];
        const allBooleans = sampleValues.every(v => 
            boolValues.includes(String(v).toLowerCase())
        );
        if (allBooleans) return 'Boolean';

        // 配列チェック（パイプ区切り）
        const hasDelimiter = sampleValues.some(v => String(v).includes('|'));
        if (hasDelimiter) {
            const firstWithDelimiter = sampleValues.find(v => String(v).includes('|'));
            const parts = String(firstWithDelimiter).split('|');
            const allPartsNumbers = parts.every(p => !isNaN(Number(p.trim())));
            return allPartsNumbers ? 'Number Array' : 'String Array';
        }

        return 'String';
    }

    /**
     * CX2ファイルを開く
     * @param {File} file 
     */
    async openCX2File(file) {
        progressOverlay.show('Opening CX2 file...');
        
        try {
            const text = await file.text();
            const cx2Data = JSON.parse(text);
            
            // CX2フォーマットの検証
            if (!cx2Data.nodes || !cx2Data.edges) {
                throw new Error('Invalid CX2 format: missing nodes or edges');
            }
            
            // ネットワークをクリア
            if (networkManager.hasNetwork()) {
                networkManager.closeNetwork();
            }
            
            // Cytoscapeデータに変換
            const elements = {
                nodes: cx2Data.nodes.map(node => ({
                    data: { id: node.id, ...node.v }
                })),
                edges: cx2Data.edges.map(edge => ({
                    data: { 
                        id: edge.id, 
                        source: edge.s, 
                        target: edge.t,
                        ...edge.v 
                    }
                }))
            };
            
            // ネットワークを作成
            networkManager.cy.add(elements);
            
            // レイアウトを復元（保存されている場合）
            if (cx2Data.layout) {
                cx2Data.nodes.forEach((node, index) => {
                    if (cx2Data.layout[index]) {
                        const cyNode = networkManager.cy.getElementById(node.id);
                        cyNode.position(cx2Data.layout[index]);
                    }
                });
            }
            
            // スタイルを復元（保存されている場合）
            if (cx2Data.styleSettings && stylePanel) {
                stylePanel.nodeStyles = cx2Data.styleSettings.nodeStyles || stylePanel.nodeStyles;
                stylePanel.edgeStyles = cx2Data.styleSettings.edgeStyles || stylePanel.edgeStyles;
                stylePanel.reapplyStyles();
            }
            
            // Edge Bends設定を復元（保存されている場合）
            if (cx2Data.edgeBendsSettings && edgeBends) {
                // Bend Strengthを復元
                edgeBends.currentBendStrength = cx2Data.edgeBendsSettings.bendStrength || 40;
                const slider = document.getElementById('bend-strength-slider');
                const valueInput = document.getElementById('bend-strength-value');
                if (slider) slider.value = edgeBends.currentBendStrength;
                if (valueInput) valueInput.value = edgeBends.currentBendStrength;
                
                // 各エッジの曲げ設定を復元
                if (cx2Data.edgeBendsSettings.edgeStyles) {
                    cx2Data.edgeBendsSettings.edgeStyles.forEach(edgeStyle => {
                        const edge = networkManager.cy.getElementById(edgeStyle.id);
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
            
            // ファイトを適用
            networkManager.cy.fit();
            
            // Table Panelを更新
            if (window.tablePanel) {
                tablePanel.updateTable(networkManager.cy.nodes());
            }
            
            // 現在のファイルパスを保存
            this.currentFilePath = file.name;
            
            // Saveメニューを有効化
            if (menuManager) {
                menuManager.updateMenuStates();
            }
            
            progressOverlay.hide();
        } catch (error) {
            progressOverlay.hide();
            alert('Error opening CX2 file: ' + error.message);
        }
    }

    /**
     * ネットワークをCX2形式で保存
     * @param {string} filename - ファイル名（省略時はデフォルト名）
     * @param {boolean} useFileDialog - ファイルダイアログを使用するか（Save As用）
     */
    async saveCX2File(filename, useFileDialog = false) {
        if (!networkManager.hasNetwork()) {
            alert('No network to save.');
            return;
        }
        
        try {
            // CX2フォーマットに変換
            const nodes = networkManager.cy.nodes().map(node => {
                const data = node.data();
                const { id, ...attributes } = data;
                return {
                    id: id,
                    v: attributes
                };
            });
            
            const edges = networkManager.cy.edges().map(edge => {
                const data = edge.data();
                const { id, source, target, ...attributes } = data;
                return {
                    id: id,
                    s: source,
                    t: target,
                    v: attributes
                };
            });
            
            // レイアウト情報を保存
            const layout = networkManager.cy.nodes().map(node => node.position());
            
            // Edge Bends設定を保存
            const edgeBendsSettings = {
                bendStrength: edgeBends ? edgeBends.currentBendStrength : 40,
                edgeStyles: networkManager.cy.edges().map(edge => ({
                    id: edge.id(),
                    curveStyle: edge.style('curve-style'),
                    controlPointDistances: edge.style('control-point-distances'),
                    controlPointWeights: edge.style('control-point-weights')
                }))
            };
            
            // スタイル設定を保存
            const styleSettings = stylePanel ? {
                nodeStyles: stylePanel.nodeStyles,
                edgeStyles: stylePanel.edgeStyles
            } : null;
            
            const cx2Data = {
                nodes: nodes,
                edges: edges,
                layout: layout,
                edgeBendsSettings: edgeBendsSettings,
                styleSettings: styleSettings
            };
            
            const jsonString = JSON.stringify(cx2Data, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            
            // File System Access APIをサポートしているか確認
            if (useFileDialog && 'showSaveFilePicker' in window) {
                try {
                    // デフォルトファイル名を設定
                    const defaultName = filename || this.currentFilePath || 'network.cx2';
                    const suggestedName = defaultName.endsWith('.cx2') ? defaultName : defaultName + '.cx2';
                    
                    // ファイル保存ダイアログを表示
                    const handle = await window.showSaveFilePicker({
                        suggestedName: suggestedName,
                        types: [{
                            description: 'CX2 Network File',
                            accept: { 'application/json': ['.cx2'] }
                        }]
                    });
                    
                    // ファイルに書き込み
                    const writable = await handle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                    
                    // ファイルパスを保存
                    this.currentFilePath = handle.name;
                    
                    // Saveメニューを有効化
                    if (menuManager) {
                        menuManager.updateMenuStates();
                    }
                    
                    return;
                } catch (err) {
                    // ユーザーがキャンセルした場合など
                    if (err.name !== 'AbortError') {
                        console.error('Error using File System Access API:', err);
                        // フォールバックに続く
                    } else {
                        return; // キャンセルされた
                    }
                }
            }
            
            // フォールバック: 従来のダウンロード方法
            const defaultName = filename || this.currentFilePath || 'network.cx2';
            const finalName = defaultName.endsWith('.cx2') ? defaultName : defaultName + '.cx2';
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = finalName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            // ファイルパスを保存
            this.currentFilePath = finalName;
            
            // Saveメニューを有効化
            if (menuManager) {
                menuManager.updateMenuStates();
            }
        } catch (error) {
            alert('Error saving CX2 file: ' + error.message);
        }
    }
}

// グローバルインスタンス
let fileHandler;

/**
 * プログレスオーバーレイ管理
 */
const progressOverlay = {
    element: null,
    textElement: null,

    init() {
        this.element = document.getElementById('progress-overlay');
        this.textElement = this.element.querySelector('.progress-text');
    },

    show(message = 'Loading...') {
        this.textElement.textContent = message;
        this.element.classList.add('active');
    },

    hide() {
        this.element.classList.remove('active');
    }
};

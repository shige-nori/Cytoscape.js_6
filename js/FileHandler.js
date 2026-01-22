import { appContext } from './AppContext.js';
import { progressOverlay } from './ProgressOverlay.js';

/**
 * FileHandler - ファイル読み込み処理クラス
 */
export class FileHandler {
    constructor() {
        this.currentData = null;
        this.currentColumns = [];
        this.importMode = 'network'; // 'network' or 'table'
        this.currentFilePath = null; // 現在開いているcx2ファイルのパス
        this.currentFileHandle = null; // File System Access APIのファイルハンドル
    }

    /**
     * CSVファイルを読み込む
     * @param {File} file - ファイルオブジェクト
     * @returns {Promise<Object>} パースされたデータ
     */
    async readCsvFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const text = String(e.target.result || '');
                    const rows = this.parseCsv(text);

                    if (rows.length < 2) {
                        reject(new Error('File must contain at least header row and one data row'));
                        return;
                    }

                    const headers = rows[0].map(h => String(h).trim());
                    const data = rows.slice(1).map(row => {
                        const obj = {};
                        headers.forEach((header, index) => {
                            obj[header] = row[index] !== undefined ? String(row[index]) : '';
                        });
                        return obj;
                    });

                    resolve({
                        columns: headers,
                        data
                    });
                } catch (error) {
                    reject(new Error('Failed to parse CSV file: ' + error.message));
                }
            };

            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };

            reader.readAsText(file);
        });
    }

    /**
     * CSVテキストを2次元配列に変換
     * @param {string} text
     * @returns {Array<Array<string>>}
     */
    parseCsv(text) {
        const rows = [];
        let currentRow = [];
        let currentValue = '';
        let inQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const nextChar = text[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    currentValue += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
                continue;
            }

            if (char === ',' && !inQuotes) {
                currentRow.push(currentValue);
                currentValue = '';
                continue;
            }

            if ((char === '\n' || char === '\r') && !inQuotes) {
                if (char === '\r' && nextChar === '\n') {
                    i++;
                }
                currentRow.push(currentValue);
                if (currentRow.some(value => value !== '')) {
                    rows.push(currentRow);
                }
                currentRow = [];
                currentValue = '';
                continue;
            }

            currentValue += char;
        }

        currentRow.push(currentValue);
        if (currentRow.some(value => value !== '')) {
            rows.push(currentRow);
        }

        return rows;
    }

    /**
     * Network Fileのインポート処理を開始
     * @param {File} file 
     */
    async startNetworkImport(file) {
        this.importMode = 'network';
        progressOverlay.show('Reading file...');
        
        try {
            // 既存ネットワークがあればクローズしてから読み込む
            if (appContext.networkManager.hasNetwork()) {
                appContext.networkManager.closeNetwork();
            }

            const result = await this.readCsvFile(file);
            this.currentData = result.data;
            this.currentColumns = result.columns;
            
            progressOverlay.hide();
            appContext.modalManager.showColumnMapping(result.columns, this.importMode);
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
        if (!appContext.networkManager.hasNetwork()) {
            alert('Please import a network file first.');
            return;
        }

        this.importMode = 'table';
        progressOverlay.show('Reading file...');
        
        try {
            const result = await this.readCsvFile(file);
            this.currentData = result.data;
            this.currentColumns = result.columns;
            
            progressOverlay.hide();
            appContext.modalManager.showColumnMapping(result.columns, this.importMode);
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
                const result = appContext.networkManager.createNetwork(this.currentData, mappings);
                appContext.layoutManager.applyDagreLayout();
                progressOverlay.hide();
                
                // メニュー状態を更新
                if (appContext.menuManager) {
                    appContext.menuManager.updateMenuStates();
                }
                
                // Table Panelの全カラムを表示
                if (appContext.tablePanel) {
                    appContext.tablePanel.resetToShowAllColumns();
                }
            } else {
                const result = appContext.networkManager.addTableData(this.currentData, mappings);
                progressOverlay.hide();
                
                // Table Panelの全カラムを表示
                if (appContext.tablePanel) {
                    appContext.tablePanel.resetToShowAllColumns();
                }
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
     * @param {FileSystemFileHandle} fileHandle - File System Access APIのファイルハンドル（オプション）
     */
    async openCX2File(file, fileHandle = null) {
        progressOverlay.show('Opening CX2 file...');
        
        try {
            const text = await file.text();
            const cx2Data = JSON.parse(text);
            
            // CX2フォーマットの検証
            if (!cx2Data.nodes || !cx2Data.edges) {
                throw new Error('Invalid CX2 format: missing nodes or edges');
            }
            
            // ネットワークをクリア
            if (appContext.networkManager.hasNetwork()) {
                appContext.networkManager.closeNetwork();
            }
            
            // スタイル設定をデフォルトにリセット
            if (appContext.stylePanel) {
                appContext.stylePanel.resetToDefault();
            }
            
            // Edge Bends設定をデフォルトにリセット
            if (appContext.edgeBends) {
                appContext.edgeBends.resetToDefault();
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
            appContext.networkManager.cy.add(elements);
            
            // レイアウトを復元（保存されている場合）
            if (cx2Data.layout) {
                cx2Data.nodes.forEach((node, index) => {
                    if (cx2Data.layout[index]) {
                        const cyNode = appContext.networkManager.cy.getElementById(node.id);
                        cyNode.position(cx2Data.layout[index]);
                    }
                });
            }
            
            // Edge Bends設定を先に復元（スタイル適用前）
            if (cx2Data.edgeBendsSettings && appContext.edgeBends) {
                
                // Bend Strengthを復元
                appContext.edgeBends.currentBendStrength = cx2Data.edgeBendsSettings.bendStrength || 40;
                const slider = document.getElementById('bend-strength-slider');
                const valueInput = document.getElementById('bend-strength-value');
                if (slider) slider.value = appContext.edgeBends.currentBendStrength;
                if (valueInput) valueInput.value = appContext.edgeBends.currentBendStrength;
                
                // 各エッジの曲げ設定を復元
                if (cx2Data.edgeBendsSettings.edgeStyles) {
                    cx2Data.edgeBendsSettings.edgeStyles.forEach(edgeStyle => {
                        const edge = appContext.networkManager.cy.getElementById(edgeStyle.id);
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
            
            // スタイルを復元（Edge Bends復元後）
            if (cx2Data.styleSettings && appContext.stylePanel) {
                appContext.stylePanel.nodeStyles = cx2Data.styleSettings.nodeStyles || appContext.stylePanel.nodeStyles;
                appContext.stylePanel.edgeStyles = cx2Data.styleSettings.edgeStyles || appContext.stylePanel.edgeStyles;
                appContext.stylePanel.reapplyStyles();
            } else if (appContext.stylePanel) {
                // スタイル設定がない場合、デフォルトスタイルをUIに反映
                appContext.stylePanel.reapplyStyles();
            }
            
            // ファイトを適用
            appContext.networkManager.cy.fit();
            
            // Table Panelの全カラムを表示
            if (appContext.tablePanel) {
                appContext.tablePanel.resetToShowAllColumns();
            }
            
            // 現在のファイル情報を保存
            this.currentFilePath = file.name;
            this.currentFileHandle = fileHandle; // ファイルハンドルを保存
            
            // Saveメニューを有効化
            if (appContext.menuManager) {
                appContext.menuManager.updateMenuStates();
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
        if (!appContext.networkManager.hasNetwork()) {
            alert('No network to save.');
            return false;
        }
        
        try {
            // CX2フォーマットに変換
            const nodes = appContext.networkManager.cy.nodes().map(node => {
                const data = node.data();
                const { id, ...attributes } = data;
                return {
                    id: id,
                    v: attributes
                };
            });
            
            const edges = appContext.networkManager.cy.edges().map(edge => {
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
            const layout = appContext.networkManager.cy.nodes().map(node => node.position());
            
            // Edge Bends設定を保存
            const edgeBendsSettings = {
                bendStrength: appContext.edgeBends ? appContext.edgeBends.currentBendStrength : 40,
                edgeStyles: appContext.networkManager.cy.edges().map(edge => ({
                    id: edge.id(),
                    curveStyle: edge.style('curve-style'),
                    controlPointDistances: edge.style('control-point-distances'),
                    controlPointWeights: edge.style('control-point-weights')
                }))
            };
            
            // スタイル設定を保存
            const styleSettings = appContext.stylePanel ? {
                nodeStyles: appContext.stylePanel.nodeStyles,
                edgeStyles: appContext.stylePanel.edgeStyles
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
            if ('showSaveFilePicker' in window) {
                try {
                    let handle;
                    
                    // Save Asまたは保存先がない場合はダイアログを表示
                    if (useFileDialog || !this.currentFileHandle) {
                        // デフォルトファイル名を設定
                        const defaultName = filename || this.currentFilePath || 'network.cx2';
                        const suggestedName = defaultName.endsWith('.cx2') ? defaultName : defaultName + '.cx2';
                        
                        // ファイル保存ダイアログを表示
                        handle = await window.showSaveFilePicker({
                            suggestedName: suggestedName,
                            types: [{
                                description: 'CX2 Network File',
                                accept: { 'application/json': ['.cx2'] }
                            }]
                        });
                        
                        // ファイルハンドルを保存
                        this.currentFileHandle = handle;
                        this.currentFilePath = handle.name;
                    } else {
                        // 既存のファイルハンドルを使用（上書き）
                        handle = this.currentFileHandle;
                    }
                    
                    // ファイルに書き込み
                    const writable = await handle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                    
                    // Saveメニューを有効化
                    if (appContext.menuManager) {
                        appContext.menuManager.updateMenuStates();
                    }

                    this.restoreNetworkView();
                    return true;
                } catch (err) {
                    // ユーザーがキャンセルした場合など
                    if (err.name !== 'AbortError') {
                        console.error('Error using File System Access API:', err);
                        // フォールバックに続く
                    } else {
                        return false; // キャンセルされた
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
            if (appContext.menuManager) {
                appContext.menuManager.updateMenuStates();
            }

            this.restoreNetworkView();
            return true;
        } catch (error) {
            alert('Error saving CX2 file: ' + error.message);
            return false;
        }
    }

    /**
     * 保存後の表示を維持
     */
    restoreNetworkView() {
        if (!appContext.networkManager || !appContext.networkManager.cy) return;
        const cy = appContext.networkManager.cy;
        cy.style().update();
        cy.resize();
    }
}

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
        try {
            const text = await file.text();
            const rows = await this.parseCsvWithWorker(text, (progress) => {
                const percent = Math.min(99, Math.max(1, Math.round(progress * 100)));
                progressOverlay.update(`Parsing CSV... ${percent}%`);
            });

            if (rows.length < 2) {
                throw new Error('File must contain at least header row and one data row');
            }

            const headers = rows[0].map(h => String(h).trim());
            const data = rows.slice(1).map(row => {
                const obj = {};
                headers.forEach((header, index) => {
                    obj[header] = row[index] !== undefined ? String(row[index]) : '';
                });
                return obj;
            });

            return {
                columns: headers,
                data
            };
        } catch (error) {
            throw new Error('Failed to parse CSV file: ' + error.message);
        }
    }

    /**
     * Web WorkerでCSVを解析（対応環境のみ）
     * @param {string} text
     * @param {(progress: number) => void} onProgress
     * @returns {Promise<Array<Array<string>>>}
     */
    async parseCsvWithWorker(text, onProgress = null) {
        if (typeof Worker === 'undefined') {
            return this.parseCsvAsync(text, onProgress);
        }

        try {
            return await this.parseCsvInWorker(text, onProgress);
        } catch (error) {
            return this.parseCsvAsync(text, onProgress);
        }
    }

    /**
     * CSVをWorkerで解析
     * @param {string} text
     * @param {(progress: number) => void} onProgress
     * @returns {Promise<Array<Array<string>>>}
     */
    parseCsvInWorker(text, onProgress = null) {
        return new Promise((resolve, reject) => {
            const worker = new Worker(new URL('./CsvParserWorker.js', import.meta.url), { type: 'module' });

            const cleanup = () => {
                worker.removeEventListener('message', onMessage);
                worker.removeEventListener('error', onError);
                worker.terminate();
            };

            const onMessage = (event) => {
                const { type, value, rows, message } = event.data || {};
                if (type === 'progress' && onProgress) {
                    onProgress(value);
                    return;
                }

                if (type === 'result') {
                    cleanup();
                    resolve(rows || []);
                    return;
                }

                if (type === 'error') {
                    cleanup();
                    reject(new Error(message || 'CSV parse error'));
                }
            };

            const onError = (error) => {
                cleanup();
                reject(error);
            };

            worker.addEventListener('message', onMessage);
            worker.addEventListener('error', onError);
            worker.postMessage({ text });
        });
    }

    /**
     * CSVテキストを2次元配列に変換（非同期・チャンク処理）
     * @param {string} text
     * @param {(progress: number) => void} onProgress
     * @returns {Array<Array<string>>}
     */
    async parseCsvAsync(text, onProgress = null) {
        const rows = [];
        let currentRow = [];
        let currentValue = '';
        let inQuotes = false;
        const totalLength = text.length;
        const chunkSize = 100000;
        let nextProgressUpdate = chunkSize;

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

            if (i >= nextProgressUpdate) {
                if (onProgress) {
                    onProgress(i / totalLength);
                }
                await this.yieldToBrowser();
                nextProgressUpdate += chunkSize;
            }
        }

        currentRow.push(currentValue);
        if (currentRow.some(value => value !== '')) {
            rows.push(currentRow);
        }

        return rows;
    }

    /**
     * ブラウザに制御を返してUIの応答性を保つ
     */
    async yieldToBrowser() {
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    /**
     * 次の描画フレームまで待機
     */
    async waitForNextFrame() {
        await new Promise(resolve => requestAnimationFrame(() => resolve()));
    }

    /**
     * Network Fileのインポート処理を開始
     * @param {File} file 
     */
    async startNetworkImport(file) {
        this.importMode = 'network';
        progressOverlay.show('Parsing CSV...');
        
        try {
            // 既存ネットワークがあればクローズしてから読み込む
            if (appContext.networkManager.hasNetwork()) {
                appContext.networkManager.closeNetwork();
            }

            // 旧オーバーレイ（図形）が残っている可能性があるため、インポート開始時に必ずクリア
            if (appContext.layerManager) {
                console.debug('FileHandler.startNetworkImport: calling layerManager.clearAll()');
                appContext.layerManager.clearAll();
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
        progressOverlay.show('Parsing CSV...');
        
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
    async executeImport(mappings) {
        try {
            if (this.importMode === 'network') {
                progressOverlay.show('Adding elements...');
                const result = await appContext.networkManager.createNetwork(
                    this.currentData,
                    mappings,
                    (progress) => {
                        const percent = Math.min(99, Math.max(1, Math.round(progress * 100)));
                        progressOverlay.update(`Adding elements... ${percent}%`);
                    },
                    (phase) => {
                        if (phase === 'elements') {
                            progressOverlay.show('Adding elements...');
                        }
                    }
                );

                await this.waitForNextFrame();
                progressOverlay.show('Layout...');

                const elementCount = appContext.networkManager.cy.elements().length;
                const animateLayout = elementCount < 2000;

                await appContext.layoutManager.applyDagreLayout({
                    animate: animateLayout,
                    fit: true,
                    animationDuration: animateLayout ? 500 : 0
                });

                await this.waitForNextFrame();
                progressOverlay.show('Render...');
                appContext.networkManager.cy.resize();
                appContext.networkManager.cy.fit();
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
                progressOverlay.show('Adding elements...');
                const result = await appContext.networkManager.addTableData(
                    this.currentData,
                    mappings,
                    (progress) => {
                        const percent = Math.min(99, Math.max(1, Math.round(progress * 100)));
                        progressOverlay.update(`Adding elements... ${percent}%`);
                    },
                    (phase) => {
                        if (phase === 'elements') {
                            progressOverlay.show('Adding elements...');
                        }
                    }
                );

                await this.waitForNextFrame();
                progressOverlay.show('Render...');
                appContext.networkManager.cy.resize();
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
            
            // Cytoscapeデータに変換（読み込み時もDate型が混入している可能性があるためサニタイズ）
            const elements = {
                nodes: cx2Data.nodes.map(node => ({
                    data: Object.assign({ id: node.id }, this.sanitizeAttributes(node.v || {}))
                })),
                edges: cx2Data.edges.map(edge => ({
                    data: Object.assign({ id: edge.id, source: edge.s, target: edge.t }, this.sanitizeAttributes(edge.v || {}))
                }))
            };
            
            // ネットワークを作成（分割追加で応答性を維持）
            progressOverlay.show('Adding elements...');
            await appContext.networkManager.addElementsInBatches(
                [...elements.nodes, ...elements.edges],
                2000,
                (progress) => {
                    const percent = Math.min(99, Math.max(1, Math.round(progress * 100)));
                    progressOverlay.update(`Adding elements... ${percent}%`);
                }
            );

            await this.waitForNextFrame();
            progressOverlay.show('Render...');
            appContext.networkManager.cy.resize();
            
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
                if (cx2Data.styleSettings.networkStyles) {
                    appContext.stylePanel.networkStyles = cx2Data.styleSettings.networkStyles;
                }
                appContext.stylePanel.reapplyStyles();
            } else if (appContext.stylePanel) {
                // スタイル設定がない場合、デフォルトスタイルをUIに反映
                appContext.stylePanel.reapplyStyles();
            }
            
            // オーバーレイレイヤーを復元
            if (appContext.layerManager) {
                if (cx2Data.overlayLayers && Array.isArray(cx2Data.overlayLayers)) {
                    appContext.layerManager.importLayers(cx2Data.overlayLayers);
                } else {
                    appContext.layerManager.clearAll();
                }
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
                    v: this.sanitizeAttributes(attributes)
                };
            });
            
            const edges = appContext.networkManager.cy.edges().map(edge => {
                const data = edge.data();
                const { id, source, target, ...attributes } = data;
                return {
                    id: id,
                    s: source,
                    t: target,
                    v: this.sanitizeAttributes(attributes)
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
                edgeStyles: appContext.stylePanel.edgeStyles,
                networkStyles: appContext.stylePanel.networkStyles
            } : null;
            
            // オーバーレイレイヤーを保存
            const overlayLayers = appContext.layerManager ? 
                appContext.layerManager.exportLayers() : null;
            
            
            const cx2Data = {
                nodes: nodes,
                edges: edges,
                layout: layout,
                edgeBendsSettings: edgeBendsSettings,
                styleSettings: styleSettings,
                overlayLayers: overlayLayers
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

    /**
     * 属性オブジェクトを再帰的にサニタイズしてDate型を文字列に変換する
     * CX2フォーマットにDateオブジェクトが混入しないようにする
     */
    sanitizeAttributes(obj) {
        if (obj === null || obj === undefined) return obj;

        // 配列は要素ごとにサニタイズ
        if (Array.isArray(obj)) {
            return obj.map(item => this.sanitizeAttributes(item));
        }

        // プリミティブはそのまま返す（ただしDateは文字列化）
        if (typeof obj !== 'object') return obj;

        // DateオブジェクトはISO文字列に変換して返す
        if (obj instanceof Date) {
            return obj.toISOString();
        }

        // オブジェクトはキーごとに再帰処理
        const result = {};
        Object.keys(obj).forEach(key => {
            const v = obj[key];
            if (v instanceof Date) {
                result[key] = v.toISOString();
            } else if (Array.isArray(v)) {
                result[key] = v.map(item => this.sanitizeAttributes(item));
            } else if (v !== null && typeof v === 'object') {
                result[key] = this.sanitizeAttributes(v);
            } else {
                result[key] = v;
            }
        });
        return result;
    }
}

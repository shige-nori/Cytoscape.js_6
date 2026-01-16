# Network Visualizer 再作成プロンプト

以下の仕様に従って、現在の機能に不足している部分を追加してください。不明点があれば教えてください

---

## プロジェクト概要

**アプリケーション名**: Network Visualizer  
**目的**: Excelファイルからネットワークデータを読み込み、インタラクティブなグラフとして可視化するWebアプリケーション

---

## 技術スタック

- HTML5, CSS3, JavaScript (ES6+)
- Cytoscape.js 3.28.1（グラフ可視化）
- cytoscape-klay（階層型レイアウト）
- SheetJS (xlsx) 0.18.5（Excel読み込み）

---


## 機能要件

### 1. メニューバー

固定ヘッダーのメニューバーを作成してください：

- **File**
  - Import（サブメニュー）
    - Network File: ネットワークファイル（CSV/Excel）インポート
    - Table File: テーブルファイルインポート（既存ノードに属性追加）

- **Style**: スタイル設定パネルを開く

- **View**
  - Table Panel: データテーブルの表示/非表示（表示しているときはメニュー名の先頭にチェック印を表示）

- **Filter**: Coming soon（将来実装予定の表示のみ）

- **Layout**
  - Layout Tools: スケール・回転調整パネル
  - Edge Bends: エッジ曲げ強度調整パネル
  - Hierarchical（サブメニュー）
    - Defaults: Dagreレイアウト適用
    - Equal: 縦横比1:1で均等配置

---

### 2. ファイルインポート機能

#### Network File インポート
1. メニューからNetwork Fileを選択するとファイル選択ダイアログを開く
2. ファイル選択後、カラムマッピングモーダルを表示
3. モーダルでは各カラムに対して以下を設定：
   - **Role**: Source / Target / Attribute / None
   - **Data Type**: String / Number / Boolean / Date / String Array / Number Array / Date Array
   - **Delimiter**: Array型の区切り文字（デフォルト: `|`）
4. Importボタンでネットワークを作成し、Dagreレイアウトを適用

#### Table File インポート
1. 既存ネットワークが必要
2. Source（キー）カラムを指定して既存ノードにマッチ
3. 他のカラムを属性として既存ノードに追加

#### 対応ファイル形式
- CSV（UTF-8、カンマ区切り、ダブルクォート対応）
- Excel（.xlsx, .xls）


---

### 3. Style Panel（スタイル設定パネル）

Node/Edgeタブ切り替え式のパネル：

#### Nodeタブ
- Label Font Size
- Label Color
- Label Position
- Label Width
- Fill Color
- Shape（ellipse, rectangle, triangle等）
- Size
- Border Width
- Border Color
- Opacity


#### Edgeタブ
- Line Type（solid, dashed, dotted）
- Arrow Shape
- Width
- Line Color
- Opacity
- Curve Style（bezier, straight等）

#### マッピング機能
各プロパティに対して：
- **Individual**: 個別値ごとにスタイル指定
- **Continuous**: 数値範囲に基づくサイズ等のマッピング
- **Gradient**: 数値範囲に基づく色のグラデーション

---

### 4. Table Panel（データテーブルパネル）

画面下部に表示するリサイズ可能なパネル：

- Node Table / Edge Table のタブ切り替え
- グローバル検索
- カラムごとのフィルタ
- ソート（昇順/降順）
- テーブル⇔グラフの選択連動
- カラム表示/非表示設定
- ポップアウト（別ウィンドウ表示）
- パネル高さのリサイズ
- カラム幅のリサイズ

---

### 5. Layout Tools Panel

ドラッグ移動可能なフローティングパネル：

#### Scale（スケール）
- Width: 横方向のみスケール(数値を手入力可能)
- Height: 縦方向のみスケール(数値を手入力可能)  
- Selected Only: 選択ノードのみスケール(数値を手入力可能)
- 対数スライダー: 1/8 ～ 8倍

#### Rotate（回転）
- -180° ～ 180°のスライダー

Scale、Rotate共に動作が重くならないように考慮すること
(ネットワーク図の描画があとになってもいいのでスライダーの動きはスムーズにしたい)

---

### 6. Edge Bends Panel

- エッジの曲げ強度（control-point-step-size）調整
- 設定幅は0.1～20としスライド間隔は可能であれば0.1刻みでスライド
- 曲げ強度のデフォルトは2とする

---

### 8. Equalize レイアウト

- 縦横比1:1で各階層のノードを均等配置
- Y座標で階層を識別し、各階層内でノードを均等配置

---

## UI/UX要件

### カラースキーム
```css
--primary-color: #2563eb;
--secondary-color: #64748b;
--background-color: #f8fafc;
--menubar-bg: #1e293b;
--border-color: #e2e8f0;
--text-color: #1e293b;
```

### モーダルウィンドウ
- 背景オーバーレイ（半透明黒）
- 中央配置、アニメーション表示
- 背景クリックで閉じる

### プログレスオーバーレイ
- ファイル読み込み等の処理中に表示
- スピナーアニメーション
- 画面操作をブロック


## 参考添付

各機能やIFの実装状態はC:\Work\Cytoscape\03_Cytoscape.jsも参考にしてみてください


## その他
カラムマッピングモーダルでDelimiterはData TypeはString Arry、Number Arry、Date Arrayを選択したときのみに表示してください

各ステップごとに動作確認しながら進めてください。
特に各機能のID付けで相違がないように確認してください

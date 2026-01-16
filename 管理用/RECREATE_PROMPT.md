# Network Visualizer 再作成プロンプト

以下の仕様に従って、Cytoscape.jsベースのネットワーク可視化Webアプリケーションを作成してください。

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

## ファイル構成

```
project/
├── index.html
├── css/
│   └── style.css
└── js/
    ├── app.js             # メインアプリケーション
    ├── fileHandler.js     # ファイル読み込み・解析
    ├── networkManager.js  # Cytoscape.js管理
    ├── layoutTools.js     # レイアウトツール
    ├── stylePanel.js      # スタイル設定パネル
    └── tablePanel.js      # データテーブルパネル
```

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
  - Table Panel: データテーブルの表示/非表示

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

### 3. グラフ表示領域

- Cytoscape.jsを使用したインタラクティブなグラフ表示
- ズーム（マウスホイール）、パン（背景ドラッグ）対応
- ノードのドラッグ移動
- クリック/Ctrl+クリックによる選択
- ノードホバー時に上流/下流パスをピンク色でハイライト
  - 大規模ネットワーク（2000要素以上）では自動無効化

#### デフォルトスタイル
- ノード: 青色円形（#2563eb）、サイズ40px
- エッジ: グレー線（#94a3b8）、矢印付きbezierカーブ
- 選択時: オレンジ色に変化

---

### 4. Style Panel（スタイル設定パネル）

Node/Edgeタブ切り替え式のパネル：

#### Nodeタブ
- Label Font Size
- Label Color
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

### 5. Table Panel（データテーブルパネル）

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

### 6. Layout Tools Panel

ドラッグ移動可能なフローティングパネル：

#### Scale（スケール）
- Width: 横方向のみスケール
- Height: 縦方向のみスケール  
- Selected Only: 選択ノードのみスケール
- 対数スライダー: 1/8 ～ 8倍

#### Rotate（回転）
- -180° ～ 180°のスライダー

---

### 7. Edge Bends Panel

- エッジの曲げ強度（control-point-step-size）調整
- 同じノード間の複数エッジが重ならないように

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

---

## データ構造

### Network File（CSV例）
```csv
source,target,weight,type
A,B,10,normal
B,C,20,strong
C,A,5,weak
```

### Table File（CSV例）
```csv
id,label,category,value
A,Node A,Type1,100
B,Node B,Type2,200
```

### エクスポートJSON形式
```json
{
    "format_version": "1.0",
    "generated_by": "cytoscape-js-app",
    "elements": {
        "nodes": [{ "data": {...}, "position": {...} }],
        "edges": [{ "data": {...} }]
    },
    "appExtensions": {
        "styleSettings": {...},
        "edgeBendsSettings": {...}
    }
}
```

---

## 実装上の注意点

1. **モジュール構成**: 各機能を独立したクラスとして実装
2. **グローバルインスタンス**: networkManager, fileHandler等はグローバルアクセス可能に
3. **パフォーマンス**: 大規模データ時はcy.batch()でバッチ処理
4. **エラーハンドリング**: ファイル読み込み等でtry-catchを使用
5. **レスポンシブ**: ウィンドウリサイズに対応

---

## サンプルデータ

### network.csv
```csv
source,target,weight
Node1,Node2,10
Node2,Node3,20
Node3,Node4,15
Node4,Node1,8
Node2,Node4,12
```

### nodes.csv
```csv
id,label,category
Node1,First Node,TypeA
Node2,Second Node,TypeB
Node3,Third Node,TypeA
Node4,Fourth Node,TypeC
```

---

## 参考添付

この指示と一緒に `SPECIFICATION.md` ファイルを添付しています。詳細な仕様はそちらを参照してください。

---

## 作成手順

1. まずindex.htmlを作成し、外部ライブラリのCDN読み込みとHTML構造を定義
2. css/style.cssでスタイルを定義
3. js/fileHandler.jsでファイル読み込み機能を実装
4. js/networkManager.jsでCytoscape.js管理機能を実装
5. js/layoutTools.jsでレイアウトツールを実装
6. js/stylePanel.jsでスタイル設定パネルを実装
7. js/tablePanel.jsでデータテーブルパネルを実装
8. js/app.jsでメインアプリケーションを実装し、各モジュールを統合

各ステップごとに動作確認しながら進めてください。

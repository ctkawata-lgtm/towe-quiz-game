# Firebase 2人協力モード導入手順

## 1. Firebaseでプロジェクトを作る

1. https://console.firebase.google.com/ を開く
2. 「プロジェクトを追加」を押す
3. プロジェクト名を入れる
   - 例: `towe-quiz-coop`
4. Google Analytics は最初はオフでもOK
5. 作成完了まで待つ

## 2. Webアプリを追加する

1. Firebaseプロジェクトのトップで `</>` のWebアイコンを押す
2. アプリ名を入れる
   - 例: `towe-quiz-game`
3. 「Firebase Hostingも設定」はあとでもOK
4. 表示される `firebaseConfig` を控える

このような形です。

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

## 3. Authenticationを有効化する

1. 左メニューの「Authentication」
2. 「始める」
3. 「Sign-in method」
4. 「匿名」を有効化

最初は匿名ログインで十分です。

## 4. Firestore Databaseを作る

1. 左メニューの「Firestore Database」
2. 「データベースの作成」
3. 最初はテストモードで開始
4. ロケーションは近い場所を選ぶ

最終的にはルールを絞ります。

```text
rooms/{roomId}
  status
  teamFloors
  teamMistakes
  collapseCount
  players
    A
    B
  answers
```

## 5. Storageは使わない方針にする

無料プランではStorageを使えない場合があります。
そのため、最初はStorageを使わずに進めます。

方針:

```text
AはA用PDF/Excelを自分の端末で選ぶ
BはB用PDF/Excelを自分の端末で選ぶ
FirebaseにはPDF/Excel本体を保存しない
Firestoreには進行状況と回答結果だけ保存する
```

これならStorageなしで始められます。

## 6. 公開場所

選択肢は2つです。

### Firebase Hosting

Firebaseだけで完結します。

```text
Firebase Hosting: ゲーム画面
Firestore: 部屋状態
Local files: PDF/Excelは各プレイヤー端末で読み込む
Authentication: 匿名参加
```

### Netlify + Firebase

公開はNetlify、同期はFirebaseにします。

```text
Netlify: ゲーム画面
Firebase: 部屋・同期・PDF保存
```

操作が楽なのはNetlify、まとまりがいいのはFirebase Hostingです。

## 7. 今回の協力ゲーム仕様

各プレイヤーが読み込むもの:

```text
A端末: A用PDF + A用Excel
B端末: B用PDF + B用Excel
```

ゲーム進行:

```text
A/Bは別々の問題順で進む
各自、自分の問題PDFと解答・解説PDFを見る
採点後は解説PDFを見る時間を取る
次へボタンで進む
```

倒壊条件:

```text
2人の通算ミス 10個
どちらかの連続ミス 4回
どちらかの通算ミス 7回
```

救済:

```text
どちらかが8連続正解したら、全ミススタックを0にする
発動者の連続正解も0に戻す
```

クリア:

```text
2人の通算70階
または
どちらかが45階到達
```

倒壊後:

```text
原因を表示
自動復活
A/Bとも階層を0に戻す
ミススタックも0
ペナルティなし
```

## 8. 今の実装状態

現時点では、`2人協力モード` はローカル試作として動きます。

```text
ホストがA/BのPDFとExcelを選ぶ
A/BそれぞれのPDFを画面に表示
Excelを元に自動採点
採点後に解答・解説PDFを表示
倒壊/復活/救済/クリア判定
```

Firebase接続は次の段階です。

```text
1. firebaseConfigを入れる
2. 匿名ログイン
3. roomId作成
4. 各端末で自分用PDF/Excelを読み込む
5. FirestoreへA/Bの進行状況を保存
6. onSnapshotで相手の状態をリアルタイム反映
```

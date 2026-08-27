# CHROMA TWEEN

[Repository: [tomosud/distant_morph](https://github.com/tomosud/distant_morph)](https://tomosud.github.io/distant_morph/)

黒背景上のくっきりしたRGB色領域を、複数のキー画像間で補間する静的Webアプリです。画像はファイル名順に並び、各区間へ指定枚数の中割を生成してPNG連番のZIPとして保存します。処理はブラウザ内で完結し、画像をサーバーへ送信しません。

## 使い方

1. `index.html` をGitHub Pagesで公開するか、`run.bat` でローカルサーバーを起動します。
2. 同じ解像度のPNG / PSD / JPG / WEBPを2枚以上ドロップします。
3. 区間ごとの中割枚数、輪郭精度、補間カーブを設定します。
4. 出力解像度をOriginal / 長辺1024 / 512 / 256pxから選択します。縦横比は維持されます。
5. 「中割を生成」で確認し、「ZIPをダウンロード」で通常連番PNGとRGB Distance Field連番を保存します。

出力総数は `(キー画像数 - 1) × (中割枚数 + 1) + 1` です。各色は先頭画像で検出したRGB値を維持します。入力は各色につき連結した単一領域であることを前提とします。

ZIP直下には従来のカラー連番、`distance_field/` にはRGB各チャンネルへ対応領域の符号付きDistance Fieldを格納した連番が入ります。輪郭値は0.5、内側は0.5〜1.0、外側は0.5〜0.0です。シェーダーで `step(0.5, channel)` を適用すると元の二値チャンネル形状を復元できます。距離幅は画像長辺の25%で、輪郭から内外へ対称に正規化します。

## GitHub Pages

リポジトリの Settings → Pages で、デプロイ元をブランチのルートに設定してください。ビルド工程やサーバー処理はありません。

## 外部ライブラリ

- [PSD.js](https://github.com/meltingice/psd.js/) 3.4.0 — MIT License（PSDの合成画像読み込み）
- [JSZip](https://github.com/Stuk/jszip/) 3.10.1 — MIT / GPLv3 dual license（MITとして利用、ZIP生成）
- Google Fonts — SIL Open Font Licenseのフォントを利用

ライブラリ本体は固定バージョンをリポジトリへ同梱しています。フォントが取得できない環境ではシステムフォントへフォールバックし、画像処理・PSD読み込み・ZIP出力はオフラインでも動作します。

## License

MIT License. 詳細は [LICENSE](LICENSE) を参照してください。

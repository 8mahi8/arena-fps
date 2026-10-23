# RESEARCH HUNTER｜ハンター側設計の根本見直し（捕獲方法・追跡バランス・情報収集）

- 作成日: 2026-10-24
- 担当: 調査担当（読み取り・メモのみ。コード実装は含まない）
- 前提（ユーザー決定）: 基本思想は「侵入者は見つかったら基本終わり」。侵入者にダッシュはなく、歩行・しゃがみ・ライトのみでハンターより遅い。逃走手段は「視線を切る」「ロッカー」「煙幕」のみ。したがって捕獲は決定的でよいが、理不尽ではなく「捕まえた感・追い詰めた感」がある方法を探す。現行案は「1.4m以内で自動ゲージ0.45秒」。
- 表記ルール: 各項目を「事実/出典（URL付き）」「設計への示唆」「未確認」に分ける。数値は出典間で食い違う場合がある（パッチで変遷するため）。その場合は幅を持たせて書き、厳密値は未確認節に分離した。

---

## 結論要約

1. **「即捕獲」そのものは悪くない。理不尽感の出どころは別にある。** Friday the 13th で批判されたのは即死級のグラブ自体よりも、「Shift（高速接近）でいきなり目の前に現れて即グラブ」という**接近過程の不可視性・回避不能性**だった（レビューで "cheap" "don't feel earned" と明記）。逆に同じ即グラブでも、追跡の過程が見えていれば「理不尽に感じにくい」という評価もある。**捕獲の瞬間より、その前の「追い詰め過程の可視化」が公平感を決める。**
2. **決定的捕獲を成立させている作品は、必ず別の場所にコストを置いている。** DbD は攻撃成功/失敗でクールダウンを分け（成功約3秒・失敗1.5秒、その間減速）、Identity V は命中後の硬直が2.6〜4.5秒と長い。Prop Hunt は「調べる行為そのもの」に誤射コスト（体力-5/発）を課す。**捕獲を軽くするなら、接近・失敗・確認のどこかに重さを移す**のが共通構造。
3. **「獲物より速い追跡者」の相場は速度比 +10〜15%。** DbD はキラー4.6m/s対サバイバー4.0m/s（+15%）、遅いキラーは4.4m/s（+10%）で代わりに警告半径が小さい（24m対32m）。速度差を警告量とトレードする設計が定番。また長時間チェイスへの対策として、追跡が続くほどキラーが段階的に加速する Bloodlust がある（＝「逃げ切れないが、すぐには捕まらない」の保証装置）。
4. **視線を当て続ける方式（ストーク/凝視）は実績が厚い。** DbD の The Shape（見つめると溜まる→一定時間一撃ダウン）と Ghost Face（マーク→45〜60秒間一撃ダウン可能、ただし獲物に見つめ返されると解除）は、「視界の維持そのものを攻撃」にした例。**近づかなくても詰められる**ため、近接ゲージ一本よりも「追い詰めた感」の演出幅が大きい。本作の「赤ライトを当て続ける」とテーマ的にも一致する。
5. **ハンターの情報は「方向だけ・古くなる・使うとバレる」の3点セットが定番。** Evolve の Planet Scanner はクールダウン30秒で「方角だけ」を全員に示し、近距離でのみ輪郭を表示。Alien: Isolation のモーショントラッカーは使うと音でエイリアンにバレる。DbD の痕跡（スクラッチマーク）は走行時のみ残り10秒で消え、カラスは「環境が勝手に漏らす情報」として機能する。**正確な位置を常時出す方式は、1vs1ではほぼ採られていない。**
6. **ハンターに「やること」を作る王道は、巡回に意味を持たせる痕跡確認＋少数センサーの管理。** Trapper の罠は設置2.5秒の機会費用と「見に行く」動線を作るが、1vs1・短時間では拘束罠は強すぎ＆テンポが落ちる。MGH（Midnight Ghost Hunt）のEMFレーダーや Evolve の音響スパイクのように、**「置く/使う→粗い情報が返る」センサー型**の方が本作の規模に合う。

---

## ハンター方式のおすすめ案（2〜3案）

### 案1（本命）：二段構え ―「注視（ストーク）で圧力を溜め、近接ゲージで確定」
- **仕組み**: 侵入者を視界に入れ続けると「注視ゲージ」が溜まる（参考: Ghost Face のマーク、The Shape の Evil Within）。ゲージは段階表示され、侵入者側にもビネットの段階変化で「見られている」ことが伝わる。注視が満タンになるとハンターは「確定モード」になり、速度が僅かに上がる/近接捕獲ゲージ（現行案の1.4m・0.45秒）が大幅に短縮（例0.15秒）される。視線を5秒切るとリセット（既存の再ステルス仕様と統合できる）。
- **長所**: 「追い詰めた感」をゲージとして両者に見せられる。接近戦一辺倒にならず、ハンターに「視線を維持する」という技術と仕事が生まれる。捕獲自体は従来案の延長で実装コストが小さい。病院の赤ライト（当て続ける=注視）と演出が一致する。
- **短所**: 遠距離から安全に溜める「覗きゲー」化の恐れ → 距離で蓄積レートを変える（近いほど速い、上限距離あり）対策が必須。状態が1つ増えるので、初心者への説明コストがやや上がる。

### 案2：突進（タックル/ラッシュ）で詰める ―「当たれば即捕獲、外せば大きな隙」
- **仕組み**: ハンターにクールダウン制（例12〜15秒）の短い突進を持たせる。当たれば即捕獲。外す/壁に当たると1.0〜1.5秒の硬直（参考: DbD Cannibal のチェーンソーは障害物に当たるとスタン+暴れ状態、Legion の Frenzy は空振りで終了+約2.5〜3秒の疲労）。通常の歩行接触でも即捕獲は維持するが、歩行速度差だけでは詰め切れない場面を突進が担う。
- **長所**: 「捕まえた感」が最も強い。タッチ操作でもボタン1つで完結し、視点操作との競合が少ない（発動は一瞬）。失敗コストが明確で理不尽感が出にくい。
- **短所**: 突進の当たり判定・壁衝突・クールダウン管理など実装量が3案中最大。マップの直線距離によって強さが大きく変わるため、病院マップの廊下設計とセットで調整が要る。

### 案3：環境センサー管理型 ―「罠ではなく"耳"を置くハンター」
- **仕組み**: 捕獲は現行案（1.4m・0.45秒自動ゲージ）をそのまま採用。代わりにハンターの個性を情報側に寄せ、試合中に2個まで置けるセンサー（端末周辺や通路に設置、設置約1.5秒）を持たせる。侵入者がセンサーの範囲（例8m）を歩行以上で通過すると、ハンターに「方向だけ」の通知（参考: Evolve の Sound Spike / Planet Scanner、DbD ハグの罠はテレポート付きだが本案は通知のみ）。しゃがんで通過すれば回避可能（参考: ハグの罠はしゃがみで回避）。
- **長所**: ハンターの「待ち時間」が「配置と読み」の時間に変わる。1vs1でも情報の非対称が保てる（正確な位置は出ない）。捕獲方式を変えないので既存バランスへの影響が最小。
- **短所**: 捕獲そのものの「捕まえた感」は現行案のままなので、捕獲体験の改善としては間接的。センサーのUI/設置操作がタッチで増える。

**併用を推奨する共通部品（どの案でも）**: ①痕跡は「歩行以上でのみ残る・約6〜10秒で消える」（DbD式）、②近接の警告は段階化（近づくほど強いビネット/脈動。心音の代替として既存ビネットを活用）、③ハンターの近接センサーは回数制パルスではなく「常時・方向なし・近距離のみ」の弱い気配表示に留める（Whispers の方向なし設計が参考）。

---

## 1. 捕獲/キルの方法の類型と比較

### 1.1 事実/出典

**（a）接触即成立（グラブ/タグ型）**
- Friday the 13th: ジェイソンのグラブは掴めば即キル級で、対抗策は使い切りのポケットナイフ（掴まれても1回だけ脱出）のみ。レビューでは、高速移動「Shift」で目の前に出現して即グラブする殺し方が "These kills using Shift just don't feel earned... it just feels cheap" と批判された。一方で同作は「序盤のジェイソンは弱く、Shift 解放は約2分後」という段階的強化があり、理不尽感の緩和に使われている。
  - https://stevivor.com/reviews/friday-the-13th-the-game-review/
  - https://gamecritics.com/daniel-weissenberger/friday-the-13th-the-game-review/
- Identity V: ハンターはロッカーを開けることができ、中にサバイバーがいれば即ダウン＋そのまま運搬。ロッカー入りは約2秒のモーションがあり、足跡（Trail）がロッカーへ続くため「痕跡→確認→即捕獲」の連鎖になっている。
  - https://identityv.fandom.com/wiki/Beginner%27s_Guide
  - https://id5.fandom.com/wiki/Hunter

**（b）近接攻撃ボタン型（DbD / Identity V）**
- DbD: タップ=通常攻撃、長押し=ランジ（突進攻撃。前進速度がそのままランジ距離に影響）。成功時のクールダウン約3秒（武器拭き2.7秒とする資料あり）、失敗（空振り・障害物ヒット）は1.5秒。クールダウン中はキラーの移動速度が大きく落ちる。キル自体は攻撃では完結せず「2ヒット→運搬→フック（段階タイマー）」と多段構え。
  - https://eip.gg/dbd/guides/killer-weapons-powers/
  - https://steamcommunity.com/sharedfiles/filedetails/?id=3147913412
- Identity V: 2ヒットでダウン（ただし端末操作中・窓越え中などを当てると「恐怖の一撃」で1ヒット）。攻撃の発生0.25〜0.82秒、射程2.70〜3.54m、空振り硬直0.39〜1.10秒、命中硬直2.58〜4.47秒と、**命中後の硬直が非常に長い**（＝当てた側が次の行動まで時間を払う）。ダウン後は風船で運び、ロケットチェアのカウントダウン（60秒）で退場。
  - https://id5.fandom.com/wiki/Hunter/Statistics
  - https://id5.fandom.com/wiki/Hunter

**（c）タックル/ラッシュ（突進・チャージ型）**
- DbD Cannibal（レザーフェイス）: チェーンソーを構えて前進し、**衝突したサバイバーは即ダウン**。ただし障害物に当たるとスタンし、その後しばらく制御の効かない暴れ状態になる（＝外しコストが大きい）。
  - https://steamcommunity.com/sharedfiles/filedetails/?l=polish&id=1131643558&searchtext=I
- DbD Legion: パワーゲージ満タンで約10〜11秒の Frenzy（移動5.2m/s）に入るが、**空振りすると即終了し約2.5〜3秒の疲労（移動2.3m/s）**に入る。再使用はゲージ再充填（約15〜20秒）待ち。
  - https://dead-by-daylight-the-blank-slate.fandom.com/wiki/The_Legion
  - https://timesaver.gg/blog/dbd-legion-guide-feral-frenzy-perks-counters

**（d）視線を当て続ける型（ストーク/凝視）**
- DbD The Shape（マイケル・マイヤーズ）: サバイバーを見つめ続けると Evil が溜まり段階上昇。Tier1 は速度105%・警告半径6mと弱い代わりに気づかれにくく、Tier3（約60秒）は一撃ダウン。1人の獲物から吸える量には上限がある（同じ獲物の覗き続けで無限強化はできない）。
  - https://dbdguides.com/killers/the-shape/
  - https://steamcommunity.com/app/381210/discussions/0/1480982971180379707/
- DbD Ghost Face: ステルス状態で獲物を覗くとマークが溜まり（身を乗り出すリーンで約2倍速）、満タンで「暴露」状態（45〜60秒間、一撃ダウン対象）になる。ただし**獲物側が約1.5〜2秒見つめ返すとステルスが剥がれ**、見つめた側の位置が2秒間ハンターに見える（＝凝視には双方向のリスクがある）。
  - https://www.thegamer.com/dead-daylight-best-tips-ghost-face/
  - https://playerassist.com/dead-by-daylight-ghost-face/
  - https://gamerant.com/dead-by-daylight-every-status-effect-explained/

**（e）罠・トラップ設置型**
- DbD Trapper: 罠を2個携行（マップ内にさらに約6個）、設置に約2.5秒。自分の罠の位置は常時オーラで見える。サバイバーは罠を解除でき（約3.5秒）、ハンター自身も自分の罠に掛かりうる。追跡手段を持たないため「罠の置き場所の読み」が本体。
  - https://gamevoyagers.com/ultimate-guide-to-the-trapper-in-dead-by-daylight/
  - https://steamcommunity.com/sharedfiles/filedetails/?id=718026429
- DbD Hag: 罠の設置は約2秒（屈む0.5＋描く1.0＋立つ0.5）。獲物が踏むと幻影が出現してハンターに通知され、範囲内なら罠へテレポートできる。**しゃがんで通過すると発動しない**（回避行動が組み込まれている）。
  - https://steamcommunity.com/sharedfiles/filedetails/?l=italian&id=1926104111&searchtext=hatch
  - https://steamcommunity.com/sharedfiles/filedetails/?id=821675071&l=thai
- DbD The Artist: カラス像を置き、通過した獲物にカラスの群れが付くと位置がリアルタイムで見え続け、払いのけた後も約2.5秒は残る（「タグ付け＋残り香」型の通知）。
  - https://www.destructoid.com/how-to-swarm-survivors-as-the-artist-in-dead-by-daylight/

**（f）射撃/投擲で「調べる」型（プロップハント系）**
- Witch It: ハンターはジャガイモを投げて物陰を叩いて調べる。ニワトリ（近づくと魔女に寄っていく探知役）や範囲攻撃ボディスラム、移動用グラップリングフックを持つ。「当てる」より「怪しい場所を検証する」行為が中心。
  - https://www.zedgamesau.net/reviews-2/witch-it-review
  - https://www.highgroundgaming.com/witch-it-review/
- GMod Prop Hunt: ハンターがプレイヤーでない物を撃つと**自分の体力が5ずつ減る**（SMGは1発ごと）。体力100なので無差別な検証は自殺行為。「接触して調べる（Eキー/体当たり）」は無料で、「撃って調べる」にはコストが付く二層構造。
  - https://arweth.com/garrys-mod/prop-hunt/
  - https://steamcommunity.com/sharedfiles/filedetails/?l=vietnamese&id=478568360

### 1.2 設計への示唆
- 理不尽感は「即成立」ではなく「**過程が見えないまま終わる**」ことから生まれる（F13 の Shift グラブ批判が典型）。本作はテレポート型接近がないので、接触即捕獲でも土台は公平。ただし赤ライト常時点灯＝ハンター接近が常時見えている現行仕様は、この点で有利に働いている。
- 決定的な捕獲を持つ作品は、**失敗コスト（空振り/外し硬直）**か**成功コスト（命中硬直・後処理）**のどちらかを必ず持つ。本作が「ゲージ0.45秒＋逃げられたらよろけ0.8秒」という現行/前案の形を持つのは、この系譜に沿っている。
- 視線型（d）は「近づく」以外の詰め方を増やし、ハンターの仕事（視線維持）と侵入者の対抗（視線切り）をそのままゲームの中心にできる。本作の前提（逃走＝視線切り）と最も相性が良い。
- 罠型（e）は設置時間という機会費用と「確認しに行く」動線が本体。1vs1・約3分では、拘束罠より「通知センサー」の方がテンポを壊さない（案3参照）。

### 1.3 未確認
- Ghost Face のマーク所要時間は資料間で幅がある（リーン約2.5秒/通常約5秒とするプレイヤー検証と、それより長いとするガイド記事）。正確な現行値は未確認。
- F13 の Shift グラブについて、コミュニティ側の評価（フォーラム）とレビュー側の評価で温度差があり、「即グラブ自体が理不尽」という断定はできない。批判の中心が「接近の不可視性」にある、という整理はレビュー2件の記述に基づく。

---

## 2. 「獲物より速いが視界が狭い」追跡側のバランス調整

### 2.1 事実/出典
- **速度の絶対相場**: DbD はサバイバー4.0m/s、キラーは4.6m/s（115%）が標準、遅いキラーは4.4m/s（110%）。Identity V も2ヒット制＋長い命中硬直で「速度以外の場所」で追跡を成立させている。
  - https://steamcommunity.com/sharedfiles/filedetails/?id=3147913412
  - https://eip.gg/dbd/guides/killer-weapons-powers/
- **速度と警告量のトレード**: DbD のテラーレディウス（心音圏）は速度と連動し、4.6m/s級は32m、4.4m/s級は24m。The Shape の Tier1 は速度105%まで落ちる代わりに警告半径6m。「速い＝早く気づかれる、遅い＝静かに近づける」という交換が公式の調整軸になっている。
  - https://deadbydaylight.fandom.com/wiki/Terror_Radius?file=TerrorRadius_Ghost_Face.ogg
  - https://dbdguides.com/killers/the-shape/
- **心音（接近警告）**: テラーレディウス内では獲物の心音が鳴り、近づくほど速く・大きくなる。方向は分からない「近さだけ」の情報として設計されている。DbD には公式に視覚版テラーレディウス表示（アクセシビリティ機能）があり、音の警告を画面表示に置き換える前例がある。
  - https://deadbydaylight.fandom.com/wiki/Terror_Radius?file=TerrorRadius_Ghost_Face.ogg
  - https://gamingaccessibility.org/what-dead-by-daylights-visual-terror-radius-shows-and-what-it-leaves-as-audio/
- **長時間チェイスの自動決着（Bloodlust）**: DbD ではチェイスが長引くとキラーが段階的に加速する（現行系の資料では15秒ごとの段階で+0.2m/sずつ、上限3段階という記載。旧資料では12秒/+0.4m/s）。攻撃・パレット破壊・見失いでリセット/減衰する。「逃げ続けるだけでは決着しないが、即死もしない」ための時間圧力。
  - https://en.namu.wiki/w/DEAD%20BY%20DAYLIGHT/%EC%83%81%ED%83%9C%ED%9A%A8%EA%B3%BC%20%EB%B0%8F%20%EC%88%99%EB%A0%A8%EB%8F%84%20%EC%A7%80%ED%91%9C
  - https://steamcommunity.com/app/381210/discussions/0/135513534851783083/?l=turkish
- **スタミナ/ゲージ制の突進**: Legion の Frenzy は「満タンのゲージを消費して約10〜11秒だけ速くなる＋終了時に疲労」という形で、速さを常時ではなく窓（ウィンドウ）として配っている（1.1（c）参照）。
  - https://dead-by-daylight-the-blank-slate.fandom.com/wiki/The_Legion
- **追う側の視界制限**: DbD キラーは一人称視点のみで、背後・死角は完全に見えない（PlayStation 公式tipsでも「first-person view only」が弱点として明記）。Evolve では逆にモンスター側がハンターより速く、ハンターは足跡の「追従」ではなく「先回り」で捕まえる設計（足跡をそのまま辿っても追いつけない、というガイドの明記がある）。
  - https://blog.playstation.com/archive/2018/08/10/survive-ps-plus-headliner-dead-by-daylight-as-hunter-or-hunted-with-these-top-tips
  - https://steamcommunity.com/sharedfiles/filedetails/?id=336118766

### 2.2 設計への示唆
- 本作の現行速度（ハンター5.2対侵入者4.7＝約+11%）は、DbD の「遅いキラー帯（+10%）」に相当し、相場の範囲内。速度を上げるなら、警告（赤ライトの視認範囲・ビネット発動距離）を同時に強めるのが定番の釣り合い方。
- ダッシュを侵入者から外した分、長時間の直線逃げが「ただ遅れて捕まるだけ」になりやすい。Bloodlust 型の「チェイス継続でハンター微加速」か、案1の注視ゲージのような「時間で詰まる」仕組みが、無限逃げの防止と「追い詰めた感」の両方に効く。
- 心音の代替は本作では既にビネット（12m）が担っている。DbD の公式視覚テラーレディウスと同じ発想で、距離で段階（弱→強→点滅）を付けるのが自然な拡張。

### 2.3 未確認
- Bloodlust の現行の正確な段階時間・加算値は資料間で食い違い（12秒/+0.4 と 15秒/+0.2 の併記）。概念のみ採用し、数値は自作側で決めるべき。
- キラーの旋回性能（ターン速度）に意図的な上限があるかは、今回の資料では確認できなかった。ランジ/チェーンソー中の旋回が鈍る、という個別例のみ。

---

## 3. ハンターの情報収集手段の実例

### 3.1 事実/出典
- **痕跡（スクラッチマーク）**: DbD では走行中のサバイバーだけが痕跡を残し、**持続10秒**（1秒で最大輝度、8秒維持、1秒で消散）。歩行・しゃがみでは残らない。キラーだけに見える。Identity V でも疾走時の Trail が追跡の基本情報。
  - https://deadbydaylight.fandom.com/wiki/Scratch_Marks
  - https://www.gamepur.com/guides/how-scratch-marks-work-in-dead-by-daylight-and-how-to-hide-them
  - https://identityv.fandom.com/wiki/Beginner%27s_Guide
- **近接センサー（方向なし）**: DbD のパーク Whispers は、獲物が一定距離（旧48/40/32m、現行リワークで28/26/24m）以内にいると断続的に囁きが聞こえるだけの「いる/いない」センサー。方向も正確な距離も出ない。リワークでは範囲外で+5%加速が付き、「探す時間」自体に価値を持たせている。
  - https://nightlight.gg/perks/Whispers
  - https://forums.bhvr.com/dead-by-daylight/kb/articles/560-10-2-0-mid-chapter
- **パルス/スキャン（方向のみ・回数/クールダウン制）**: Evolve の Planet Scanner はクールダウン30秒。使用すると全ハンターのコンパスにモンスターの**方角だけ**が表示され、約100m以内でのみ壁越しの輪郭が一瞬見える。獲物側にも「TRACKED BY PLANET SCANNER」の警告が出る（使ったことが相手に伝わる）。
  - https://steamcommunity.com/sharedfiles/filedetails/?id=791372628
  - https://allthings.how/fusion-plant-returns-to-evolve-stage-2-through-the-modded-evolve-project/
- **常設センサーネット**: Evolve の Griffin は音響スパイクを5本まで設置でき、範囲をモンスターが通過すると検知する「面」のセンサー網を作る。Maggie の Daisy（NPC犬）は足跡を嗅いで自動で先回り追跡する。
  - http://guides.gamepressure.com/evolve/trapper/ze73b2
  - https://archive.nerdist.com/evolve-e3-preview-a-release-date-and-4-new-badass-monster-hunters/
- **レーダー（距離で強さが変わる）**: Midnight Ghost Hunt の EMF レーダーはゴーストに近づくほどメーターが上がる方式で、方向特定はプレイヤーの移動に委ねられる。検知ツール（Radar / Spectrophone / Pathfinder）と拘束用の Trap、残骸回収の Vacuum など、ハンターの仕事が道具ごとに分かれている。
  - https://www.thesixthaxis.com/2022/04/13/midnight-ghost-hunt-early-access-review/?cmpscreen
  - https://steamcommunity.com/sharedfiles/filedetails/?id=3522195672
  - https://worthplaying.com/article/2022/1/4/news/130096-midnight-ghost-hunt-supports-nvidia-dlss-reflex-new-beta-coming-this-month-trailer/
- **音そのものがセンサー（音の可視化含む）**: In Silence の Rake はほぼ盲目で、**視界の鮮明さが獲物の立てる音量に比例**する。遠距離の微かな音まで聞こえる代わりに、静止・無音の獲物はほぼ見えない。テレビやラジオの音はおとりにも罠にもなる。Fortnite の「サウンドエフェクトの視覚化」は足音などを方向付きアイコンで画面表示する（白=足音系）公式機能で、音情報の視覚置換の代表例。
  - https://store.steampowered.com/app/1361000/In_Silence/?snr=1_1056_lists_1056_1057&curator_clanid=42303478
  - https://www.dotesports.com/fortnite/news/how-to-turn-on-visual-sound-effects-on-fortnite
  - https://ggrecon.com/guides/how-to-turn-on-visual-sound-effects-on-fortnite/
- **使うとバレるセンサー**: Alien: Isolation のモーショントラッカーは距離と方向を示すが、**ビープ音が近距離のエイリアンに聞こえる**。ロッカーの中で使うと見つかるリスクがある。「情報ツール自体にリスクを付け、使う/使わないの判断を作る」設計。
  - https://www.stuff.tv/review/alien-isolation-review/
  - https://warpzoned.com/2015/01/alien-isolation-review-a-beautiful-beautiful-butterfly/
- **環境ギミック（カラス）**: DbD のマップ常駐カラスは、走って近づいた獲物に驚いて飛び立ち、ハンターはその音・動きで「誰か通った」を知る。パーク Spies from the Shadows は範囲（現行36〜40m級）内のカラス驚きを通知化し、クールダウン3〜5秒。さらに長時間何もしない獲物の頭上には「AFKカラス」が集まり、3羽でハンターに通知される（＝長居そのものを罰する環境圧力）。
  - https://nightlight.gg/perks/Spies_from_the_Shadows
  - https://www.fandomspot.com/dbd-how-to-get-rid-of-crows/
  - https://steamcommunity.com/app/381210/discussions/0/594026463740560635
- **環境ギミック（AIの学習と居場所の推定）**: Alien: Isolation のエイリアンは二層AI（大域の「監督」が大まかな居場所をエイリアンに渡し、エイリアン本体は感覚で探す）で、プレイヤーが同じ手口（ロッカー常駐など）を繰り返すと学習して見回るようになる、と開発者解説・検証記事で語られている。
  - https://kotaku.com/how-the-alien-in-alien-isolation-works-1585594283
  - https://automaton-media.com/en/reviews/why-alien-isolation-xenomorph-is-far-scarier-when-you-cant-see-it/

### 3.2 設計への示唆
- 情報の出し方は3段階が相場: **痕跡（過去・自発的）→ センサー（現在・粗い）→ パルス（現在・正確だがコスト付き）**。本作は既に「遅延ピン通知＋痕跡（ダッシュ痕跡6秒）」を持つが、ダッシュ廃止に伴い痕跡の発生源を「歩行以上の移動」に広げ、持続を DbD 相場（10秒）に寄せるのが自然。
- 病院テーマでのカラス代替として、**廊下の人感センサーライト**（通過すると点灯し、しばらく残る）が環境通知として成立する。「誰かが通った部屋が分かるが、誰かは分からない」カラスと同じ情報粒度で、テーマにも合う。
- パルスを入れるなら回数制（例2回）＋使用を侵入者にも通知（Evolve/Alien 式）が、1vs1での情報バランスの定番形。本作の既存パルス案（10m以内・方角のみ・2回）はこの系譜に沿っている。
- In Silence 型の「音＝視界」は極端な例だが、本作が無音前提（学校・音なしプレイ）である以上、音情報はすべて視覚に翻訳する必要がある（Fortnite 式の方向アイコン化が実務解）。

### 3.3 未確認
- AFKカラスの正確な発生条件（静止60秒/目的行動なし120秒というプレイヤー報告と、30/60/75秒で消えるという別資料があり、現行仕様の確定値は未確認）。
- Evolve の Planet Scanner の輪郭表示の正確な持続秒数は今回の資料で確認できなかった（「数秒」という記述のみ）。
- Alien: Isolation の学習AIの内部仕様は開発者発言ベースの二次資料が中心で、厳密なアルゴリズムは未公開。

---

## 4. ハンター側の「やることがある」設計

### 4.1 事実/出典
- **罠の管理という仕事**: Trapper は「設置（2.5秒）→オーラで位置を常時把握→掛かったら回収/再設置」の管理ループが仕事そのもの。ただし追跡能力がない分、序盤の設置時間がそのまま不利になるという評価も定番で、「設置の機会費用」が弱点として設計に組み込まれている。
  - https://gamevoyagers.com/ultimate-guide-to-the-trapper-in-dead-by-daylight/
- **痕跡を読む巡回**: DbD ハンターの基本動線は「発電機巡回→痕跡/カラス/音で方向を掴む→チェイス」。発電機という「獲物が必ず触る目標物」が巡回に意味を与えている。Evolve でも「足跡は辿るものではなく、先回りの材料」という位置づけがガイドで明示されている。
  - https://steamcommunity.com/sharedfiles/filedetails/?id=336118766
- **道具の持ち替えと残骸処理**: Midnight Ghost Hunt では、ハンターはレーダーで探し、罠で捕え、Vacuum で倒したゴーストの残骸を回収しないと復活される、と役割が時間軸で連鎖する。ゴースト側も開始前に罠を仕掛ける準備時間があり、双方に「戦闘以外の仕事」がある。
  - https://www.thesixthaxis.com/2022/04/13/midnight-ghost-hunt-early-access-review/?cmpscreen
  - https://steamcommunity.com/sharedfiles/filedetails/?id=3522195672
- **調べる行為の反復**: Witch It / Prop Hunt 系のハンターの主作業は「怪しい場所を1つずつ検証する」こと。検証にはコスト（Prop Hunt の体力、Witch It の時間）があり、コストがあるからこそ「どこを調べるか」の判断がゲームになる。
  - https://arweth.com/garrys-mod/prop-hunt/
  - https://www.zedgamesau.net/reviews-2/witch-it-review
- **ストークという能動的な準備**: Ghost Face / The Shape のハンターは、捕獲の前段に「見つからずに見つめる」という能動スキルプレイがあり、待ち時間がそのまま攻撃準備になる。
  - https://dbdguides.com/killers/the-shape/
  - https://www.thegamer.com/dead-daylight-best-tips-ghost-face/

### 4.2 設計への示唆
- ハンターの空白時間対策は、大きく (a) 目標物巡回（端末という既存の軸が使える）、(b) 痕跡・環境通知の確認、(c) センサー/罠の配置管理、(d) ストーク等の前段スキル、の4系統。**本作には既に (a) と遅延ピンがある**ので、追加するなら (b) の環境通知（人感ライト）か (c) の少量センサー、(d) の注視のどれか1つで十分。全部入れると1vs1の単純さが壊れる。
- 「やること」は情報収集と表裏である点に注意: 罠・センサーは「置く楽しさ」と「通知の楽しさ」の両方をハンターに返すため、待ち時間の解消効率が高い。
- 逆に、獲物側にだけ仕事（端末操作）がありハンターが受け身になる非対称は、F13 や Trapper の低評価点（「序盤やることがない/弱い」）と直結する。ハンターの初期行動（最初の30秒で何をするか）を設計側で用意すべき、というのが事例全体の教訓。

### 4.3 未確認
- 1vs1専用設計の市販例（Propnight の1v1モード等）のハンター側の時間配分について、信頼できる資料は今回見つからなかった。少人数の事例は主に4v1/4v4からの転用になる。

---

## 5. ハンターが強すぎる場合の調整弁の実例

### 5.1 事実/出典
- **使い切り脱出アイテム（ポケットナイフ）**: F13 では即グラブへの唯一の対抗が使い切りアイテム。「決定的な捕獲」と「1回だけの保険」をセットにする設計。
  - https://stevivor.com/reviews/friday-the-13th-the-game-review/
  - https://www.neogaf.com/threads/friday-the-13th-the-game-ot-you-and-your-friends-are-dead-game-over.1380354/page-74
- **成功/失敗で分かれるクールダウンと減速**: DbD は攻撃成功で約3秒、失敗で1.5秒のクールダウン＋その間の減速。外した側が一方的に得をしない（成功しても隙はある）構造。
  - https://eip.gg/dbd/guides/killer-weapons-powers/
- **当たった獲物への加速（逃げる側の猶予）**: DbD では攻撃を受けたサバイバーは短時間の加速（約1.8秒のスピードブースト）を得る。Identity V の長い命中硬直（2.58〜4.47秒）も同種の「当てた後の距離回復」。
  - https://steamcommunity.com/sharedfiles/filedetails/?id=3147913412
  - https://id5.fandom.com/wiki/Hunter/Statistics
- **即死にしない段階構造**: DbD は「2ヒット→ダウン→運搬（もがき約16秒で脱出可能）→フック（段階タイマー各60秒）」と、捕獲から確定までに複数の介入余地を挟む。Identity V もロケットチェア60秒＋救出あり。**1vs1・救助者なしの本作では、この段階構造を「捕獲ゲージ＋最後の抵抗（煙幕/視線切り）」で代替する必要がある**（設計側の推論であり、出典のある事実ではない）。
  - https://steamcommunity.com/sharedfiles/filedetails/?id=3147913412
  - https://id5.fandom.com/wiki/Hunter
- **段階的強化（序盤は弱いハンター）**: F13 は序盤のジェイソンの能力を制限し、時間経過で解放する。「ハンターが強い」問題を時間軸で配分する解法。
  - https://gamecritics.com/daniel-weissenberger/friday-the-13th-the-game-review/

### 5.2 設計への示唆
- 本作の前提（見つかったら終わり）では、調整弁は「捕獲後」ではなく「捕獲前」に置くのが筋: (1) 失敗コスト（ゲージ満タン直前で逃げられたらハンターがよろける＝既存仕様）、(2) 煙幕・ロッカーという回数/場所制限のある解除手段（F13 のナイフの「1回だけ」思想）、(3) 再ステルスの猶予（視線を5秒切れば注視・圧力がリセット）、の3点で十分に足りる。
- ハンターが強すぎる場合の第一調整ノブは、事例を見る限り「速度」ではなく「**捕獲の確定条件の幅**」（ゲージ時間、注視の必要時間、突進のクールダウン）。速度を触ると巡回・巡回外の全場面に波及する。

### 5.3 未確認
- DbD の運搬中もがき（ウィグル）の正確な所要時間は資料により表現が揺れる（約16秒というガイド記載を採用したが、現行値の公式確認はしていない）。

---

## 付録: 数値の早見表（相場観）

| 項目 | 事例の相場 | 出典 |
|---|---|---|
| 追跡者の速度優位 | 獲物の +10〜15% | DbD 4.0 vs 4.4/4.6 |
| 警告半径 | 24〜32m（速度と連動） | DbD テラーレディウス |
| 痕跡の持続 | 10秒（走行時のみ発生） | DbD スクラッチマーク |
| 攻撃クールダウン | 成功約3秒 / 失敗1.5秒（DbD）、命中硬直2.6〜4.5秒（Identity V） | 各節参照 |
| パルス/スキャン | CD約30秒・方向のみ・相手に使用が伝わる | Evolve Planet Scanner |
| センサー設置 | 罠の設置2〜2.5秒、しゃがみ通過で回避可（ハグ） | DbD |
| 長時間チェイス対策 | 約15秒ごとの段階加速（Bloodlust） | DbD |
| 凝視/ストーク | マーク完了で45〜60秒間一撃化、見つめ返しで解除 | DbD Ghost Face |

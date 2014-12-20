var colorCount = 4;

var Width = 40, Height = 35;
var OjamaWidth = 40, OjamaHeight = 30;


var nextList = [];

var anotherPoint = function(x, y, dir) {
  var c = Math.round(Math.cos(dir * Math.PI / 2));
  var s = Math.round(Math.sin(dir * Math.PI / 2));

  return { x: x + c, y: y + s*dist };
};

// 点数の算出
// http://dic.nicovideo.jp/a/%E3%81%8A%E3%81%98%E3%82%83%E3%81%BE%E3%81%B7%E3%82%88%E7%AE%97
var calcScore = function(data, chain) {

  var std, // 基本点
      ratio, // 倍率
      temp;

  /* 基本点の計算 */
  std = _.reduce(data, function(memo, obj) {
    return memo + obj.count;
  }, 0) * 10;

  /* ============ *
   *  倍率の計算  *
   * ============ */

  // 連鎖による加算
  if (chain == 1) {
    ratio = 0;
  } else {
    temp = Math.pow(2, chain + 1);
    ratio = temp > 999 ? 999 : temp;
  }

  // 同時消しによる加算
  temp = _.chain(data)
    .map(function(obj) { return obj.color; })
    .uniq().value().length;
  if (temp == 1) {
    ratio += 0;
  } else {
    ratio += 3 * Math.pow(2, temp - 2);
  }

  // 連結による加算
  ratio += _.reduce(data, function(memo, obj) {
    if (obj.count > 4 && obj.count < 11) {
      return memo + obj.count - 3;
    } else if (obj.count >= 11) {
      return memo + 10;
    } else {
      return memo;
    }
  }, 0);

  if (ratio == 0) ratio = 1;

  return std * ratio;
};

var Puyo = function(number) {
  var
    board, //ボードの情報

    direction = 1,
    p1 = { color: 1, x: 3, y: 0 }, //操作ぷよの情報一つ目
    p2 = { color: 2, x: 3, y: 1 }, //もう一つの操作ぷよの情報
    n1 = { color: 3, x: 3, y: 0 }, //ネクストぷよの情報一つ目
    n2 = { color: 4, x: 3, y: 1 }, //ネクストぷよの情報二つ目

    score = 0, //スコア
    tempScore = 0,
    ojama = 0, //お邪魔ぷよの数

    anime = false, //アニメーション中かどうか

    teki, //敵のPuyoオブジェクト

    chain = 0,

    fallPairID,

    game = false,

    conb = $("#board" + number)[0].getContext("2d"),
    conp = $("#pair" + number)[0].getContext("2d"),
    conn = $("#next" + number)[0].getContext("2d"),
    cono = $("#ojama" + number)[0].getContext("2d"),
    cons = $("#score" + number)[0].getContext("2d"),

    callback,

    interval = gInterval,

    computerID,

    nextNum = 0

    ; //ボードのひとつの要素を何ブロックに分けるか（ぬるぬる動かすために使用）

  cons.textAlign = "right";
  cons.textBaseline = "middle";
  cons.font = "30px Ricty";
  cons.fillStyle = "white";

  var createBoard = function() {
    // ボードの情報を設定（画面外の空白、番兵を含む）
    board = twoArray(X + 2, Y + Y_SPACE + 2, 0);

    // 番兵を壁にする
    for (var x = 0; x < X + 2; x++) {
      for (var y = 0; y < Y + Y_SPACE + 2; y++) {
        if (x == 0 || x == X + 1 || y == 0 || y == Y + Y_SPACE + 1) {
          board[x][y] = -1;
        }
      }
    }
  };

  createBoard();
  
  var boardDisplay = function() {
    conb.clearRect(0, 0, Width * X, Height * Y);

    // ボードの情報の表示
    for (var x = 1; x <= X; x++) {
      for (var y = 1 + Y_SPACE; y <= Y + Y_SPACE; y++) {
        if (board[x][y] == 0) continue;
        conb.drawImage(image[board[x][y]], (x - 1) * Width, (y - Y_SPACE - 1) * Height);
      }
    }
  };

  var pairDisplay = function() {
    conp.clearRect(0, 0, Width * X, Height * Y);

    conp.drawImage(image[p1.color], (p1.x - 1) * Width, (p1.y/dist - Y_SPACE - 1) * Height);
    conp.drawImage(image[p2.color], (p2.x - 1) * Width, (p2.y/dist - Y_SPACE - 1) * Height);
  };

  var ojamaDisplay = function() {
    var red, big, sml, x = 0;

    red = Math.floor(ojama / 30);
    big = Math.floor((ojama - red * 30) / 6);
    sml = ojama - red * 30 - big * 6;

    cono.clearRect(0, 0, OjamaWidth * X, OjamaHeight);
    while (x < 6) {
      if (red > 0) {
        cono.fillStyle = "red";
        cono.fillRect(x * OjamaWidth, 0, OjamaWidth, OjamaHeight);
        red -= 1;
      } else if (big > 0) {
        cono.fillStyle = "black";
        cono.fillRect(x * OjamaWidth, 0, OjamaWidth, OjamaHeight);
        big -= 1;
      } else if (sml > 0) {
        cono.fillStyle = "gray";
        cono.fillRect(x * OjamaWidth, 0, OjamaWidth, OjamaHeight);
        sml -= 1;
      }
      x += 1;
    }
  };

  var nextDisplay = function() {
    conn.clearRect(0, 0, Width, Height * 2);

    conn.drawImage(image[n1.color], 0, Height);
    conn.drawImage(image[n2.color], 0, 0);
  };

  var scoreDisplay = function() {
    cons.clearRect(0, 0, Width * X, Height);
    cons.fillText(score, 240-5, 15);
  };

  var setAnotherPoint = function() {
    $.extend(p2, anotherPoint(p1.x, p1.y, direction));
  };

  var move = function(dx, dy) {
    if (!game) return;
    if (anime) return;
    if (isMove(dx, dy)) {
      p1.x += dx; p1.y += dy;
      p2.x += dx; p2.y += dy;
      pairDisplay();

      if (dy > 0) {
        resetPairInterval();
      }

      return true;
    } else {
      return false;
    }
  };

  var testest = function(number) {
    return Math.floor(about(number));
  };

  var isMove = function(dx, dy) {
    if (board[p1.x + dx][testest(p1.y/dist) + dy] == 0
     && board[p2.x + dx][testest(p2.y/dist) + dy] == 0) {
      return true;
    } else {
      return false;
    }
  };

  var rotate = function() {
    if (!game) return;
    if (anime) return;

    var dir = (direction + 1) % 4;
    var p2 = $.extend({}, p2, anotherPoint(p1.x, p1.y, dir));

    //周りに障害物がない場合は回転させる
    if (board[p2.x][testest(p2.y/dist)] == 0) {
      direction = (direction + 1) % 4;
      setAnotherPoint();
      animeRotate(p1, direction - 1, 1);
      return true;

    //回転するときに壁がある場合、ひとつ横に移動させてから回転させる
    } else if (dir == 2 && board[p1.x+1][testest(p1.y/dist)] == 0) {
      move(1, 0);
      direction = (direction + 1) % 4;
      setAnotherPoint();
      animeRotate(p1, direction - 1, 1);
      return true;
    } else if (dir == 0 && board[p1.x-1][testest(p1.y/dist)] == 0) {
      move(-1, 0);
      direction = (direction + 1) % 4;
      setAnotherPoint();
      animeRotate(p1, direction - 1, 1);
      return true;

    //昇竜ぷよを行う
    } else if (dir == 1 && board[p1.x][testest(p1.y/dist)-1] == 0) {
      move(0, -1);
      direction = (direction + 1) % 4;
      setAnotherPoint();
      animeRotate(p1, direction - 1, 1);

      // 昇竜ぷよを行うごとに落下の間隔を短くする（無限に昇竜ぷよを行わせないため）
      interval -= gInterval / 20;
      return true;

    //左右を壁に囲まれているときは半回転させる
    } else if (dir == 2 && board[p1.x+1][testest(p1.y/dist)] != 0 && board[p1.x][testest(p1.y/dist)-1] == 0) {
      direction = (direction + 2) % 4;
      setAnotherPoint();
      animeRotate(p1, direction - 2, 2);
      return true;
    } else if (dir == 0 && board[p1.x-1][testest(p1.y/dist)] != 0 && board[p1.x][testest(p1.y/dist)+1] == 0) {
      direction = (direction + 2) % 4;
      setAnotherPoint();
      animeRotate(p1, direction - 2, 2);
      return true;

    } else {
      return false;
    }
  };

  //4つ以上連なるぷよを消す
  var deletePuyo = function(board) {
    var data = [], color, bd, count,
        conCount = 0,

        mapped, //調査したかどうかを格納しておく配列
        recursion,
        x, y, i, j;

    mapped = twoArray(X + 2, Y + Y_SPACE + 2, false);

    //連なるぷよを、どんどん削除フラグを立てていく
    recursion = function(x, y) {
      bd[x][y] = true;
      mapped[x][y] = true;

      fourDirection(function(c, s) {
        var dx = x + c, dy = y + s;
        if (bd[dx][dy] == false && board[dx][dy] == color) recursion(dx, dy);
      });
    };

    for (x = 1; x <= X; x++) {
      for (y = 1; y <= Y + Y_SPACE; y++) {

        //もう調査しているので調査しない
        if (mapped[x][y]) continue;

        //壁orおじゃまぷよのときは調査しない
        color = board[x][y];
        if (color == 0 || color == 9) continue;

        bd = twoArray(X + 2, Y + Y_SPACE + 2, false);
        recursion(x, y, color, bd);

        //連なるぷよの数を数える
        count = 0;
        for (i = 1; i <= X; i++) {
          for (j = 1 + Y_SPACE; j <= Y + Y_SPACE; j++) {
            if (bd[i][j]) count += 1;
          }
        }

        //連なるぷよの総数（思考ルーチン部分で使用）
        if (count > 1) conCount += count;

        // 4つ以上繋がっていればぷよを消す
        if (count < 4) continue;

        for (i = 1; i <= X; i++) {
          for (j = 1 + Y_SPACE; j <= Y + Y_SPACE; j++) {
            if (!bd[i][j]) continue;

            //色ぷよの削除
            board[i][j] = 0;

            //まわりのおじゃまぷよを消す
            fourDirection(function(c, s) {
              var dx = i + c, dy = j + s;
              if (board[dx][dy] == 9) board[dx][dy] = 0;
            });
          }
        }

        //消したぷよの情報をオブジェクトとして配列に格納
        data.push({ color: color, count: count });
      }
    }

    return { deleteData: data, connectCount: conCount};
  };

  var deletePuyoSync = function(board) {
    var d = $.Deferred(),
        data = deletePuyo(board), temp;
    if (data.deleteData.length == 0) {
      d.resolve(false); // 一つも削除されなかったら間を置かずに次の処理へ
    } else {
      chain += 1;
      temp = calcScore(data.deleteData, chain);
      tempScore += temp;
      score += temp;
      scoreDisplay();
      boardDisplay();
      sleep(interval).done(function() {
        d.resolve(true); // 消滅し終えたことを報告している
      });
    }
    return d.promise();
  };

  //ボード上のぷよの落下
  var fallPuyo = function(board) {
    var isFall = false,
        x, y, color, dy;

    for (x = 1; x <= X; x++) {
      for (y = Y + Y_SPACE; y >= 1; y--) {
        if (board[x][y] == 0) continue;

        dy = y;
        while (board[x][++dy] == 0) isFall = true;

        color = board[x][y];
        board[x][y] = 0;
        board[x][--dy] = color;
      }
    }
    return isFall;
  };

  var fallPuyoSync = function(board) {
    var d = $.Deferred();
    if (!fallPuyo(board)) {
      d.resolve(); // 一つも落ちなかったら間を置かずに次の処理へ
    } else {
      boardDisplay()
      sleep(interval).done(function() {
        d.resolve(); // 落ち終えたことを報告している
      });
    }
    return d.promise();
  };

  //ボード上におじゃまぷよを作る
  var makeOjama = function(board) {
    var count, x, c, made, max;

    if (ojama == 0) return 0;

    if (ojama >= 30) {
      count = 30;
    } else {
      count = ojama % 30;
    }

    ojama -= count;

    //画面外におじゃまぷよを作る
    max = Math.ceil(count / 6)
    for (var y = 1; y <= max; y++) {
      for (c = 0; c < 6 && count != 0; c++, count--) {
        do {
          x = Math.ceil(Math.random() * 6);
        } while (board[x][y] != 0);

        board[x][y] = 9;
      }
    }

    //画面外のおじゃまぷよを画面上すぐまで落下させる
    for (var x = 1; x <= X; x++) {
      for (var y = Y + Y_SPACE; y >= 1; y--) {
        if (board[x][y] == 0) continue;

        dy = y;
        while (board[x][++dy] == 0 && dy <= Y_SPACE);

        color = board[x][y];
        board[x][y] = 0;
        board[x][--dy] = color;
      }
    }
  };

  //数字の符号を返す
  var sign = function(number) {
    return number > 0 ? 1 : number < 0 ? -1 : 0;
  };

  //ぷよを回転させるアニメーション
  //（angle変数に1を与えることで、時計回転に90度回転する）
  var animeRotate = function(p1, dir, angle) {
    amine = true;

    var d = $.Deferred(),
        w2 = {}, recursion, i = -1;

    recursion = function() {
      i += 1;

      //組ぷよ2つ目の座標を設定
      w2.color = p2.color;
      w2.x = p1.x + Math.cos((6 * dir + i * angle) / 12 * Math.PI);
      w2.y = p1.y/dist + Math.sin((6 * dir + i * angle) / 12 * Math.PI);

      conp.clearRect(0, 0, Width * 6, Height * 12);
      conp.drawImage(image[p1.color], (p1.x - 1) * Width, (p1.y/dist - Y_SPACE - 1) * Height);
      conp.drawImage(image[w2.color], (w2.x - 1) * Width, (w2.y - Y_SPACE - 1) * Height);

      if (i < 6) {
        setTimeout(recursion, 8);
      } else {
        anime = false;
        d.resolve();
      }
    };

    setTimeout(recursion, 8);

    return d.promise();
  };

  //空中にあるぷよ（おじゃまぷよ、色ぷよ）を落下させる
  var animeFall = function(board) {
    var d = $.Deferred(),
        from = [], to = [], is = [], time = 0, h, dy = [], color = [],
        x, y, i, l,
        a = [], r = [],
        isAllTrue, recursion, display;

    // 空中に浮いているぷよのy座標をfrom配列に代入
    for (x = 1; x <= X; x++) {
      from[x] = [];
      color[x] = [];

      y = Y + Y_SPACE;

      //地面に接しているぷよ
      while (board[x][--y] > 0);

      //ぷよがないところ
      while (board[x][--y] == 0);

      //空中に浮いているぷよ
      for (i = 0; y > 0; y--) {
        if (board[x][y] == 0) continue;
        from[x][i] = y;
        color[x][i] = board[x][y];

        //空中に浮いてるぷよは一旦ボードから削除する
        //（アニメーションが終わった時にボードに情報を入れ直す）
        board[x][y] = 0;

        i += 1;
      }
    }

    //to配列に、どこまで落ちるかの情報を格納する
    for (x = 1; x <= X; x++) {
      to[x] = [];
      if (existy(y = from[x][0])) {
        while (board[x][++y] == 0);
        for (i = 0, l = from[x].length; i < l; i++) to[x][i] = --y;
      }
    }

    //落ちたかどうかを格納するbool型の二次元配列
    for (x = 1; x <= X; x++) {
      is[x] = [];
      for (y = 0, l = from[x].length; y < l; y++) is[x][y] = false;
    }

    for (var x = 1; x <= X; x++) {
      dy[x] = [];
    }

    //ランダムな変数を作成（降ってくるぷよの位置と、使用する定数を少しだけ変える）
    for (var x = 1; x <= X; x++) {
      a[x] = Math.random() * 0.1 + 0.5;
      r[x] = Math.floor(Math.random() * 30) - 30;
    }

    //すべての要素がtrueかどうかを判定する
    isFalled = function(is) {
      var x, y, l;
      for (x = 1; x <= X; x++) {
        for (y = 0, l = is[x].length; y < l; y++) {
          if (is[x][y] === false) return false;
        }
      }
      return true;
    };

    //落下中のぷよを表示する（組ぷよを表示するフレームと同じ）
    display = function() {
      conp.clearRect(0, 0, Width * 6, Height * 12);
      for (var x = 1; x <= X; x++) {
        for (var y = 0, l = dy[x].length; y < l; y++) {
          conp.drawImage(image[color[x][y]], (x - 1) * Width, (dy[x][y] - Height));
        }
      }
    };

    //すべての浮遊ぷよの落下
    recursion = function() {
      if (isFalled(is)) {
        for (var x = 1; x <= X; x++) {
          for (var y = 0, l = to[x].length; y < l; y++) {
            board[x][to[x][y]] = color[x][y];
          }
        }
        pairDisplay();
        boardDisplay();
        d.resolve(); return true;
      }

      for (var x = 1; x <= X; x++) {

        //自由落下距離
        h = a[x] * time * time;
        
        for (var y = 0, l = from[x].length; y < l; y++) {

          //まだぷよが空中にある場合
          if (!is[x][y]) {
            dy[x][y] = (from[x][y] - Y_SPACE) * Height + h + r[x];
          }

          //降ってくるぷよが下のぷよまで到達したとき
          if (to[x][y] - Y_SPACE - 1 < Math.floor(dy[x][y] / Height)) {
            dy[x][y] = (to[x][y] - Y_SPACE) * Height;
            is[x][y] = true;
          }
        }
      }
      display();
      time += 1;
      setTimeout(recursion, 30);
    };

    boardDisplay();
    recursion();

    return d.promise();
  };

  // アニメーションが終わった時の処理
  var endSync = function() {
    makeOjama(board);
    ojamaDisplay();
    animeFall(board).done(function() {

      boardDisplay();

      send(Math.round(tempScore / 70));
      tempScore = 0;

      //昇竜ぷよを行ったことによる落下の間隔の減少を元に戻す
      interval = gInterval;

      //思考ルーチンの計算済みデータのリセット
      alreadyData = null;

      if (!game) return;

      if (board[3][1+Y_SPACE] == 0) {
        takePair();
        makeNext();
      } else {
        gameOver();
        return false;
      }

      fallPairID = setTimeout(fallPair, interval);
      anime = false;
    });
  };

  var resetPairInterval = function() {
    if (!isMove(0, 1)) {
      clearTimeout(fallPairID);
      fallPairID = setTimeout(fallPair, interval);
    }
  };

  var fallPair = function() {
    if (move(0, 1)) {
      fallPairID = setTimeout(fallPair, interval);
    } else {
      clearTimeout(fallPairID);
      anime = true;

      // ペアぷよをボードに反映させる
      board[p1.x][testest(p1.y/dist)] = p1.color;
      board[p2.x][testest(p2.y/dist)] = p2.color;

      // ペアぷよを画面外に移動させる
      p1.x = 3; p1.y = 1*dist;
      p2.x = 4; p2.y = 1*dist;

      // 組ぷよを非表示にする
      pairDisplay();

      chain = 0;
      tempScore = 0;

      // 落下と消滅を繰り返し、それらが終わったらネクストぷよを作ってタイマー再動！
      syncLoop(function() {
        return fallPuyoSync(board);
      }, function() {
        return deletePuyoSync(board);
      }).done(endSync);
    }
  };

  var makeNext = function() {
    n1 = Puyo.next(nextNum)[0];
    n2 = Puyo.next(nextNum)[1];

    nextNum += 1;

    nextDisplay();
  };

  var takePair = function() {
    direction = 3;
    p1 = $.extend({}, n1, { x: 3, y: Y_SPACE * dist });
    p2 = $.extend({}, n2, { x: 3, y: (Y_SPACE - 1) * dist });

    pairDisplay();
  };

  var gameOver = function() {
    clearTimeout(fallPairID);
    clearTimeout(computerID);
    game = false;
    if (existy(callback)) callback();
  };

  // 敵にお邪魔ぷよを送る
  var send = function(count) {
    teki.receive(count);
  };


  /* ============================ *
   *  Puyoオブジェクトのメソッド  *
   * ============================ */

  this.move = move;
  this.rotate = rotate;

  // 相手の設定
  this.rival = function(aite) {
    teki = aite;
  };

  this.start = function() {
    score = 0;
    makeNext();
    takePair();
    makeNext();
    fallPairID = setTimeout(fallPair, interval);
    scoreDisplay();
    game = true;
  };

  //敵からのお邪魔ぷよを受け取る
  this.receive = function(count) {
    ojama += count;
    ojamaDisplay();
  };

  // ゲームの中断
  this.stop = function() {
    clearTimeout(fallPairID);
    clearTimeout(computerID);
    game = false;
  };

  // ゲームオーバーになった時に呼び出す関数を設定
  this.end = function(func) {
    callback = func;
  };

  var alreadyData;

  var routine = function() {
    //alreadyData = null; //ここをコメントアウトすると、常に最適解を求め続ける

    if (existy(alreadyData)) return alreadyData;
    var all = [], x;

    for (x = 1; x <= X; x++) {
      for (var i = 0; i < 4; i++) {
        var s1 = {}, s2 = {},
            bd, alldata = [], data,
            score, conCount;

        var c = Math.round(Math.cos(i * Math.PI / 2));
        var s = Math.round(Math.sin(i * Math.PI / 2)) * dist;

        s1 = { x: x, y: p1.y, color: p1.color };
        s2 = { x: x+c, y: p1.y+s, color: p2.color };

        if (s1.x < 1 || s1.x > X || s2.x < 1 || s2.x > X) continue;
        if (board[s1.x][testest(s1.y/dist)] != 0 || board[s2.x][testest(s1.y/dist)] != 0) continue;

        bd = copyTwoArray(board);

        if (!_move(0, 1, bd, s1, s2)) continue;
        while (_move(0, 1, bd, s1, s2));

        //操作ぷよをボードに取り込み
        bd[s1.x][testest(s1.y/dist)] = s1.color;
        bd[s2.x][testest(s2.y/dist)] = s2.color;

        fallPuyo(bd);

        conCount = 0;

        //ぷよの削除と落下を繰り返す
        data = deletePuyo(bd);
        conCount += data.connectCount;

        while (data.deleteData.length > 0) {
          alldata.push(data.deleteData);
          fallPuyo(bd);
          data = deletePuyo(bd);
          conCount += data.connectCount;
        }

        //点数を取得
        score = _.reduce(alldata, function(sum, data, chain) {
          return sum + calcScore(data, chain + 1);
        }, 0);

        // 余裕がある場合
        if (s1.y > (5 + Y_SPACE)*dist && s2.y > (5 + Y_SPACE)*dist) {
          // 1連鎖などの中途半端な連鎖は、評価値を下げる
          if (score < 1000 && score > 0) {
            score -= 1000;
          }
        } else {
          //ぷよの設置箇所が低いほど評価値が上がる
          score += s1.y;
        }

        //左より右のほうが評価値が高い
        score += s1.x;

        if ((s1.x == 3 && s1.y == (1+Y_SPACE)*dist) || (s2.x == 3 && s2.y == (1+Y_SPACE)*dist)) {
          score = -10000;
        }

        //連なるぷよが多いほど評価値が上がる
        score += conCount;

        all.push({ x: x, direction: i, score: score });
      }
    }

    alreadyData = _.chain(all)
      .max(function(obj) { return obj.score })
      .value();

    //最も評価値の高いxとdirectionの組み合わせを返す
    return alreadyData;
  };

  var computer = function() {
    var data = routine();

    if (data.direction != direction % 4) {
      rotate();
    } else if (data.x > p1.x) {
      move(1, 0);
    } else if (data.x < p1.x) {
      move(-1, 0);
    } else {
      move(0, 1);
    }

    computerID = setTimeout(computer, 100);
  };

  if (number == 2) computerID = setTimeout(computer, 100);

  var _move = function(dx, dy, board, p1, p2) {
    if (board[p1.x + dx][testest(p1.y/dist) + dy] == 0
     && board[p2.x + dx][testest(p2.y/dist) + dy] == 0) {
      p1.x += dx; p1.y += dy;
      p2.x += dx; p2.y += dy;
      return true;
    } else {
      return false;
    }
  };
};

Puyo.next = function(n) {
  if (!existy(nextList[n])) {
    var p1 = { color: Math.floor(Math.random() * colorCount + 1) };
    var p2 = { color: Math.floor(Math.random() * colorCount + 1) };
    nextList.push([p1, p2]);
  }
  return nextList[n];
};
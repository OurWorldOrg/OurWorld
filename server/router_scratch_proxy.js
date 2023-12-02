var express = require("express");
var router = express.Router();
var fs = require("fs");
var DB = require("./lib/database.js"); // 数据库

//功能函数集
var I = require("./lib/fuck.js");

router.all("*", function (req, res, next) {
  next();
});

//首页
router.get("/", function (req, res) {
  //获取已分享的作品总数：1:普通作品，2：推荐的优秀作品
  var SQL =
    `SELECT ` +
    ` (SELECT count(id) FROM scratch WHERE state>0 ) AS scratch_count `;
  DB.query(SQL, function (err, data) {
    if (err) {
      // console.error('数据库操作出错：');
      res.locals.scratch_count = 0;
    } else {
      res.locals.scratch_count = data[0].scratch_count;
    }

      res.render("ejs/scratchmitedu/scratch_projects.ejs");
  
  });
});

//==作品状态：
//0：未发布；
//1：已发布；
//2：已开源；（开源的必须发布）
//Scratch项目展示
router.get("/play", function (req, res) {
  res.render("ejs/scratchmitedu/scratch_play.ejs");
});
//Scratch_play获取源代码数据部分
router.get("/play/project/:filename", function (req, res) {
  var SQL = `SELECT src FROM scratch WHERE id=${req.params.filename} LIMIT 1`;
  DB.query(SQL, function (err, SCRATCH) {
    if (err) {
      return;
    }
    if (SCRATCH.length == 0) {
      return;
    }

    res.status(200).json(JSON.parse(SCRATCH[0].src));
  });
});
//移动端项目点赞：不需要登录即可直接点赞
router.post("/play/like", function (req, res) {
  var pid = req.body["pid"];

  //scratch表like_count+1
  var UPDATE = `UPDATE scratch SET like_count=like_count+1 WHERE id=${pid} LIMIT 1`;
  DB.query(UPDATE, function (err, SCRATCH) {
    if (err || SCRATCH.changedRows == 0) {
      res.status(200).send({ status: "failed", msg: "已打Call(￣y▽,￣)╭ " });
      return;
    }

    res.status(200).send({ status: "1", msg: "感谢您的支持，谢谢！" });
  });
});
//项目收藏
router.post("/play/favo", function (req, res) {
  if (!res.locals.login) {
    res.status(200).send({ status: "failed", msg: "请先登录" });
    return;
  }

  var pid = req.body["pid"];
  var SQL = `SELECT id FROM scratch_favo WHERE userid=${req.session.userid} AND projectid=${pid} LIMIT 1`;
  DB.query(SQL, function (err, FAVO) {
    if (err) {
      res.status(200).send({ status: "failed", msg: "数据错误，请再试一次" });
      return;
    }

    if (FAVO.length == 0) {
      //插入一条收藏记录、scratch表favo_count+1
      var UPDATE = `UPDATE scratch SET favo_count=favo_count+1 WHERE id=${pid} LIMIT 1`;
      DB.query(UPDATE, function (err, SCRATCH) {
        if (err || SCRATCH.changedRows == 0) {
          res
            .status(200)
            .send({ status: "failed", msg: "数据错误，请再试一次" });
          return;
        }

        var INSERT = `INSERT INTO scratch_favo (userid, projectid) VALUES (${req.session.userid}, ${pid})`;
        DB.query(INSERT, function (err, FAVO) {
          if (err || FAVO.affectedRows == 0) {
            res
              .status(200)
              .send({ status: "failed", msg: "数据错误，请再试一次" });
            return;
          }

          res.status(200).send({ status: "1", opt: 1, msg: "感谢收藏！" });
        });
      });
    } else {
      //删除一条收藏记录、scratch表favo_count-1
      var UPDATE = `UPDATE scratch SET favo_count=favo_count-1 WHERE id=${pid} LIMIT 1`;
      DB.query(UPDATE, function (err, SCRATCH) {
        if (err || SCRATCH.changedRows == 0) {
          res
            .status(200)
            .send({ status: "failed", msg: "数据错误，请再试一次" });
          return;
        }

        var INSERT = `DELETE FROM scratch_favo WHERE id=${FAVO[0].id} LIMIT 1`;
        DB.query(INSERT, function (err, FAVO) {
          if (err || FAVO.affectedRows == 0) {
            res
              .status(200)
              .send({ status: "failed", msg: "数据错误，请再试一次" });
            return;
          }

          res.status(200).send({ status: "1", opt: -1, msg: "操作成功" });
        });
      });
    }
  });
});

//项目开源、闭源
router.post("/play/openSrc", function (req, res) {
  if (!res.locals.login) {
    res.status(200).send({ status: "failed", msg: "请先登录" });
    return;
  }

  var pid = req.body["pid"];
  var SQL = `SELECT state FROM scratch WHERE id=${pid} AND authorid=${req.session.userid} LIMIT 1`;
  DB.query(SQL, function (err, RECO) {
    if (err || RECO.length == 0) {
      res.status(200).send({ status: "failed", msg: "数据错误，请再试一次" });
      return;
    }

    var state = 1;
    if (RECO[0].state == 1) {
      state = 2;
    }

    var UPDATE = `UPDATE scratch SET state=${state} WHERE id=${pid} LIMIT 1`;
    DB.query(UPDATE, function (err, SCRATCH) {
      if (err) {
        res.status(200).send({ status: "failed", msg: "数据错误，请再试一次" });
        return;
      }

      res.status(200).send({ status: "1", msg: "操作成功" });
    });
  });
});

//Scratch编程界面
router.get("/edit", function (req, res) {
  res.render("ejs/scratchmitedu/scratch_edit.ejs");
});

//Scratch内部调用一：获取作品数据：JSON源代码
//支持两种方案加载默认作品
//1、从指定文件加载
//2、从数据库加载
router.post("/project/:projectid", function (req, res) {
  ////console.log('服务器：获取作品JSON源代码');
  var projectid = 0;
  if (req.params.projectid) {
    projectid = req.params.projectid;
  }

  if (projectid == 0) {
    // 默认作品
    /* 当把该块注释后，则从数据库加载默认作品
        //从指定文件加载默认作品：BEGIN==========================================
        var _SDP = require("./lib/scratch_default_project.js");
        res.status(200).send({status:'ok', src:_SDP});
        return;
        //从指定文件加载默认作品：END============================================
        // */
    SQL = `SELECT id, authorid, state, title, src FROM scratch WHERE id=1`; //默认作品为1号作品
  } else {
    if (!res.locals.login) {
      SQL = `SELECT * FROM scratch WHERE id=${projectid} AND state>0`;
    } else {
      //作品编辑：能够打开一个作品的几种权限：
      //0、管理员能打开所有作品;
      //1、自己的作品；
      //2、开源的作品；
      //3、课堂用例、作业模板：购买课程后可以打开；
      //4、课堂作业作品：课程老师可以打开；
      if (req.session["is_admin"] == 1) {
        SQL = `SELECT * FROM scratch WHERE id=${projectid}`;
      } else {
        SQL = `SELECT * FROM scratch WHERE id=${projectid} AND (authorid=${req.session.userid} OR state>0)`;
        //(AND (courseid IN (SELECT courseid FROM student WHERE studentid=${req.session.userid} AND coursepayid>0)))
      }
    }
  }

  DB.query(SQL, function (err, SCRATCH) {
    if (err) {
      res.status(200).send({ status: "作品不存在或无权打开" }); //需要Scratch内部处理
      return;
    }

    if (SCRATCH.length == 0) {
      //4、课堂作业作品：课程老师可以打开；
      SQL = `SELECT * FROM scratch WHERE id=${projectid} AND courseid!=0 AND (courseid IN (SELECT courseid FROM class WHERE teacherid=${req.session.userid}))`;
      DB.query(SQL, function (err, SCRATCH) {
        if (err || SCRATCH.length == 0) {
          res.status(200).send({ status: "作品不存在或无权打开" }); //需要Scratch内部处理
          return;
        }

        //作品被浏览次数+1
        var UPDATE = `UPDATE scratch SET view_count=view_count+1 WHERE id=${projectid} LIMIT 1`;
        DB.query(UPDATE, function (err, s) {
          if (err) {
          }
        });

        SCRATCH[0]["teacher_id"] = req.session.userid;
        res.status(200).send({ status: "ok", src: SCRATCH[0] });
      });

      return;
    }

    if (projectid == 0) {
      // 默认作品， 转换成scratch.min.js能使用的默认作品数据
      SCRATCH[0].id = 0;
      SCRATCH[0].authorid = 0;
      SCRATCH[0].state = 0;
      projectid = 1;
    }

    //作品被浏览次数+1
    var UPDATE = `UPDATE scratch SET view_count=view_count+1 WHERE id=${projectid} LIMIT 1`;
    DB.query(UPDATE, function (err, s) {
      if (err) {
      }
    });

    res.status(200).send({ status: "ok", src: SCRATCH[0] });
  });
});

//Scratch内部调用二：获取作品素材：背景、角色、音频。取素材时需要完整的文件路径
router.get("/assets/:filename", function (req, res) {
  var p = `${global.dirname}/data/material/asset/${req.params.filename}`;
  res.sendFile(p); //必须是绝对路径
});

//保存作品：标题
router.post("/saveProjcetTitle", function (req, res) {
  if (!res.locals.login) {
    res.status(404);
    return;
  }
  var UPDATE = `UPDATE scratch SET title=? WHERE id=${req.body.id} AND authorid=${req.session.userid} LIMIT 1`;
  var VAL = [`${req.body.title}`];
  DB.qww(UPDATE, VAL, function (err, SCRATCH) {
    if (err) {
      res.status(404).send({ status: "err" }); //返回内容可有可无，，因为客户端没处理
    } else {
      res.status(200).send({ status: "ok" }); //返回内容可有可无，因为客户端没处理
    }
  });
});

//保存作品源代码：此时作品已存在。req.body为项目JSON源代码
router.put("/projects/:projectid", function (req, res) {
  // //console.log('服务器：保存作品JSON源代码');
  if (!res.locals.login) {
    res.status(404).send({});
    return;
  }

  var SQL = `SELECT id, authorid FROM scratch WHERE id=${req.params.projectid} LIMIT 1`;
  DB.query(SQL, function (err, SWork) {
    if (err || SWork.length == 0) {
      res.status(404).send({});
      return;
    }

    if (SWork[0].authorid != req.session.userid) {
      res.status(404).send({});
      return;
    }

    var UPDATE = `UPDATE scratch SET src=? WHERE id=${req.params.projectid} LIMIT 1`;
    var VAL = [`${JSON.stringify(req.body)}`];
    DB.qww(UPDATE, VAL, function (err, SCRATCH) {
      if (err) {
        res.status(404).send({});
        return;
      }

      res.status(200).json({ status: "ok" });
    });
  });
});
//保存作品：缩略图
router.post("/thumbnail/:projectid", function (req, res) {
  ////console.log('开始保存缩略图：'+req.params.projectid);

  // 请求的头部为 'Content-Type': 'image/png'时，用req.on接收文件
  var _data = [];
  req.on("data", function (data) {
    if (data) {
      _data["push"](data);
    }
  });
  req.on("end", function () {
    //var strFileName = './data/scratch_slt/' + req.params.projectid;
    var strFileName = `${global.dirname}/data/scratch_slt/${req.params.projectid}`;
    let content = Buffer["concat"](_data);
    fs.writeFile(strFileName, content, function (err) {
      if (err) {
        res.status(404).send({ status: "err" });
        //console.log(err);
        //console.log("保存缩略图失败：" + strFileName);
      } else {
        I.qiniuupdate("scratch_slt/" + req.params.projectid, strFileName);

        ////console.log('保存缩略图成功：'+strFileName);
        res.status(200).send({ status: "ok" });
        //fs.unlink(`./data/scratch_slt/${req.params.projectid}`,function (err) { if (err) { res.status(200).send( {'status':'文件上传失败'}); return; }})
      }
    });
  });
});
//分享作品：
router.post("/shareProject/:projectid", function (req, res) {
  if (!res.locals.login) {
    res.status(200).send({ status: "x" });
    return;
  }

  var s = 0;
  if (req.body.s == 1) {
    s = 1;
  }

  //只能分享自己的作品
  var UPDATE = `UPDATE scratch SET state=${s} WHERE id=${req.params.projectid} AND authorid=${req.session.userid} LIMIT 1`;
  DB.query(UPDATE, function (err, U) {
    if (err) {
      res.status(200).send({ status: "x" });
      return;
    }

    res.status(200).send({ status: "ok" });
  });
});

//保存新作品：保存源代码及作品名称。req.body为项目JSON源代码,?title=作品名称
router.post("/projects", function (req, res) {
  //console.log("服务器：新建作品JSON源代码");

  if (!req.body) {
    res.send(404);
    return;
  }
  var title = "新作品";
  if (req.query.title) {
    title = req.query.title;
  }
  var INSERT = `INSERT INTO scratch (authorid, title, src) VALUES (${req.session.userid}, ?, ?)`;
  var VAL = [title, `${JSON.stringify(req.body)}`];
  DB.qww(INSERT, VAL, function (err, newScratch) {
    if (err || newScratch.affectedRows == 0) {
      res.send(404);
      return;
    }

    res.status(200).send({
      status: "ok",
      id: newScratch["insertId"],
    });
  });
});
//新作品：保存作品素材
router.post("/assets/:filename", function (req, res) {
  var strFileName = "./data/material/asset/" + req.params.filename;
  fs.exists(strFileName, function (bExists) {
    //if (bExists) {
    //  console.log("素材已存在：" + strFileName);
    //  res.status(200).send({ status: "ok" });
    //} else {
      var _data = [];
      req.on("data", function (data) {
        if (data) {
          _data["push"](data);
        }
      });
      req.on("end", function () {
        let content = Buffer["concat"](_data);
        fs.writeFile(strFileName, content, function (err) {
          if (err) {
            res.send(404);
            //console.log("素材保存失败：" + strFileName);
          } else {
            I.qiniuupdate("material/asset/" + req.params.filename, strFileName);

            //console.log("素材保存成功：" + strFileName);
            res.status(200).send({ status: "ok" });
            //fs.unlink('./data/material/asset/' + req.params.filename,function (err) { if (err) { res.status(200).send( {'status':'文件上传失败'}); return; }})
          }
        });
      });
    }
  //}
  );
});

// 自定义背景
router.get("/getBackdrop", (req, res, next) => {
  var resultData = { tags: [], mates: [] };
  var SQL = `SELECT * FROM material_tags WHERE type=1`;
  DB.query(SQL, function (err, TAGS) {
    if (err || TAGS.length == 0) {
      res.status(200).send(resultData);
      return;
    }

    resultData.tags = TAGS;

    var SQL = `SELECT mb.src 
            FROM material_backdrop mb
            INNER JOIN material_tags mt ON mt.type=1 
            WHERE mb.tagId=mt.id `;
    DB.query(SQL, function (err, Mates) {
      if (err || Mates.length == 0) {
        res.status(200).send(resultData);
        return;
      }

      resultData.mates = Mates;

      res.status(200).send(resultData);
    });
  });
});
// 自定义角色
router.get("/getSprite", (req, res, next) => {
  var resultData = { tags: [], mates: [] };
  res.status(200).send(resultData);
});
// 自定义造型
router.get("/getCostume", (req, res, next) => {
  var resultData = {
    tags: [{ tag: "people", intlLabel: "造型测试标签" }],
    mates: [
      {
        name: "Abby-a",
        tags: ["people"],
        assetId: "809d9b47347a6af2860e7a3a35bce057",
        bitmapResolution: 1,
        dataFormat: "svg",
        md5ext: "809d9b47347a6af2860e7a3a35bce057.svg",
        rotationCenterX: 31,
        rotationCenterY: 100,
      },
    ],
  };
  res.status(200).send(resultData);
});
// 自定义声音
router.get("/getSound", (req, res, next) => {
  var resultData = { tags: [], mates: [] };
  res.status(200).send(resultData);
});

// 取自定义扩展
router.get("/getExtensionLibrary", (req, res, next) => {
  var resultData = [
    {
      name: "数学王国",
      extensionId: "CoCoMathExt",
      extensionURL: "/static/extensions/coco-math-extension.js",
      iconURL: "/static/extensions/cocoExt.jpg",
      insetIconURL: "/static/extensions/cocoLogo.png",
      description: process.env.siteneme + "自定义扩展",
      featured: true,
    },
  ];

  res.status(200).send(resultData);
});

//点击积木块，从服务器上获取数据
router.get("/test_getBlockLinkToServer", (req, res, next) => {
  res
    .status(200)
    .send("从服务器上获取数据成功，当前服务器时间：" + new Date().toString());
});

// 获取我的作品列表
// req.body.t:0：未分享/1：已分享 /100：全部 /200：收藏
router.post("/getMyProjectLibrary", function (req, res) {
  if (res.locals["userid"] == "") {
    res.status(200).send({ status: "err", data: [] });
  }

  var WHERE = "";
  if (req.body.t == 0) {
    WHERE = " AND state=0";
  } else if (req.body.t == 1) {
    // 包括1发而的、2推荐的
    WHERE = " AND state>0";
  }

  if (req.body.f && req.body.f != "") {
    WHERE += ` AND title LIKE '%${req.body.f}%'`;
  }

  var SELECT = `SELECT id, title, time, state FROM scratch WHERE authorid=${req.session["userid"]} ${WHERE} ORDER BY time DESC LIMIT ${req.body.l},${req.body.n}`; //正式版本中，需要限定作者本身的作品
  DB.query(SELECT, function (err, SCRATCH) {
    if (err) {
      res.status(200).send({ status: "err", data: [] });
    } else {
      res.status(200).send({ status: "ok", data: SCRATCH });
    }
  });
});

// 获取优秀作品列表
router.post("/getYxProjectLibrary", function (req, res) {
  var SELECT =
    ` SELECT s.id, s.title, s.view_count, s.authorid, u.nickname FROM scratch s ` +
    " LEFT JOIN user u ON u.id=s.authorid " +
    ` WHERE s.state=2 ORDER BY s.view_count DESC LIMIT ${req.body.l},${req.body.n}`;
  DB.query(SELECT, function (err, SCRATCH) {
    if (err) {
      res.status(200).send({ status: "err", data: [] });
    } else {
      res.status(200).send({ status: "ok", data: SCRATCH });
    }
  });
});

// 获取背景
// 组件获取条件 tag：是否获取分类; f: 搜索字符串; t: 分类; l: 已经获取的背景数; n: 每次获取的背景数，默认为20个
router.post("/getBackdropLibrary", function (req, res) {
  var WHERE = "";
  if (req.body.t != 0) {
    WHERE = " AND tagId=" + req.body.t;
  }

  if (req.body.f && req.body.f != "") {
    WHERE += ` AND name LIKE '%${req.body.f}%'`;
  }

  var SELECT = `SELECT id, name, md5, info0, info1, info2  FROM material_backdrop WHERE state=1 ${WHERE} ORDER BY name DESC LIMIT ${req.body.l},${req.body.n}`;
  DB.query(SELECT, function (err, Backdrop) {
    if (err) {
      res.status(200).send({ status: "err", data: [], tags: [] });
      return;
    }

    if (req.body.tag == 0) {
      res.status(200).send({ status: "ok", data: Backdrop, tags: [] });
      return;
    }

    // 取一次背景分类
    SELECT = `SELECT id, tag FROM material_tags WHERE type=1 ORDER BY tag DESC`;
    DB.query(SELECT, function (err, tags) {
      if (err) {
        res.status(200).send({ status: "err", data: [], tags: [] });
        return;
      }

      res.status(200).send({ status: "ok", data: Backdrop, tags: tags });
    });
  });
});

// 随机获取一个背景
router.post("/getRandomBackdrop", function (req, res) {
  const SELECT =
    `SELECT name, md5, info0, info1, info2 FROM material_backdrop` +
    ` JOIN (SELECT MAX(id) AS maxId, MIN(id) AS minId FROM material_backdrop WHERE state=1) AS m ` +
    ` WHERE id >= ROUND(RAND()*(m.maxId - m.minId) + m.minId) AND state=1 LIMIT 1`;
  DB.query(SELECT, function (err, B) {
    if (err || B.length < 1) {
      res.status(200).send({ status: "err", data: {} });
      return;
    }

    res.status(200).send({ status: "ok", data: B[0] });
  });
});

// 获取造型
// 组件获取条件 tag：是否获取分类; f: 搜索字符串; t: 分类; l: 已经获取的背景数; n: 每次获取的背景数，默认为32个
router.post("/getCostumeLibrary", function (req, res) {
  // //console.log(req.body);

  var WHERE = "";
  if (req.body.t != 0) {
    WHERE = " AND tagId=" + req.body.t;
  }

  if (req.body.f && req.body.f != "") {
    WHERE += ` AND name LIKE '%${req.body.f}%'`;
  }

  var SELECT = `SELECT id, name, md5, info0, info1, info2  FROM material_costume WHERE state=1 ${WHERE} ORDER BY name DESC LIMIT ${req.body.l},${req.body.n}`;
  DB.query(SELECT, function (err, Backdrop) {
    if (err) {
      res.status(200).send({ status: "err", data: [], tags: [] });
      return;
    }

    if (req.body.tag == 0) {
      res.status(200).send({ status: "ok", data: Backdrop, tags: [] });
      return;
    }

    // 取一次分类
    SELECT = `SELECT id, tag FROM material_tags WHERE type=3 ORDER BY tag DESC`;
    DB.query(SELECT, function (err, tags) {
      if (err) {
        res.status(200).send({ status: "err", data: [], tags: [] });
        return;
      }

      res.status(200).send({ status: "ok", data: Backdrop, tags: tags });
    });
  });
});

// 随机获取一个造型
router.post("/getRandomCostume", function (req, res) {
  const SELECT =
    `SELECT name, md5, info0, info1, info2 FROM material_costume` +
    ` JOIN (SELECT MAX(id) AS maxId, MIN(id) AS minId FROM material_costume WHERE state=1) AS m ` +
    ` WHERE id >= ROUND(RAND()*(m.maxId - m.minId) + m.minId) AND state=1 LIMIT 1`;
  DB.query(SELECT, function (err, B) {
    if (err || B.length < 1) {
      res.status(200).send({ status: "err", data: {} });
      return;
    }

    res.status(200).send({ status: "ok", data: B[0] });
  });
});

// 获取声音
// 组件获取条件 tag：是否获取分类; f: 搜索字符串; t: 分类; l: 已经获取的背景数; n: 每次获取的背景数，默认为32个
router.post("/getSoundLibrary", function (req, res) {
  var WHERE = "";
  if (req.body.t != 0) {
    WHERE = " AND tagId=" + req.body.t;
  }

  if (req.body.f && req.body.f != "") {
    WHERE += ` AND name LIKE '%${req.body.f}%'`;
  }

  var SELECT = `SELECT id, name, md5, format, rate, sampleCount FROM material_sound WHERE state=1 ${WHERE} ORDER BY name DESC LIMIT ${req.body.l},${req.body.n}`;
  DB.query(SELECT, function (err, Backdrop) {
    if (err) {
      res.status(200).send({ status: "err", data: [], tags: [] });
      return;
    }

    if (req.body.tag == 0) {
      res.status(200).send({ status: "ok", data: Backdrop, tags: [] });
      return;
    }

    // 取一次分类
    SELECT = `SELECT id, tag FROM material_tags WHERE type=4 ORDER BY tag DESC`;
    DB.query(SELECT, function (err, tags) {
      if (err) {
        res.status(200).send({ status: "err", data: [], tags: [] });
        return;
      }

      res.status(200).send({ status: "ok", data: Backdrop, tags: tags });
    });
  });
});
// 随机获取一个声音
router.post("/getRandomSound", function (req, res) {
  const SELECT =
    `SELECT name, md5, format, rate, sampleCount FROM material_sound` +
    ` JOIN (SELECT MAX(id) AS maxId, MIN(id) AS minId FROM material_sound WHERE state=1) AS m ` +
    ` WHERE id >= ROUND(RAND()*(m.maxId - m.minId) + m.minId) AND state=1 LIMIT 1`;
  DB.query(SELECT, function (err, B) {
    if (err || B.length < 1) {
      res.status(200).send({ status: "err", data: {} });
      return;
    }

    res.status(200).send({ status: "ok", data: B[0] });
  });
});

// 获取角色
// 组件获取条件 tag：是否获取分类; f: 搜索字符串; t: 分类; l: 已经获取的素材数; n: 每次获取的素材数，默认为32个
router.post("/getSpriteLibrary", function (req, res) {
  var WHERE = "";
  if (req.body.t != 0) {
    WHERE = " AND tagId=" + req.body.t;
  }

  if (req.body.f && req.body.f != "") {
    WHERE += ` AND name LIKE '%${req.body.f}%'`;
  }

  var SELECT = `SELECT id, name, json FROM material_sprite WHERE state=1 ${WHERE} ORDER BY name DESC LIMIT ${req.body.l},${req.body.n}`;
  DB.query(SELECT, function (err, Backdrop) {
    if (err) {
      res.status(200).send({ status: "err", data: [], tags: [] });
      return;
    }

    if (req.body.tag == 0) {
      res.status(200).send({ status: "ok", data: Backdrop, tags: [] });
      return;
    }

    // 取一次分类
    SELECT = `SELECT id, tag FROM material_tags WHERE type=2 ORDER BY tag DESC`;
    DB.query(SELECT, function (err, tags) {
      if (err) {
        res.status(200).send({ status: "err", data: [], tags: [] });
        return;
      }

      res.status(200).send({ status: "ok", data: Backdrop, tags: tags });
    });
  });
});
// 随机获取一个角色
router.post("/getRandomSprite", function (req, res) {
  const SELECT =
    `SELECT name, json FROM material_sprite` +
    ` JOIN (SELECT MAX(id) AS maxId, MIN(id) AS minId FROM material_sprite WHERE state=1) AS m ` +
    ` WHERE id >= ROUND(RAND()*(m.maxId - m.minId) + m.minId) AND state=1 LIMIT 1`;
  DB.query(SELECT, function (err, B) {
    if (err || B.length < 1) {
      res.status(200).send({ status: "err", data: {} });
      return;
    }

    res.status(200).send({ status: "ok", data: B[0] });
  });
});

//Scratch启动时，自动获取一次登录信息
router.post("/getSession", (req, res) => {
  if (!res.locals.login) {
    var new_session = {
      userid: 0,
      username: "",
      nickname: "",
      avatar: ``,
    };
  } else {
    var new_session = {
      userid: parseInt(req.session["userid"]),
      username: req.session["username"],
      nickname: req.session["nickname"],
      avatar: `${process.env.qiniuurl}/user/${req.session.userid}.png`,
    };
  }

  res.status(200).send(JSON.stringify(new_session));
});
//从Scratch中退出
router.post("/logout", function (req, res) {
  logout(req, res);
  var login_info = [{ username: "OurWorldExampleUser", success: 1 }];
  res.status(200).send(login_info);
});
module.exports = router;

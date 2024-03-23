var express = require('express');
var router = express.Router();

var DB = require("./lib/database.js"); // 数据库


router.all('*', function (req, res, next) {
	next();
});
//router.get('/', function (req, res) {})

//首页
router.get("/", function (req, res) {
    //获取已分享的作品总数：1:普通作品，2：推荐的优秀作品
    var SQL =
      `SELECT ` +
      ` (SELECT count(id) FROM python WHERE state>0 ) AS python_count `;
    DB.query(SQL, function (err, data) {
      if (err) {
        // console.error('数据库操作出错：');
        res.locals.python_count = 0;
      } else {
        res.locals.python_count = data[0].python_count;
      }
  
        res.render("python/python_projects.ejs");
    
    });
  });

//翻页：Python作品列表：数据
router.post("/view/getPythonProjects", function (req, res) {
    var curr = parseInt(req.body.curr); //当前要显示的页码
    var limit = parseInt(req.body.limit); //每页显示的作品数
    var type = "view_count";
    if (req.body.type == "new") {
      type = "time";
    }
  
    var SQL = `SELECT python.id, python.title, python.state,python.authorid, python.description,user.nickname,user.motto FROM python JOIN user ON python.authorid = user.id WHERE python.state > 0 ORDER BY python.${type} DESC LIMIT ${
      (curr - 1) * limit
    }, ${limit}`;
    DB.query(SQL, function (err, data) {
      if (err) {
        res.status(200).send([]);
      } else {
        res.status(200).send(data);
      }
    });
  });

//搜索：Scratch项目列表：数据//只搜索标题
router.post("/view/seachPythonProjects", function (req, res) {
    if (!req.body.txt) {
      res.status(200).send([]);
      return;
    }
    var tabelName = "python";
    var searchinfo = "title";
    if (req.body.searchall == "true") {
      searchinfo = "src";
    }
    //var SQL = `SELECT id, title FROM ${tabelName} WHERE state>0 AND (${searchinfo} LIKE ?) LIMIT 12`;
    var SQL = `SELECT ${tabelName}.id, ${tabelName}.title, ${tabelName}.state,${tabelName}.authorid,${tabelName}.description, user.nickname,user.motto FROM ${tabelName} JOIN user ON ${tabelName}.authorid = user.id WHERE ${tabelName}.state>0 AND (${searchinfo} LIKE ?)`;
    var WHERE = [`%${req.body.txt}%`];
    DB.qww(SQL, WHERE, function (err, data) {
      if (err) {
        res.status(200).send([]);
      } else {
        res.status(200).send(data);
      }
    });
  });
  
//python项目展示界面
router.get('/play', function (req, res) {
    
            res.render('python/python_play.ejs');
        });

//项目点赞
router.post('/play/like', function (req, res) {
    if (!res.locals.login){
        res.status(200).send( {'status': 'failed','msg': '请先登录'});
        return;
    }

    var pid = req.body['pid'];
    var SQL = `SELECT id FROM python_like WHERE userid='${res.locals.userid}' AND projectid=${pid} LIMIT 1`;
    DB.query(SQL, function(err, LIKE){
        if (err){
            res.status(200).send( {'status': 'failed','msg': '数据错误，请再试一次'});
            return;            
        }
        
        if (LIKE.length==0){
            //插入一条点赞记录、python表like_count+1
            var UPDATE = `UPDATE python SET like_count=like_count+1 WHERE id=${pid} LIMIT 1`;
            DB.query(UPDATE, function(err, PYTHON){
                if (err|| PYTHON.changedRows==0){
                    res.status(200).send( {'status': 'failed','msg': '数据错误，请再试一次'});
                    return;  
                }

                var INSERT =`INSERT INTO python_like (userid, projectid) VALUES ('${res.locals.userid}', ${pid})`;
                DB.query(INSERT, function(err, LIKE){
                    if (err || LIKE.affectedRows == 0){
                        res.status(200).send( {'status': 'failed','msg': '数据错误，请再试一次'});
                        return; 
                    }

                    res.status(200).send( {'status': '1','opt':1,'msg': '感谢点赞！'});
                });
            });
        } else {
            //删除一条点赞记录、python表like_count-1
            var UPDATE = `UPDATE python SET like_count=like_count-1 WHERE id=${pid} LIMIT 1`;
            DB.query(UPDATE, function(err, PYTHON){
                if (err|| PYTHON.changedRows==0){
                    res.status(200).send( {'status': 'failed','msg': '数据错误，请再试一次'});
                    return;  
                }

                var INSERT =`DELETE FROM python_like WHERE id=${LIKE[0].id} LIMIT 1`;
                DB.query(INSERT, function(err, LIKE){
                    if (err || LIKE.affectedRows == 0){
                        res.status(200).send( {'status': 'failed','msg': '数据错误，请再试一次'});
                        return; 
                    }

                    res.status(200).send( {'status': '1','opt':-1,'msg': '操作成功'});
                });
            });
        }
    });
});
//项目收藏
router.post('/play/favo', function (req, res) {
    if (!res.locals.login){
        res.status(200).send( {'status': 'failed','msg': '请先登录'});
        return;
    }

    var pid = req.body['pid'];
    var SQL = `SELECT id FROM python_favo WHERE userid='${res.locals.userid}' AND projectid=${pid} LIMIT 1`;
    DB.query(SQL, function(err, FAVO){
        if (err){
            res.status(200).send( {'status': 'failed','msg': '数据错误，请再试一次'});
            return;            
        }
        
        if (FAVO.length==0){
            //插入一条收藏记录、python表favo_count+1
            var UPDATE = `UPDATE python SET favo_count=favo_count+1 WHERE id=${pid} LIMIT 1`;
            DB.query(UPDATE, function(err, PYTHON){
                if (err|| PYTHON.changedRows==0){
                    res.status(200).send( {'status': 'failed','msg': '数据错误，请再试一次'});
                    return;  
                }

                var INSERT =`INSERT INTO python_favo (userid, projectid) VALUES ('${res.locals.userid}', ${pid})`;
                DB.query(INSERT, function(err, FAVO){
                    if (err || FAVO.affectedRows == 0){
                        res.status(200).send( {'status': 'failed','msg': '数据错误，请再试一次'});
                        return; 
                    }

                    res.status(200).send( {'status': '1','opt':1,'msg': '感谢收藏！'});
                });
            });
        } else {
            //删除一条收藏记录、python表favo_count-1
            var UPDATE = `UPDATE python SET favo_count=favo_count-1 WHERE id=${pid} LIMIT 1`;
            DB.query(UPDATE, function(err, PYTHON){
                if (err|| PYTHON.changedRows==0){
                    res.status(200).send( {'status': 'failed','msg': '数据错误，请再试一次'});
                    return;  
                }

                var INSERT =`DELETE FROM python_favo WHERE id=${FAVO[0].id} LIMIT 1`;
                DB.query(INSERT, function(err, FAVO){
                    if (err || FAVO.affectedRows == 0){
                        res.status(200).send( {'status': 'failed','msg': '数据错误，请再试一次'});
                        return; 
                    }

                    res.status(200).send( {'status': '1','opt':-1,'msg': '操作成功'});
                });
            });
        }
    });
});



//python项目编辑界面：获取项目源代码
router.get('/edit', function (req, res) {
	res.render('python/python_edit.ejs');
})
//python兼容编辑器
router.get('/old', function (req, res) {
	res.render('python/python_edit_old.ejs');
})
// 从数据库获取作品
router.post('/getWork', function (req, res) {
    var projectid = 0;
    if (req.body.id && req.body.id>1){
        projectid = req.body.id;
    }

    if (projectid == 0 || projectid == 1){ // 默认作品
        //***当把该块注释后，则从数据库加载默认作品***
        //从指定文件加载默认作品：BEGIN==========================================
        // var DefaultPython={
        //     "id":0,
        //     "title":"Python新项目",
        //     "state":0,
        //     "src":`import turtle\n\nt = turtle.Turtle()\nt.forward(100)\n\nprint ("Welcome to ourworld!")`
        // };
        // if (projectid == 1){
        // 	res.status(200).send({status:'ok',work:DefaultPython});
        //     return;
        // }
        //从指定文件加载默认作品：END============================================
        //*/
        SQL = `SELECT * FROM python WHERE id=1`;//默认作品为1号作品
    } else {
        if (!res.locals.login){//未登录时，只能打开已发布的作品
            SQL = `SELECT * FROM python WHERE id=${projectid} AND state>0`;
        }else {
           
                //作品编辑：能够打开一个作品的几种权限：
                //1、自己的作品；
                //2、开源的作品；
                SQL = `SELECT * FROM python WHERE id=${projectid} AND (authorid='${res.locals.userid}' OR state>0)`;
            
            
        }
    }

    DB.query(SQL, function(err, WORK) {
        if (err||WORK.length==0) {
            res.status(200).send({status:'x', msg:"作品不存在或无权打开"});//需要前端内部处理
        } else {
			var UPDATE = `UPDATE python SET view_count=view_count+1 WHERE id=${projectid} LIMIT 1`;
			DB.query(UPDATE, function(err, s) { if (err) { } });

            if (WORK[0].id == 1) {
                WORK[0].id = 0; // 通知浏览器作品ID为0
            }
            res.status(200).send({status:'ok', work:WORK[0]});
        }
    });
});

// python 保存
router.post('/save', function (req, res) {
    if (!res.locals.userid){
        res.status(200).send({status: "x", msg: "请先登录" });
        return;
    }

    // 新作品
	if (req.body.id == '0'){
		var INSERT =`INSERT INTO python (authorid, title,src) VALUES ('${res.locals.userid}', ?, ?)`;
		var SET = [req.body.title,req.body.data]
		DB.qww(INSERT, SET, function (err, newPython) {
			if (err || newPython.affectedRows==0) {
				res.status(200).send({status: "x", msg: "保存失败" });
				return;
			}
	
			res.status(200).send({status: "ok", msg: "保存成功", 'newid': newPython['insertId']})
		});

		return;
	}

    // 旧作品
    var UPDATE =`UPDATE python SET ? WHERE id=${req.body.id} AND authorid='${res.locals.userid}' LIMIT 1`;
    var SET = {
        title:req.body.title,
        src:req.body.data,
        description:req.body.description
    }
    DB.qww(UPDATE, SET, function (err, u) {
        if (err) {
            res.status(200).send({status: "x", msg: "保存失败" });
            return;
        }

        res.status(200).send({status: "ok", msg: "保存成功" })
    })
});

router.post('/publish', function (req, res) {
    if (!res.locals.userid){
        res.status(200).send({status: "x", msg: "请先登录" });
        return;
    }

	var state = req.body.s=="0"? 1:0;
	var UPDATE = `UPDATE python SET state=${state} WHERE id=${req.body.id} AND authorid='${res.locals.userid}' LIMIT 1`;
	DB.query(UPDATE, function (err, u) {
		if (err) {
			res.status(200).send({status: "x", msg: "操作失败！"});
			return;
		}

		res.status(200).send({status: "ok", msg: "操作成功"})
	})
})



// python 优秀作品
router.post('/YxLibrary_count', function (req, res) {
    var SQL = `SELECT count(id) AS c FROM python WHERE state=2`;
    DB.query(SQL, function (err, COUNT){
        if (err) {
            res.status(200).send({status:'ok', total: 0});
        } else {
            res.status(200).send({status:'ok', total: COUNT[0].c});

        }
    });
})
//显示Python项目列表：数据，流加载模式
router.post('/YxLibrary_data', function (req, res) {
    //获取当前数据集合：以被浏览次数降序排列，每次取16个
    var page = parseInt(req.body.page);
    SQL = `SELECT python.id, python.authorid, python.view_count, python.time, python.title, python.description, user.nickname AS author_nickname FROM python `+
    ` LEFT JOIN user ON user.id=python.authorid `+
    ` WHERE python.state=2 ORDER BY python.view_count DESC LIMIT ${(page-1)*16},${16}`;
    DB.query(SQL, function (err, data) {
        if (err) {
            res.status(200).send({status:'ok', data:[]});
        } else {
            res.status(200).send({status:'ok', data:data});
        }
    });
});



router.all('*', function (req, res, next) {
    if (!res.locals.userid){
        res.status(200).send({status: "x", msg: "请先登录" });
        return;
    }

	next();
});

router.post('/MyLibrary_count', function (req, res) {
    var SQL = `SELECT count(id) AS c FROM python WHERE authorid='${res.locals.userid}'`;
    DB.query(SQL, function (err, COUNT){
        if (err) {
            res.status(200).send({status:'ok', total: 0});
        } else {
            res.status(200).send({status:'ok', total: COUNT[0].c});

        }
    });
})
router.post('/MyLibrary_data', function (req, res) {
    //获取当前数据集合：以被浏览次数降序排列，每次取16个
    var page = parseInt(req.body.page);
    SQL = `SELECT id, state, time, title FROM python WHERE authorid='${res.locals.userid}' ORDER BY time DESC LIMIT ${(page-1)*16},${16}`;
    DB.query(SQL, function (err, data) {
        if (err) {
            res.status(200).send({status:'ok', data:[]});
        } else {
            res.status(200).send({status:'ok', data:data});
        }
    });
});


module.exports = router;
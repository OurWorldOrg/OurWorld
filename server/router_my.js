//个人中心
var express = require('express');
var router = express.Router();
var fs = require('fs');
var crypto = require('crypto');
//功能函数集
var I = require('./lib/fuck.js');
//数据库
var DB = require("./lib/database.js");

router.all('*', function(req, res, next) {
    //限定访问该模块的权限：必须已登录
    if (!res.locals.login){//未登录时，跳转到登录界面
        res.redirect("/user/login");
        return;
    }

    //设置导航栏选中情况
    res.locals['curItem'] = {};
	next();
});

//个人中心：当前版本，直接跳转到个人作品
router.get('/', function (req, res) {
    res.redirect('/my/scratch');    
});
router.get('/project', function (req, res) {
    res.redirect('/my/scratch');    
});

//作品
router.get('/scratch', function (req, res) {
    var SQL = `SELECT `+
        ` count(case when state=0 then 1 end) AS state0_count, `+
        ` count(case when state=1 then 1 end) AS state1_count, `+
        ` count(case when state=2 then 1 end) AS state2_count `+
        ` FROM scratch WHERE authorid=${res.locals['userid']}`;
    
    DB.query(SQL, function(err, data){
        if (err){
            res.locals.state0_count = 0;
            res.locals.state1_count = 0;
            res.locals.state2_count = 0;
        }else{
            res.locals.state0_count = data[0].state0_count;
            res.locals.state1_count = data[0].state1_count;
            res.locals.state2_count = data[0].state2_count;
        }
        res.render('scratch/my_scratch_projects.ejs');
    });
});  

//作品
router.get('/python', function (req, res) {
    var SQL = `SELECT `+
        ` count(case when state=0 then 1 end) AS state0_count, `+
        ` count(case when state=1 then 1 end) AS state1_count, `+
        ` count(case when state=2 then 1 end) AS state2_count `+
        ` FROM python WHERE authorid='${res.locals.userid}'`;
    
    DB.query(SQL, function(err, data){
        if (err){
            res.locals.state0_count = 0;
            res.locals.state1_count = 0;
            res.locals.state2_count = 0;
        }else{
            res.locals.state0_count = data[0].state0_count;
            res.locals.state1_count = data[0].state1_count;
            res.locals.state2_count = data[0].state2_count;
        }
        res.render('python/my_python_projects.ejs');
    });
});  
//显示Scratch项目列表：数据，{curr:obj.curr, limit:obj.limit,state:state}
router.post('/getScratchProjects', function (req, res) {
    var curr = parseInt(req.body.curr);     //当前要显示的页码
    var limit = parseInt(req.body.limit);   //每页显示的作品数
    var state = parseInt(req.body.state);   //每页显示的作品状态

    var SQL = `SELECT id, title,view_count,description FROM scratch WHERE authorid='${res.locals.userid}' AND state=${state} ORDER BY view_count DESC LIMIT ${(curr-1)*limit}, ${limit}`;
    DB.query(SQL, function (err, data) {
        if (err) {
            res.status(200).send([]);
        } else {
            res.status(200).send(data);
        }
    });
});

//显示Scratch项目列表：数据，{curr:obj.curr, limit:obj.limit,state:state}
router.post('/getPythonProjects', function (req, res) {
    var curr = parseInt(req.body.curr);     //当前要显示的页码
    var limit = parseInt(req.body.limit);   //每页显示的作品数
    var state = parseInt(req.body.state);   //每页显示的作品状态

    var SQL = `SELECT id, title,view_count,description FROM python WHERE authorid='${res.locals.userid}' AND state=${state} ORDER BY view_count DESC LIMIT ${(curr-1)*limit}, ${limit}`;
    DB.query(SQL, function (err, data) {
        if (err) {
            res.status(200).send([]);
        } else {
            res.status(200).send(data);
        }
    });
});

//分享Scratch项目
router.post('/scratch/share', function (req, res) {
    var SQL = `UPDATE scratch SET state=1 WHERE id=${ req.body['id']} AND authorid='${res.locals.userid}' LIMIT 1`;
    DB.query(SQL, function (err, d) {
        if (err) {
            res.status(200).send(I.msg_fail);
            return;
        }

        res.status(200).send( { 'status': 'success', 'msg':'分享成功' });
    });
});

//分享Scratch项目
router.post('/python/share', function (req, res) {
    var SQL = `UPDATE python SET state=1 WHERE id=${ req.body['id']} AND authorid='${res.locals.userid}' LIMIT 1`;
    DB.query(SQL, function (err, d) {
        if (err) {
            res.status(200).send(I.msg_fail);
            return;
        }

        res.status(200).send( { 'status': 'success', 'msg':'分享成功' });
    });
});

//简介
router.post('/scratch/setdescription', function (req, res) {
    var SET= {description:req.body['description']};
    var SQL = `UPDATE scratch SET ? WHERE id=${ req.body['id']} AND authorid='${res.locals.userid}' LIMIT 1`;
    DB.qww(SQL,SET, function (err, d) {
        if (err) {
            res.status(200).send(I.msg_fail);
            return;
        }

        res.status(200).send( { 'status': 'success', 'msg':'设置成功' });
    });
});

//简介
router.post('/python/setdescription', function (req, res) {
    var SET= {description:req.body['description']};
    var SQL = `UPDATE python SET ? WHERE id=${ req.body['id']} AND authorid='${res.locals.userid}' LIMIT 1`;
    DB.qww(SQL,SET, function (err, d) {
        if (err) {
            res.status(200).send(I.msg_fail);
            return;
        }

        res.status(200).send( { 'status': 'success', 'msg':'设置成功' });
    });
});


//取消分享Scratch项目
router.post('/scratch/noshare', function (req, res) {
    var SQL = `UPDATE scratch SET state=0 WHERE id=${ req.body['id']} AND authorid='${res.locals.userid}' LIMIT 1`;
    DB.query(SQL, function (err, d) {
        if (err) {
            res.status(200).send(I.msg_fail);
            return;
        }

        res.status(200).send( { 'status': 'success', 'msg':'取消分享成功' });
    });
});

//取消分享Scratch项目
router.post('/python/noshare', function (req, res) {
    var SQL = `UPDATE python SET state=0 WHERE id=${ req.body['id']} AND authorid='${res.locals.userid}' LIMIT 1`;
    DB.query(SQL, function (err, d) {
        if (err) {
            res.status(200).send(I.msg_fail);
            return;
        }

        res.status(200).send( { 'status': 'success', 'msg':'取消分享成功' });
    });
});




//删除Scratch项目
router.post('/scratch/del', function (req, res) {
    var DEL = `DELETE FROM scratch WHERE id=${ req.body['id']} AND authorid='${res.locals.userid}' LIMIT 1`;
    DB.query(DEL, function (err, d) {
        if (err) {
            res.status(200).send(I.msg_fail);
            return;
        }

        if (d.affectedRows==0) {
            res.status(200).send( {'status': 'failed','msg': '删除失败'});
            return;
        }

        //var filename = ('./data/scratch_slt/' + req.body['id']);
        //I.qiniudelete('scratch_slt/' + req.body['id'])
        //fs.unlink(filename,function (err) {if(err){}});

        res.status(200).send( { 'status': 'success', 'msg':'删除成功' });
    });
});

//删除Scratch项目
router.post('/python/del', function (req, res) {
    var DEL = `DELETE FROM python WHERE id=${ req.body['id']} AND authorid='${res.locals.userid}' LIMIT 1`;
    DB.query(DEL, function (err, d) {
        if (err) {
            res.status(200).send(I.msg_fail);
            return;
        }

        if (d.affectedRows==0) {
            res.status(200).send( {'status': 'failed','msg': '删除失败'});
            return;
        }

        

        res.status(200).send( { 'status': 'success', 'msg':'删除成功' });
    });
});



//个人设置
router.get('/info', function (req, res) {
    res.locals['curItem']['set'] = 'active';
    var SQL = `SELECT * FROM user WHERE id='${res.locals.userid}' LIMIT 1`;
    DB.query(SQL, function (err, USER) {
        if (err || USER.length == 0) {
            res.render('404.ejs');
            return;
        }

        res.locals['sex'] = USER[0]['sex'];
        res.locals['birth'] = USER[0]['birthday'];
        res.locals['motto'] = USER[0]['motto'];

        res.render('my_info.ejs');
    });
});
//修改头像
router.post('/set/avatar', function (req, res) {
   //保存文件到正确位置
   if (!req['files']['file']) {
       res.status(200).send( {'status':'文件上传失败'} );
       return;
   }

   tmppath = req['files']['file']['path'];
   newpath = `./data/user/'${res.locals.userid}'.png`;
   fs.rename(tmppath, newpath,function (err) {
       if (err) {
           res.status(200).send( {'status':'文件上传失败'} );
           return;
       }

       // 计算图片的md5值
       const hash = crypto.createHash('md5');
       const chunks = fs.createReadStream(newpath);
       chunks.on('data', (chunk) => {
           hash.update(chunk);
       });
       chunks.on('end', () => {
           const hashValue = hash.digest('hex');
           // 上传到七牛云
           I.S3update(`user/${hashValue}.png`,newpath,res.locals.username);
           var UPDATE = `UPDATE user SET ? WHERE id='${res.locals.userid}' LIMIT 1`;
           var SET = {
               'images':hashValue,
           };
           DB.qww(UPDATE, SET, function (err, u) {
            if (err) {
                res.status(200).send( {'status':'请再试一次'});
                return;
            }
            res.status(200).send( {'status': 'ok'} );
         
          });
           
       });
   });
});
//修改个人信息
router.post('/set/userinfo', function (req, res) {
    var UPDATE = `UPDATE user SET ? WHERE id='${res.locals.userid}' LIMIT 1`;
    var SET = {
        'nickname':req.body['nickname'],
        'motto': req.body['aboutme'],
        'sex': req.body['sex'],
        'birthday': new Date(`${req.body['year']}-${req.body['month']}-${req.body['day']} 00:00:00`)
    };
    DB.qww(UPDATE, SET, function (err, u) {
        if (err) {
            res.status(200).send( {'status':'请再试一次'});
            return;
        }
            
            res.locals['nickname'] = req.body['nickname'];
       
            var UPDATE = `UPDATE wl_Users SET ? WHERE email='${res.locals.username}' LIMIT 1`;
            var SET = {
                'display_name':req.body['nickname'],
            };
            DB.qww(UPDATE, SET, function (err, u) {
                if (err) {
                    res.status(200).send( {'status':'请再试一次'});
                    return;
                }
                
                res.cookie("token",I.GenerateJwt(res.locals["userid"],res.locals["username"],res.locals["nickname"]),{maxAge: 604800000,});
                res.status(200).send( {'status': '个人信息修成成功'});
              });
     
      });
});
//修改密码：动作
router.post('/set/pw', function (req, res) {
    var oldPW = I.md5(I.md5(req.body['oldpw'])+res.locals.username);
    //console.log(oldPW)
    //console.log(req.body['oldpw'])
    //console.log(res.locals.username)
    //console.log(req.body['newpw'])
    var newPW = I.md5(I.md5(req.body['newpw'])+res.locals.username);
    //console.log(newPW)
    //判断用户是手机账号用户、校区自己生成的账号

    SET = {pwd:newPW};
    UPDATE = `UPDATE user SET ? WHERE id='${res.locals.userid}' AND pwd="${oldPW}" LIMIT 1`;
    DB.qww(UPDATE, SET, function (err, u) {
        if (err) {
            res.status(200).send({'status': '请再试一次'});
            return;
        }
        //if (u.changedRows==0) { res.status(200).send( {'status': '原密码错误'}); return; }

        res.status(200).send( {'status':'ok'});
    });
});


module.exports = router;
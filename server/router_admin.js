//系统平台部分
var express = require('express');
var router = express.Router();
var fs = require('fs');

//功能函数集
var I = require('./lib/fuck.js');

//数据库
var DB = require("./lib/database.js");


router.all('*', function(req, res, next) {
    if (!res.locals.login){
        res.render('404.ejs');
        return;
    }

	if ( res.locals['is_admin'] != 1) {
        res.render('404.ejs');
        return;
    }

	next();
});
//平台首页
router.get('/', function (req, res) {    
    res.render('admin/admin_index.ejs');
});
//平台默认首页
router.get('/default', function (req, res) {    
    res.render('admin/admin_default.ejs');

});

//平台概况
router.get('/info', function (req, res) {   
    var SQL = `SELECT `+
               ` (SELECT count(id) FROM user) AS user_count, `+ 
               ` (SELECT count(id) FROM scratch) AS scratch_count, ` +
               ` (SELECT count(id) FROM python) AS python_count, ` +
               ` (SELECT count(id) FROM material_backdrop) AS backdrop_count, `+
               ` (SELECT count(id) FROM material_sprite) AS sprite_count `;
    DB.query(SQL, function(err,d){
        if (err||d.length==0){

            res.locals['user_count'] = 0;
            res.locals['scratch_count'] = 0;
            res.locals['python_count'] = 0;
            res.locals['backdrop_count'] = 0;
            res.locals['sprite_count'] = 0;
        } else {
            res.locals['user_count'] = d[0].user_count;
            res.locals['scratch_count'] = d[0].scratch_count;
            res.locals['python_count'] = d[0].python_count;
            res.locals['backdrop_count'] = d[0].backdrop_count;
            res.locals['sprite_count'] = d[0].sprite_count;
        }

        res.render('admin/admin_info.ejs');
    })
});


//用户管理
router.get('/user', function (req, res) {
    var SQL = `SELECT id FROM sys_ini WHERE iniKey='regist' AND iniValue=1 LIMIT 1`; 
    DB.query(SQL, function(err, data){
        if (err || data.length == 0){
            res.locals.regist = 0;
        } else {
            res.locals.regist = 1
        }
        res.render('admin/admin_user.ejs');
    });
});
//用户管理：数据。0正常用户，2封号用户
router.get('/user/data', function(req, res) {
    var state = parseInt(req.query['s']);
    if (state == 9){//0：正常用户，2：封号用户，9：查找用户
        var SQL = `SELECT count(id) AS c FROM user WHERE username LIKE '%${req.query.t}%'`;
    } else {
        var SQL = `SELECT count(id) AS c FROM user WHERE state=${state}`;
    }
    DB.query(SQL,function (err, count){
        if (err || count.length==0 || count[0]['c']==0) {
            res.status(200).send({'count':0,'data':[]});
            return;
        }
        //获取当前数据集合
        var page = parseInt(req.query['page']);
        var limit = parseInt(req.query['limit']);

        if (state == 9){//0：正常用户，2：封号用户，9：查找用户
            SQL = `SELECT id,username,nickname,state,regTime FROM user WHERE username LIKE '%${req.query.t}%' LIMIT ${(page-1)*limit}, ${limit}`;
        } else {
            SQL = `SELECT id,username,nickname,state,regTime FROM user WHERE state=${state} LIMIT ${(page-1)*limit}, ${limit}`;
        }
        DB.query(SQL, function (err, data) {
            if (err) {
                res.status(200).send({'count':0,'data':[]});
            } else {
                res.status(200).send({'count':count[0]['c'],'data':data});
            }
        });
    });
});
//管理员重置用户密码
router.post('/user_setpwd', function (req, res) {
    if (!req.body.pw || !req.body.un|| !I.userpwTest(req.body.pw)){
        res.status(200).send({"status":"failed","msg":"再试一次"});
        return;
    }

    //对密码进行加密
    let pw = I.md5(I.md5(req.body.pw)+req.body.un);
    var UPDATE = `UPDATE user SET pwd='${pw}' WHERE username='${req.body['un']}' LIMIT 1`;
    DB.query(UPDATE, function (err, d) {
        if (err) {
            res.status(200).send({"status":"failed","msg":"再试一次"})
        } else {
            res.status(200).send( {'status': 'success','msg': '密码重置成功'});
        }
    });
});
//用户管理：功能.0解封 2封号
router.post('/user_setstate',function(req,res){
    var state = 0;
    if (req.body['s'] == undefined || req.body['s'] !=0) {
        state = 2;//未知时，都当作封号处理
    }
    //var state = parseInt(req.body['s']);
    var UPDATE = `UPDATE user SET state=${state} WHERE id=${req.body.id} LIMIT 1`;
    DB.query(UPDATE, function(err,d){
        if(err){
            res.status(200).send({"status":"failed","msg":"再试一次"})
        }
        else {
            res.status(200).send({"status":"success",'msg':'操作成功'})        
        }
    })
});
//用户管理：创建新用户，功能
router.post('/user_new',function(req,res){ 
    if (!req.body.un|| !I.usernameTest(req.body.un)){
        res.status(200).send({"status":"failed","msg":"再试一次"});
        return;
    }
    //检查账号是否已存在
    var SQL = `SELECT id FROM user WHERE username='${req.body.un}' LIMIT 1`;
    DB.query(SQL, function (err, User) {
        if (err) {
            res.status(200).send( msg_fail);
            return;
        }
        if (User.length != 0) {
            res.status(200).send( {'status': 'fail','msg':'该账号已存在'});
            return;
        }

        //对密码进行加密:默认密码为用户手机号后8位
        var nn = req.body.un.substring(req.body.un.length-6);//昵称
        var pw = nn;//req.body.un.substring(req.body.un.length-6);//初始密码
        pw = I.md5(I.md5(pw)+req.body.un);
        SQL = `INSERT INTO user (username,pwd,nickname) VALUES ('${req.body.un}','${pw}','${nn}')`;
        DB.query(SQL, function (err, newUser) {
            if (err) {
                res.status(200).send( { 'status': 'fail', 'msg': '再试一次' });
                return;
            }

            oldpath = './build/img/user_default_icon.png';
            newpath = './data/user/' + newUser.insertId + '.png';
            let oldFile = fs['createReadStream'](oldpath);
            let newFile = fs['createWriteStream'](newpath);
            oldFile['pipe'](newFile);
            

            res.status(200).send( { 'status': 'success', 'msg': '操作成功' });
        });
    });
});
//用户管理：批量创建新用户，功能
router.post('/user_new100',function(req,res){ 
    const qz = req.body.qz;
    const sl = req.body.sl;
    var reg = /^(?:\d+|[a-zA-Z]+){4,8}$/;
    if (!reg['test'](qz)) {
        res.status(200).send({status: 'x', msg:'前缀格式不正确'});
        return;
    }

    reg = /^([0-9]+){1,3}$/;
    if (!reg['test'](sl)) {
        res.status(200).send({status: 'x', msg:'数量不正确：1~100'});
        return;
    }

    if (sl== 0 || sl>100) {
        res.status(200).send({status: 'x', msg:'数量不正确：1~100'});
        return;
    }

    // 生成账号

    for (var i=0; i<sl; i++){
        if (i<10){
            un = qz + '0' + i;
        } else {
            un = qz + i;
        }

        var pw = un.substring(un.length-6);//初始密码
        pw = I.md5(I.md5(pw)+un);
        SQL = `INSERT INTO user (username, pwd, nickname) VALUES ('${un}','${pw}','${un}')`;
        DB.query(SQL, function (err, newUser) {if (err) {return;}});
    }

    res.status(200).send({status: 'ok', msg: '操作成功' });
});

//用户管理：开启、关闭用户注册通道
router.post('/user/setRegist',function(req,res){
    let v=1;
    if (req.body.v != 1){
        v=0
    }

    var SQL = `UPDATE sys_ini SET iniValue=${v} WHERE iniKey='regist' LIMIT 1`;
    DB.query(SQL, function (err, User) {
        if (err) {
            res.status(200).send({status:'x', msg: '数据错误'});
            return;
        }
        
        res.status(200).send({status:'ok', msg: '操作成功'});
    });
});


//作品管理：Scratch页面
router.get('/works/scratch', function (req, res) {
    res.render('admin/admin_works_scratch.ejs');
});
//作品管理：Scratch数据
router.get('/works/scratch/data', function(req, res) {
    WHERE='';
    NICKNAME = '';//根据昵称查找
    if (req.query.w == 'search_state0'){
        WHERE = ` WHERE scratch.state=0 `;
    } else if (req.query.w == 'search_state1'){
        WHERE = ` WHERE scratch.state=1 `;
    } else if (req.query.w == 'search_state2'){
        WHERE = ` WHERE scratch.state=2 `;
    } else if (req.query.w == 'search_workname'){
        WHERE = ` WHERE scratch.title LIKE '%${req.query.v}%' `;
    } else if (req.query.w == 'search_nickname'){
        NICKNAME = ` AND user.nickname LIKE '%${req.query.v}%' `;
    }

    if (NICKNAME==''){
        var SQL = `SELECT count(id) AS c FROM scratch ${WHERE}`;
    } else {
        var SQL = `SELECT count(scratch.id) AS c FROM scratch `+
        ` INNER JOIN user ON (user.id=scratch.authorid ${NICKNAME}) `;
    }
    DB.query(SQL, function (err, count){
        if (err || count[0]['c']==0) {
            res.status(200).send({'count':0,'data':[]});
            return;
        }
        //获取当前数据集合
        var page = parseInt(req.query['page']);
        var limit = parseInt(req.query['limit']);
        SQL = `SELECT scratch.id, scratch.state, scratch.title, scratch.time, user.username, user.nickname FROM scratch `
             +` INNER JOIN user ON (user.id=scratch.authorid ${NICKNAME}) `
             +` ${WHERE} ORDER BY scratch.time DESC LIMIT ${(page-1)*limit},${limit}`;

        DB.query(SQL, function (err, data) {
            if (err) {
                res.status(200).send({'count':0,'data':[]});
            } else {
                res.status(200).send({'count':count[0]['c'],'data':data});
            }
        });
    });
});
//作品管理：设置作品的标题
router.post('/works/scratch/changeTitle',function(req,res){
    var UPDATE = `UPDATE scratch SET title=? WHERE id=${req.body.id} LIMIT 1`;
    var SET = [`${req.body.t}`]
    DB.qww(UPDATE, SET, function(err,d){
        if(err){
            res.status(200).send({"status":"failed","msg":"再试一次"})
        }
        else {
            res.status(200).send({"status":"success",'msg':'操作成功'})        
        }
    })
});
//作品管理：设置作品的发布状态
router.post('/works/scratch/setState',function(req,res){
    if (req.body.s == undefined || (req.body.s < 0 || 2 < req.body.s)) {
        s = 0;//未知时，都当作取消推荐处理
    }else{
        s = req.body.s;
    }

    var UPDATE = `UPDATE scratch SET state=${s} WHERE id=${req.body.id} LIMIT 1`;
    DB.query(UPDATE, function(err,d){
        if(err){
            res.status(200).send({"status":"failed","msg":"再试一次"})
        }
        else {
            res.status(200).send({"status":"success",'msg':'操作成功'})        
        }
    })
});
//作品管理：复制作品为默认作品
router.post('/works/scratch/setDefaultWork',function(req,res){
    if (!req.body.id || req.body.id == 1) { // 客服端传参数问题
        res.status(200).send({status:"ok", msg:"操作成功"});
        return;
    }

    const SELECT = `SELECT title, src FROM scratch WHERE id=${req.body.id}`;
    DB.query(SELECT, function(err,d){
        if(err || d.length==0){
            res.status(200).send({status:"x", msg:"再试一次"});
            return;
        }


        const UPDATE = `UPDATE scratch SET title=?, src=? WHERE id=1`;
        const VAL = [d[0].title, d[0].src]
        DB.qww(UPDATE, VAL, function(err,d){
            if(err){
                res.status(200).send({status:"x", msg:"再试一次"});
            } else {
                res.status(200).send({status:"ok",msg:'操作成功'});      
            }
        })
    })
});


//作品管理：Python页面
router.get('/works/python', function (req, res) {
    res.render('admin/admin_works_python.ejs');
});
//作品管理：Python数据
router.get('/works/python/data', function(req, res) {
    WHERE='';
    NICKNAME = '';//根据昵称查找
    if (req.query.w == 'search_state0'){
        WHERE = ` WHERE python.state=0 `;
    } else if (req.query.w == 'search_state1'){
        WHERE = ` WHERE python.state=1 `;
    } else if (req.query.w == 'search_state2'){
        WHERE = ` WHERE python.state=2 `;
    } else if (req.query.w == 'search_workname'){
        WHERE = ` WHERE python.title LIKE '%${req.query.v}%' `;
    } else if (req.query.w == 'search_nickname'){
        NICKNAME = ` AND user.nickname LIKE '%${req.query.v}%' `;
    }

    if (NICKNAME==''){
        var SQL = `SELECT count(id) AS c FROM python ${WHERE}`;
    } else {
        var SQL = `SELECT count(python.id) AS c FROM python `+
        ` INNER JOIN user ON (user.id=python.authorid ${NICKNAME}) `;
    }
    DB.query(SQL, function (err, count){
        if (err || count[0]['c']==0) {
            res.status(200).send({'count':0,'data':[]});
            return;
        }
        //获取当前数据集合
        var page = parseInt(req.query['page']);
        var limit = parseInt(req.query['limit']);
        SQL = `SELECT python.id, python.state, python.title, python.time, user.username, user.nickname FROM python `
             +` INNER JOIN user ON (user.id=python.authorid ${NICKNAME}) `
             +` ${WHERE} ORDER BY python.time DESC LIMIT ${(page-1)*limit},${limit}`;

        DB.query(SQL, function (err, data) {
            if (err) {
                res.status(200).send({'count':0,'data':[]});
            } else {
                res.status(200).send({'count':count[0]['c'],'data':data});
            }
        });
    });
});
//作品管理：Python 设置作品的标题
router.post('/works/python/changeTitle',function(req,res){
    var UPDATE = `UPDATE python SET title=? WHERE id=${req.body.id} LIMIT 1`;
    var SET = [`${req.body.t}`]
    DB.qww(UPDATE, SET, function(err,d){
        if(err){
            res.status(200).send({status:"x", msg:"再试一次"})
        }
        else {
            res.status(200).send({status:"ok", msg:'操作成功'})        
        }
    })
});
//作品管理：Python设置作品的发布状态
router.post('/works/python/setState',function(req,res){
    if (req.body.s == undefined || (req.body.s < 0 || 2 < req.body.s)) {
        s = 0;//未知时，都当作取消推荐处理
    }else{
        s = req.body.s;
    }

    var UPDATE = `UPDATE python SET state=${s} WHERE id=${req.body.id} LIMIT 1`;
    DB.query(UPDATE, function(err,d){
        if(err){
            res.status(200).send({status:"x", msg:"再试一次"})
        }
        else {
            res.status(200).send({status:"ok", msg:'操作成功'})        
        }
    })
});
//作品管理：Python复制作品为默认作品
router.post('/works/python/setDefaultWork',function(req,res){
    if (!req.body.id || req.body.id == 1) { // 客服端传参数问题
        res.status(200).send({status:"ok", msg:"操作成功"});
        return;
    }

    const SELECT = `SELECT title, src FROM python WHERE id=${req.body.id}`;
    DB.query(SELECT, function(err,d){
        if(err || d.length==0){
            res.status(200).send({status:"x", msg:"再试一次"});
            return;
        }


        const UPDATE = `UPDATE python SET title=?, src=? WHERE id=1`;
        const VAL = [d[0].title, d[0].src]
        DB.qww(UPDATE, VAL, function(err,d){
            if(err){
                res.status(200).send({status:"x", msg:"再试一次"});
            } else {
                res.status(200).send({status:"ok",msg:'操作成功'});      
            }
        })
    })
});










// 素材分类管理：数据
router.get('/material/tag', function(req, res) { 
    res.render('admin/admin_tag.ejs');
});
// 素材分类管理：数据
router.get('/material/tag/data', function(req, res) { 
    var type = parseInt(req.query['t']);
    if (!type || (type < 1 || 4 < type)) {// 1背景、2角色、3造型、4声音
        res.status(200).send({status:"x", msg: "素材类型参数错误"});
        return;
    }

    var SQL = `SELECT id, tag FROM material_tags WHERE type=${type} ORDER BY id DESC`;
    DB.query(SQL, function (err, tags){
        if (err) {
            res.status(200).send({status:"x", msg: "服务器错误"});
            return;
        }

        res.status(200).send({status:"ok", 'data':tags});
    });
});
// 素材分类管理：添加
router.post('/material/tag/add', function (req, res) {
    var type = parseInt(req.body.t);
    if (!type || (type < 1 || 4 < type)) {// 1背景、2角色、3造型、4声音
        res.status(200).send({status:"x", msg: "素材类型参数错误"});
        return;
    }

    if (!req.body.v || req.body.v == ''){
        res.status(200).send({status:"x", msg: "标签名错误"});
        return;
    }

    SQL = `INSERT INTO material_tags (type, tag) VALUES ('${type}', '${req.body.v}')`;
    DB.query(SQL, function (err, newTag) {
        if (err) {
            res.status(200).send({status:'x', msg: '保存数据错误，请再试一次' });
            return;
        }
        
        res.status(200).send({status:'ok', msg: '操作成功', newTagId: newTag.insertId});
    });
});
// 素材分类管理：修改
router.post('/material/tag/mod', function (req, res) {
    if (!req.body.v || req.body.v == ''){
        res.status(200).send({status:"x", msg: "标签名错误"});
        return;
    }

    SQL = `UPDATE material_tags SET tag=? WHERE id=?`;
    var VAL = [`${req.body.v}`,  req.body.id];
    DB.qww(SQL, VAL, function (err, TAG) {
        if (err) {
            res.status(200).send({status:'x', msg: '保存数据错误，请再试一次' });
            return;
        }

        res.status(200).send({status:'ok', msg: '操作成功'});
    });
});
// 素材分类管理：删除
router.post('/material/tag/del', function (req, res) {
    // 判断此标签下是否有素材：只能删除空标签
    var type = parseInt(req.body.t);
    var tabelname = '';// 1背景、2角色、3造型、4声音
    if (type == 1 ) { tabelname = "material_backdrop";} else 
    if (type == 2 ) { tabelname = "material_sprite";} else 
    if (type == 3 ) { tabelname = "material_costume";} else 
    if (type == 4 ) { tabelname = "material_sound";} 
    else { 
        res.status(200).send({status:"x", msg: "素材类型参数错误"});
        return;
    } 


    var VAL = [req.body.id];
    var SQL = `SELECT id FROM ${tabelname} WHERE tagId=? LIMIT 1`;
    DB.qww(SQL, VAL, function (err, MATE) {
        if (err) {
            res.status(200).send({status:'x', msg: '保存数据错误，请再试一次' });
            return;
        }

        if (MATE.length != 0) {
            res.status(200).send({status:'x', msg: '只能删除空标签' });
            return;
        }

        SQL = `DELETE FROM material_tags WHERE id=?`;
        DB.qww(SQL, VAL, function (err, TAG) {
            if (err) {
                res.status(200).send({status:'x', msg: '保存数据错误，请再试一次' });
                return;
            }

            res.status(200).send({status:'ok', msg: '操作成功'});
        });
    });
});


/*生成32位随机流水号*/
const random_32ID_With_Time_Tag = function() {
    var chars = 'ABCDEFabcdef0123456789';// 角色文件必须是：^[a-fA-F0-9]{32}$
    var maxPos = chars.length;
    var randomID = "B100" + parseInt(new Date().getTime()/1000).toString(16).toUpperCase();
    for (i = 0; i < 20; i++) {
        randomID += chars.charAt(Math.floor(Math.random() * maxPos));
    }
    return randomID;
}

    
// 背景管理：页面
router.get('/material/backdrop', function (req, res) {
    var SQL = `SELECT id, tag FROM material_tags WHERE type=1 ORDER BY id DESC`;
    DB.query(SQL, function (err, tags){
        if (err) {
            res.locals['tags'] = [];
        } else {
            res.locals['tags'] = tags;
        }

        res.render('admin/admin_material_backdrop.ejs');
    });   
});
// 背景管理：数据
router.get('/material/backdrop/data', function(req, res) {
    var VAL = [req.query.tagId];
    var SQL = `SELECT count(id) AS c FROM material_backdrop WHERE tagId=?`;
    DB.qww(SQL, VAL, function (err, count){
        if (err || count[0]['c']==0) {
            res.status(200).send({'count':0,'data':[]});
            return;
        }

        //获取当前数据集合
        var page = parseInt(req.query['page']);
        var limit = parseInt(req.query['limit']);
        SQL = `SELECT * FROM material_backdrop WHERE tagId=? ORDER BY id DESC LIMIT ${(page-1)*limit},${limit}`;
        DB.qww(SQL, VAL, function (err, data) {
            if (err) {
                res.status(200).send({'count':0,'data':[]});
            } else {
                res.status(200).send({'count':count[0]['c'],'data':data});
            }
        });
    });
});
// 背景管理：添加
router.post('/material/backdrop/add', function(req, res) {
    var newFileName = random_32ID_With_Time_Tag();
    const SQL = `INSERT INTO material_backdrop (tagId, md5) VALUES ('${req.body.tagId}', '${newFileName}.png')`;
    DB.query(SQL, function (err, newTag) {
        if (err) {
            res.status(200).send({status:'x', msg: '保存数据错误，请再试一次' });
            return;
        }
        
        //保存文件到正确位置
        exampleFile = `./data/material/backdrop_example.png`;
        md5File = `./data/material/asset/${newFileName}.png`;
        fs.copyFile(exampleFile, md5File, function (err) { if(err){}});

        res.status(200).send({status:'ok', msg: '操作成功'});
    });
});
// 背景管理：修改素材
router.post('/material/backdrop/modImage', function (req, res) {
    if (!req['files']['file']) {
        res.status(200).send({status: 'x', msg: '文件上传失败,请再试一次'});
        return;
    }
    
    //保存文件到正确位置
    const tmppath = req['files']['file']['path'];
    arr=tmppath.split(".")
    let newExt = arr[arr.length-1];//取上传文件的扩展名jpg|png|gif|svg|bmp
    if (newExt != 'jpg' && newExt != 'png' && newExt != 'gif' && newExt !='svg' && newExt !='bmp'){
        res.status(200).send({status:'x', msg: '文件类型错误，请再试一次' });
        return;
    }

    
    let md5 = req.body.md5;
    const oldExt = md5.substring(md5.length-3);
    if (oldExt == newExt){ // 后缀未变，直接替换
        const newpath = `./data/material/asset/${md5}`;
        fs.rename(tmppath, newpath, function (err) { if(err){}});

        res.status(200).send({ status: "ok", msg: "修改成功", imgFile: md5});
    } else {
        // 删除原图片文件
        fs.unlink(`./data/material/asset/${md5}`, function (err) {  if(err){ console.log(err); } });

        
        md5 = md5.substring(0, md5.length-3) + newExt; // 组合新文件名
        const newpath = `./data/material/asset/${md5}`;
        fs.rename(tmppath, newpath, function (err) { if(err){}});

        SQL = `UPDATE material_backdrop SET md5=? WHERE id=${req.body.id}`;
        VAL = [md5];
        DB.qww(SQL, VAL, function (err, R) {
            if (err) {
                res.status(200).send({status:'x', msg: '保存数据错误，请再试一次' });
                return;
            }

            res.status(200).send({ status: "ok", msg: "修改成功", imgFile: md5});
        });
    }
});
// 背景管理：修改名称
router.post('/material/backdrop/modName', function (req, res) {
    if (!req.body.v || req.body.v == ''){
        res.status(200).send({status:"x", msg: "名称错误"});
        return;
    }

    var SQL = `UPDATE material_backdrop SET name=? WHERE id=?`;
    var VAL = [req.body.v, req.body.id];
    DB.qww(SQL, VAL, function (err, Mate) {
        if (err) {
            res.status(200).send({status:'x', msg: '保存数据错误，请再试一次' });
            return;
        }
        
        res.status(200).send({status:'ok', msg: '操作成功'});
    });
});
// 背景管理：修改尺寸
router.post('/material/backdrop/modMateSize', function (req, res) {
    let infoValue = parseInt(req.body.v);
    if (req.body.t == 'info0' || req.body.t == 'info1'){
        if (!infoValue || infoValue<1 || 9999<infoValue) {
            res.status(200).send({status:"x", msg: "参数错误：宽、高只能在 1~9999 之间"});
            return;
        }    
    } else if (req.body.t == 'info2'){
        if (!infoValue || infoValue<1 || 2<infoValue) {
            res.status(200).send({status:"x", msg: "参数错误！显示方式：1=铺开显示；2=原图显示"});
            return;
        }   
    } else {
        res.status(200).send({status:"x", msg: "参数错误"});
        return;
    }

    const SQL = `UPDATE material_backdrop SET ${req.body.t}=${infoValue} WHERE id=?`;
    var VAL = [req.body.id];
    DB.qww(SQL, VAL, function (err, Mate) {
        if (err) {
            res.status(200).send({status:'x', msg: '保存数据错误，请再试一次' });
            return;
        }
        
        res.status(200).send({status:'ok', msg: '操作成功'});
    });
});
// 背景管理：删除：未删除其文件，仅仅删除数据库记录
router.post('/material/backdrop/del', function (req, res) {
    var VAL = [req.body.id];
    var SQL = `DELETE FROM material_backdrop WHERE id=?`;
    DB.qww(SQL, VAL, function (err, TAG) {
        if (err) {
            res.status(200).send({status:'x', msg: '保存数据错误，请再试一次' });
            return;
        }

        res.status(200).send({status:'ok', msg: '操作成功'});
    });
});
// 背景管理：状态管理
router.post('/material/backdrop/setState',function(req,res){
    let v = 0; //默认都当作 停用 处理
    if (req.body.v && req.body.v ==1) {
        v = 1;
    }

    var UPDATE = `UPDATE material_backdrop SET state=${v} WHERE id=${req.body.id} LIMIT 1`;
    DB.query(UPDATE, function(err,d){
        if(err){
            res.status(200).send({status:"x", msg:"再试一次"})
        }
        else {
            res.status(200).send({status:"ok", msg:'操作成功'})        
        }
    })
});

// 造型管理：页面
router.get('/material/costume', function (req, res) {
    var SQL = `SELECT id, tag FROM material_tags WHERE type=3 ORDER BY id DESC`;
    DB.query(SQL, function (err, tags){
        if (err) {
            res.locals['tags'] = [];
        } else {
            res.locals['tags'] = tags;
        }

        res.render('admin/admin_material_costume.ejs');
    }); 
});
// 造型管理：数据
router.get('/material/costume/data', function(req, res) {
    var VAL = [req.query.tagId];
    var SQL = `SELECT count(id) AS c FROM material_costume WHERE tagId=?`;
    DB.qww(SQL, VAL, function (err, count){
        if (err || count[0]['c']==0) {
            res.status(200).send({'count':0,'data':[]});
            return;
        }

        //获取当前数据集合
        var page = parseInt(req.query['page']);
        var limit = parseInt(req.query['limit']);
        SQL = `SELECT * FROM material_costume WHERE tagId=? ORDER BY id DESC LIMIT ${(page-1)*limit},${limit}`;
        DB.qww(SQL, VAL, function (err, data) {
            if (err) {
                res.status(200).send({'count':0,'data':[]});
            } else {
                res.status(200).send({'count':count[0]['c'],'data':data});
            }
        });
    });
});
// 造型管理：添加
router.post('/material/costume/add', function(req, res) {
    var newFileName = random_32ID_With_Time_Tag();
    const SQL = `INSERT INTO material_costume (tagId, md5) VALUES ('${req.body.tagId}', '${newFileName}.png')`;
    DB.query(SQL, function (err, newTag) {
        if (err) {
            res.status(200).send({status:'x', msg: '保存数据错误，请再试一次' });
            return;
        }
        
        //保存文件到正确位置
        exampleFile = `./data/material/backdrop_example.png`;
        md5File = `./data/material/asset/${newFileName}.png`;
        fs.copyFile(exampleFile, md5File, function (err) { if(err){}});

        res.status(200).send({status:'ok', msg: '操作成功'});
    });
});
// 造型管理：修改素材文件
router.post('/material/costume/modImage', function (req, res) {
    if (!req['files']['file']) {
        res.status(200).send({status: 'x', msg: '文件上传失败,请再试一次'});
        return;
    }
    
    //保存文件到正确位置
    const tmppath = req['files']['file']['path'];
    arr=tmppath.split(".")
    let newExt = arr[arr.length-1];//取上传文件的扩展名jpg|png|gif|svg|bmp
    if (newExt != 'jpg' && newExt != 'png' && newExt != 'gif' && newExt !='svg' && newExt !='bmp'){
        res.status(200).send({status:'x', msg: '文件类型错误，请再试一次' });
        return;
    }

    
    let md5 = req.body.md5;
    const oldExt = md5.substring(md5.length-3);
    if (oldExt == newExt){ // 后缀未变，直接替换
        const newpath = `./data/material/asset/${md5}`;
        fs.rename(tmppath, newpath, function (err) { if(err){}});

        res.status(200).send({ status: "ok", msg: "修改成功", imgFile: md5});
    } else {
        // 删除原图片文件
        fs.unlink(`./data/material/asset/${md5}`, function (err) {  if(err){ console.log(err); } });

        
        md5 = md5.substring(0, md5.length-3) + newExt; // 组合新文件名
        const newpath = `./data/material/asset/${md5}`;
        fs.rename(tmppath, newpath, function (err) { if(err){}});

        SQL = `UPDATE material_costume SET md5=? WHERE id=${req.body.id}`;
        VAL = [md5];
        DB.qww(SQL, VAL, function (err, R) {
            if (err) {
                res.status(200).send({status:'x', msg: '保存数据错误，请再试一次' });
                return;
            }

            res.status(200).send({ status: "ok", msg: "修改成功", imgFile: md5});
        });
    }
});
// 造型管理：修改名称
router.post('/material/costume/modName', function (req, res) {
    if (!req.body.v || req.body.v == ''){
        res.status(200).send({status:"x", msg: "名称错误"});
        return;
    }

    var SQL = `UPDATE material_costume SET name=? WHERE id=?`;
    var VAL = [req.body.v, req.body.id];
    DB.qww(SQL, VAL, function (err, Mate) {
        if (err) {
            res.status(200).send({status:'x', msg: '保存数据错误，请再试一次' });
            return;
        }
        
        res.status(200).send({status:'ok', msg: '操作成功'});
    });
});
// 造型管理：修改素材属性：尺寸
router.post('/material/costume/modMateSize', function (req, res) {
    let infoValue = parseInt(req.body.v);
    if (req.body.t == 'info0' || req.body.t == 'info1'){
        if (!infoValue || infoValue<1 || 9999<infoValue) {
            res.status(200).send({status:"x", msg: "参数错误：宽、高只能在 1~9999 之间"});
            return;
        }    
    } else if (req.body.t == 'info2'){
        if (!infoValue || infoValue<1 || 2<infoValue) {
            res.status(200).send({status:"x", msg: "参数错误！显示方式：1=铺开显示；2=原图显示"});
            return;
        }   
    } else {
        res.status(200).send({status:"x", msg: "参数错误"});
        return;
    }

    const SQL = `UPDATE material_costume SET ${req.body.t}=${infoValue} WHERE id=?`;
    var VAL = [req.body.id];
    DB.qww(SQL, VAL, function (err, Mate) {
        if (err) {
            res.status(200).send({status:'x', msg: '保存数据错误，请再试一次' });
            return;
        }
        
        res.status(200).send({status:'ok', msg: '操作成功'});
    });
});
// 造型管理：删除素材,未删除其文件，仅仅删除数据库记录
router.post('/material/costume/del', function (req, res) {
    // 需要判断是否在角色中有被使用到，有被角色使用到时，不能删除
    var VAL = [req.body.id];
    var SQL = `DELETE FROM material_costume WHERE id=?`;
    DB.qww(SQL, VAL, function (err, TAG) {
        if (err) {
            res.status(200).send({status:'x', msg: '保存数据错误，请再试一次' });
            return;
        }

        res.status(200).send({status:'ok', msg: '操作成功'});
    });
});
// 造型管理：素材状态管理
router.post('/material/costume/setState',function(req,res){
    let v = 0; //默认都当作 停用 处理
    if (req.body.v && req.body.v ==1) {
        v = 1;
    }

    var UPDATE = `UPDATE material_costume SET state=${v} WHERE id=${req.body.id} LIMIT 1`;
    DB.query(UPDATE, function(err,d){
        if(err){
            res.status(200).send({status:"x", msg:"再试一次"})
        }
        else {
            res.status(200).send({status:"ok", msg:'操作成功'})        
        }
    })
});


// 角色管理：页面
router.get('/material/sprite', function (req, res) {
    var SQL = `SELECT id, tag FROM material_tags WHERE type=2 ORDER BY id DESC`;
    DB.query(SQL, function (err, tags){
        if (err) {
            res.locals['tags'] = [];
        } else {
            res.locals['tags'] = tags;
        }

        res.render('admin/admin_material_sprite.ejs');
    }); 
});
// 角色管理：页面数据
router.get('/material/sprite/data', function(req, res) {
    var VAL = [req.query.tagId];
    var SQL = `SELECT count(id) AS c FROM material_sprite WHERE tagId=?`;
    DB.qww(SQL, VAL, function (err, count){
        if (err || count[0]['c']==0) {
            res.status(200).send({'count':0,'data':[]});
            return;
        }

        //获取当前数据集合
        var page = parseInt(req.query['page']);
        var limit = parseInt(req.query['limit']);
        SQL = `SELECT * FROM material_sprite WHERE tagId=? ORDER BY id DESC LIMIT ${(page-1)*limit},${limit}`;
        DB.qww(SQL, VAL, function (err, data) {
            if (err) {
                res.status(200).send({'count':0,'data':[]});
            } else {
                res.status(200).send({'count':count[0]['c'],'data':data});
            }
        });
    });
});
// 角色管理：添加
router.post('/material/sprite/add', function(req, res) {    
    const sprite = require("./lib/scratch_default_sprite.js");// 默认角色
    const SQL = `INSERT INTO material_sprite (tagId, json) VALUES (?, ?)`;
    const VAL = [req.body.tagId, sprite]
    DB.qww(SQL, VAL, function (err, R) {
        if (err) {
            res.status(200).send({status:'x', msg: '保存数据错误，请再试一次' });
            return;
        }

        res.status(200).send({status:'ok', msg: '操作成功'});
    });
});
// 角色管理：删除素材,未删除其文件，仅仅删除数据库记录
router.post('/material/sprite/del', function (req, res) {
    // 需要判断是否在角色中有被使用到，有被角色使用到时，不能删除
    var VAL = [req.body.id];
    var SQL = `DELETE FROM material_sprite WHERE id=?`;
    DB.qww(SQL, VAL, function (err, TAG) {
        if (err) {
            res.status(200).send({status:'x', msg: '保存数据错误，请再试一次' });
            return;
        }

        res.status(200).send({status:'ok', msg: '操作成功'});
    });
});
// 角色管理：导入角色：作品数据
router.get('/material/sprite/worklist', function (req, res) {
    var _title = "";
    if (req.query['t'] != undefined && req.query['t'] !=""){
        _title = ` AND title LIKE '%${req.query['t']}%' `;
    }

    var SQL =`SELECT count(id) AS c FROM scratch WHERE authorid='${res.locals.userid}' ${_title}`;
    DB.query(SQL, function(err, count){
        if (err || count.length==0 || count[0].c==0) {
            res.status(200).send({'count':0,'data':[]});
            return;
        }
        
        //获取当前数据集合
        var page = parseInt(req.query['page']);
        var limit = parseInt(req.query['limit']);
        var SQL =`SELECT id,title FROM scratch WHERE authorid='${res.locals.userid}' ${_title} ORDER BY time DESC LIMIT ${(page-1)*limit}, ${limit}`;
        DB.query(SQL, function (err, data) {
            if (err) {
                res.status(200).send({'count':0,'data':[]});
            } else {
                res.status(200).send({'count':count[0].c,'data':data});
            }
        });
    });
});
// 角色管理：导入角色：导入{tagid: _tagId, workid:select_data.id}
router.post('/material/sprite/import', function (req, res) {
    // 1、获取作品src
    var SELECT = `SELECT src FROM scratch WHERE id=${req.body.workid} LIMIT 1`;
    DB.query(SELECT, function(err,SRC){
        if (err || SRC.length == 0){
            res.status(200).send({status: 'x', msg: '再试一次'});
            return;
        }

        // 组合角色数据 values="(),(),()"
        let spriteCount = 0;
        let values="";
        let targets = JSON.parse(SRC[0].src).targets;
        for (var i=0; i<targets.length; i++) {
            if (!targets[i].isStage) {
                let json={};
                json["costumes"] = targets[i]["costumes"];
                json["sounds"] =  targets[i]["sounds"];

                if (values != ""){
                    values += ",";
                }

                values += `(${req.body.tagid}, '${targets[i].name}', '${JSON.stringify(json).replace(/'/g, '’')}')`;

                
                spriteCount++;
            }
        }

        if (spriteCount == 0) {
            res.status(200).send({status: 'ok', msg: '作品中无角色数据'});
        }

        var SQL = `INSERT INTO material_sprite(tagId, name, json) VALUES ${values}`
        DB.query(SQL, function (err, D) {
            if (err) {
                res.status(200).send({status:'x', msg: '操作失败，请再试一次' });
                return;
            }

            res.status(200).send({status: 'ok', msg: `操作成功，导入角色数：${spriteCount}`});
        });
    })
});
// 角色管理：修改名称
router.post('/material/sprite/modName', function (req, res) {
    if (!req.body.v || req.body.v == ''){
        res.status(200).send({status:"x", msg: "名称错误"});
        return;
    }

    var SQL = `UPDATE material_sprite SET name=? WHERE id=?`;
    var VAL = [req.body.v, req.body.id];
    DB.qww(SQL, VAL, function (err, Mate) {
        if (err) {
            res.status(200).send({status:'x', msg: '保存数据错误，请再试一次' });
            return;
        }
        
        res.status(200).send({status:'ok', msg: '操作成功'});
    });
});
// 角色管理：素材状态管理
router.post('/material/sprite/setState',function(req,res){
    let v = 0; //默认都当作 停用 处理
    if (req.body.v && req.body.v ==1) {
        v = 1;
    }

    var UPDATE = `UPDATE material_sprite SET state=${v} WHERE id=${req.body.id} LIMIT 1`;
    DB.query(UPDATE, function(err,d){
        if(err){
            res.status(200).send({status:"x", msg:"再试一次"})
        }
        else {
            res.status(200).send({status:"ok", msg:'操作成功'})        
        }
    })
});

// 角色管理：造型管理 页面
router.get('/material/sprite/setCostume', function (req, res) {
    res.locals._id = req.query['id'];
    res.render('admin/admin_material_sprite_costume.ejs');
});
// 角色管理：造型管理 页面数据
router.get('/material/sprite/setCostume/data', function(req, res) {
    var SQL = `SELECT json FROM material_sprite WHERE id=${req.query['id']} LIMIT 1`;
    DB.query(SQL, function(err,D){
        if (err || D.length==0){
            res.status(200).send({status: 'x', data: ''});
            return;
        }

        res.status(200).send({status: 'ok', data: D[0].json});
    })
});
// 角色管理：造型管理：删除素材,未删除其文件，仅仅删除数据库记录
// 参数：{id: _id, index: obj.data.index, md5: obj.data.md5ext}
router.post('/material/sprite/setCostume/del', function (req, res) {
    // 需要判断是否在角色中有被使用到，有被角色使用到时，不能删除
    var SQL = `SELECT json FROM material_sprite WHERE id=?`;
    var VAL = [req.body.id];
    DB.qww(SQL, VAL, function (err, D) {
        if (err || D.length == 0) {
            res.status(200).send({status:'x', msg: '数据错误，请再试一次' });
            return;
        }

        let json = JSON.parse(D[0].json);// json 包含了造型与声音
        if (json.costumes.length < 2) { // 角色的造型，必须最少有一个造型
            res.status(200).send({status:'x', msg: '角色最少有一个造型' });
            return;
        }

        // 判断要移除的造型是否存在
        var costume = json.costumes[req.body.index];
        if (!costume || costume.md5ext != req.body.md5) {
            res.status(200).send({status:'x', msg: '数据错误，请再试一次' });
            return;
        }

        // 移除造型 并 保存
        json.costumes.splice(req.body.index, 1);
        SQL = `UPDATE material_sprite SET json='${JSON.stringify(json)}' WHERE id=${req.body.id}`;
        DB.query(SQL,function (err, D1) {
            if (err) {
                res.status(200).send({status:'x', msg: '数据错误，请再试一次' });
                return;
            }

            res.status(200).send({status:'ok', msg: '操作成功'});
        });
    });
});
// 角色管理：造型管理：添加造型时，可选择造型 数据
// {text: 搜索文本，默认为空：''}
router.get('/material/sprite/setCostume/select', function (req, res) {
    var SQL = `SELECT count(id) AS c FROM material_costume WHERE name LIKE '%${req.query.text}%'`;
    DB.query(SQL, function (err, count){
        if (err || count[0]['c']==0) {
            res.status(200).send({count:0, data:[]});
            return;
        }

        //获取当前数据集合
        var page = parseInt(req.query['page']);
        var limit = parseInt(req.query['limit']);
        SQL = `SELECT c.id, c.name, t.tag FROM material_costume c ` +
            ` LEFT JOIN material_tags t ON (c.tagId = t.id) ` +
            ` WHERE c.name LIKE '%${req.query.text}%' LIMIT ${(page-1)*limit},${limit}`;
        DB.query(SQL, function (err, data) {
            if (err) {
                res.status(200).send({count:0, data:[]});
            } else {
                res.status(200).send({count:count[0]['c'], data: data});
            }
        });
    });
});
// 角色管理：造型管理：添加
// {sid: 角色ID, cid: 将被添加的造型ID}
router.post('/material/sprite/setCostume/add', function (req, res) {
    // 取造型数据
    let SQL = `SELECT c.name, c.md5, c.info0, c.info1, c.info2, s.json FROM material_costume c` +
            ` LEFT JOIN material_sprite s ON (s.id=?) ` +
            ` WHERE c.id=?`;
    let VAL = [req.body.sid, req.body.cid] 
    DB.qww(SQL, VAL, function (err, D) {
        if (err || D.length==0) {
            res.status(200).send({status:'x', msg: '数据错误，请再试一次' });
            return;
        }
        
        // 组合数据
        const md5 = D[0].md5.split('.');
        let newCostume = {
            name: D[0].name, // 名称
            assetId: md5[0]?md5[0]:'error', // md5ext前部分
            dataFormat: md5[1]?md5[1]:'error', // md5ext 后部分
            md5ext: D[0].md5,
            rotationCenterX: D[0].info0, // info0
            rotationCenterY: D[0].info1, // info1
            bitmapResolution: D[0].info2 // info2
        }
 

        let json = JSON.parse(D[0].json);
        json.costumes.push(newCostume);

        SQL = `UPDATE material_sprite SET json='${JSON.stringify(json)}' WHERE id=${req.body.sid}`
        DB.query(SQL, function (err, D) {
            if (err) {
                res.status(200).send({status:'x', msg: '数据错误，请再试一次' });
                return;
            }

            res.status(200).send({status:'ok', msg: '操作成功'});
        });
    });
});


// 角色管理：声音管理 页面
router.get('/material/sprite/setSound', function (req, res) {
    res.locals._id = req.query['id'];
    res.render('admin/admin_material_sprite_sound.ejs');
});
// 角色管理：声音管理 页面 数据
router.get('/material/sprite/setSound/data', function(req, res) {
    var SQL = `SELECT json FROM material_sprite WHERE id=${req.query['id']} LIMIT 1`;
    DB.query(SQL, function(err,D){
        if (err || D.length==0){
            res.status(200).send({status: 'x', data: ''});
            return;
        }

        res.status(200).send({status: 'ok', data: D[0].json});
    })
});
// 角色管理：声音管理：删除素材,未删除其文件，仅仅删除数据库记录
// 参数：{id: _id, index: obj.data.index, md5: obj.data.md5ext}
router.post('/material/sprite/setSound/del', function (req, res) {
    // 需要判断是否在角色中有被使用到，有被角色使用到时，不能删除
    var SQL = `SELECT json FROM material_sprite WHERE id=?`;
    var VAL = [req.body.id];
    DB.qww(SQL, VAL, function (err, D) {
        if (err || D.length == 0) {
            res.status(200).send({status:'x', msg: '数据错误，请再试一次' });
            return;
        }

        let json = JSON.parse(D[0].json);// json 包含了造型与声音
        if (json.sounds.length < 2) { // 角色的声音，必须最少有一个声音
            res.status(200).send({status:'x', msg: '角色最少有一个声音' });
            return;
        }

        // 判断要移除的声音是否存在
        var sound = json.sounds[req.body.index];
        if (!sound || sound.md5ext != req.body.md5) {
            res.status(200).send({status:'x', msg: '数据错误，请再试一次' });
            return;
        }

        // 移除 并 保存
        json.sounds.splice(req.body.index, 1);
        SQL = `UPDATE material_sprite SET json='${JSON.stringify(json)}' WHERE id=${req.body.id}`;
        DB.query(SQL,function (err, D1) {
            if (err) {
                res.status(200).send({status:'x', msg: '数据错误，请再试一次' });
                return;
            }

            res.status(200).send({status:'ok', msg: '操作成功'});
        });
    });
});
// 角色管理：声音管理：添加声音时，可选择声音 数据
// {text: 搜索文本，默认为空：''}
router.get('/material/sprite/setSound/select', function (req, res) {
    var SQL = `SELECT count(id) AS c FROM material_sound WHERE name LIKE '%${req.query.text}%'`;
    DB.query(SQL, function (err, count){
        if (err || count[0]['c']==0) {
            res.status(200).send({count:0, data:[]});
            return;
        }

        //获取当前数据集合
        var page = parseInt(req.query['page']);
        var limit = parseInt(req.query['limit']);
        SQL = `SELECT c.id, c.name, t.tag FROM material_sound c ` +
            ` LEFT JOIN material_tags t ON (c.tagId = t.id) ` +
            ` WHERE c.name LIKE '%${req.query.text}%' LIMIT ${(page-1)*limit},${limit}`;
        DB.query(SQL, function (err, data) {
            if (err) {
                res.status(200).send({count:0, data:[]});
            } else {
                res.status(200).send({count:count[0]['c'], data: data});
            }
        });
    });
});
// 角色管理：声音管理：添加
// {sid: 角色ID, cid: 将被添加的声音ID}
router.post('/material/sprite/setSound/add', function (req, res) {
    // 取声音数据
    let SQL = `SELECT c.name, c.md5, c.format, c.rate, c.sampleCount, s.json FROM material_sound c` +
            ` LEFT JOIN material_sprite s ON (s.id=?) ` +
            ` WHERE c.id=?`;
    let VAL = [req.body.sid, req.body.cid] 
    DB.qww(SQL, VAL, function (err, D) {
        if (err || D.length==0) {
            res.status(200).send({status:'x', msg: '数据错误，请再试一次' });
            return;
        }
        
        // 组合数据
        const md5 = D[0].md5.split('.');
        let newSound = {
            name: D[0].name, // 名称
            assetId: md5[0]?md5[0]:'error', // md5ext前部分
            dataFormat: md5[1]?md5[1]:'error', // md5ext 后部分
            md5ext: D[0].md5,
            format: D[0].format, // format
            rate: D[0].rate, // rate
            sampleCount: D[0].sampleCount, // sampleCount
        } 

        let json = JSON.parse(D[0].json);
        json.sounds.push(newSound);

        SQL = `UPDATE material_sprite SET json='${JSON.stringify(json)}' WHERE id=${req.body.sid}`
        DB.query(SQL, function (err, D) {
            if (err) {
                res.status(200).send({status:'x', msg: '数据错误，请再试一次' });
                return;
            }

            res.status(200).send({status:'ok', msg: '操作成功'});
        });
    });
});


// 声音管理：页面
router.get('/material/sound', function (req, res) {
    var SQL = `SELECT id, tag FROM material_tags WHERE type=4 ORDER BY id DESC`;
    DB.query(SQL, function (err, tags){
        if (err) {
            res.locals['tags'] = [];
        } else {
            res.locals['tags'] = tags;
        }

        res.render('admin/admin_material_sound.ejs');
    }); 
});
// 声音管理：数据
router.get('/material/sound/data', function(req, res) {
    var VAL = [req.query.tagId];
    var SQL = `SELECT count(id) AS c FROM material_sound WHERE tagId=?`;
    DB.qww(SQL, VAL, function (err, count){
        if (err || count[0]['c']==0) {
            res.status(200).send({'count':0,'data':[]});
            return;
        }

        //获取当前数据集合
        var page = parseInt(req.query['page']);
        var limit = parseInt(req.query['limit']);
        SQL = `SELECT * FROM material_sound WHERE tagId=? ORDER BY id DESC LIMIT ${(page-1)*limit},${limit}`;
        DB.qww(SQL, VAL, function (err, data) {
            if (err) {
                res.status(200).send({'count':0,'data':[]});
            } else {
                res.status(200).send({'count':count[0]['c'],'data':data});
            }
        });
    });
});
// 声音管理：添加
router.post('/material/sound/add', function(req, res) {
    // 仅仅支持wav格式的声音素材
    var newFileName = random_32ID_With_Time_Tag()+".wav";
    const SQL = `INSERT INTO material_sound (tagId, md5) VALUES ('${req.body.tagId}', '${newFileName}')`;
    DB.query(SQL, function (err, newTag) {
        if (err) {
            res.status(200).send({status:'x', msg: '保存数据错误，请再试一次' });
            return;
        }
        
        //保存文件到正确位置
        exampleFile = `./data/material/sound_example.wav`;
        md5File = `./data/material/asset/${newFileName}`;
        fs.copyFile(exampleFile, md5File, function (err) { if(err){}});

        res.status(200).send({status:'ok', msg: '操作成功'});
    });
});
// 声音管理：修改素材文件
router.post('/material/sound/modWav', function (req, res) {
    if (!req['files']['file']) {
        res.status(200).send({status: 'x', msg: '文件上传失败,请再试一次'});
        return;
    }

    const tmppath = req['files']['file']['path'];
    arr=tmppath.split(".")
    let newExt = arr[arr.length-1];//取上传文件的扩展名wav
    if (newExt != 'wav'){
        res.status(200).send({status:'x', msg: '文件类型错误，请再试一次' });
        return;
    }

    const SQL = `SELECT md5 FROM material_sound WHERE id=?`;
    const VAL = [req.body.id];
    DB.qww(SQL, VAL, function (err, DATA) {
        if (err || DATA.length == 0) {
            res.status(200).send({status:'x', msg: '保存数据错误，请再试一次' });
            return;
        }
        
        //保存文件
        const newpath = `./data/material/asset/${DATA[0].md5}`;
        fs.rename(tmppath, newpath, function (err) { if(err){}});
    
        res.status(200).send({ status: "ok", msg: "修改成功"});
    });

});
// 声音管理：修改名称
router.post('/material/sound/modName', function (req, res) {
    if (!req.body.v || req.body.v == ''){
        res.status(200).send({status:"x", msg: "名称错误"});
        return;
    }

    var SQL = `UPDATE material_sound SET name=? WHERE id=?`;
    var VAL = [req.body.v, req.body.id];
    DB.qww(SQL, VAL, function (err, Mate) {
        if (err) {
            res.status(200).send({status:'x', msg: '保存数据错误，请再试一次' });
            return;
        }
        
        res.status(200).send({status:'ok', msg: '操作成功'});
    });
});
// 声音管理：修改素材属性：rate/sampleCount
router.post('/material/sound/modMateAttr', function (req, res) {
    if (req.body.t != 'sampleCount'){
        res.status(200).send({status:"x", msg: "参数错误"});
        return;
    }
        
    let infoValue = parseInt(req.body.v);
    if (!infoValue || infoValue<0 || 10000000<infoValue) {
        res.status(200).send({status:"x", msg: "参数错误：只能在 0~1000,0000 之间"});
        return;
    }


    const SQL = `UPDATE material_sound SET sampleCount=${infoValue} WHERE id=?`;
    var VAL = [req.body.id];
    DB.qww(SQL, VAL, function (err, Mate) {
        if (err) {
            res.status(200).send({status:'x', msg: '保存数据错误，请再试一次' });
            return;
        }
        
        res.status(200).send({status:'ok', msg: '操作成功'});
    });
});
// 声音管理：删除素材,未删除其文件，仅仅删除数据库记录
router.post('/material/sound/del', function (req, res) {
    // 需要判断是否在角色中有被使用到，有被角色使用到时，不能删除
    var VAL = [req.body.id];
    var SQL = `DELETE FROM material_sound WHERE id=?`;
    DB.qww(SQL, VAL, function (err, TAG) {
        if (err) {
            res.status(200).send({status:'x', msg: '保存数据错误，请再试一次' });
            return;
        }

        res.status(200).send({status:'ok', msg: '操作成功'});
    });
});
// 声音管理：素材状态管理
router.post('/material/sound/setState',function(req,res){
    let v = 0; //默认都当作 停用 处理
    if (req.body.v && req.body.v ==1) {
        v = 1;
    }

    var UPDATE = `UPDATE material_sound SET state=${v} WHERE id=${req.body.id} LIMIT 1`;
    DB.query(UPDATE, function(err,d){
        if(err){
            res.status(200).send({status:"x", msg:"再试一次"})
        }
        else {
            res.status(200).send({status:"ok", msg:'操作成功'})        
        }
    })
});


// 清理scratch缩略图
router.get('/clear_scratch_slt', function (req, res) {
    var SQL = "SELECT id FROM scratch";
    DB.query(SQL, function(err, data){
        if (err){
            res.status(200).send('清理scratch缩略图数据库查询出错!');
            return;
        }

        // 把缩略图目录
        var slt_path = './data/scratch_slt';
        var backup_time = (new Date().getTime()).toString(16);
        var backup_path = `./data/scratch_slt_backup_${backup_time}`;
        try {
            fs.renameSync(slt_path, backup_path);
        }
        catch (e) {
            res.status(200).send('备份缩略图文件夹出错!');
            return;
        }
        try {
            fs.mkdirSync(slt_path);
        }
        catch (e) {
            res.status(200).send('创建缩略图文件夹出错!');
            return;
        }


        for (var i=data.length-1; i>=0; i--){
            let slt_old = `${backup_path}/${data[i].id}`;
            let slt = `${slt_path}/${data[i].id}`;

            fs.copyFile(slt_old, slt, function (err) { if(err){}});
        }

        res.status(200).send('OK!');
    });
});


module.exports = router;
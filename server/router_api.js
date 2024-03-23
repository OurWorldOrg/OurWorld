//个人中心
var express = require('express');
var router = express.Router();
var fs = require('fs');

//功能函数集
var I = require('./lib/fuck.js');
//数据库
var DB = require("./lib/database.js");

const clerk = require('@clerk/clerk-sdk-node');

const clerkClient = clerk.default;
//首页
router.get("/", function (req, res) {
    //获取已分享的作品总数：1:普通作品，2：推荐的优秀作品
    var SQL =
      `SELECT ` +
      ` (SELECT count(id) FROM scratch WHERE state>0 ) AS scratch_count, ` +
      ` (SELECT count(id) FROM python WHERE state>0 ) AS python_count `;
    DB.query(SQL, function (err, data) {
      if (err) {
        // console.error('数据库操作出错：');
        res.locals.scratch_count = 0;
        res.locals.python_count = 0;
      } else {
        res.locals.scratch_count = data[0].scratch_count;
        res.locals.python_count = data[0].python_count;
      }
  
      // 获取首页头图
      //SQL = `SELECT id, content FROM ads WHERE state=1 ORDER BY i ASC`;
      //DB.query(SQL, function (err, ADS) {
      //  if (err) {
      //    console.error(err);
      //    ADS = [];
      //  }
  
      //  res.locals["ads"] = encodeURIComponent(JSON.stringify(ADS));
  
      //});
      res.status(200).send({name: "index", count: data[0]});
    });
  });
//显示Scratch项目列表：数据，{curr:obj.curr, limit:obj.limit,state:state}
router.post('/getUserScratchProjects', function (req, res) {
    var curr = parseInt(req.body.curr);     //当前要显示的页码
    var limit = parseInt(req.body.limit);   //每页显示的作品数
    var userid = parseInt(req.body.userid);     //
    var SQL = `SELECT id, title,state,view_count,description FROM scratch WHERE authorid=${userid} AND state>0 ORDER BY view_count DESC LIMIT ${(curr-1)*limit}, ${limit}`;
    DB.query(SQL, function (err, data) {
        if (err) {
            res.status(200).send([]);
        } else {
            res.status(200).send(data);
        }
    });
});

//显示Scratch项目列表：数据，{curr:obj.curr, limit:obj.limit,state:state}
router.post('/getUserPythonProjects', function (req, res) {
    var curr = parseInt(req.body.curr);     //当前要显示的页码
    var limit = parseInt(req.body.limit);   //每页显示的作品数
    var userid = parseInt(req.body.userid);     //
    var SQL = `SELECT id, title,state,view_count,description FROM python WHERE authorid=${userid} AND state>0 ORDER BY view_count DESC LIMIT ${(curr-1)*limit}, ${limit}`;
    DB.query(SQL, function (err, data) {
        if (err) {
            res.status(200).send([]);
        } else {
            res.status(200).send(data);
        }
    });
});

//显示Scratch项目列表：数据，{curr:obj.curr, limit:obj.limit,state:state}
router.post('/getProjectsInfo', function (req, res) {
 
            res.status(200).send([{name:'Scratch编程',info: 'Scartch创作',link:'/scratch'},{name:'Python编程',info: 'Python编程',link:'/python'}]);
      
});
router.get('/play', function (req, res) {
    var deviceAgent = req.headers["user-agent"].toLowerCase();
    var agentID = deviceAgent.match(/(iphone|ipad|android|windows phone)/);
    res.locals['is_mobile'] = false;
    if(agentID){
        res.locals['is_mobile'] = true;//请求来自手机、pad等移动端
    }

    //浏览数+1
    var SQL = `UPDATE scratch SET view_count=view_count+1 WHERE id=${req.query.id} LIMIT 1`;
    DB.query(SQL, function(err,U){
        if (err|| U.affectedRows==0) {
            res.locals.tip = {'opt': 'flash', 'msg':'项目不存在或未发布'};
            res.render('404.ejs');
            return;
        }
        
       
            SQL = `SELECT user.nickname,scratch.motto,`+
          
            ` FROM user `+
            ` LEFT JOIN user ON (user.nickname=user.neme) `+
            ` WHERE user.id=${req.query.id}`;
         
    
        DB.query(SQL, function (err, SCRATCH) {
            if (err|| SCRATCH.length==0) {
                res.locals.tip = {'opt': 'flash', 'msg':'项目不存在或未发布'};
                res.render('404.ejs');
                return;
            }
    
            res.locals['is_author'] = (SCRATCH[0].authorid==res.locals.userid)?true:false;
            res.locals['project'] = SCRATCH[0];
            res.render('scratch/scratch_play.ejs');
        });
    });
});

router.get('/usertx', function (req, res) {
    

    SQL = `SELECT images FROM user WHERE id = ${req.query.id};`;
  
      DB.query(SQL, function (err, USER) {
        if (err || USER.length == 0) {
          res.locals.tip = { opt: "flash", msg: "用户不存在" };
          res.render("404.ejs");
          return;
        }

  
        res.redirect(302, process.env.S3staticurl+'/user/'+USER[0].images+'.png');
      });
});

router.post("/getuserinfo", async function (req, res) {
  const userId = req.query.clerkid || req.body.clerkid || req.query.id || req.body.id;
 
  const user = await clerkClient.users.getUser(userId);
  res.status(200).send({status: 'ok',info:{id:user.id,imageUrl:user.imageUrl,nickname:user.username,motto:user.publicMetadata.motto}});
        

    });

router.get("/getuserinfo", async function (req, res) {
  const userId = req.query.clerkid || req.body.clerkid || req.query.id || req.body.id;
 
  const user = await clerkClient.users.getUser(userId);
  res.status(200).send({status: 'ok',info:{id:user.id,imageUrl:user.imageUrl,nickname:user.username,motto:user.publicMetadata.motto}});
        
   
      
    });
    
router.get("/userclerkinfo", async function (req, res) {
  const userId = req.query.clerkid || req.body.clerkid || req.query.id || req.body.id;
 
  const user = await clerkClient.users.getUser(userId);
  res.status(200).send({status: 'ok',info:{id:user.id,imageUrl:user.imageUrl,nickname:user.username,motto:user.publicMetadata.motto}});
          
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
        res.send({user: 0 , scratch:0,python: 0,project: 0});

      }

      res.send({user: d[0].user_count , scratch:d[0].scratch_count,python: d[0].python_count,project: d[0].scratch_count +d[0].python_count});
  })
});

module.exports = router;

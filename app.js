var express = require("express");
var app = express();
var http = require("http");

//环境变量
require("dotenv").config();
// 日志部分
var winston = require("winston");
var morganlogger = require("morgan");
const { WinstonTransport: AxiomTransport } = require("@axiomhq/axiom-node");
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ message }) => {
      return `${message}`;
    })
  ),
  defaultMeta: { service: "ourworld-service" },
  transports: [
    process.env.AXIOM_TOKEN ? new AxiomTransport({
      dataset: process.env.AXIOM_DATASET,
      token: process.env.AXIOM_TOKEN,
    }) : null,
    new winston.transports.Console(),
  ],
}); 

// 创建自定义Stream，将日志写入Winston
const winstonStream = {
  write: (message) => {
    logger.info(message.trim());
  },
};
morganlogger.token("colored-status", (req, res) => {
  const status = res.statusCode;
  let color;
  if (status >= 500) {
    color = "\x1b[31m"; // 红色
  } else if (status >= 400) {
    color = "\x1b[33m"; // 黄色
  } else if (status >= 300) {
    color = "\x1b[36m"; // 青色
  } else {
    color = "\x1b[32m"; // 绿色
  }
  return color + status + "\x1b[0m"; // 重置颜色
});
app.use(
  morganlogger(":method :colored-status :response-time ms :remote-addr :url", {
    stream: winstonStream,
  })
);
//console.clog = console.log;
console.log = function (str) {
  logger.info(str);
  //console.clog(str);
};
console.error = function (str) {
  logger.error(str);
  //console.clog(str);
};

// cors配置
var cors = require("cors");
var corsOptions = {
  origin: process.env.corslist,
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  preflightContinue: false,
  optionsSuccessStatus: 204,
  credentials: true,
};
app.use(cors(corsOptions)); // 应用CORS配置函数

//设置环境变量
var session = require("express-session");
app.use(
  session({
    secret: process.env.SessionSecret,
    resave: false,
    name: "OurWorld-session",
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

//express 的cookie的解析组件
var cookieParser = require("cookie-parser");
app.use(cookieParser(process.env.SessionSecret));

//express 的http请求体进行解析组件
var bodyParser = require("body-parser");
app.use(bodyParser["urlencoded"]({ limit: "50mb", extended: false }));
app.use(bodyParser["json"]({ limit: "50mb" }));

//文件上传模块
var multipart = require("connect-multiparty");
app.use(multipart({ uploadDir: "./data/upload_tmp" }));

//压缩组件，需要位于 express.static 前面，否则不起作用
var compress = require("compression");
app.use(compress());

app.set("views", __dirname + "/build");
app.set("view engine", "ejs");

//数据库
var DB = require("./server/lib/database.js");

//设置静态资源路径
if (process.env.localstatic == 'true') {
  app.use(process.env.staticurl, express.static(process.env.staticpath));
}
//全局变量
global.dirname = __dirname;

//启动http(80端口)==================================
http.createServer(app).listen(3000, "0.0.0.0", function () {
  console.log("Listening on http://localhost:3000");
});
//平台总入口
app.all("*", function (req, res, next) {
  //console.log(req.method +' '+ req.url + " IP:" + req.ip);
  if (req.session["userid"] == undefined && req.signedCookies["userid"]) {
    req.session["userid"] = req.signedCookies["userid"];
    req.session["username"] = req.signedCookies["username"];
    req.session["nickname"] = req.signedCookies["nickname"];

    //判断系统管理员权限：此处写死，无需从数据库获取
    req.session["is_admin"] = 0;
    if (req.session["username"].indexOf(process.env.adminuser) == 0) {
      if (req.session["username"] == process.env.adminuser) {
        req.session["is_admin"] = 1;
      } else {
        let no = parseInt(req.session["username"].substring(8));
        if (0 <= no && no < 100) {
          req.session["is_admin"] = 1;
        }
      }
    }
  }

  if (req.session["userid"]) {
    res.locals["login"] = true;
    res.locals["userid"] = req.session["userid"];
    res.locals["username"] = req.session["username"];
    res.locals["nickname"] = req.session["nickname"];
    res.locals["is_admin"] = req.session["is_admin"];
  } else {
    res.locals["login"] = false;
    res.locals["userid"] = "";
    res.locals["username"] = "";
    res.locals["nickname"] = "";
    res.locals["is_admin"] = 0;
  }

  next();
});

//首页
app.get("/", function (req, res) {
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
    res.render("ejs/index.ejs");
  });
});

//放在最后，确保路由时能先执行app.all=====================
//注册、登录等功能路由
var router_register = require("./server/router_user.js");
app.use("/user", router_register);

//个人中心路由//学生平台路由
var router_admin = require("./server/router_my.js");
app.use("/my", router_admin);

//系统平台路由
var router_admin = require("./server/router_admin.js");
app.use("/admin", router_admin);

//scratch路由
var router_scratch = require("./server/router_scratch.js");
app.use("/scratch", router_scratch);


//scratch代理路由
var router_scratch = require("./server/router_scratch_proxy.js");
app.use("/proxy", router_scratch);
//api路由
var apiserver = require("./server/router_api.js");
app.use("/api", apiserver);

app.get("/about", function (req, res, next) {
  res.render("ejs/about.ejs");
});
app.get("/comparer", function (req, res, next) {
  res.render("ejs/comparer.ejs");
});
app.get("/asdm", function (req, res, next) {
  res.render("ejs/asdm.ejs");
});
app.get("/share", function (req, res, next) {
  res.render("ejs/share.ejs");
});
app.get("/home", function (req, res, next) {
  res.render("ejs/home.ejs");
});
//python路由
var router_python = require("./server/router_python.js");
app.use("/python", router_python);

//头图系统
var router_ads = require("./server/router_ads.js");
app.use("/ads", router_ads);

process.on("uncaughtException", function (err) {
  console.log("Caught exception: " + err);
});

//放在最后，友好的处理地址不存在的访问
app.all("*", function (req, res, next) {
  res.locals.tipType = "访问错误";
  res.render("ejs/404.ejs");
});

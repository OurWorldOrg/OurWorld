import logger from "../utils/logger.js";
import configManager from "../utils/configManager.js";
import { Router } from "express";
const router = Router();
import { prisma } from "../utils/global.js";
import default_project from "../config/default_project.js";
import {
  extractProjectData,
  projectSelectionFields,
  authorSelectionFields,
  handleTagsChange,
} from "../controllers/projects.js";
import { getProjectStars } from "../controllers/projectlist.js";

import { createHash } from "crypto";
import jwt from "jsonwebtoken";
import {
  generateFileAccessToken,
  verifyFileAccessToken,

} from "../utils/tokenManager.js";
import { needlogin } from "../middleware/auth.js";
// 中间件，确保所有请求均经过该处理
router.all("*", (req, res, next) => next());

// 创建新作品
router.post("/", async (req, res, next) => {
  if (!res.locals.login) {
    return res
      .status(200)
      .send({ status: "error", message: "未登录", code: "AUTH_ERROR_LOGIN" });
  }

  try {
    const outputJson = {
      ...extractProjectData(req.body),
      type: req.body.type || "scratch",
    };
    outputJson.authorid = res.locals.userid;

    const result = await prisma.ow_projects.create({ data: outputJson });
    res.status(200).send({ status: "success", message: "保存成功", id: result.id });
  } catch (err) {
    logger.error("Error creating new project:", err);
    next(err);
  }
});

// 保存源代码
router.post("/savefile",needlogin, async (req, res, next) => {
  if (!res.locals.userid) {
    return res
      .status(200)
      .send({ status: "error", message: "未登录", code: "AUTH_ERROR_LOGIN" });
  }

  try {
    const { source } = req.body;
    if (typeof source !== "string") {
      return res
        .status(400)
        .send({ status: "error", message: "无效的源代码格式" });
    }

    const sha256 = createHash("sha256").update(source).digest("hex");
    logger.debug(sha256);

    await prisma.ow_projects_file
      .create({
        data: {
          sha256: sha256,
          source: source,
          authorid: res.locals.userid,
        },
      })
      .catch((err) => {
        if (err.code === "P2002") {
          logger.debug("File already exists, skipping.");
        } else {
          logger.error(err);
        }
      });

    const accessFileToken = await generateFileAccessToken(
      sha256,
      res.locals.userid
    );
    res.status(200).send({
      status: "success",
      message: "保存成功",
      accessFileToken: accessFileToken,
    });
  } catch (err) {
    logger.error("Error saving source code:", err);
    next(err);
  }
});

// 提交代码
router.put("/commit/:id", async (req, res, next) => {
  if (!res.locals.userid) {
    return res
      .status(200)
      .send({ status: "error", message: "未登录", code: "AUTH_ERROR_LOGIN" });
  }

  try {
    const {
      branch = "main",
      projectid,
      accessFileToken,
      message = "edit",
      parent_commit,
    } = req.body;

    if (!projectid || !accessFileToken) {
      return res
        .status(400)
        .send({ status: "error", message: "缺少必要的参数" });
    }

    // 验证项目权限
    const project = await prisma.ow_projects.findFirst({
      where: { id: Number(projectid) },
    });
    if (!project) {
      return res
        .status(403)
        .send({ status: "error", message: "项目不存在" });
    }

    if (project.authorid !== res.locals.userid) {
      return res
        .status(403)
        .send({ status: "error", message: "无权提交此项目" });
    }

    const decodedFileToken = jwt.verify(
      accessFileToken,
      await configManager.getConfig("security.jwttoken")
    );
    if (!decodedFileToken) {
      return res
        .status(200)
        .send({ status: "error", message: "无效的文件访问令牌" });
    }

    const { sha256, type, action, userid } = decodedFileToken.data;
    if (type !== "file" || action !== "read" || userid !== res.locals.userid) {
      return res
        .status(200)
        .send({ status: "error", message: "无效的文件访问令牌" });
    }

    let parent_commit_id = null;
    if (/^[a-fA-F0-9]{64}$/.test(parent_commit)) {
      parent_commit_id = parent_commit;
    } else {
      const latestCommit = await prisma.ow_projects_commits.findFirst({
        where: { project_id: Number(projectid), author_id: res.locals.userid },
        orderBy: { id: "desc" },
      });
      parent_commit_id = latestCommit ? latestCommit.id : null;
    }

    const result = await prisma.ow_projects_commits.create({
      data: {
        project_id: Number(projectid),
        author_id: res.locals.userid,
        branch: branch,
        commit_file: sha256,
        commit_message: message,
        parent_commit_id: parent_commit_id,
      },
    });

    res
      .status(200)
      .send({ status: "success", message: "保存成功", data: result });
  } catch (err) {
    logger.error("Error saving source code:", err);
    next(err);
  }
});

// Fork 作品
router.post("/:id/fork", async (req, res, next) => {
  if (!res.locals.login) {
    return res
      .status(200)
      .send({ status: "error", message: "未登录", code: "AUTH_ERROR_LOGIN" });
  }

  try {
    const original = await prisma.ow_projects.findFirst({
      where: { id: Number(req.params.id) },
    });

    if (original?.state === "public") {
      const result = await prisma.ow_projects.create({
        data: {
          authorid: res.locals.userid,
          title: `${original.title}改编`,
          description: original.description,
          licence: original.licence,
          state: "private",
          type: original.type,
          source: original.source,
          devsource: original.source,
          tags: original.tags,
        },
      });
      res.status(200).send({ status: "success", message: "改编成功", id: result.id });
    } else {
      res.status(200).send({ status: "error", message: "改编失败" });
    }
  } catch (err) {
    logger.error("Error forking project:", err);
    next(err);
  }
});

// 更新作品信息
router.put("/:id", async (req, res, next) => {
  if (!res.locals.userid) {
    return res
      .status(200)
      .send({ status: "error", message: "未登录", code: "AUTH_ERROR_LOGIN" });
  }

  try {
    const updatedData = extractProjectData(req.body);
    await prisma.ow_projects.update({
      where: { id: Number(req.params.id), authorid: Number(res.locals.userid) },
      data: updatedData,
    });
    // 处理标签
    if (req.body.tags) {
      await handleTagsChange(Number(req.params.id), req.body.tags);
    }

    res.status(200).send({ status: "success", message: "保存成功" });
  } catch (err) {
    logger.error("Error updating project information:", err);
    next(err);
  }
});

// 获取项目信息
router.get("/:id", async (req, res, next) => {
  try {
    const project = await prisma.ow_projects.findFirst({
      where: { id: Number(req.params.id) },
      select: projectSelectionFields(),
    });

    if (
      !project ||
      (project.state === "private" && project.authorid !== res.locals.userid)
    ) {
      return res.status(200).send({ status: "error", message: "作品不存在或无权打开" });
    }

    const author = await prisma.ow_users.findFirst({
      where: { id: Number(project.authorid) },
      select: authorSelectionFields(),
    });

    const tags = await prisma.ow_projects_tags.findMany({
      where: { projectid: Number(req.params.id) },
      select: { name: true, id: true, created_at: true },
    });

    project.author = author;
    project.tags = tags;
    logger.debug(tags);
    logger.debug(project);
    res.status(200).send(project);
  } catch (err) {
    logger.error("Error fetching project information:", err);
    next(err);
  }
});

// 获取项目文件
router.get("/:id/:branch/:ref", async (req, res, next) => {
  try {
    const { id, branch, ref } = req.params;
    const userid = res.locals.userid || 0; // 未登录用户为匿名用户

    // 验证项目权限
    const project = await prisma.ow_projects.findFirst({
      where: { id: Number(id) },
    });
    if (!project || (project.state === "private" && project.authorid !== userid)) {
      return res.status(200).send({ status: "error", message: "项目不存在或无权访问",code:"404" });
    }

    let commit;
    if (ref === "latest") {
      commit = await prisma.ow_projects_commits.findFirst({
        where: { project_id: Number(id), branch: branch },
        orderBy: { commit_date: "desc" },
      });
    } else {
      commit = await prisma.ow_projects_commits.findFirst({
        where: { id: ref, project_id: Number(id), branch: branch },
      });
    }

    if (!commit) {
      const defaultSource = default_project[project.type];
      if (!defaultSource) {
        return res.status(200).send({ status: "error", message: "默认作品不存在" });
      }

      const accessFileToken = await generateFileAccessToken(
        defaultSource.sha256,
        userid
      );

      return res.status(200).send({
        status: "success",
        message: "获取成功",
        commit: {
          commit_file: defaultSource.sha256,
          commit_message: "默认作品",
          commit_date: new Date(),
        },
        accessFileToken,
      });
    }

    const accessFileToken = await generateFileAccessToken(
      commit.commit_file,
      userid
    );

    res.status(200).send({
      status: "success",
      message: "获取成功",
      commit,
      accessFileToken,
    });
  } catch (err) {
    logger.error("Error fetching project file:", err);
    next(err);
  }
});

// 根据文件哈希读取文件
router.get("/files/:sha256", async (req, res, next) => {
  try {
    const { sha256 } = req.params;
    const { accessFileToken } = req.query;
    const userid = res.locals.userid || 0; // 未登录用户为匿名用户

    try {
      const sha256 = await verifyFileAccessToken(
        accessFileToken,
        userid
      );
    } catch (err) {
      return res
        .status(200)
        .send({ status: "error", message: "无效的文件访问令牌" });
    }

    const file = await prisma.ow_projects_file.findFirst({
      where: { sha256 },
    });

    if (!file) {
      return res.status(200).send({ status: "error", message: "文件不存在" });
    }

    res.status(200).send({ status: "success", message: "获取成功", file });
  } catch (err) {
    logger.error("Error fetching file by hash:", err);
    next(err);
  }
});

// 获取项目信息
router.get("/community/:id", async (req, res, next) => {
  try {
    var stars = await getProjectStars(req.params.id);
    res
      .status(200)
      .send({ status: "success", message: "获取成功", data: { stars: stars } });
  } catch (err) {
    logger.error("Error fetching project information:", err);
    next(err);
  }
});
// 删除作品
router.delete("/:id", async (req, res, next) => {
  try {
    await prisma.ow_projects.delete({
      where: { id: Number(req.params.id), authorid: res.locals.userid },
    });
    res.status(200).send({ status: "success", message: "删除成功" });
  } catch (err) {
    logger.error("Error deleting project:", err);
    next(err);
  }
});

// 初始化项目
router.post("/:id/init", needlogin, async (req, res, next) => {
  if (!res.locals.userid) {
    return res
      .status(200)
      .send({ status: "error", message: "未登录", code: "AUTH_ERROR_LOGIN" });
  }

  try {
    const { id } = req.params;

    // 验证项目权限
    const project = await prisma.ow_projects.findFirst({
      where: { id: Number(id), authorid: res.locals.userid },
    });
    if (!project) {
      return res
        .status(403)
        .send({ status: "error", message: "无权访问此项目" });
    }

    // 检查项目是否在任何分支都没有任何提交
    const commitCount = await prisma.ow_projects_commits.count({
      where: { project_id: Number(id) },
    });
    if (commitCount > 0) {
      return res
        .status(400)
        .send({ status: "error", message: "项目已存在提交或不存在" });
    }

    // 获取默认作品
    const defaultSource = default_project[project.type];
    if (!defaultSource) {
      return res.status(200).send({ status: "error", message: "默认作品不存在" });
    }


    // 计算提交的哈希值作为 id
    const commitContent = JSON.stringify({
      userid: res.locals.userid,
      project_id: Number(id),
      project_branch: "main",
      source_sha256: defaultSource,
      commit_message: "初始化提交",
      parent_commit: null,
      timestamp: Date.now(),
    });
    const commitId = createHash("sha256").update(commitContent).digest("hex");

    // 创建提交记录
    const result = await prisma.ow_projects_commits.create({
      data: {
        id: commitId,
        project_id: Number(id),
        author_id: res.locals.userid,
        branch: "main",
        commit_file: defaultSource,
        commit_message: "初始化提交",
        parent_commit_id: null,
        commit_date: new Date(),
      },
    });

    res.status(200).send({
      status: "success",
      message: "初始化成功",
      data: result,
    });
  } catch (err) {
    logger.error("Error initializing project:", err);
    next(err);
  }
});

export default router;

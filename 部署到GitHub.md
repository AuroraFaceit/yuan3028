# 把「碎碎念念」展馆托管到 GitHub Pages

展馆是纯静态站点（HTML + CSS + JS + 图片 + 音频，没有后端），所以 GitHub Pages 完全够用，免费、可自定义域名、自带 HTTPS。

- 站点根目录：`site/`（`index.html` 就在里面）
- 所有资源引用都是**相对路径**（`css/…`、`js/…`、`assets/…`），上传到任何子路径都能正常跑
- 站点总大小约 **16 MB**（图片 4.4 MB + 三首 mp3 约 10 MB），远小于 GitHub 单仓库 1 GB 限制

---

## 一、准备工作（两分钟）

1. 注册 / 登录 GitHub：https://github.com
2. 想好仓库名，例如 `suisuiniannian`（推荐用小写英文；仓库名会出现在网址里）
3. 先确认三首 mp3 已在 `site/assets/audio/` 里：
   - `stay-with-me.mp3`
   - `fenwu-hai.mp3`
   - `baby-dont-cry.mp3`

---

## 二、方式 A：网页上传（不装任何软件，最省事）

1. 打开 https://github.com/new
2. **Repository name** 填 `suisuiniannian`
3. 可见性选 **Public**（免费账号的 Pages 只对公开仓库开放；私人仓库开 Pages 需要 GitHub Pro）
4. 点 **Create repository**
5. 页面里点 **uploading an existing file**
6. 打开本机的 `C:\Users\watch\WorkBuddy\2026-10-25-16-02-14\site\`，把里面的**全部内容**（`index.html`、`css`、`js`、`assets`、`vendor`、`.nojekyll`）拖进浏览器上传框
   > 注意：拖的是 `site` 里的**内容**，不是 `site` 这个文件夹本身。`index.html` 必须在仓库最外层。
7. 底部 **Commit changes**
8. 仓库页 → **Settings** → 左侧 **Pages**
9. **Source** 选 `Deploy from a branch`，Branch 选 `main`，目录选 `/ (root)`，点 **Save**
10. 等 1–2 分钟，刷新页面，顶部会出现网址：
    `https://<你的用户名>.github.io/suisuiniannian/`

打开就是展馆。手机、平板、电脑都能直接看。

---

## 三、方式 B：命令行（以后改内容方便，一条命令更新）

在 `site/` 目录里初始化仓库并推上去：

```bash
cd C:\Users\watch\WorkBuddy\2026-10-25-16-02-14\site

git init
git add -A
git commit -m "碎碎念念 · 展馆首次上线"

# 把 <你的用户名> 换成自己的
git remote add origin https://github.com/<你的用户名>/suisuiniannian.git
git branch -M main
git push -u origin main
```

然后同「方式 A」的 8–10 步：Settings → Pages → Deploy from a branch → main / root → Save。

以后每次改完内容：

```bash
cd C:\Users\watch\WorkBuddy\2026-10-25-16-02-14\site
git add -A
git commit -m "改了什么"
git push
```

GitHub Pages 会自动重新部署（约 1 分钟）。

> 第一次 `git push` 会要求登录。GitHub 已不支持密码推送，请用 **Personal Access Token**：
> GitHub → 头像 → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token → 勾 `repo` → 生成后复制，粘贴到命令行提示的「password」处。

---

## 四、方式 C：用本仓库自带的 Actions 工作流（推荐长期维护）

本工程里已经放好 `.github/workflows/deploy.yml`，它会把 `site/` 目录自动发布到 Pages。

如果你把**整个工程目录**（包含 `site/`、`tools/`、`.github/`）推到 GitHub：

1. 按方式 B 推送整个工程目录（不是只推 `site/`）
2. 仓库 → **Settings → Pages → Source** 选 **GitHub Actions**
3. 之后每次 `git push` 到 `main`，Actions 会自动构建并发布 `site/`，网址同上

工作流文件内容（已存在，不用改）：

```yaml
# .github/workflows/deploy.yml 关键部分
- uses: actions/upload-pages-artifact@v3
  with:
    path: site      # ← 站点根目录
```

---

## 五、绑定自己的域名（可选）

1. 在域名服务商处添加一条 **CNAME** 记录：`www` → `<你的用户名>.github.io`
2. 在 `site/` 里新建文件 `CNAME`，内容只写一行你的域名，例如：
   ```
   museum.example.com
   ```
3. 仓库 Settings → Pages → **Custom domain** 填同一个域名 → Save → 勾上 **Enforce HTTPS**

DNS 生效通常 10 分钟到 1 小时。

---

## 六、注意事项（重要）

- **音频版权**：三首是正式发行的商业歌曲（易烊千玺《粉雾海》、鬼怪 OST《Stay With Me》、《Baby, Don't Cry》）。放**公开**仓库等于公开分发音频文件，存在版权风险。稳妥做法：
  1. 仓库设为 **Private**（Pages 需 Pro），或
  2. 公开仓库里不放 mp3（把 `site/assets/audio/` 加进 `.gitignore`），只保留播放器逻辑——没有音频文件时页面会自动退回内置的八音盒旋律
- **不要提交** `tmp/`、`preview/` 这类中间产物（几 MB 的截图），仓库只要 `site/`
- **首次部署慢**：GitHub Pages 第一次构建约 1–3 分钟，之后每次更新 30 秒左右
- **改完看不到变化**：按 `Ctrl + F5` 强刷，或等 1 分钟 CDN 缓存过期
- **路径大小写**：GitHub 的服务器区分大小写，本地 Windows 不区分。文件名请保持全小写（本工程已经是这样），否则线上会 404

---

## 七、上线检查清单

- [ ] 打开网址能看到加载页，进度走到 100% 后进入展馆
- [ ] 一楼电视屏幕上是那张照片，柜子上有笑脸
- [ ] 点电视或「一起听听」，音乐响起，旁边的小动物开始蹦
- [ ] 数字键 / 章节条能换层
- [ ] 手机上打开：hero 不挡画面，方向键（dpad）能用手指按住移动
- [ ] 「展信佳」里沙漏天数正确
- [ ] 控制台（F12）没有红色报错

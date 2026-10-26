// 极简本地静态服务器（无依赖），仅用于本地预览
// 用法: node server.js [端口]
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'site');
const PORT = Number(process.argv[2] || process.env.PORT || 8123);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.ico': 'image/x-icon',
};

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
  fs.stat(file, (err, st) => {
    if (err || st.isDirectory()) {
      if (!err && st.isDirectory()) file = path.join(file, 'index.html');
      else { res.writeHead(404); return res.end('not found'); }
    }
    fs.readFile(file, (e, buf) => {
      if (e) { res.writeHead(404); return res.end('not found'); }
      const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
      const head = {
        'Content-Type': type,
        'Content-Length': buf.length,   // 视频/音频必须给长度，否则浏览器放不出来
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache',
      };

      // 媒体文件的 Range 请求（拖进度条要用）
      const range = req.headers.range;
      if (range && type.startsWith(('video/')) || (range && type.startsWith('audio/'))) {
        const m = /bytes=(\d*)-(\d*)/.exec(range);
        if (m) {
          const start = m[1] ? parseInt(m[1], 10) : 0;
          const end = m[2] ? parseInt(m[2], 10) : buf.length - 1;
          if (start < buf.length) {
            const chunk = buf.subarray(start, Math.min(end, buf.length - 1) + 1);
            res.writeHead(206, {
              ...head,
              'Content-Range': `bytes ${start}-${start + chunk.length - 1}/${buf.length}`,
              'Content-Length': chunk.length,
            });
            return res.end(chunk);
          }
        }
      }

      res.writeHead(200, head);
      res.end(buf);
    });
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log(`云上展馆已启动: http://127.0.0.1:${PORT}/`);
  console.log('按 Ctrl+C 停止');
});

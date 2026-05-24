const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
// Render 上需挂载持久磁盘并设 DATA_DIR 环境变量，如 /var/data
const DATA_DIR = process.env.DATA_DIR || (process.env.RENDER ? '/var/data' : path.join(__dirname, 'data'));
const DB_FILE = path.join(DATA_DIR, 'db.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ ambient: [], music: [] }));

// 管理密码
const ADMIN_PWD = '7856';

// 中间件
app.use(express.json());
app.use(express.static(__dirname));

// 上传配置
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB 单文件
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp3', '.ogg', '.wav', '.aac', '.m4a', '.flac', '.webm', '.m4a', '.opus'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  }
});

// 读取数据库
function readDB() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')); }
  catch { return { ambient: [], music: [] }; }
}

// 写入数据库
function writeDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// 鉴权中间件
function auth(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token || '';
  if (token === ADMIN_PWD) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ===== 环境音 API =====

// 列表
app.get('/api/ambient', (req, res) => {
  const db = readDB();
  res.json(db.ambient.map(a => ({ id: a.id, name: a.name, fileName: a.fileName, fileSize: a.fileSize, uploadedAt: a.uploadedAt })));
});

// 下载单个
app.get('/api/ambient/:id', (req, res) => {
  const db = readDB();
  const item = db.ambient.find(a => a.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  const filePath = path.join(DATA_DIR, item.id + path.extname(item.fileName));
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing' });
  res.sendFile(filePath);
});

// 上传（需鉴权）
app.post('/api/ambient', auth, upload.single('file'), (req, res) => {
  const { name } = req.body;
  if (!name || !req.file) return res.status(400).json({ error: 'Name and file required' });
  const id = 'amb_' + Date.now();
  const ext = path.extname(req.file.originalname);
  const filePath = path.join(DATA_DIR, id + ext);
  fs.writeFileSync(filePath, req.file.buffer);
  const db = readDB();
  const record = { id, name, fileName: req.file.originalname, fileType: req.file.mimetype, fileSize: req.file.size, uploadedAt: new Date().toISOString() };
  db.ambient.push(record);
  writeDB(db);
  res.json(record);
});

// 删除（需鉴权）
app.delete('/api/ambient/:id', auth, (req, res) => {
  const db = readDB();
  const idx = db.ambient.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const item = db.ambient[idx];
  // 删除文件
  const ext = path.extname(item.fileName);
  const filePath = path.join(DATA_DIR, item.id + ext);
  try { fs.unlinkSync(filePath); } catch(e) {}
  db.ambient.splice(idx, 1);
  writeDB(db);
  res.json({ ok: true });
});

// ===== 音乐 API =====

// 列表
app.get('/api/music', (req, res) => {
  const db = readDB();
  res.json(db.music.map(m => ({ id: m.id, name: m.name, channelCount: m.channelCount, fileNames: m.fileNames, uploadedAt: m.uploadedAt })));
});

// 下载音乐分轨（以zip方式或单个channel）
app.get('/api/music/:id/:ch', (req, res) => {
  const db = readDB();
  const item = db.music.find(m => m.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  const ch = parseInt(req.params.ch);
  if (ch >= item.channelCount) return res.status(404).json({ error: 'Channel not found' });
  const ext = path.extname(item.fileNames[ch]);
  const filePath = path.join(DATA_DIR, item.id + '_' + ch + ext);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing' });
  res.sendFile(filePath);
});

// 上传（需鉴权，多文件对应分轨）
app.post('/api/music', auth, upload.array('files', 12), (req, res) => {
  const { name } = req.body;
  if (!name || !req.files || req.files.length === 0) return res.status(400).json({ error: 'Name and files required' });
  const id = 'mus_' + Date.now();
  const fileNames = [];
  req.files.forEach((f, i) => {
    const ext = path.extname(f.originalname);
    fileNames.push(f.originalname);
    const filePath = path.join(DATA_DIR, id + '_' + i + ext);
    fs.writeFileSync(filePath, f.buffer);
  });
  const db = readDB();
  const record = { id, name, channelCount: req.files.length, fileNames, uploadedAt: new Date().toISOString() };
  db.music.push(record);
  writeDB(db);
  res.json(record);
});

// 删除（需鉴权）
app.delete('/api/music/:id', auth, (req, res) => {
  const db = readDB();
  const idx = db.music.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const item = db.music[idx];
  // 删除所有分轨文件
  for (let i = 0; i < item.channelCount; i++) {
    const ext = path.extname(item.fileNames[i]);
    const filePath = path.join(DATA_DIR, item.id + '_' + i + ext);
    try { fs.unlinkSync(filePath); } catch(e) {}
  }
  db.music.splice(idx, 1);
  writeDB(db);
  res.json({ ok: true });
});

// ===== 存储用量 =====
app.get('/api/usage', (req, res) => {
  const db = readDB();
  let size = 0;
  function dirSize(dir) {
    try {
      fs.readdirSync(dir).forEach(f => {
        try { size += fs.statSync(path.join(dir, f)).size; } catch(e) {}
      });
    } catch(e) {}
  }
  dirSize(DATA_DIR);
  res.json({ totalBytes: size, ambientCount: db.ambient.length, musicCount: db.music.length });
});

app.listen(PORT, () => {
  console.log(`Naxin Player server running on port ${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
});

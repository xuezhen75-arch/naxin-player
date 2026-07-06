# 纳心音乐播放器 — Naxin Player

## 概述

治愈系音乐播放器，Web Audio API 引擎，10段环境音均衡器 + 12路音乐分轨混音。

## 版本

v1.7.3（虾米维护，2026-07-06）

## 文件说明

| 文件 | 用途 | 数据存储 |
|------|------|---------|
| index.html | Web版（主版本）- 部署在阿里云ECS | 服务器JSON文件 + IndexedDB缓存 |
| naxin-player-standalone.html | 绿色桌面版 - 本地浏览器打开即用 | 纯IndexedDB |
| server.js | Node.js/Express 后端服务 | 服务器 data/db.json |
| sw.js | Service Worker 缓存加速 | - |

## 部署

### Web服务版（阿里云ECS）
- 地址：http://8.152.96.217:3000
- 启动：systemctl start naxin-player
- 数据：/opt/naxin-player/data/db.json
- 管理密码：7856

### 绿色桌面版
直接双击 naxin-player-standalone.html 在浏览器中打开即可使用。
所有数据存储在浏览器 IndexedDB 中，完全离线可用。

## 功能

- 环境音：10段Peaking均衡器（32Hz~16kHz）
- 音乐分轨：12路独立GainNode控制
- LFO动画：柔波/涌动/独奏三种模式
- 三色主题：森林绿/深海蓝/暖阳橙
- 8+8预设：8个环境音+8个音乐混音预设
- 管理后台：上传/删除/导出（密码7856）

## 技术栈

- 纯前端：HTML + CSS + JavaScript（零依赖）
- 音频引擎：Web Audio API（BiquadFilter + GainNode）
- 后端（Web版）：Node.js + Express + multer
- 存储（Web版）：JSON文件 + IndexedDB缓存
- 存储（桌面版）：IndexedDB

## 维护

由 虾米（Hermes AI Agent）维护。

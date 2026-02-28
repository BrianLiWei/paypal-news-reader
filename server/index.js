const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { auth, signIn, signUp, logout, firestore } = require('./firebase');
const { initFirebaseAdmin } = require('./auth');
const { startScheduler, manualRefresh } = require('./scheduler');
const { initMailer, sendTestEmail } = require('./mailer');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// 初始化 Firebase Admin（用于验证 token）
initFirebaseAdmin();

// 初始化邮件发送器
initMailer();

// 启动定时任务（每天早上 7 点）
const cronSchedule = process.env.CRON_SCHEDULE || '0 7 * * *';
startScheduler(cronSchedule);

// ==================== API 路由 ====================

// 1. 用户注册
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: '请提供邮箱和密码' });
    }

    const userCredential = await signUp(email, password);
    const user = userCredential.user;

    // 创建用户设置
    await firestore.updateUserSettings(user.uid, {
      email: email,
      notifyEnabled: false,
      createdAt: new Date()
    });

    res.json({
      success: true,
      user: {
        uid: user.uid,
        email: user.email
      }
    });
  } catch (error) {
    console.error('注册失败:', error);
    res.status(400).json({ error: error.message });
  }
});

// 2. 用户登录
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: '请提供邮箱和密码' });
    }

    const userCredential = await signIn(email, password);
    const user = userCredential.user;

    // 生成自定义 token（用于 API 认证）
    // 在生产环境中，应该返回 Firebase ID Token
    res.json({
      success: true,
      user: {
        uid: user.uid,
        email: user.email
      },
      token: user.uid  // 简化版：直接返回 UID 作为 token
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(401).json({ error: '邮箱或密码错误' });
  }
});

// 3. 用户登出
app.post('/api/auth/logout', async (req, res) => {
  try {
    await logout();
    res.json({ success: true });
  } catch (error) {
    console.error('登出失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 4. 获取新闻列表
app.get('/api/news', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];

    if (!userId) {
      return res.status(401).json({ error: '未授权' });
    }

    const limit = parseInt(req.query.limit) || 50;
    const news = await firestore.getNews(userId, { limit });

    res.json({ success: true, news });
  } catch (error) {
    console.error('获取新闻失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 5. 手动刷新新闻
app.post('/api/news/refresh', async (req, res) => {
  try {
    // Express 会将 header 转为小写
    const userId = req.headers['x-user-id'] || req.headers['X-User-Id'];
    console.log('刷新新闻 - 收到的 header:', req.headers);
    console.log('刷新新闻 - userId:', userId);

    if (!userId) {
      return res.status(401).json({ error: '未授权', debug: 'userId is ' + userId });
    }

    const newCount = await manualRefresh(userId);

    res.json({
      success: true,
      message: `新增 ${newCount} 条新闻`,
      newCount
    });
  } catch (error) {
    console.error('刷新新闻失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 6. 标记新闻为已读
app.post('/api/news/:newsId/read', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { newsId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: '未授权' });
    }

    await firestore.markAsRead(userId, newsId);

    res.json({ success: true });
  } catch (error) {
    console.error('标记已读失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 7. 删除新闻
app.delete('/api/news/:newsId', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { newsId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: '未授权' });
    }

    await firestore.deleteNews(userId, newsId);

    res.json({ success: true });
  } catch (error) {
    console.error('删除新闻失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 8. 获取用户设置
app.get('/api/settings', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];

    if (!userId) {
      return res.status(401).json({ error: '未授权' });
    }

    const settings = await firestore.getUserSettings(userId);

    res.json({ success: true, settings });
  } catch (error) {
    console.error('获取设置失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 9. 更新用户设置
app.put('/api/settings', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];

    if (!userId) {
      return res.status(401).json({ error: '未授权' });
    }

    const { email, notifyEnabled } = req.body;

    await firestore.updateUserSettings(userId, {
      email,
      notifyEnabled: !!notifyEnabled
    });

    res.json({ success: true });
  } catch (error) {
    console.error('更新设置失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 10. 发送测试邮件
app.post('/api/settings/test-email', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];

    if (!userId) {
      return res.status(401).json({ error: '未授权' });
    }

    const settings = await firestore.getUserSettings(userId);

    if (!settings.email) {
      return res.status(400).json({ error: '请先设置邮箱' });
    }

    await sendTestEmail(settings.email);

    res.json({ success: true, message: '测试邮件已发送' });
  } catch (error) {
    console.error('发送测试邮件失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║   PayPal 新闻聚合平台                              ║
║   服务器运行在: http://localhost:${PORT}            ║
║   定时任务: 每天 ${cronSchedule.split(' ')[1]} 点自动抓取             ║
╚═══════════════════════════════════════════════════╝
  `);
});

module.exports = app;

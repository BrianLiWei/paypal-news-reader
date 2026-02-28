// 认证中间件 - 验证用户 Token
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未授权，请先登录' });
  }

  const token = authHeader.split('Bearer ')[1];

  // 简化版：直接将 token 作为用户 ID
  // 在生产环境中，应该使用 firebase-admin 验证 Firebase ID Token
  req.userId = token;
  req.token = token;

  next();
};

// Firebase Admin 实例
let firebaseAdmin = null;

// 初始化 Firebase Admin（用于验证 token）
const initFirebaseAdmin = () => {
  // 检查是否配置了 Firebase
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_PRIVATE_KEY) {
    console.log('Firebase Admin 未配置（缺少 FIREBASE_PROJECT_ID 或 FIREBASE_PRIVATE_KEY）');
    return null;
  }

  try {
    const admin = require('firebase-admin');

    if (!admin.apps.length) {
      const serviceAccount = {
        type: 'service_account',
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL
      };

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }

    firebaseAdmin = admin;
    return admin;
  } catch (error) {
    console.error('Firebase Admin 初始化失败:', error.message);
    return null;
  }
};

module.exports = {
  authenticate,
  initFirebaseAdmin
};

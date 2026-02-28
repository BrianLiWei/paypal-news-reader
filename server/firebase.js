const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, orderBy, limit, updateDoc, deleteDoc } = require('firebase/firestore');
const { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } = require('firebase/auth');
require('dotenv').config();

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

module.exports = {
  db,
  auth,
  // 认证函数
  signIn: (email, password) => signInWithEmailAndPassword(auth, email, password),
  signUp: (email, password) => createUserWithEmailAndPassword(auth, email, password),
  logout: () => signOut(auth),
  onAuthStateChanged: (callback) => onAuthStateChanged(auth, callback),

  // Firestore 操作
  firestore: {
    // 添加新闻
    addNews: async (userId, news) => {
      const newsRef = doc(collection(db, 'users', userId, 'news'));
      await setDoc(newsRef, {
        ...news,
        createdAt: new Date()
      });
      return newsRef.id;
    },

    // 获取新闻列表
    getNews: async (userId, options = {}) => {
      let q = query(
        collection(db, 'users', userId, 'news'),
        orderBy('pubDate', 'desc')
      );

      if (options.limit) {
        q = query(q, limit(options.limit));
      }

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        // Firestore Timestamp 转换为 JavaScript Date
        if (data.pubDate && data.pubDate.toDate) {
          data.pubDate = data.pubDate.toDate().toISOString();
        }
        return { id: doc.id, ...data };
      });
    },

    // 标记新闻为已读
    markAsRead: async (userId, newsId) => {
      const newsRef = doc(db, 'users', userId, 'news', newsId);
      await updateDoc(newsRef, { isRead: true });
    },

    // 删除新闻
    deleteNews: async (userId, newsId) => {
      const newsRef = doc(db, 'users', userId, 'news', newsId);
      await deleteDoc(newsRef);
    },

    // 检查新闻是否已存在（去重）
    newsExists: async (userId, link) => {
      const q = query(
        collection(db, 'users', userId, 'news'),
        where('link', '==', link),
        limit(1)
      );
      const snapshot = await getDocs(q);
      return !snapshot.empty;
    },

    // 获取用户设置
    getUserSettings: async (userId) => {
      const settingsRef = doc(db, 'users', userId, 'settings', 'preferences');
      const snapshot = await getDoc(settingsRef);
      if (snapshot.exists()) {
        return snapshot.data();
      }
      return { email: '', notifyEnabled: false };
    },

    // 更新用户设置
    updateUserSettings: async (userId, settings) => {
      const settingsRef = doc(db, 'users', userId, 'settings', 'preferences');
      await setDoc(settingsRef, settings, { merge: true });
    }
  }
};

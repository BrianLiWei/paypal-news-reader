const cron = require('node-cron');
const { fetchAndSaveNews, scrapePayPalNews } = require('./scraper');
const { sendDailyDigest } = require('./mailer');
const { db, firestore } = require('./firebase');
const { getDocs, collection } = require('firebase/firestore');

let isRunning = false;

/**
 * 获取所有用户
 */
async function getAllUsers() {
  try {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    return usersSnapshot.docs.map(doc => doc.id);
  } catch (error) {
    console.error('获取用户列表失败:', error);
    return [];
  }
}

/**
 * 为所有用户抓取新闻
 */
async function fetchNewsForAllUsers() {
  if (isRunning) {
    console.log('上次任务还在运行中，跳过...');
    return;
  }

  isRunning = true;
  console.log('========== 开始定时抓取新闻 ==========');

  try {
    const users = await getAllUsers();
    console.log(`发现 ${users.length} 个用户`);

    for (const userId of users) {
      try {
        // 抓取新闻
        const newCount = await fetchAndSaveNews(firestore, userId);

        // 获取用户设置，检查是否需要发送邮件
        const settings = await firestore.getUserSettings(userId);

        if (settings.notifyEnabled && settings.email) {
          // 获取当天新闻
          const news = await firestore.getNews(userId, { limit: 20 });
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const todayNews = news.filter(item => {
            const pubDate = new Date(item.pubDate);
            return pubDate >= today;
          });

          if (todayNews.length > 0) {
            await sendDailyDigest(settings.email, todayNews);
            console.log(`已向 ${settings.email} 发送每日汇总`);
          }
        }
      } catch (error) {
        console.error(`处理用户 ${userId} 失败:`, error);
      }
    }
  } catch (error) {
    console.error('定时任务执行失败:', error);
  } finally {
    isRunning = false;
    console.log('========== 定时抓取完成 ==========');
  }
}

/**
 * 启动定时任务
 * @param {string} schedule - cron 表达式，默认每天早上 7 点
 */
function startScheduler(schedule = '0 7 * * *') {
  console.log(`定时任务已启动: ${schedule}`);

  // 立即执行一次（可选）
  // fetchNewsForAllUsers();

  // 定时执行
  cron.schedule(schedule, () => {
    fetchNewsForAllUsers();
  });

  return {
    runNow: fetchNewsForAllUsers,
    stop: () => {
      // node-cron 不提供直接停止的方法，
      // 可以通过返回函数来控制
    }
  };
}

/**
 * 手动触发新闻抓取（用于用户手动刷新）
 * @param {string} userId - 用户 ID
 */
async function manualRefresh(userId) {
  console.log(`用户 ${userId} 手动刷新新闻...`);
  return await fetchAndSaveNews(firestore, userId);
}

module.exports = {
  startScheduler,
  fetchNewsForAllUsers,
  manualRefresh
};

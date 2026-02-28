const Parser = require('rss-parser');

// Google News RSS 源
const RSS_SOURCES = [
  {
    name: 'Google News - PayPal',
    url: 'https://news.google.com/rss/search?q=PayPal&hl=zh-CN&gl=CN&ceid=CN:zh'
  },
  {
    name: 'Google News - PayPal (English)',
    url: 'https://news.google.com/rss/search?q=PayPal&hl=en-US&gl=US&ceid=US:en'
  }
];

const parser = new Parser({
  customFields: {
    item: ['source', 'enclosure']
  }
});

/**
 * 抓取 PayPal 新闻
 * @param {string} userId - 用户 ID
 * @returns {Promise<Array>} 新闻列表
 */
async function scrapePayPalNews(userId) {
  const allNews = [];

  for (const source of RSS_SOURCES) {
    try {
      console.log(`正在从 ${source.name} 抓取新闻...`);
      const feed = await parser.parseURL(source.url);

      if (feed.items && feed.items.length > 0) {
        const newsItems = feed.items.map(item => ({
          title: item.title,
          link: item.link,
          pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
          source: item.source || source.name,
          snippet: item.contentSnippet || item.content || '',
          isRead: false,
          userId: userId
        }));

        allNews.push(...newsItems);
        console.log(`从 ${source.name} 抓取到 ${newsItems.length} 条新闻`);
      }
    } catch (error) {
      console.error(`从 ${source.name} 抓取失败:`, error.message);
    }
  }

  // 按日期排序（最新的在前）
  allNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  // 去重（基于链接）
  const uniqueNews = [];
  const seenLinks = new Set();

  for (const news of allNews) {
    // 清理链接，提取原始 URL
    // Google News RSS 格式: https://news.google.com/.../url=原始URL&...
    let cleanLink = news.link;

    // 尝试从 url= 参数提取原始链接
    if (cleanLink.includes('url=')) {
      const match = cleanLink.match(/url=([^&]+)/);
      if (match) {
        cleanLink = decodeURIComponent(match[1]);
      }
    }

    // 进一步清理
    try {
      // 去除更多参数
      cleanLink = cleanLink.split('?')[0];
      // 确保是有效的 URL
      if (!cleanLink.startsWith('http')) {
        cleanLink = news.link; // 如果失败，使用原始链接
      }
    } catch (e) {
      // 保持原样
    }

    if (!seenLinks.has(cleanLink)) {
      seenLinks.add(cleanLink);
      news.link = cleanLink;
      uniqueNews.push(news);
    }
  }

  return uniqueNews;
}

/**
 * 抓取并保存新闻到数据库
 * @param {Object} firestore - Firestore 操作对象
 * @param {string} userId - 用户 ID
 * @returns {Promise<number>} 新增新闻数量
 */
async function fetchAndSaveNews(firestore, userId) {
  const news = await scrapePayPalNews(userId);

  let newCount = 0;

  for (const item of news) {
    try {
      // 检查是否已存在
      const exists = await firestore.newsExists(userId, item.link);
      if (!exists) {
        await firestore.addNews(userId, item);
        newCount++;
      }
    } catch (error) {
      console.error(`保存新闻失败: ${item.title}`, error.message);
    }
  }

  console.log(`用户 ${userId}: 新增 ${newCount} 条新闻`);
  return newCount;
}

module.exports = {
  scrapePayPalNews,
  fetchAndSaveNews,
  RSS_SOURCES
};

const dotenv = require('dotenv');
dotenv.config();

const { scrapePayPalNews } = require('./server/scraper');
const { initMailer, sendDailyDigest } = require('./server/mailer');

async function main() {
  initMailer();

  console.log('正在抓取 PayPal 新闻...');
  const news = await scrapePayPalNews('test-user');

  if (news.length === 0) {
    console.log('没有抓取到新闻');
    return;
  }

  console.log(`抓取到 ${news.length} 条新闻`);

  // 发送到两个邮箱
  const emails = ['brian.w.li@hotmail.com', 'weili10@paypal.com'];

  for (const email of emails) {
    console.log(`\n正在发送邮件到 ${email}...`);
    const success = await sendDailyDigest(email, news);
    console.log(success ? `✓ 发送到 ${email} 成功` : `✗ 发送到 ${email} 失败`);
  }

  console.log('\n全部完成！');
}

main().catch(console.error);

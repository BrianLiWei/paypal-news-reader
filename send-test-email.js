const dotenv = require('dotenv');
dotenv.config();

const { scrapePayPalNews } = require('./server/scraper');
const { initMailer, sendDailyDigest } = require('./server/mailer');

async function main() {
  // 初始化邮件发送器
  initMailer();

  console.log('正在抓取 PayPal 新闻...');
  const news = await scrapePayPalNews('test-user');

  if (news.length === 0) {
    console.log('没有抓取到新闻');
    return;
  }

  console.log(`抓取到 ${news.length} 条新闻`);

  // 显示前几条新闻的链接，确认 URL 是否正确
  console.log('\n前5条新闻链接:');
  news.slice(0, 5).forEach((item, i) => {
    console.log(`${i + 1}. ${item.title}`);
    console.log(`   链接: ${item.link}\n`);
  });

  // 发送到 Hotmail
  const targetEmail = 'brian.w.li@hotmail.com';
  console.log(`\n正在发送邮件到 ${targetEmail}...`);

  const success = await sendDailyDigest(targetEmail, news);

  if (success) {
    console.log('邮件发送成功！');
  } else {
    console.log('邮件发送失败');
  }
}

main().catch(console.error);

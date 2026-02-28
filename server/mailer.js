const nodemailer = require('nodemailer');

let transporter = null;

/**
 * 初始化邮件发送器
 */
function initMailer() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.log('邮件配置未设置，跳过邮件初始化');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  console.log('邮件发送器已初始化');
  return transporter;
}

/**
 * 发送每日新闻汇总邮件
 * @param {string} to - 收件人邮箱
 * @param {Array} news - 新闻列表
 */
async function sendDailyDigest(to, news) {
  if (!transporter) {
    console.log('邮件发送器未初始化');
    return false;
  }

  // 支持多个邮箱（用逗号分隔）
  const recipients = to.split(',').map(email => email.trim()).filter(email => email);
  if (recipients.length === 0) {
    console.log('没有有效的收件人邮箱');
    return false;
  }

  const newsListHtml = news.slice(0, 15).map((item, index) => {
    const date = new Date(item.pubDate).toLocaleString('zh-CN');
    return `
      <div style="margin-bottom: 16px; padding: 12px; background: #f5f5f5; border-radius: 4px;">
        <h3 style="margin: 0 0 8px 0; font-size: 16px;">
          <a href="${item.link}" style="color: #1a73e8; text-decoration: none;">${item.title}</a>
        </h3>
        <p style="margin: 0; font-size: 12px; color: #666;">
          来源: ${item.source} | 发布时间: ${date}
        </p>
      </div>
    `;
  }).join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1a73e8; color: white; padding: 20px; text-align: center; border-radius: 4px 4px 0 0; }
        .content { background: #fff; padding: 20px; border: 1px solid #ddd; }
        .footer { background: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 4px 4px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 24px;">PayPal 新闻汇总</h1>
          <p style="margin: 5px 0 0 0;">${new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div class="content">
          <p>今日为您精选 <strong>${news.length}</strong> 条 PayPal 相关新闻：</p>
          ${newsListHtml}
        </div>
        <div class="footer">
          <p>来自 PayPal 新闻聚合平台</p>
          <p><a href="${process.env.APP_URL || 'http://localhost:3000'}">打开应用查看更多</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const info = await transporter.sendMail({
      from: `"PayPal News" <${process.env.SMTP_USER}>`,
      to: recipients.join(','),
      subject: `PayPal 新闻汇总 - ${new Date().toLocaleDateString('zh-CN')}`,
      html: htmlContent
    });

    console.log(`邮件已发送到 ${to}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('发送邮件失败:', error);
    return false;
  }
}

/**
 * 发送测试邮件
 * @param {string} to - 收件人邮箱
 */
async function sendTestEmail(to) {
  return await sendDailyDigest(to, [
    {
      title: '这是一封测试邮件',
      link: 'https://www.paypal.com',
      source: 'PayPal News',
      pubDate: new Date()
    }
  ]);
}

module.exports = {
  initMailer,
  sendDailyDigest,
  sendTestEmail
};

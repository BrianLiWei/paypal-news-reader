// API 基础 URL
const API_BASE = '';

// 状态管理
const state = {
  user: null,
  token: null,
  news: [],
  selectedNews: null,
  autoReadTimer: null,  // 自动标记已读的定时器
  autoReadDelay: 3000,  // 3秒后自动标记已读
  settings: {
    email: '',
    notifyEnabled: false
  }
};

// ==================== DOM 元素 ====================
const elements = {
  // 页面
  authPage: document.getElementById('auth-page'),
  appPage: document.getElementById('app-page'),

  // 认证
  authForm: document.getElementById('auth-form'),
  emailInput: document.getElementById('email'),
  passwordInput: document.getElementById('password'),
  authSubmit: document.getElementById('auth-submit'),
  authError: document.getElementById('auth-error'),
  tabBtns: document.querySelectorAll('.tab-btn'),

  // 导航
  refreshBtn: document.getElementById('refresh-btn'),
  settingsBtn: document.getElementById('settings-btn'),
  logoutBtn: document.getElementById('logout-btn'),

  // 新闻列表
  newsList: document.getElementById('news-list'),
  newsCount: document.getElementById('news-count'),
  filterDate: document.getElementById('filter-date'),

  // 新闻详情
  newsDetail: document.getElementById('news-detail'),
  detailPlaceholder: document.querySelector('.detail-placeholder'),
  detailContent: document.getElementById('detail-content'),
  detailTitle: document.getElementById('detail-title'),
  detailSource: document.getElementById('detail-source'),
  detailDate: document.getElementById('detail-date'),
  detailSnippet: document.getElementById('detail-snippet'),
  detailLink: document.getElementById('detail-link'),
  markReadBtn: document.getElementById('mark-read-btn'),

  // 设置弹窗
  settingsModal: document.getElementById('settings-modal'),
  closeSettings: document.getElementById('close-settings'),
  notifyEmail: document.getElementById('notify-email'),
  notifyEnabled: document.getElementById('notify-enabled'),
  testEmailBtn: document.getElementById('test-email-btn'),
  saveSettings: document.getElementById('save-settings')
};

// ==================== 工具函数 ====================

// 格式化日期
function formatDate(dateStr) {
  if (!dateStr) return '';

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diff = now - date;

  // 小于 1 小时
  if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    return mins <= 0 ? '刚刚' : `${mins} 分钟前`;
  }

  // 小于 24 小时
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours} 小时前`;
  }

  // 小于 7 天
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days} 天前`;
  }

  // 超过 7 天
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric'
  });
}

// API 请求
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (state.token) {
    headers['X-User-Id'] = state.token;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '请求失败');
    }

    return data;
  } catch (error) {
    console.error('API 请求失败:', error);
    throw error;
  }
}

// 显示错误
function showError(message) {
  elements.authError.textContent = message;
  elements.authError.style.display = 'block';
}

// 清除错误
function clearError() {
  elements.authError.textContent = '';
  elements.authError.style.display = 'none';
}

// ==================== 认证相关 ====================

// 切换标签页
elements.tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;

    elements.tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    elements.authSubmit.textContent = tab === 'login' ? '登录' : '注册';
  });
});

// 登录/注册表单提交
elements.authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();

  const email = elements.emailInput.value;
  const password = elements.passwordInput.value;
  const isLogin = elements.authSubmit.textContent === '登录';

  elements.authSubmit.disabled = true;
  elements.authSubmit.textContent = '请稍候...';

  try {
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const data = await apiRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    state.user = data.user;
    state.token = data.token;

    // 保存到 localStorage
    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('token', data.token);

    showApp();
    loadNews();
    loadSettings();
  } catch (error) {
    showError(error.message);
  } finally {
    elements.authSubmit.disabled = false;
    elements.authSubmit.textContent = isLogin ? '登录' : '注册';
  }
});

// 登出
elements.logoutBtn.addEventListener('click', async () => {
  try {
    await apiRequest('/api/auth/logout', { method: 'POST' });
  } catch (error) {
    console.error('登出失败:', error);
  }

  // 清除本地状态
  state.user = null;
  state.token = null;
  state.news = [];

  localStorage.removeItem('user');
  localStorage.removeItem('token');

  showAuth();
});

// ==================== 页面切换 ====================

function showAuth() {
  elements.authPage.classList.remove('hidden');
  elements.appPage.classList.add('hidden');
}

function showApp() {
  elements.authPage.classList.add('hidden');
  elements.appPage.classList.remove('hidden');
}

// 初始化 - 检查登录状态
function init() {
  try {
    const savedUser = localStorage.getItem('user');
    const savedToken = localStorage.getItem('token');

    if (savedUser && savedToken) {
      state.user = JSON.parse(savedUser);
      state.token = savedToken;

      // 验证 token 是否有效
      if (state.token && state.token.length > 0) {
        showApp();
        loadNews();
        loadSettings();
        return;
      }
    }
  } catch (e) {
    console.error('读取登录状态失败:', e);
  }

  // 未登录
  showAuth();
}

// ==================== 新闻相关 ====================

// 加载新闻
async function loadNews() {
  elements.newsList.innerHTML = '<div class="loading">加载中...</div>';

  try {
    const data = await apiRequest('/api/news');
    state.news = data.news || [];
    renderNewsList();
  } catch (error) {
    elements.newsList.innerHTML = '<div class="loading">加载失败: ' + error.message + '</div>';
  }
}

// 刷新新闻
elements.refreshBtn.addEventListener('click', async () => {
  elements.refreshBtn.disabled = true;
  elements.refreshBtn.style.animation = 'spin 1s linear infinite';

  try {
    const data = await apiRequest('/api/news/refresh', { method: 'POST' });
    await loadNews();
    alert(data.message || '刷新成功');
  } catch (error) {
    alert('刷新失败: ' + error.message);
  } finally {
    elements.refreshBtn.disabled = false;
    elements.refreshBtn.style.animation = '';
  }
});

// 渲染新闻列表
function renderNewsList() {
  const filter = elements.filterDate.value;
  let filteredNews = [...state.news];

  // 过滤
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (filter === 'today') {
    filteredNews = filteredNews.filter(item => new Date(item.pubDate) >= now);
  } else if (filter === 'week') {
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    filteredNews = filteredNews.filter(item => new Date(item.pubDate) >= weekAgo);
  }

  elements.newsCount.textContent = `${filteredNews.length} 条`;

  if (filteredNews.length === 0) {
    elements.newsList.innerHTML = '<div class="loading">暂无新闻</div>';
    return;
  }

  elements.newsList.innerHTML = filteredNews.map(news => `
    <div class="news-item ${news.isRead ? '' : 'unread'} ${state.selectedNews?.id === news.id ? 'active' : ''}"
         data-id="${news.id}">
      <div class="news-title">${escapeHtml(news.title)}</div>
      <div class="news-snippet">${escapeHtml(news.snippet || '')}</div>
      <div class="news-meta">
        <span class="news-source">${escapeHtml(news.source)}</span>
        <span class="news-date">${formatDate(news.pubDate)}</span>
      </div>
    </div>
  `).join('');

  // 添加点击事件
  document.querySelectorAll('.news-item').forEach(item => {
    item.addEventListener('click', () => {
      const newsId = item.dataset.id;
      const news = state.news.find(n => n.id === newsId);
      if (news) {
        selectNews(news);
      }
    });
  });
}

// 选择新闻
function selectNews(news) {
  state.selectedNews = news;

  // 清除之前的自动标记已读定时器
  if (state.autoReadTimer) {
    clearTimeout(state.autoReadTimer);
    state.autoReadTimer = null;
  }

  // 更新列表选中状态
  document.querySelectorAll('.news-item').forEach(item => {
    item.classList.toggle('active', item.dataset.id === news.id);
  });

  // 显示详情
  elements.detailPlaceholder.classList.add('hidden');
  elements.detailContent.classList.remove('hidden');

  elements.detailTitle.textContent = news.title;
  elements.detailSource.textContent = news.source;
  elements.detailDate.textContent = formatDate(news.pubDate);
  elements.detailSnippet.textContent = news.snippet || '无摘要';
  elements.detailLink.href = news.link;

  // 如果未读，3秒后自动标记为已读
  if (!news.isRead) {
    state.autoReadTimer = setTimeout(async () => {
      try {
        await apiRequest(`/api/news/${news.id}/read`, { method: 'POST' });
        // 更新本地状态
        const index = state.news.findIndex(n => n.id === news.id);
        if (index !== -1) {
          state.news[index].isRead = true;
        }
        renderNewsList();
      } catch (error) {
        console.error('自动标记已读失败:', error);
      }
    }, state.autoReadDelay);
  }
}

// HTML 转义
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 标记为已读
elements.markReadBtn.addEventListener('click', async () => {
  if (!state.selectedNews) return;

  try {
    await apiRequest(`/api/news/${state.selectedNews.id}/read`, { method: 'POST' });

    // 更新本地状态
    const index = state.news.findIndex(n => n.id === state.selectedNews.id);
    if (index !== -1) {
      state.news[index].isRead = true;
    }

    renderNewsList();
  } catch (error) {
    alert('标记失败: ' + error.message);
  }
});

// 过滤变化
elements.filterDate.addEventListener('change', renderNewsList);

// ==================== 设置相关 ====================

// 加载设置
async function loadSettings() {
  try {
    const data = await apiRequest('/api/settings');
    state.settings = data.settings || { email: '', notifyEnabled: false };

    elements.notifyEmail.value = state.settings.email || '';
    elements.notifyEnabled.checked = state.settings.notifyEnabled || false;
  } catch (error) {
    console.error('加载设置失败:', error);
  }
}

// 打开设置弹窗
elements.settingsBtn.addEventListener('click', () => {
  elements.settingsModal.classList.remove('hidden');
});

// 关闭设置弹窗
elements.closeSettings.addEventListener('click', () => {
  elements.settingsModal.classList.add('hidden');
});

// 点击弹窗外部关闭
elements.settingsModal.addEventListener('click', (e) => {
  if (e.target === elements.settingsModal) {
    elements.settingsModal.classList.add('hidden');
  }
});

// 发送测试邮件
elements.testEmailBtn.addEventListener('click', async () => {
  elements.testEmailBtn.disabled = true;
  elements.testEmailBtn.textContent = '发送中...';

  try {
    await apiRequest('/api/settings/test-email', { method: 'POST' });
    alert('测试邮件已发送，请检查邮箱');
  } catch (error) {
    alert('发送失败: ' + error.message);
  } finally {
    elements.testEmailBtn.disabled = false;
    elements.testEmailBtn.textContent = '发送测试邮件';
  }
});

// 保存设置
elements.saveSettings.addEventListener('click', async () => {
  const email = elements.notifyEmail.value;
  const notifyEnabled = elements.notifyEnabled.checked;

  try {
    await apiRequest('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({ email, notifyEnabled })
    });

    state.settings.email = email;
    state.settings.notifyEnabled = notifyEnabled;

    elements.settingsModal.classList.add('hidden');
    alert('设置已保存');
  } catch (error) {
    alert('保存失败: ' + error.message);
  }
});

// 添加旋转动画
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

// 初始化
init();

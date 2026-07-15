// GitOps Platform Dashboard - Frontend Application v2.0.0

(function() {
  'use strict';

  // ========================================
  // State Management
  // ========================================
  const state = {
    theme: 'light',
    systemInfo: null,
    services: [],
    metrics: {},
    lastUpdated: null,
    updateInterval: null
  };

  // ========================================
  // DOM Elements Cache
  // ========================================
  const elements = {};

  function cacheElements() {
    elements.themeToggle = document.getElementById('themeToggle');
    elements.systemStatus = document.getElementById('systemStatus');
    elements.systemStatusText = document.getElementById('systemStatusText');
    elements.sysHostname = document.getElementById('sysHostname');
    elements.sysPlatform = document.getElementById('sysPlatform');
    elements.sysArch = document.getElementById('sysArch');
    elements.sysUptime = document.getElementById('sysUptime');
    elements.sysCpus = document.getElementById('sysCpus');
    elements.sysLoad = document.getElementById('sysLoad');
    elements.sysMemory = document.getElementById('sysMemory');
    elements.sysNode = document.getElementById('sysNode');
    elements.statServices = document.getElementById('statServices');
    elements.statHealthy = document.getElementById('statHealthy');
    elements.statUptime = document.getElementById('statUptime');
    elements.statDeployments = document.getElementById('statDeployments');
    elements.servicesGrid = document.getElementById('servicesGrid');
    elements.lastUpdated = document.getElementById('lastUpdated');
    elements.refreshServices = document.getElementById('refreshServices');
    elements.metricRequests = document.getElementById('metricRequests');
    elements.metricMemory = document.getElementById('metricMemory');
    elements.metricCpu = document.getElementById('metricCpu');
    elements.metricUptime = document.getElementById('metricUptime');
    elements.uptimeBadge = document.getElementById('uptimeBadge');
    elements.progressBar = document.getElementById('progressBar');
    elements.toastContainer = document.getElementById('toastContainer');
    elements.navLinks = document.querySelectorAll('.nav-link[data-page]');
  }

  // ========================================
  // Theme Management
  // ========================================
  function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme(savedTheme);
    
    if (elements.themeToggle) {
      elements.themeToggle.addEventListener('click', toggleTheme);
    }
    
    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('theme')) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    });
  }

  function setTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    // Update theme toggle icon
    if (elements.themeToggle) {
      elements.themeToggle.setAttribute('aria-label', 
        theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
  }

  function toggleTheme() {
    const newTheme = state.theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    showToast(`Switched to ${newTheme} mode`, 'info');
  }

  // ========================================
  // Progress Bar
  // ========================================
  function showProgress() {
    if (elements.progressBar) {
      elements.progressBar.classList.add('loading');
    }
  }

  function hideProgress() {
    if (elements.progressBar) {
      elements.progressBar.classList.remove('loading');
    }
  }

  // ========================================
  // API Fetching
  // ========================================
  async function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          ...options.headers
        }
      });
      clearTimeout(timeout);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }

  async function loadSystemInfo() {
    try {
      const data = await fetchWithTimeout('/api/system');
      state.systemInfo = data;
      updateSystemPanel(data);
      return data;
    } catch (error) {
      console.warn('Failed to load system info:', error);
      updateSystemStatus('offline', 'Offline');
      showToast('Failed to load system info', 'warning');
    }
  }

  async function loadServices() {
    showProgress();
    try {
      const data = await fetchWithTimeout('/api/services');
      state.services = data;
      state.lastUpdated = new Date();
      renderServices(data);
      updateLastUpdated();
      updateHeroStats(data);
      hideProgress();
      return data;
    } catch (error) {
      console.warn('Failed to load services:', error);
      hideProgress();
      showToast('Failed to load services', 'warning');
    }
  }

  async function loadMetrics() {
    try {
      const data = await fetchWithTimeout('/api/system');
      state.metrics = data;
      updateMetrics(data);
    } catch (error) {
      console.warn('Failed to load metrics:', error);
    }
  }

  // ========================================
  // UI Updates
  // ========================================
  function updateSystemPanel(data) {
    if (!data) return;

    const { hostname, platform, arch, uptime, loadavg, memory, cpus, networkInterfaces, nodeVersion, pid, memoryUsage } = data;

    // Update system info
    if (elements.sysHostname) elements.sysHostname.textContent = hostname || 'Unknown';
    if (elements.sysPlatform) elements.sysPlatform.textContent = `${platform} (${arch})`;
    if (elements.sysArch) elements.sysArch.textContent = arch;
    if (elements.sysUptime) elements.sysUptime.textContent = formatUptime(uptime);
    if (elements.sysCpus) elements.sysCpus.textContent = cpus?.length || 'Unknown';
    if (elements.sysLoad) elements.sysLoad.textContent = loadavg?.map(l => l.toFixed(2)).join(', ') || 'Unknown';
    
    const memUsed = memory ? Math.round((memory.total - memory.free) / 1024 / 1024) : 'Unknown';
    const memTotal = memory ? Math.round(memory.total / 1024 / 1024) : 'Unknown';
    if (elements.sysMemory) elements.sysMemory.textContent = `${memUsed} / ${memTotal} MB`;
    
    if (elements.sysNode) elements.sysNode.textContent = nodeVersion || 'Unknown';

    // Update status
    updateSystemStatus('online', 'Online');
  }

  function updateSystemStatus(status, text) {
    if (elements.systemStatus) {
      elements.systemStatus.className = `status-dot status-${status}`;
    }
    if (elements.systemStatusText) {
      elements.systemStatusText.textContent = text;
    }
  }

  function formatUptime(seconds) {
    if (!seconds || seconds < 0) return 'Unknown';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    return parts.join(' ') || '< 1m';
  }

  function updateHeroStats(services) {
    const total = services.length;
    const healthy = services.filter(s => s.status === 'healthy').length;
    
    if (elements.statServices) elements.statServices.textContent = total;
    if (elements.statHealthy) elements.statHealthy.textContent = healthy;
    if (elements.statUptime && state.systemInfo?.uptime) {
      elements.statUptime.textContent = formatUptime(state.systemInfo.uptime);
    }
  }

  function updateUptimeBadge() {
    if (elements.uptimeBadge && state.systemInfo?.uptime) {
      elements.uptimeBadge.textContent = `Uptime: ${formatUptime(state.systemInfo.uptime)}`;
      elements.uptimeBadge.className = 'badge badge-success';
    }
  }

  function updateSystemStatus(status, text) {
    updateSystemStatus(status, text);
  }

  function renderServices(services) {
    if (!elements.servicesGrid) return;

    elements.servicesGrid.innerHTML = services.map(service => `
      <article class="service-card" data-service="${service.name}" role="listitem">
        <div class="service-header">
          <div class="service-icon ${getServiceIconClass(service.name)}">
            ${getServiceIcon(service.name)}
          </div>
          <div class="service-info">
            <h3 class="service-name">${escapeHtml(service.name)}</h3>
            <span class="service-url">${escapeHtml(service.url || 'N/A')}</span>
          </div>
          <span class="service-status status-${service.status}">
            <span class="status-dot"></span>
            <span class="status-text">${service.status === 'healthy' ? 'Healthy' : 'Unhealthy'}</span>
          </span>
        </div>
        <div class="service-details">
          <div class="detail-item">
            <span class="detail-label">Port</span>
            <span class="detail-value">${service.port || 'N/A'}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Last Check</span>
            <span class="detail-value">${formatDateTime(service.lastCheck)}</span>
          </div>
          ${service.error ? `
            <div class="detail-item detail-error">
              <span class="detail-label">Error</span>
              <span class="detail-value">${escapeHtml(service.error)}</span>
            </div>
          ` : ''}
        </div>
        <div class="service-actions">
          ${service.port ? `
            <button class="btn btn-ghost btn-sm" onclick="testPort('${service.url?.replace('http://', '')}', ${service.port})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              Test Port
            </button>
          ` : ''}
        </div>
      </article>
    `).join('');

    // Animate cards
    const cards = elements.servicesGrid.querySelectorAll('.service-card');
    cards.forEach((card, index) => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(20px)';
      setTimeout(() => {
        card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
      }, index * 80);
    });
  }

  function getServiceIconClass(name) {
    const lower = name.toLowerCase();
    if (lower.includes('prometheus')) return 'prometheus';
    if (lower.includes('grafana')) return 'grafana';
    if (lower.includes('postgres') || lower.includes('db') || lower.includes('sql')) return 'postgres';
    if (lower.includes('node') || lower.includes('exporter')) return 'node-exporter';
    if (lower.includes('runner') || lower.includes('gitlab')) return 'gitlab';
    if (lower.includes('app') || lower.includes('web')) return 'app';
    return 'generic';
  }

  function getServiceIcon(name) {
    const lower = name.toLowerCase();
    if (lower.includes('prometheus')) {
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
    }
    if (lower.includes('grafana')) {
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="10"/><line x1="6" y1="20" x2="6" y2="10"/><path d="M2 10h20"/></svg>`;
    }
    if (lower.includes('postgres') || lower.includes('db')) {
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`;
    }
    if (lower.includes('node') || lower.includes('exporter')) {
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="10"/><line x1="6" y1="20" x2="6" y2="10"/><path d="M2 10h20"/></svg>`;
    }
    if (lower.includes('runner') || lower.includes('gitlab')) {
      return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1a.42.42 0 0 1 .11-.18.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49 1.22 3.78a.84.84 0 0 1-.3.94z"/></svg>`;
    }
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`;
  }

  function updateMetrics(data) {
    if (!data) return;

    if (elements.metricRequests) {
      elements.metricRequests.textContent = '1,234'; // Mock
    }
    if (elements.metricMemory && data.memoryUsage) {
      elements.metricMemory.textContent = `${data.memoryUsage.heapUsed} / ${data.memoryUsage.heapTotal} MB`;
    }
    if (elements.metricCpu && data.loadavg) {
      const cpuPercent = ((data.loadavg[0] / (data.cpus?.length || 1)) * 100).toFixed(1);
      elements.metricCpu.textContent = `${cpuPercent}%`;
    }
    if (elements.metricUptime && data.uptime) {
      elements.metricUptime.textContent = formatUptime(data.uptime);
    }
  }

  function updateLastUpdated() {
    if (elements.lastUpdated && state.lastUpdated) {
      elements.lastUpdated.textContent = `Last updated: ${formatDateTime(state.lastUpdated)}`;
    }
  }

  function formatDateTime(date) {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  // ========================================
  // Toast Notifications
  // ========================================
  function showToast(message, type = 'info', duration = 4000) {
    if (!elements.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');
    
    const icons = {
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
      error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };

    toast.innerHTML = `
      <div class="toast-icon">${icons[type] || icons.info}</div>
      <div class="toast-message">${escapeHtml(message)}</div>
      <button class="toast-close" aria-label="Dismiss">&times;</button>
    `;

    elements.toastContainer.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    // Auto dismiss
    const timeout = setTimeout(() => {
      dismissToast(toast);
    }, duration);

    // Manual dismiss
    toast.querySelector('.toast-close').addEventListener('click', () => {
      clearTimeout(timeout);
      dismissToast(toast);
    });
  }

  function dismissToast(toast) {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }

  // ========================================
  // Navigation Active State
  // ========================================
  function updateActiveNav() {
    const currentPath = window.location.pathname;
    elements.navLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href === currentPath || (href !== '/' && currentPath.startsWith(href))) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  // ========================================
  // Smooth Scroll & Page Transitions
  // ========================================
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  // ========================================
  // Auto-refresh
  // ========================================
  function startAutoRefresh() {
    // Initial load
    loadSystemInfo();
    loadServices();
    loadMetrics();
    
    // Refresh every 30 seconds
    state.updateInterval = setInterval(() => {
      loadSystemInfo();
      loadServices();
      loadMetrics();
    }, 30000);
  }

  function stopAutoRefresh() {
    if (state.updateInterval) {
      clearInterval(state.updateInterval);
      state.updateInterval = null;
    }
  }

  // ========================================
  // Event Listeners
  // ========================================
  function bindEvents() {
    // Refresh services button
    if (elements.refreshServices) {
      elements.refreshServices.addEventListener('click', () => {
        elements.refreshServices.classList.add('spinning');
        loadServices().finally(() => {
          elements.refreshServices.classList.remove('spinning');
        });
      });
    }

    // Handle page visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopAutoRefresh();
      } else {
        startAutoRefresh();
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + D: Toggle theme
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        toggleTheme();
      }
      // Ctrl/Cmd + R: Refresh (prevent default, do our refresh)
      if ((e.ctrlKey || e.metaKey) && e.key === 'r' && !e.shiftKey) {
        e.preventDefault();
        loadServices();
        showToast('Refreshing services...', 'info');
      }
    });
  }

  // ========================================
  // Utility Functions
  // ========================================
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ========================================
  // Animation Observer
  // ========================================
  function initAnimationObserver() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    document.querySelectorAll('.feature-card, .service-card, .metric-card, .link-card, .status-item, .vm-grid > .topology-node').forEach(el => {
      observer.observe(el);
    });
  }

  // ========================================
  // Initialize Application
  // ========================================
  function init() {
    cacheElements();
    initTheme();
    bindEvents();
    initSmoothScroll();
    initAnimationObserver();
    updateActiveNav();
    startAutoRefresh();
    updateUptimeBadge();

    // Initial load
    loadSystemInfo();
    loadServices();
    loadMetrics();

    console.log('🚀 GitOps Platform Dashboard v2.0.0 initialized');
  }

  // ========================================
  // Public API (for inline onclick handlers)
  // ========================================
  window.testPort = async function(host, port) {
    showToast(`Testing ${host}:${port}...`, 'info');
    try {
      const response = await fetch(`/api/test-port?host=${encodeURIComponent(host)}&port=${port}`);
      const result = await response.json();
      if (result.success) {
        showToast(`Port ${port} on ${host} is OPEN`, 'success');
      } else {
        showToast(`Port ${port} on ${host} is CLOSED`, 'error');
      }
    } catch (error) {
      showToast('Port test failed', 'error');
    }
  };

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
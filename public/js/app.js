// App Core Controller - FG TEN Platform
const App = {
  currentView: 'dashboard',
  user: null,
  clients: [],
  packages: [],
  settings: {},
  currentProject: null, // Holds active project being viewed/edited
  activeProjectTab: 'info',

  // Workflow label mapping
  statusLabels: {
    inquiry: '1. Inquiry / Tanya',
    booked: '2. Terjadwal',
    dp_received: '3. DP Masuk',
    shooting_done: '4. Selesai Foto',
    selection: '5. Seleksi Klien',
    editing: '6. Proses Editing',
    gallery_ready: '7. Galeri Siap',
    delivered: '8. Galeri Terkirim',
    completed: '9. Selesai & Ditutup'
  },

  paymentLabels: {
    unpaid: 'Belum Bayar',
    dp_paid: 'DP Terbayar',
    paid: 'Lunas'
  },

  init() {
    this.bindEvents();
    this.checkInitialRoute();
  },

  checkInitialRoute() {
    const urlParams = new URLSearchParams(window.location.search);
    const portalId = urlParams.get('portal');

    if (portalId) {
      this.loadPortal(portalId);
      return;
    }

    this.checkAuth();
  },

  async checkAuth() {
    try {
      const auth = await API.checkAuth();
      if (auth && auth.authenticated) {
        this.user = auth;
        this.showApp();
      } else {
        this.showLogin();
      }
    } catch (e) {
      this.showLogin();
    }
  },

  showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-layout').style.display = 'none';
    document.getElementById('portal-screen').style.display = 'none';
  },

  showApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('portal-screen').style.display = 'none';
    document.getElementById('app-layout').style.display = 'flex';

    if (this.user && this.user.email) {
      document.getElementById('user-email-display').textContent = this.user.email;
    }

    this.loadBootstrapData();
    this.navigate(this.currentView);
  },

  async loadBootstrapData() {
    try {
      const [clientsData, packagesData, settingsData] = await Promise.all([
        API.getClients(),
        API.getPackages(),
        API.getSettings()
      ]);
      this.clients = clientsData.clients || [];
      this.packages = packagesData.packages || [];
      this.settings = settingsData.settings || {};
      this.populateSelects();
    } catch (e) {
      console.error('Error loading bootstrap data:', e);
    }
  },

  populateSelects() {
    // Populate client select
    const clientSelect = document.getElementById('proj-client-select');
    if (clientSelect) {
      clientSelect.innerHTML = '<option value="">-- Ketik Klien Baru di bawah --</option>' +
        this.clients.map(c => `<option value="${c.id}">${this.escapeHtml(c.name)} ${c.phone ? `(${c.phone})` : ''}</option>`).join('');
    }

    // Populate package select
    const pkgSelect = document.getElementById('proj-package-select');
    if (pkgSelect) {
      pkgSelect.innerHTML = '<option value="">-- Pilih Paket (Opsional) --</option>' +
        this.packages.map(p => `<option value="${p.id}" data-price="${p.price}" data-name="${this.escapeHtml(p.name)}">${this.escapeHtml(p.name)} - ${this.formatIDR(p.price)}</option>`).join('');
    }
  },

  bindEvents() {
    // Login form
    const loginForm = document.getElementById('form-login');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const submitBtn = document.getElementById('btn-submit-login');

        try {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Memverifikasi...';
          const res = await API.login(email, password);
          this.user = { email: res.email };
          this.toast('Login berhasil', 'success');
          this.showApp();
        } catch (err) {
          this.toast(err.message, 'error');
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Masuk ke Dashboard';
        }
      });
    }

    // Logout
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await API.logout();
        this.user = null;
        this.showLogin();
      });
    }

    // Top action: + Proyek Baru
    const topCreateBtn = document.getElementById('btn-create-project-top');
    if (topCreateBtn) {
      topCreateBtn.addEventListener('click', () => this.openProjectModal());
    }

    // Navigation items
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const view = item.dataset.view;
        this.navigate(view);
      });
    });

    // Project filters
    const filterPills = document.querySelectorAll('#project-filter-pills .filter-pill');
    filterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        filterPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.loadProjects(pill.dataset.filter);
      });
    });

    // Project search
    const searchInput = document.getElementById('project-search-input');
    if (searchInput) {
      let debounce;
      searchInput.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          const activeFilter = document.querySelector('#project-filter-pills .filter-pill.active')?.dataset.filter || 'all';
          this.loadProjects(activeFilter, searchInput.value);
        }, 300);
      });
    }

    // Client search
    const clientSearch = document.getElementById('client-search-input');
    if (clientSearch) {
      clientSearch.addEventListener('input', () => {
        this.renderClients(clientSearch.value);
      });
    }

    // Add Client button
    const addClientBtn = document.getElementById('btn-add-client');
    if (addClientBtn) {
      addClientBtn.addEventListener('click', () => this.openClientModal());
    }

    // Add Package button
    const addPackageBtn = document.getElementById('btn-add-package');
    if (addPackageBtn) {
      addPackageBtn.addEventListener('click', () => this.openPackageModal());
    }

    // Project Modal Tabs
    document.querySelectorAll('.modal-tabs .modal-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        this.switchProjectTab(tab);
      });
    });

    // Project Modal Select Client event
    const projClientSelect = document.getElementById('proj-client-select');
    if (projClientSelect) {
      projClientSelect.addEventListener('change', () => {
        const clientId = projClientSelect.value;
        if (clientId) {
          const client = this.clients.find(c => c.id === clientId);
          if (client) {
            document.getElementById('proj-client-name').value = client.name;
            document.getElementById('proj-client-phone').value = client.phone || '';
          }
        }
      });
    }

    // Project Modal Select Package event
    const projPkgSelect = document.getElementById('proj-package-select');
    if (projPkgSelect) {
      projPkgSelect.addEventListener('change', () => {
        const opt = projPkgSelect.selectedOptions[0];
        if (opt && opt.dataset.price) {
          document.getElementById('proj-package-price').value = opt.dataset.price;
          this.updateExpenseCalculations();
        }
      });
    }

    // Live expense calculation when price inputs change
    ['proj-package-price', 'proj-addons-price'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => this.updateExpenseCalculations());
    });

    // Form Project Submit
    const formProject = document.getElementById('form-project');
    if (formProject) {
      formProject.addEventListener('submit', (e) => this.handleSaveProject(e));
    }

    // Form Client Submit
    const formClient = document.getElementById('form-client');
    if (formClient) {
      formClient.addEventListener('submit', (e) => this.handleSaveClient(e));
    }

    // Form Package Submit
    const formPackage = document.getElementById('form-package');
    if (formPackage) {
      formPackage.addEventListener('submit', (e) => this.handleSavePackage(e));
    }

    // Form Settings Submit
    const formSettings = document.getElementById('form-settings');
    if (formSettings) {
      formSettings.addEventListener('submit', (e) => this.handleSaveSettings(e));
    }

    // Copy portal url button
    const btnCopyPortal = document.getElementById('btn-copy-portal');
    if (btnCopyPortal) {
      btnCopyPortal.addEventListener('click', () => {
        const input = document.getElementById('share-portal-url');
        input.select();
        navigator.clipboard.writeText(input.value);
        this.toast('Tautan portal klien berhasil disalin!', 'success');
      });
    }
  },

  navigate(viewName) {
    this.currentView = viewName;

    // Update nav active state
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.view === viewName);
    });

    // Hide all view sections
    const views = ['dashboard', 'projects', 'clients', 'schedule', 'packages', 'settings'];
    views.forEach(v => {
      const el = document.getElementById(`view-${v}`);
      if (el) el.style.display = v === viewName ? 'block' : 'none';
    });

    // Update Heading
    const headings = {
      dashboard: 'Ringkasan Alur Kerja',
      projects: 'Daftar Proyek & Sesi Foto',
      clients: 'Database Klien',
      schedule: 'Jadwal & Agenda Pemotretan',
      packages: 'Katalog Paket & Layanan',
      settings: 'Pengaturan & Profil Studio'
    };
    document.getElementById('page-heading').textContent = headings[viewName] || 'Dashboard';

    // Load view data
    if (viewName === 'dashboard') this.loadDashboard();
    else if (viewName === 'projects') this.loadProjects();
    else if (viewName === 'clients') this.loadClients();
    else if (viewName === 'schedule') this.loadSchedule();
    else if (viewName === 'packages') this.loadPackages();
    else if (viewName === 'settings') this.loadSettings();
  },

  // --- DASHBOARD ---
  async loadDashboard() {
    try {
      const res = await API.getStats();
      const stats = res.stats || {};

      document.getElementById('stat-active-projects').textContent = stats.activeProjects || 0;
      document.getElementById('stat-upcoming-shoots').textContent = stats.upcomingShoots || 0;
      document.getElementById('stat-in-editing').textContent = stats.inEditing || 0;
      document.getElementById('stat-gallery-ready').textContent = stats.galleryReady || 0;
      document.getElementById('stat-unpaid-amount').textContent = this.formatIDR(stats.totalUnpaidAmount || 0);
      document.getElementById('stat-unpaid-count').textContent = `${stats.unpaidProjectsCount || 0} proyek`;

      const netProfitEl = document.getElementById('stat-net-profit');
      if (netProfitEl) netProfitEl.textContent = this.formatIDR(stats.netProfit || 0);

      const totalExpEl = document.getElementById('stat-total-expenses');
      if (totalExpEl) totalExpEl.textContent = `Biaya ops: ${this.formatIDR(stats.totalExpenses || 0)}`;

      // Upcoming shoots list
      const upcomingEl = document.getElementById('dashboard-upcoming-list');
      if (res.upcomingList && res.upcomingList.length > 0) {
        upcomingEl.innerHTML = res.upcomingList.map(p => `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border);">
            <div>
              <div style="font-weight: 600; color: #fff;">${this.escapeHtml(p.title)}</div>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                👤 ${this.escapeHtml(p.clientName)} &bull; 📍 ${this.escapeHtml(p.location || 'Lokasi belum diset')}
              </div>
            </div>
            <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
              <div style="font-weight: 600; color: var(--accent); font-size: 13px;">${this.formatDate(p.date)} ${p.time ? `@ ${p.time}` : ''}</div>
              <div style="display: flex; gap: 6px; align-items: center;">
                <span class="badge badge-${p.workflowStatus}">${this.statusLabels[p.workflowStatus] || p.workflowStatus}</span>
                <a href="${this.googleCalendarUrl(p)}" target="_blank" class="btn btn-secondary btn-sm" style="font-size: 10px; padding: 2px 6px;" title="Tambah ke Google Calendar">📅 Kalender</a>
              </div>
            </div>
          </div>
        `).join('');
      } else {
        upcomingEl.innerHTML = '<div style="color: var(--text-dim); font-size: 13px; padding: 12px 0;">Tidak ada jadwal pemotretan dalam 7 hari ke depan.</div>';
      }

      // Recent projects table
      const recentEl = document.getElementById('dashboard-recent-projects');
      if (res.recentProjects && res.recentProjects.length > 0) {
        recentEl.innerHTML = res.recentProjects.map(p => `
          <tr>
            <td>
              <div style="font-weight: 600; color: #fff;">${this.escapeHtml(p.title)}</div>
              <span class="badge" style="margin-top: 3px; font-size: 10px;">${this.escapeHtml(p.category || 'Foto')}</span>
            </td>
            <td>
              <div>${this.escapeHtml(p.clientName)}</div>
              ${p.clientPhone ? `<a href="${this.waLink(p.clientPhone, p.title)}" target="_blank" style="font-size: 11px; color: var(--success-text); text-decoration: none;">💬 WhatsApp</a>` : ''}
            </td>
            <td>${p.date ? this.formatDate(p.date) : '-'}</td>
            <td><span class="badge badge-${p.workflowStatus}">${this.statusLabels[p.workflowStatus] || p.workflowStatus}</span></td>
            <td><span class="badge badge-${p.paymentStatus}">${this.paymentLabels[p.paymentStatus] || p.paymentStatus}</span></td>
            <td>
              <div style="display: inline-flex; gap: 4px;">
                <button class="btn btn-secondary btn-sm" onclick="App.openProjectModal('${p.id}')">Detail</button>
                <button class="btn btn-secondary btn-sm" onclick="App.openWAModal('${p.id}')">💬 WA</button>
              </div>
            </td>
          </tr>
        `).join('');
      } else {
        recentEl.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-dim); padding: 20px;">Belum ada proyek foto. Klik "+ Proyek Baru" untuk memulai.</td></tr>';
      }
    } catch (err) {
      console.error(err);
    }
  },

  // --- PROJECTS ---
  async loadProjects(filter = 'all', query = '') {
    try {
      const res = await API.getProjects(filter, query);
      const tbody = document.getElementById('projects-table-body');
      const projects = res.projects || [];

      if (projects.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-dim); padding: 30px;">Tidak ada proyek foto yang sesuai.</td></tr>';
        return;
      }

      tbody.innerHTML = projects.map(p => {
        const balance = (Number(p.totalPrice) || 0) - (Number(p.dpAmount) || 0);

        return `
          <tr>
            <td>
              <div style="font-weight: 600; color: #fff; font-size: 14px;">${this.escapeHtml(p.title)}</div>
              <div style="display: flex; gap: 6px; margin-top: 4px; align-items: center;">
                <span class="badge" style="font-size: 10px;">${this.escapeHtml(p.category || 'Foto')}</span>
                ${p.packageName ? `<span style="font-size: 11px; color: var(--text-dim);">${this.escapeHtml(p.packageName)}</span>` : ''}
                ${p.selectedPhotos ? `<span class="badge" style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; font-size: 10px;" title="Foto sudah dipilih klien">📸 Dipilih</span>` : ''}
              </div>
            </td>
            <td>
              <div style="font-weight: 500;">${this.escapeHtml(p.clientName)}</div>
              <div style="display: flex; gap: 8px; margin-top: 2px; font-size: 11px;">
                ${p.clientPhone ? `<a href="${this.waLink(p.clientPhone, p.title)}" target="_blank" style="color: var(--success-text); text-decoration: none;">💬 ${this.escapeHtml(p.clientPhone)}</a>` : ''}
              </div>
            </td>
            <td>
              <div style="font-weight: 500;">${p.date ? this.formatDate(p.date) : 'Belum ditentukan'}</div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                ${p.time ? `🕒 ${p.time} ` : ''}
                ${p.location ? `📍 ${this.escapeHtml(p.location)}` : ''}
              </div>
            </td>
            <td>
              <select onchange="App.quickUpdateWorkflow('${p.id}', this.value)" class="form-control" style="padding: 3px 6px; font-size: 12px; width: 160px;">
                ${Object.entries(this.statusLabels).map(([val, label]) => `
                  <option value="${val}" ${p.workflowStatus === val ? 'selected' : ''}>${label}</option>
                `).join('')}
              </select>
            </td>
            <td>
              <div style="font-weight: 600;">${this.formatIDR(p.totalPrice || 0)}</div>
              <div style="margin-top: 2px;">
                <span class="badge badge-${p.paymentStatus}">${this.paymentLabels[p.paymentStatus] || p.paymentStatus}</span>
                ${balance > 0 && p.paymentStatus !== 'paid' ? `<div style="font-size: 10px; color: var(--danger-text); margin-top: 2px;">Sisa: ${this.formatIDR(balance)}</div>` : ''}
              </div>
            </td>
            <td style="text-align: right; white-space: nowrap;">
              <div style="display: inline-flex; gap: 4px;">
                <button class="btn btn-secondary btn-sm" title="Template WhatsApp" onclick="App.openWAModal('${p.id}')">
                  💬 WA
                </button>
                <button class="btn btn-secondary btn-sm" title="Cetak Kwitansi" onclick="App.openInvoiceModal('${p.id}')">
                  🖨️
                </button>
                <button class="btn btn-secondary btn-sm" title="Bagikan link portal ke klien" onclick="App.openSharePortal('${p.id}', '${this.escapeHtml(p.title)}', '${p.clientPhone || ''}')">
                  🔗 Portal
                </button>
                ${p.driveUrl ? `<a href="${p.driveUrl}" target="_blank" class="btn btn-secondary btn-sm" title="Buka Drive Galeri">☁️</a>` : ''}
                <button class="btn btn-secondary btn-sm" onclick="App.openProjectModal('${p.id}')">Edit</button>
                <button class="btn btn-danger btn-sm" onclick="App.deleteProject('${p.id}')">&times;</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error(err);
    }
  },

  async quickUpdateWorkflow(id, newStatus) {
    try {
      await API.updateProject(id, { workflowStatus: newStatus });
      this.toast(`Status diperbarui ke: ${this.statusLabels[newStatus]}`, 'success');
    } catch (err) {
      this.toast(err.message, 'error');
    }
  },

  // --- CLIENTS ---
  async loadClients() {
    try {
      const res = await API.getClients();
      this.clients = res.clients || [];
      this.populateSelects();
      this.renderClients();
    } catch (err) {
      console.error(err);
    }
  },

  renderClients(searchQuery = '') {
    const tbody = document.getElementById('clients-table-body');
    let list = this.clients;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => (c.name && c.name.toLowerCase().includes(q)) || (c.phone && c.phone.includes(q)) || (c.email && c.email.toLowerCase().includes(q)));
    }

    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-dim); padding: 30px;">Belum ada klien tersimpan.</td></tr>';
      return;
    }

    tbody.innerHTML = list.map(c => `
      <tr>
        <td style="font-weight: 600; color: #fff;">${this.escapeHtml(c.name)}</td>
        <td>
          ${c.phone ? `
            <a href="${this.waLink(c.phone)}" target="_blank" style="color: var(--success-text); text-decoration: none; font-weight: 500;">
              💬 ${this.escapeHtml(c.phone)}
            </a>
          ` : '-'}
        </td>
        <td>${c.email ? this.escapeHtml(c.email) : '-'}</td>
        <td>${c.instagram ? `<span style="color: var(--accent);">${this.escapeHtml(c.instagram)}</span>` : '-'}</td>
        <td style="color: var(--text-muted); font-size: 12px; max-width: 250px;">${this.escapeHtml(c.notes || '-')}</td>
        <td style="text-align: right;">
          <div style="display: inline-flex; gap: 4px;">
            <button class="btn btn-secondary btn-sm" onclick="App.openClientModal('${c.id}')">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="App.deleteClient('${c.id}')">&times;</button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  // --- SCHEDULE ---
  async loadSchedule() {
    try {
      const res = await API.getProjects('all');
      const projects = (res.projects || []).filter(p => p.date).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
      const timeline = document.getElementById('schedule-timeline');

      if (projects.length === 0) {
        timeline.innerHTML = '<div style="color: var(--text-dim); padding: 30px; text-align: center;">Belum ada jadwal sesi foto yang memiliki tanggal.</div>';
        return;
      }

      const todayStr = new Date().toISOString().split('T')[0];

      timeline.innerHTML = projects.map(p => {
        const isToday = p.date === todayStr;
        const isPast = p.date < todayStr;
        const calUrl = this.googleCalendarUrl(p);

        return `
          <div style="display: flex; gap: 16px; padding: 14px 0; border-bottom: 1px solid var(--border); ${isToday ? 'background: rgba(47, 129, 247, 0.08); padding-left: 12px; border-left: 3px solid var(--accent);' : ''}">
            <div style="width: 130px; flex-shrink: 0;">
              <div style="font-weight: 700; font-size: 14px; color: ${isToday ? 'var(--accent)' : '#fff'};">${this.formatDate(p.date)}</div>
              <div style="font-size: 12px; color: var(--text-muted);">${p.time ? `🕒 ${p.time} ${p.endTime ? `- ${p.endTime}` : ''}` : 'Waktu fleksibel'}</div>
              ${isToday ? '<span class="badge" style="background: var(--accent); color: #fff; margin-top: 4px;">HARI INI</span>' : (isPast ? '<span class="badge" style="font-size: 9px;">LEWAT</span>' : '')}
            </div>
            <div style="flex: 1;">
              <div style="font-weight: 600; font-size: 15px; color: #fff;">${this.escapeHtml(p.title)}</div>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
                Klien: <strong>${this.escapeHtml(p.clientName)}</strong> &bull; Kategori: <strong>${this.escapeHtml(p.category)}</strong>
              </div>
              <div style="font-size: 12px; color: var(--text-dim); margin-top: 2px;">
                📍 ${this.escapeHtml(p.location || 'Lokasi belum diset')}
                ${p.mapsUrl ? `<a href="${p.mapsUrl}" target="_blank" style="color: var(--accent); margin-left: 6px; text-decoration: none;">[Buka Google Maps]</a>` : ''}
              </div>
            </div>
            <div style="display: flex; flex-direction: column; align-items: flex-end; justify-content: center; gap: 6px;">
              <span class="badge badge-${p.workflowStatus}">${this.statusLabels[p.workflowStatus] || p.workflowStatus}</span>
              <div style="display: flex; gap: 4px;">
                <a href="${calUrl}" target="_blank" class="btn btn-secondary btn-sm" title="Simpan ke Google Calendar">📅 Kalender</a>
                <button class="btn btn-secondary btn-sm" onclick="App.openProjectModal('${p.id}')">Detail</button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error(err);
    }
  },

  // --- PACKAGES ---
  async loadPackages() {
    try {
      const res = await API.getPackages();
      this.packages = res.packages || [];
      this.populateSelects();

      const tbody = document.getElementById('packages-table-body');
      if (this.packages.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-dim); padding: 30px;">Belum ada paket layanan.</td></tr>';
        return;
      }

      tbody.innerHTML = this.packages.map(p => `
        <tr>
          <td style="font-weight: 600; color: #fff;">${this.escapeHtml(p.name)}</td>
          <td><span class="badge">${this.escapeHtml(p.category)}</span></td>
          <td style="font-weight: 600; color: var(--success-text);">${this.formatIDR(p.price)}</td>
          <td style="font-size: 12px; color: var(--text-muted); max-width: 400px;">${this.escapeHtml(p.description || '-')}</td>
          <td style="text-align: right;">
            <div style="display: inline-flex; gap: 4px;">
              <button class="btn btn-secondary btn-sm" onclick="App.openPackageModal('${p.id}')">Edit</button>
              <button class="btn btn-danger btn-sm" onclick="App.deletePackage('${p.id}')">&times;</button>
            </div>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      console.error(err);
    }
  },

  // --- SETTINGS ---
  async loadSettings() {
    try {
      const res = await API.getSettings();
      const s = res.settings || {};
      this.settings = s;

      document.getElementById('setting-studioName').value = s.studioName || '';
      document.getElementById('setting-domain').value = s.domain || 'fg.ten.my.id';
      document.getElementById('setting-phone').value = s.phone || '';
      document.getElementById('setting-email').value = s.email || '';
      document.getElementById('setting-instagram').value = s.instagram || '';
      document.getElementById('setting-bankName').value = s.bankName || '';
      document.getElementById('setting-bankAccount').value = s.bankAccount || '';
      document.getElementById('setting-bankHolder').value = s.bankHolder || '';
    } catch (err) {
      console.error(err);
    }
  },

  async handleSaveSettings(e) {
    e.preventDefault();
    try {
      const data = {
        studioName: document.getElementById('setting-studioName').value,
        phone: document.getElementById('setting-phone').value,
        email: document.getElementById('setting-email').value,
        instagram: document.getElementById('setting-instagram').value,
        bankName: document.getElementById('setting-bankName').value,
        bankAccount: document.getElementById('setting-bankAccount').value,
        bankHolder: document.getElementById('setting-bankHolder').value
      };
      await API.updateSettings(data);
      this.toast('Pengaturan studio berhasil disimpan', 'success');
    } catch (err) {
      this.toast(err.message, 'error');
    }
  },

  // --- MODAL TABS ---
  switchProjectTab(tabName) {
    this.activeProjectTab = tabName;
    document.querySelectorAll('.modal-tabs .modal-tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tabName);
    });

    ['info', 'shotlist', 'gear', 'expenses', 'selection'].forEach(t => {
      const pane = document.getElementById(`proj-tab-${t}`);
      if (pane) pane.style.display = t === tabName ? 'block' : 'none';
    });
  },

  // --- MODAL CONTROLS ---
  openProjectModal(id = null) {
    const modal = document.getElementById('modal-project');
    const titleEl = document.getElementById('modal-project-title');
    const form = document.getElementById('form-project');
    form.reset();
    document.getElementById('proj-id').value = '';

    this.switchProjectTab('info');
    const btnInvoice = document.getElementById('proj-btn-print-invoice');
    const btnWA = document.getElementById('proj-btn-wa-msg');

    if (id) {
      titleEl.textContent = 'Edit Sesi Foto / Proyek';
      if (btnInvoice) btnInvoice.style.display = 'inline-flex';
      if (btnWA) btnWA.style.display = 'inline-flex';

      API.getProject(id).then(res => {
        const p = res.project;
        if (!p) return;
        this.currentProject = p;

        document.getElementById('proj-id').value = p.id;
        document.getElementById('proj-title').value = p.title || '';
        document.getElementById('proj-category').value = p.category || 'Wedding';
        document.getElementById('proj-client-select').value = p.clientId || '';
        document.getElementById('proj-client-name').value = p.clientName || '';
        document.getElementById('proj-client-phone').value = p.clientPhone || '';
        document.getElementById('proj-date').value = p.date || '';
        document.getElementById('proj-time').value = p.time || '';
        document.getElementById('proj-endtime').value = p.endTime || '';
        document.getElementById('proj-location').value = p.location || '';
        document.getElementById('proj-maps-url').value = p.mapsUrl || '';
        document.getElementById('proj-workflow-status').value = p.workflowStatus || 'inquiry';
        document.getElementById('proj-package-price').value = p.packagePrice || 0;
        document.getElementById('proj-addons-price').value = p.addOnsPrice || 0;
        document.getElementById('proj-dp-amount').value = p.dpAmount || 0;
        document.getElementById('proj-dp-date').value = p.dpDate || '';
        document.getElementById('proj-payment-status').value = p.paymentStatus || 'unpaid';
        document.getElementById('proj-drive-url').value = p.driveUrl || '';
        document.getElementById('proj-notes').value = p.notes || '';
        document.getElementById('proj-selection-quota').value = p.selectionQuota || 20;
        document.getElementById('proj-selected-photos').value = p.selectedPhotos || '';

        const syncStatusEl = document.getElementById('sync-drive-status');
        if (syncStatusEl) {
          const photoCount = Array.isArray(p.drivePhotos) ? p.drivePhotos.length : 0;
          if (photoCount > 0) {
            syncStatusEl.innerHTML = `<span style="color: #3fb950; font-weight: 600;">✅ ${photoCount} foto tersinkronkan dari Google Drive.</span>`;
          } else {
            syncStatusEl.textContent = '💡 Klien akan melihat foto visual langsung di portal mereka tanpa membuka Google Drive asli.';
          }
        }

        this.renderShotlist();
        this.renderGearList();
        this.renderExpenses();
        this.renderSelectedPhotosVisual();
        this.updateExpenseCalculations();
      });
    } else {
      titleEl.textContent = 'Tambah Sesi Foto Baru';
      if (btnInvoice) btnInvoice.style.display = 'none';
      if (btnWA) btnWA.style.display = 'none';

      document.getElementById('proj-selection-quota').value = 20;
      const syncStatusEl = document.getElementById('sync-drive-status');
      if (syncStatusEl) syncStatusEl.textContent = '💡 Klien akan melihat foto visual langsung di portal mereka tanpa membuka Google Drive asli.';

      this.currentProject = {
        shotlist: [],
        gearChecklist: [],
        expenses: [],
        selectionQuota: 20,
        selectedPhotos: '',
        photoNotes: {},
        drivePhotos: []
      };
      this.renderShotlist();
      this.renderGearList();
      this.renderExpenses();
      this.renderSelectedPhotosVisual();
      this.updateExpenseCalculations();
    }

    modal.style.display = 'flex';
  },

  async handleSaveProject(e) {
    e.preventDefault();
    const id = document.getElementById('proj-id').value;
    const pkgSelect = document.getElementById('proj-package-select');
    const selectedPkgName = pkgSelect.selectedOptions[0]?.dataset.name || '';

    const payload = {
      title: document.getElementById('proj-title').value,
      category: document.getElementById('proj-category').value,
      clientId: document.getElementById('proj-client-select').value || null,
      clientName: document.getElementById('proj-client-name').value,
      clientPhone: document.getElementById('proj-client-phone').value,
      date: document.getElementById('proj-date').value,
      time: document.getElementById('proj-time').value,
      endTime: document.getElementById('proj-endtime').value,
      location: document.getElementById('proj-location').value,
      mapsUrl: document.getElementById('proj-maps-url').value,
      packageName: selectedPkgName,
      packagePrice: Number(document.getElementById('proj-package-price').value) || 0,
      addOnsPrice: Number(document.getElementById('proj-addons-price').value) || 0,
      dpAmount: Number(document.getElementById('proj-dp-amount').value) || 0,
      dpDate: document.getElementById('proj-dp-date').value,
      paymentStatus: document.getElementById('proj-payment-status').value,
      workflowStatus: document.getElementById('proj-workflow-status').value,
      driveUrl: document.getElementById('proj-drive-url').value,
      notes: document.getElementById('proj-notes').value,
      shotlist: this.currentProject ? this.currentProject.shotlist || [] : [],
      gearChecklist: this.currentProject ? this.currentProject.gearChecklist || [] : [],
      expenses: this.currentProject ? this.currentProject.expenses || [] : [],
      selectionQuota: Number(document.getElementById('proj-selection-quota')?.value) || 20,
      selectedPhotos: document.getElementById('proj-selected-photos').value || '',
      drivePhotos: this.currentProject ? this.currentProject.drivePhotos || [] : [],
      photoNotes: this.currentProject ? this.currentProject.photoNotes || {} : {}
    };

    try {
      if (id) {
        await API.updateProject(id, payload);
        this.toast('Proyek berhasil diperbarui', 'success');
      } else {
        await API.createProject(payload);
        this.toast('Proyek baru berhasil dibuat', 'success');
      }
      this.closeModals();
      this.loadBootstrapData();
      if (this.currentView === 'projects') this.loadProjects();
      else if (this.currentView === 'dashboard') this.loadDashboard();
      else if (this.currentView === 'schedule') this.loadSchedule();
    } catch (err) {
      this.toast(err.message, 'error');
    }
  },

  async deleteProject(id) {
    if (!confirm('Yakin ingin menghapus sesi foto ini?')) return;
    try {
      await API.deleteProject(id);
      this.toast('Proyek berhasil dihapus', 'success');
      this.loadProjects();
      this.loadDashboard();
    } catch (err) {
      this.toast(err.message, 'error');
    }
  },

  // --- SHOT LIST HANDLERS ---
  renderShotlist() {
    const container = document.getElementById('proj-shotlist-items');
    if (!container || !this.currentProject) return;
    const items = this.currentProject.shotlist || [];

    if (items.length === 0) {
      container.innerHTML = '<div style="color: var(--text-dim); font-size: 12px; padding: 10px 0;">Belum ada momen terdaftar. Klik "+ Template Standar" atau ketik momen baru di bawah.</div>';
      return;
    }

    container.innerHTML = items.map((item, idx) => `
      <div class="checklist-item ${item.done ? 'done' : ''}" style="justify-content: space-between;">
        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; flex: 1;">
          <input type="checkbox" ${item.done ? 'checked' : ''} onchange="App.toggleShotlistItem(${idx})">
          <span>${this.escapeHtml(item.text)}</span>
        </label>
        <button type="button" class="btn btn-danger btn-sm" onclick="App.deleteShotlistItem(${idx})" style="padding: 2px 6px;">&times;</button>
      </div>
    `).join('');
  },

  toggleShotlistItem(idx) {
    if (this.currentProject && this.currentProject.shotlist[idx]) {
      this.currentProject.shotlist[idx].done = !this.currentProject.shotlist[idx].done;
      this.renderShotlist();
    }
  },

  addShotlistItem() {
    const input = document.getElementById('proj-new-shotlist-input');
    if (!input || !input.value.trim()) return;
    if (!this.currentProject.shotlist) this.currentProject.shotlist = [];
    this.currentProject.shotlist.push({ id: Date.now(), text: input.value.trim(), done: false });
    input.value = '';
    this.renderShotlist();
  },

  deleteShotlistItem(idx) {
    if (this.currentProject && this.currentProject.shotlist) {
      this.currentProject.shotlist.splice(idx, 1);
      this.renderShotlist();
    }
  },

  loadDefaultShotlist() {
    const cat = document.getElementById('proj-category')?.value || 'Wedding';
    const defaults = {
      Wedding: [
        'Detail Cincin & Gaun Pengantin',
        'Make Up & Persiapan Pengantin',
        'First Look Momen',
        'Akad Nikah / Pemberkatan (Ijab Kabul)',
        'Sungkeman / Haru Orang Tua',
        'Pemasangan Cincin & Buku Nikah',
        'Foto Keluarga Inti & Kerabat',
        'Resepsi & Lempar Bunga'
      ],
      Prewedding: [
        'Close-up Romantic Pose',
        'Wide Angle Lokasi Outdoor',
        'Walking & Candid Laughing',
        'Detail Cincin / Hands Holding',
        'Sunset / Golden Hour Silhouette'
      ],
      Portrait: [
        'Headshot Clean Background',
        'Half Body Styling Pose',
        'Full Body Look',
        'Creative Lighting / Drama Portrait'
      ],
      Wisuda: [
        'Portrait dengan Toga & Ijazah',
        'Lempar Topi Toga Momen',
        'Foto bersama Orang Tua',
        'Foto bersama Pasangan / Sahabat'
      ]
    };

    const list = defaults[cat] || defaults.Wedding;
    this.currentProject.shotlist = list.map((text, i) => ({ id: Date.now() + i, text, done: false }));
    this.renderShotlist();
    this.toast(`Template shot list ${cat} dimuat`, 'info');
  },

  // --- GEAR CHECKLIST HANDLERS ---
  renderGearList() {
    const container = document.getElementById('proj-gear-items');
    if (!container || !this.currentProject) return;
    const items = this.currentProject.gearChecklist || [];

    if (items.length === 0) {
      container.innerHTML = '<div style="color: var(--text-dim); font-size: 12px; padding: 10px 0;">Belum ada perlengkapan dicatat. Klik "+ Gear Standar" untuk memuat checklist alat.</div>';
      return;
    }

    container.innerHTML = items.map((item, idx) => `
      <div class="checklist-item ${item.done ? 'done' : ''}" style="justify-content: space-between;">
        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; flex: 1;">
          <input type="checkbox" ${item.done ? 'checked' : ''} onchange="App.toggleGearItem(${idx})">
          <span>${this.escapeHtml(item.text)}</span>
        </label>
        <button type="button" class="btn btn-danger btn-sm" onclick="App.deleteGearItem(${idx})" style="padding: 2px 6px;">&times;</button>
      </div>
    `).join('');
  },

  toggleGearItem(idx) {
    if (this.currentProject && this.currentProject.gearChecklist[idx]) {
      this.currentProject.gearChecklist[idx].done = !this.currentProject.gearChecklist[idx].done;
      this.renderGearList();
    }
  },

  addGearItem() {
    const input = document.getElementById('proj-new-gear-input');
    if (!input || !input.value.trim()) return;
    if (!this.currentProject.gearChecklist) this.currentProject.gearChecklist = [];
    this.currentProject.gearChecklist.push({ id: Date.now(), text: input.value.trim(), done: false });
    input.value = '';
    this.renderGearList();
  },

  deleteGearItem(idx) {
    if (this.currentProject && this.currentProject.gearChecklist) {
      this.currentProject.gearChecklist.splice(idx, 1);
      this.renderGearList();
    }
  },

  loadDefaultGearList() {
    const gears = [
      'Body Kamera Utama + Strap',
      'Body Kamera Cadangan',
      'Lensa 24-70mm f/2.8',
      'Lensa 70-200mm / 85mm f/1.4',
      'Baterai Kamera Terisi Penuh (x3)',
      'Memory Card SD/CFexpress Kosong (x3)',
      'Flash Eksternal Godox + Trigger Wireless',
      'Baterai Cadangan Flash AA',
      'Kain Microfiber & Lens Cleaner'
    ];
    this.currentProject.gearChecklist = gears.map((text, i) => ({ id: Date.now() + i, text, done: false }));
    this.renderGearList();
    this.toast('Gear standar fotografi dimuat', 'info');
  },

  // --- EXPENSES & NET PROFIT HANDLERS ---
  renderExpenses() {
    const container = document.getElementById('proj-expense-items');
    if (!container || !this.currentProject) return;
    const items = this.currentProject.expenses || [];

    if (items.length === 0) {
      container.innerHTML = '<div style="color: var(--text-dim); font-size: 12px; padding: 10px 0;">Belum ada biaya operasional dicatat.</div>';
      return;
    }

    container.innerHTML = items.map((item, idx) => `
      <div class="expense-item">
        <div>
          <span style="font-weight: 500; color: #fff;">${this.escapeHtml(item.name)}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-weight: 600; color: var(--danger-text);">${this.formatIDR(item.amount)}</span>
          <button type="button" class="btn btn-danger btn-sm" onclick="App.deleteExpenseItem(${idx})" style="padding: 2px 6px;">&times;</button>
        </div>
      </div>
    `).join('');
  },

  addExpenseItem() {
    const nameInput = document.getElementById('proj-new-expense-name');
    const amountInput = document.getElementById('proj-new-expense-amount');
    if (!nameInput || !nameInput.value.trim() || !amountInput || !amountInput.value) return;

    if (!this.currentProject.expenses) this.currentProject.expenses = [];
    this.currentProject.expenses.push({
      id: Date.now(),
      name: nameInput.value.trim(),
      amount: Number(amountInput.value) || 0
    });

    nameInput.value = '';
    amountInput.value = '';
    this.renderExpenses();
    this.updateExpenseCalculations();
  },

  deleteExpenseItem(idx) {
    if (this.currentProject && this.currentProject.expenses) {
      this.currentProject.expenses.splice(idx, 1);
      this.renderExpenses();
      this.updateExpenseCalculations();
    }
  },

  updateExpenseCalculations() {
    const pkgPrice = Number(document.getElementById('proj-package-price')?.value) || 0;
    const addOns = Number(document.getElementById('proj-addons-price')?.value) || 0;
    const totalRevenue = pkgPrice + addOns;

    let totalExp = 0;
    if (this.currentProject && Array.isArray(this.currentProject.expenses)) {
      totalExp = this.currentProject.expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    }

    const netProfit = totalRevenue - totalExp;

    const revEl = document.getElementById('proj-calc-revenue');
    if (revEl) revEl.textContent = this.formatIDR(totalRevenue);

    const expEl = document.getElementById('proj-calc-expenses');
    if (expEl) expEl.textContent = this.formatIDR(totalExp);

    const netEl = document.getElementById('proj-calc-net');
    if (netEl) {
      netEl.textContent = this.formatIDR(netProfit);
      netEl.style.color = netProfit >= 0 ? '#3fb950' : 'var(--danger-text)';
    }
  },

  copySelectedPhotos() {
    const txt = document.getElementById('proj-selected-photos')?.value || '';
    if (!txt.trim()) {
      this.toast('Belum ada nomor foto untuk disalin', 'info');
      return;
    }
    navigator.clipboard.writeText(txt);
    this.toast('Nomor foto disalin ke clipboard! Siap di-paste ke Lightroom/Photo Mechanic.', 'success');
  },

  renderSelectedPhotosVisual() {
    const container = document.getElementById('proj-selected-visual-container');
    if (!container) return;

    const p = this.currentProject || {};
    const raw = document.getElementById('proj-selected-photos')?.value || p.selectedPhotos || '';
    const list = raw.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
    const drivePhotos = Array.isArray(p.drivePhotos) ? p.drivePhotos : [];
    const notes = p.photoNotes || {};

    if (list.length === 0) {
      container.innerHTML = `
        <div style="color: var(--text-dim); font-size: 12px; padding: 14px; background: rgba(255,255,255,0.02); border: 1px dashed var(--border); border-radius: 8px; text-align: center;">
          Belum ada foto yang dipilih oleh klien. Bagikan tautan portal agar klien dapat memilih foto secara visual.
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; margin-top: 6px;">
        ${list.map((photoName, idx) => {
          const match = drivePhotos.find(dp => dp.name === photoName || dp.id === photoName);
          const thumbUrl = match ? (match.thumbnailUrl || `https://lh3.googleusercontent.com/d/${match.id}=w600-h600`) : '';
          const note = notes[photoName] || (match ? notes[match.id] : '') || '';

          return `
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; padding: 6px; font-size: 11px;">
              <div style="width: 100%; height: 90px; background: #090d13; border-radius: 4px; overflow: hidden; display: flex; align-items: center; justify-content: center; position: relative;">
                ${thumbUrl ? `
                  <img src="${thumbUrl}" alt="${this.escapeHtml(photoName)}" style="width: 100%; height: 100%; object-fit: cover;" loading="lazy">
                ` : `
                  <span style="color: var(--text-dim); font-size: 20px;">🖼️</span>
                `}
                <span style="position: absolute; top: 4px; left: 4px; background: rgba(0,0,0,0.7); color: #fff; font-size: 9px; padding: 1px 4px; border-radius: 3px;">#${idx + 1}</span>
              </div>
              <div style="font-weight: 700; color: #fff; margin-top: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${this.escapeHtml(photoName)}">
                ${this.escapeHtml(photoName)}
              </div>
              ${note ? `
                <div style="background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); color: #fbbf24; font-size: 10px; padding: 3px 6px; border-radius: 4px; margin-top: 4px; line-height: 1.2;" title="${this.escapeHtml(note)}">
                  📝 ${this.escapeHtml(note)}
                </div>
              ` : `
                <div style="color: var(--text-dim); font-size: 10px; margin-top: 2px;">Tanpa catatan</div>
              `}
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  async syncDrivePhotos() {
    const projectId = document.getElementById('proj-id')?.value;
    const driveUrl = document.getElementById('proj-drive-url')?.value.trim();
    const syncStatusEl = document.getElementById('sync-drive-status');
    const syncBtn = document.getElementById('btn-sync-drive');

    if (!driveUrl) {
      alert('Masukkan link folder Google Drive terlebih dahulu.');
      return;
    }

    if (!projectId) {
      alert('Simpan proyek terlebih dahulu sebelum melakukan sinkronisasi Google Drive.');
      return;
    }

    try {
      if (syncBtn) {
        syncBtn.disabled = true;
        syncBtn.textContent = 'Menghubungkan...';
      }
      if (syncStatusEl) {
        syncStatusEl.innerHTML = '<span style="color: #60a5fa;">⏳ Mengambil daftar foto dari Google Drive...</span>';
      }

      const res = await API.syncDrivePhotos(projectId, driveUrl);
      if (res.photos && Array.isArray(res.photos)) {
        if (!this.currentProject) this.currentProject = {};
        this.currentProject.drivePhotos = res.photos;
        if (syncStatusEl) {
          syncStatusEl.innerHTML = `<span style="color: #3fb950; font-weight: 600;">✅ Berhasil mensinkronkan ${res.photos.length} foto dari Google Drive!</span>`;
        }
        this.toast(`Berhasil mensinkronkan ${res.photos.length} foto!`, 'success');
        this.renderSelectedPhotosVisual();
      } else {
        if (syncStatusEl) {
          syncStatusEl.innerHTML = `<span style="color: #e3b341;">⚠️ ${res.message || 'Tidak ada foto ditemukan.'}</span>`;
        }
      }
    } catch (err) {
      if (syncStatusEl) {
        syncStatusEl.innerHTML = `<span style="color: var(--danger-text);">❌ ${err.message}</span>`;
      }
      this.toast(err.message, 'error');
    } finally {
      if (syncBtn) {
        syncBtn.disabled = false;
        syncBtn.textContent = '⚡ Sinkronkan Foto';
      }
    }
  },

  openClientPortalFromModal() {
    const id = document.getElementById('proj-id')?.value;
    if (!id) {
      alert('Simpan proyek terlebih dahulu.');
      return;
    }
    const origin = window.location.origin;
    window.open(`${origin}/portal?id=${id}`, '_blank');
  },

  // --- SETTINGS VIEW ---
  async loadSettings() {
    try {
      const res = await API.getSettings();
      const s = res.settings || {};
      this.settings = s;

      document.getElementById('setting-studioName').value = s.studioName || '';
      document.getElementById('setting-phone').value = s.phone || '';
      document.getElementById('setting-email').value = s.email || '';
      document.getElementById('setting-instagram').value = s.instagram || '';
      document.getElementById('setting-bankName').value = s.bankName || '';
      document.getElementById('setting-bankAccount').value = s.bankAccount || '';
      document.getElementById('setting-bankHolder').value = s.bankHolder || '';

      const apiKeyEl = document.getElementById('setting-googleDriveApiKey');
      if (apiKeyEl) apiKeyEl.value = s.googleDriveApiKey || '';
    } catch (err) {
      this.toast('Gagal memuat pengaturan: ' + err.message, 'error');
    }
  },

  async handleSaveSettings(e) {
    e.preventDefault();
    const apiKeyEl = document.getElementById('setting-googleDriveApiKey');
    const payload = {
      studioName: document.getElementById('setting-studioName').value.trim(),
      phone: document.getElementById('setting-phone').value.trim(),
      email: document.getElementById('setting-email').value.trim(),
      instagram: document.getElementById('setting-instagram').value.trim(),
      bankName: document.getElementById('setting-bankName').value.trim(),
      bankAccount: document.getElementById('setting-bankAccount').value.trim(),
      bankHolder: document.getElementById('setting-bankHolder').value.trim(),
      googleDriveApiKey: apiKeyEl ? apiKeyEl.value.trim() : ''
    };

    try {
      const res = await API.updateSettings(payload);
      this.settings = res.settings;
      this.toast('Pengaturan studio berhasil disimpan!', 'success');
    } catch (err) {
      this.toast('Gagal menyimpan pengaturan: ' + err.message, 'error');
    }
  },

  // --- INVOICE GENERATOR ---
  async openInvoiceModal(projectId = null) {
    const p = projectId ? (await API.getProject(projectId)).project : this.currentProject;
    if (!p) return;

    const s = this.settings;
    document.getElementById('inv-studio-name').textContent = s.studioName || 'TEN PHOTOGRAPHY';
    document.getElementById('inv-studio-contact').textContent = `WhatsApp: ${s.phone || '-'} | fg.ten.my.id`;
    document.getElementById('inv-number').textContent = `INV-${(p.id || '').replace('proj_', '').substring(0, 8).toUpperCase()}`;
    document.getElementById('inv-date').textContent = this.formatDate(new Date().toISOString().split('T')[0]);

    document.getElementById('inv-client-name').textContent = p.clientName || 'Klien';
    document.getElementById('inv-client-phone').textContent = p.clientPhone ? `WhatsApp: ${p.clientPhone}` : '';

    document.getElementById('inv-project-title').textContent = p.title || 'Sesi Foto';
    document.getElementById('inv-package-desc').textContent = `${p.category || 'Fotografi'} ${p.packageName ? `(${p.packageName})` : ''} - Tanggal: ${p.date ? this.formatDate(p.date) : 'TBD'}`;
    document.getElementById('inv-package-price').textContent = this.formatIDR(p.packagePrice || 0);

    const addonsRow = document.getElementById('inv-row-addons');
    if (p.addOnsPrice > 0) {
      addonsRow.style.display = 'table-row';
      document.getElementById('inv-addons-price').textContent = this.formatIDR(p.addOnsPrice);
    } else {
      addonsRow.style.display = 'none';
    }

    const total = Number(p.totalPrice) || 0;
    const dp = Number(p.dpAmount) || 0;
    const balance = total - dp;

    document.getElementById('inv-total-price').textContent = this.formatIDR(total);
    document.getElementById('inv-dp-amount').textContent = this.formatIDR(dp);
    document.getElementById('inv-balance').textContent = balance <= 0 ? 'Rp 0' : this.formatIDR(balance);

    const badge = document.getElementById('inv-badge-status');
    if (p.paymentStatus === 'paid' || balance <= 0) {
      badge.className = 'invoice-badge-paid';
      badge.textContent = 'LUNAS';
    } else if (dp > 0) {
      badge.className = 'invoice-badge-unpaid';
      badge.textContent = 'DP DITERIMA';
    } else {
      badge.className = 'invoice-badge-unpaid';
      badge.textContent = 'BELUM BAYAR';
    }

    document.getElementById('inv-bank-info').textContent = s.bankName && s.bankAccount ? `Transfer Bank: ${s.bankName} ${s.bankAccount} (a.n ${s.bankHolder || s.studioName})` : 'Metode Pembayaran: Transfer Rekening Fotografer';
    document.getElementById('inv-signer-name').textContent = s.bankHolder || s.studioName || 'Fotografer';

    document.getElementById('modal-invoice').style.display = 'flex';
  },

  // --- WHATSAPP QUICK AUTOMATION ---
  async openWAModal(projectId = null) {
    const p = projectId ? (await API.getProject(projectId)).project : this.currentProject;
    if (!p) return;
    this.currentProject = p;

    this.onWATemplateChange();
    document.getElementById('modal-wa-templates').style.display = 'flex';
  },

  onWATemplateChange() {
    const p = this.currentProject;
    if (!p) return;
    const s = this.settings;
    const type = document.getElementById('wa-template-select')?.value || 'reminder';
    const preview = document.getElementById('wa-template-preview');
    const sendBtn = document.getElementById('wa-btn-send-direct');

    const origin = window.location.origin;
    const portalUrl = `${origin}/portal?id=${p.id}`;
    const dateFormatted = p.date ? this.formatDate(p.date) : 'segera';
    const total = this.formatIDR(p.totalPrice || 0);
    const balance = this.formatIDR((p.totalPrice || 0) - (p.dpAmount || 0));
    const bank = s.bankName && s.bankAccount ? `${s.bankName} ${s.bankAccount} (a.n ${s.bankHolder || s.studioName})` : '';

    let text = '';

    if (type === 'reminder') {
      text = `Halo Kak ${p.clientName}! 👋\n\nMengingatkan kembali jadwal sesi foto kita besok:\n📅 Hari/Tgl: ${dateFormatted}\n⏰ Waktu: ${p.time || 'Sesuai kesepakatan'}\n📍 Lokasi: ${p.location || 'Sesuai briefing'}\n${p.mapsUrl ? `🗺️ Maps: ${p.mapsUrl}\n` : ''}\nMohon hadir tepat waktu agar sesi pemotretan berjalan maksimal. Sampai bertemu besok ya Kak!\n\nSalam,\n*${s.studioName || 'TEN Photography'}*`;
    } else if (type === 'invoice') {
      text = `Halo Kak ${p.clientName}! 🙏\n\nBerikut rincian tagihan sesi foto *${p.title}*:\n• Total Biaya: ${total}\n• DP Masuk: ${this.formatIDR(p.dpAmount || 0)}\n• Sisa Pembayaran: *${balance}*\n\nPembayaran dapat ditransfer ke:\n💳 ${bank}\n\nKonfirmasi bukti transfer ke nomor ini jika sudah ya Kak. Terima kasih banyak!`;
    } else if (type === 'portal') {
      text = `Halo Kak ${p.clientName}! ✨\n\nBerikut tautan portal sesi foto Anda untuk memantau jadwal, lokasi, status progres pengerjaan, dan unduhan foto:\n👉 ${portalUrl}\n\nTautan ini bisa dibuka langsung tanpa perlu login. Terima kasih!`;
    } else if (type === 'drive') {
      text = `Halo Kak ${p.clientName}! 🎉\n\nKabar gembira, foto-foto sesi *${p.title}* sudah selesai dan siap diunduh!\n\n📥 Link Galeri / Google Drive:\n${p.driveUrl || portalUrl}\n\nSilakan diunduh dan disimpan berkas fotonya ya Kak. Terima kasih banyak atas kepercayaannya memotret bersama kami!`;
    } else if (type === 'review') {
      text = `Halo Kak ${p.clientName}! ❤️\n\nTerima kasih banyak sudah mempercayakan momen terbaik Kakak kepada kami (*${s.studioName || 'TEN Photography'}*).\n\nJika Kakak posting foto hasil pemotretan di Instagram, jangan lupa tag kami di *${s.instagram || '@tenphotography'}* ya!\n\nSehat dan sukses selalu untuk Kakak sekeluarga! 🙏`;
    }

    if (preview) preview.value = text;

    if (sendBtn) {
      let cleanPhone = (p.clientPhone || '').replace(/\D/g, '');
      if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.substring(1);
      if (cleanPhone) {
        sendBtn.href = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
        sendBtn.style.display = 'inline-flex';
      } else {
        sendBtn.style.display = 'none';
      }
    }
  },

  copyWAText() {
    const text = document.getElementById('wa-template-preview')?.value || '';
    if (!text) return;
    navigator.clipboard.writeText(text);
    this.toast('Teks pesan WhatsApp berhasil disalin!', 'success');
  },

  // --- GOOGLE CALENDAR LINK GENERATOR ---
  googleCalendarUrl(p) {
    if (!p || !p.date) return '#';
    const cleanDate = p.date.replace(/-/g, '');
    let startDateTime = `${cleanDate}T090000Z`;
    let endDateTime = `${cleanDate}T120000Z`;

    if (p.time) {
      const timeParts = p.time.split(':');
      const startH = timeParts[0].padStart(2, '0');
      const startM = (timeParts[1] || '00').padStart(2, '0');
      startDateTime = `${cleanDate}T${startH}${startM}00`;

      if (p.endTime) {
        const endParts = p.endTime.split(':');
        endDateTime = `${cleanDate}T${endParts[0].padStart(2, '0')}${endParts[1] || '00'}00`;
      } else {
        const nextH = String(Number(startH) + 3).padStart(2, '0');
        endDateTime = `${cleanDate}T${nextH}${startM}00`;
      }
    }

    const title = encodeURIComponent(`📸 Sesi Foto: ${p.title} (${p.clientName})`);
    const details = encodeURIComponent(`Sesi foto bersama ${p.clientName} (${p.clientPhone || ''}). Paket: ${p.category} ${p.packageName || ''}.`);
    const location = encodeURIComponent(p.location || '');

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDateTime}/${endDateTime}&details=${details}&location=${location}`;
  },

  // --- EXPORT CSV ---
  async exportCSV() {
    try {
      const res = await API.getProjects('all');
      const projects = res.projects || [];
      if (projects.length === 0) {
        this.toast('Belum ada data proyek untuk diekspor', 'info');
        return;
      }

      const headers = ['ID', 'Judul Sesi', 'Klien', 'WhatsApp', 'Kategori', 'Tanggal', 'Jam', 'Lokasi', 'Harga Paket', 'DP', 'Status Bayar', 'Status Alur Kerja', 'Drive Link'];
      const rows = projects.map(p => [
        p.id,
        `"${(p.title || '').replace(/"/g, '""')}"`,
        `"${(p.clientName || '').replace(/"/g, '""')}"`,
        `"${p.clientPhone || ''}"`,
        `"${p.category || ''}"`,
        p.date || '',
        p.time || '',
        `"${(p.location || '').replace(/"/g, '""')}"`,
        p.totalPrice || 0,
        p.dpAmount || 0,
        p.paymentStatus || '',
        p.workflowStatus || '',
        `"${p.driveUrl || ''}"`
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `rekap-proyek-fg-ten-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      this.toast('Berkas CSV berhasil diunduh!', 'success');
    } catch (err) {
      this.toast('Gagal mengekspor data: ' + err.message, 'error');
    }
  },

  // Client Modal
  openClientModal(id = null) {
    const modal = document.getElementById('modal-client');
    const form = document.getElementById('form-client');
    form.reset();
    document.getElementById('client-id').value = '';

    if (id) {
      document.getElementById('modal-client-title').textContent = 'Edit Data Klien';
      API.getClient(id).then(res => {
        const c = res.client;
        if (!c) return;
        document.getElementById('client-id').value = c.id;
        document.getElementById('client-name').value = c.name || '';
        document.getElementById('client-phone').value = c.phone || '';
        document.getElementById('client-email').value = c.email || '';
        document.getElementById('client-instagram').value = c.instagram || '';
        document.getElementById('client-notes').value = c.notes || '';
      });
    } else {
      document.getElementById('modal-client-title').textContent = 'Tambah Klien Baru';
    }
    modal.style.display = 'flex';
  },

  async handleSaveClient(e) {
    e.preventDefault();
    const id = document.getElementById('client-id').value;
    const payload = {
      name: document.getElementById('client-name').value,
      phone: document.getElementById('client-phone').value,
      email: document.getElementById('client-email').value,
      instagram: document.getElementById('client-instagram').value,
      notes: document.getElementById('client-notes').value
    };

    try {
      if (id) {
        await API.updateClient(id, payload);
        this.toast('Data klien berhasil diperbarui', 'success');
      } else {
        await API.createClient(payload);
        this.toast('Klien baru berhasil ditambahkan', 'success');
      }
      this.closeModals();
      this.loadClients();
    } catch (err) {
      this.toast(err.message, 'error');
    }
  },

  async deleteClient(id) {
    if (!confirm('Hapus klien ini?')) return;
    try {
      await API.deleteClient(id);
      this.toast('Klien berhasil dihapus', 'success');
      this.loadClients();
    } catch (err) {
      this.toast(err.message, 'error');
    }
  },

  // Package Modal
  openPackageModal(id = null) {
    const modal = document.getElementById('modal-package');
    const form = document.getElementById('form-package');
    form.reset();
    document.getElementById('package-id').value = '';

    if (id) {
      document.getElementById('modal-package-title').textContent = 'Edit Paket Layanan';
      const p = this.packages.find(x => x.id === id);
      if (p) {
        document.getElementById('package-id').value = p.id;
        document.getElementById('package-name').value = p.name || '';
        document.getElementById('package-category').value = p.category || 'Wedding';
        document.getElementById('package-price').value = p.price || 0;
        document.getElementById('package-desc').value = p.description || '';
      }
    } else {
      document.getElementById('modal-package-title').textContent = 'Tambah Paket Baru';
    }
    modal.style.display = 'flex';
  },

  async handleSavePackage(e) {
    e.preventDefault();
    const id = document.getElementById('package-id').value;
    const payload = {
      name: document.getElementById('package-name').value,
      category: document.getElementById('package-category').value,
      price: Number(document.getElementById('package-price').value) || 0,
      description: document.getElementById('package-desc').value
    };

    try {
      if (id) {
        await API.updatePackage(id, payload);
        this.toast('Paket berhasil diperbarui', 'success');
      } else {
        await API.createPackage(payload);
        this.toast('Paket baru berhasil ditambahkan', 'success');
      }
      this.closeModals();
      this.loadPackages();
    } catch (err) {
      this.toast(err.message, 'error');
    }
  },

  async deletePackage(id) {
    if (!confirm('Hapus paket layanan ini?')) return;
    try {
      await API.deletePackage(id);
      this.toast('Paket berhasil dihapus', 'success');
      this.loadPackages();
    } catch (err) {
      this.toast(err.message, 'error');
    }
  },

  // Share Client Portal Modal
  openSharePortal(projectId, projectTitle, clientPhone = '') {
    const modal = document.getElementById('modal-share-portal');
    const origin = window.location.origin;
    const portalUrl = `${origin}/portal?id=${projectId}`;

    document.getElementById('share-portal-url').value = portalUrl;

    const waBtn = document.getElementById('btn-wa-portal');
    if (clientPhone) {
      let cleanPhone = clientPhone.replace(/\D/g, '');
      if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.substring(1);
      const text = encodeURIComponent(`Halo! Berikut tautan pemantauan progres sesi foto dan unduhan galeri Anda (${projectTitle}):\n${portalUrl}`);
      waBtn.href = `https://wa.me/${cleanPhone}?text=${text}`;
      waBtn.style.display = 'inline-flex';
    } else {
      waBtn.style.display = 'none';
    }

    modal.style.display = 'flex';
  },

  closeModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
  },

  // --- CLIENT PORTAL VIEW (PUBLIC) ---
  async loadPortal(id) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-layout').style.display = 'none';
    const portalEl = document.getElementById('portal-screen');
    portalEl.style.display = 'block';

    try {
      const res = await API.getPortalProject(id);
      const p = res.project;
      const studio = res.studio || {};

      document.getElementById('portal-studio-name').textContent = studio.studioName || 'TEN Photography';
      document.getElementById('portal-project-title').textContent = p.title || 'Sesi Foto';
      document.getElementById('portal-client-name').textContent = `Klien: ${p.clientName}`;

      // Status
      const statusBadge = document.getElementById('portal-status-badge');
      statusBadge.className = `badge badge-${p.workflowStatus}`;
      statusBadge.textContent = this.statusLabels[p.workflowStatus] || p.workflowStatus;

      const descMap = {
        inquiry: 'Sesi sedang dalam tahap konsultasi / persiapan konsep.',
        booked: 'Jadwal sesi foto telah terdaftar dan siap dilaksanakan.',
        dp_received: 'Uang muka (DP) telah diterima. Jadwal terkunci aman.',
        shooting_done: 'Sesi pemotretan telah selesai dilaksanakan.',
        selection: 'Foto sedang dalam tahap kurasi dan seleksi foto pilihan.',
        editing: 'Foto sedang dalam tahap retouching dan color grading.',
        gallery_ready: '🎉 Galeri foto Anda sudah siap diunduh!',
        delivered: 'File foto telah dikirimkan ke Anda.',
        completed: 'Sesi foto dan pesanan cetak telah selesai.'
      };
      document.getElementById('portal-status-desc').textContent = descMap[p.workflowStatus] || 'Proses sedang berlangsung.';

      // Details
      document.getElementById('portal-datetime').textContent = `${p.date ? this.formatDate(p.date) : 'Belum dijadwalkan'} ${p.time ? `@ ${p.time}` : ''}`;
      document.getElementById('portal-package').textContent = `${p.category || 'Foto'} ${p.packageName ? `(${p.packageName})` : ''}`;
      document.getElementById('portal-location').textContent = p.location || 'Lokasi fleksibel';

      const mapsWrap = document.getElementById('portal-maps-link');
      if (p.mapsUrl) {
        mapsWrap.innerHTML = `<a href="${p.mapsUrl}" target="_blank" class="btn btn-secondary btn-sm">📍 Buka di Google Maps</a>`;
      } else {
        mapsWrap.innerHTML = '';
      }

      // Drive link
      const driveContent = document.getElementById('portal-drive-content');
      if (p.driveUrl) {
        driveContent.innerHTML = `
          <div style="margin-top: 6px;">
            <a href="${p.driveUrl}" target="_blank" class="btn btn-primary" style="padding: 10px 18px; font-size: 14px;">
              📥 Buka Galeri Google Drive
            </a>
            <div style="font-size: 11px; color: var(--text-dim); margin-top: 8px;">Silakan unduh dan simpan berkas foto Anda dengan aman.</div>
          </div>
        `;
      } else {
        driveContent.innerHTML = `<p style="font-size: 13px; color: var(--text-dim);">Tautan galeri/Google Drive akan muncul di sini setelah sesi foto selesai diedit.</p>`;
      }

      // Photo Selection Input
      const selectionInput = document.getElementById('portal-selection-input');
      const selectionFeedback = document.getElementById('portal-selection-feedback');
      if (selectionInput) {
        selectionInput.value = p.selectedPhotos || '';
      }
      if (selectionFeedback && p.selectedPhotos) {
        selectionFeedback.style.display = 'block';
        selectionFeedback.style.color = '#3fb950';
        selectionFeedback.textContent = '✅ Pilihan foto Anda sudah tersimpan dan diterima fotografer.';
      }

      const saveSelectionBtn = document.getElementById('portal-btn-save-selection');
      if (saveSelectionBtn) {
        saveSelectionBtn.onclick = async () => {
          const val = selectionInput ? selectionInput.value : '';
          try {
            saveSelectionBtn.disabled = true;
            saveSelectionBtn.textContent = 'Menyimpan...';
            await API.submitPortalSelection(id, val);
            if (selectionFeedback) {
              selectionFeedback.style.display = 'block';
              selectionFeedback.style.color = '#3fb950';
              selectionFeedback.textContent = '✅ Pilihan foto Anda berhasil disimpan!';
            }
          } catch (err) {
            alert('Gagal menyimpan pilihan: ' + err.message);
          } finally {
            saveSelectionBtn.disabled = false;
            saveSelectionBtn.textContent = '💾 Kirim Nomor Pilihan ke Fotografer';
          }
        };
      }

      // Deliverables
      const delivList = document.getElementById('portal-deliverables-list');
      if (p.deliverables && p.deliverables.length > 0) {
        delivList.innerHTML = p.deliverables.map(d => `
          <div class="checklist-item ${d.done ? 'done' : ''}">
            <span>${d.done ? '✅' : '⏳'}</span>
            <span>${this.escapeHtml(d.text)}</span>
          </div>
        `).join('');
      } else {
        delivList.innerHTML = '<div style="font-size: 12px; color: var(--text-dim);">Output standar paket foto.</div>';
      }

      // Pricing & Invoice
      const total = Number(p.totalPrice) || 0;
      const dp = Number(p.dpAmount) || 0;
      const balance = total - dp;

      document.getElementById('portal-total-price').textContent = this.formatIDR(total);
      document.getElementById('portal-dp-amount').textContent = this.formatIDR(dp);
      document.getElementById('portal-balance').textContent = balance <= 0 ? 'LUNAS' : this.formatIDR(balance);

      if (studio.bankName && studio.bankAccount) {
        document.getElementById('portal-bank-info').textContent = `${studio.bankName} ${studio.bankAccount} (a.n ${studio.bankHolder || studio.studioName})`;
      } else {
        document.getElementById('portal-bank-info').textContent = 'Silakan hubungi fotografer langsung.';
      }

      // WhatsApp fotografer
      const waBtn = document.getElementById('portal-wa-btn');
      if (studio.phone) {
        let cleanPhone = studio.phone.replace(/\D/g, '');
        if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.substring(1);
        const text = encodeURIComponent(`Halo Kak ${studio.studioName}, saya klien sesi ${p.title}.`);
        waBtn.href = `https://wa.me/${cleanPhone}?text=${text}`;
      }
    } catch (err) {
      portalEl.innerHTML = `
        <div style="text-align: center; padding: 50px 20px;">
          <h2 style="color: var(--danger-text);">Data Sesi Tidak Ditemukan</h2>
          <p style="color: var(--text-muted); margin-top: 10px;">${err.message}</p>
        </div>
      `;
    }
  },

  // --- UTILS ---
  formatIDR(amount) {
    return 'Rp ' + Number(amount || 0).toLocaleString('id-ID');
  },

  formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        return `${parseInt(parts[2])} ${months[parseInt(parts[1]) - 1]} ${parts[0]}`;
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  },

  waLink(phone, projectTitle = '') {
    if (!phone) return '#';
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('0')) clean = '62' + clean.substring(1);
    const msg = projectTitle ? encodeURIComponent(`Halo Kak, terkait sesi foto "${projectTitle}"...`) : '';
    return `https://wa.me/${clean}${msg ? `?text=${msg}` : ''}`;
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3500);
  },

  onUnauthorized() {
    this.showLogin();
  }
};

// Auto start when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

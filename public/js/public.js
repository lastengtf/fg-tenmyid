// Public Client Website & Landing Page Controller - fg.ten.my.id
const PublicApp = {
  studio: {
    studioName: 'TEN Photography',
    tagline: 'Visual Storyteller & Professional Photography Services',
    phone: '',
    email: '',
    instagram: '@tenphotography',
    bankName: '',
    bankAccount: '',
    bankHolder: ''
  },
  packages: [],

  init() {
    this.checkUrlParams();
    this.bindEvents();
    this.loadStudioInfo();
    this.loadPackages();
  },

  checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const portalId = urlParams.get('portal') || urlParams.get('id');
    if (portalId) {
      // Redirect directly to the dedicated client portal
      window.location.replace(`/portal?id=${portalId}`);
    }
  },

  bindEvents() {
    // Mobile Drawer Toggle
    const toggleBtn = document.getElementById('btn-mobile-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const drawer = document.getElementById('mobile-menu-drawer');
        if (drawer) drawer.classList.toggle('open');
      });
    }

    // Tracking Form Submit
    const trackForm = document.getElementById('public-track-form');
    if (trackForm) {
      trackForm.addEventListener('submit', (e) => this.handleTrackSubmit(e));
    }

    // Booking Form Submit
    const bookForm = document.getElementById('public-book-form');
    if (bookForm) {
      bookForm.addEventListener('submit', (e) => this.handleBookingSubmit(e));
    }

    // Category Change in Booking Form
    const categorySelect = document.getElementById('book-category');
    if (categorySelect) {
      categorySelect.addEventListener('change', () => this.filterPackagesByCategory());
    }

    // Package Change in Booking Form
    const packageSelect = document.getElementById('book-package');
    if (packageSelect) {
      packageSelect.addEventListener('change', () => this.onPackageSelected());
    }
  },

  closeMobileMenu() {
    const drawer = document.getElementById('mobile-menu-drawer');
    if (drawer) drawer.classList.remove('open');
  },

  async loadStudioInfo() {
    try {
      const res = await fetch('/api/public/studio');
      const data = await res.json();
      if (data && data.studio) {
        this.studio = data.studio;
        this.renderStudioInfo();
      }
    } catch (e) {
      console.warn('Could not load studio info:', e);
    }
  },

  renderStudioInfo() {
    const s = this.studio;
    document.querySelectorAll('.studio-name').forEach(el => el.textContent = s.studioName || 'TEN Photography');

    const igLinks = document.querySelectorAll('.studio-instagram');
    igLinks.forEach(el => {
      const handle = (s.instagram || '').replace('@', '');
      if (handle) {
        el.textContent = '@' + handle;
        el.href = `https://instagram.com/${handle}`;
      }
    });

    const waLinks = document.querySelectorAll('.studio-wa-btn');
    if (s.phone) {
      let cleanPhone = s.phone.replace(/\D/g, '');
      if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.substring(1);
      waLinks.forEach(el => {
        el.href = `https://wa.me/${cleanPhone}?text=${encodeURIComponent('Halo, saya ingin berkonsultasi mengenai jadwal & paket sesi foto.')}`;
      });
    }
  },

  async loadPackages() {
    const container = document.getElementById('packages-grid');
    if (!container) return;

    try {
      const res = await fetch('/api/public/packages');
      const data = await res.json();
      this.packages = data.packages || [];
      this.renderPackagesGrid(this.packages);
      this.filterPackagesByCategory();
    } catch (e) {
      container.innerHTML = '<div style="color: var(--text-dim); text-align: center; grid-column: 1/-1;">Gagal memuat katalog paket.</div>';
    }
  },

  renderPackagesGrid(packages) {
    const container = document.getElementById('packages-grid');
    if (!container) return;

    if (packages.length === 0) {
      container.innerHTML = `
        <div style="color: var(--text-muted); text-align: center; grid-column: 1/-1; padding: 30px 0;">
          Katalog paket foto sedang diperbarui. Hubungi kami via WhatsApp untuk penawaran paket kustom.
        </div>
      `;
      return;
    }

    container.innerHTML = packages.map(p => `
      <div class="package-card">
        <div class="package-badge">${this.escapeHtml(p.category || 'Fotografi')}</div>
        <h3 class="package-name">${this.escapeHtml(p.name)}</h3>
        <div class="package-price">${this.formatIDR(p.price)}</div>
        <div class="package-desc">${this.escapeHtml(p.description || 'Layanan pemotretan profesional dengan editing warna artistik.')}</div>
        <button type="button" class="btn btn-primary btn-sm" style="width: 100%; margin-top: auto;" onclick="PublicApp.selectPackageForBooking('${p.id}', '${this.escapeHtml(p.category || 'Wedding')}')">
          Pilih Paket & Booking &rarr;
        </button>
      </div>
    `).join('');
  },

  filterPackagesByCategory() {
    const categorySelect = document.getElementById('book-category');
    const packageSelect = document.getElementById('book-package');
    if (!packageSelect) return;

    const cat = categorySelect ? categorySelect.value : 'all';
    const filtered = (cat && cat !== 'all') ? this.packages.filter(p => p.category === cat) : this.packages;

    let html = '<option value="">-- Pilih Paket Layanan --</option>';
    filtered.forEach(p => {
      html += `<option value="${p.id}" data-price="${p.price}" data-category="${p.category}">${p.name} - ${this.formatIDR(p.price)}</option>`;
    });
    packageSelect.innerHTML = html;
  },

  quickSelectCategory(category) {
    const catSelect = document.getElementById('book-category');
    if (catSelect && category) {
      catSelect.value = category;
      this.filterPackagesByCategory();
    }
  },

  selectPackageForBooking(packageId, category) {
    const catSelect = document.getElementById('book-category');
    if (catSelect && category) {
      catSelect.value = category;
      this.filterPackagesByCategory();
    }
    const pkgSelect = document.getElementById('book-package');
    if (pkgSelect) {
      pkgSelect.value = packageId;
    }
    this.onPackageSelected();

    // Smooth scroll to booking section
    const bookingSection = document.getElementById('reservasi');
    if (bookingSection) {
      bookingSection.scrollIntoView({ behavior: 'smooth' });
    }
  },

  onPackageSelected() {
    const pkgSelect = document.getElementById('book-package');
    const priceDisplay = document.getElementById('book-price-preview');
    if (!pkgSelect || !priceDisplay) return;

    const opt = pkgSelect.selectedOptions[0];
    if (opt && opt.dataset.price) {
      priceDisplay.textContent = `Investasi Paket: ${this.formatIDR(Number(opt.dataset.price))}`;
      priceDisplay.style.display = 'block';
    } else {
      priceDisplay.style.display = 'none';
    }
  },

  // Search & Track: Opens dedicated portal in NEW TAB
  async handleTrackSubmit(e) {
    e.preventDefault();
    const query = document.getElementById('track-input').value.trim();
    if (!query) return;

    const btn = document.getElementById('btn-track-submit');
    const resultBox = document.getElementById('track-search-results');

    try {
      btn.disabled = true;
      btn.textContent = 'Mencari Data Sesi...';

      const res = await fetch(`/api/public/track?q=${encodeURIComponent(query)}`);
      const data = await res.json();

      if (!res.ok || !data.found) {
        resultBox.style.display = 'block';
        resultBox.innerHTML = `
          <div class="track-error-card">
            ⚠️ ${data.message || 'Data sesi tidak ditemukan. Periksa kembali nomor WhatsApp atau ID Sesi Anda.'}
          </div>
        `;
        return;
      }

      const portalUrl = `/portal?id=${data.projectId}`;

      // Open immediately in new tab!
      window.open(portalUrl, '_blank');

      resultBox.style.display = 'block';
      resultBox.innerHTML = `
        <div class="track-success-card">
          <div>
            <div style="font-weight: 700; color: var(--text-main); font-size: 15px;">✓ Sesi Ditemukan: ${this.escapeHtml(data.title)}</div>
            <div style="color: var(--text-muted); font-size: 13px; margin-top: 3px;">
              Klien: <strong>${this.escapeHtml(data.clientName)}</strong> &bull; Tanggal: ${data.date ? this.formatDate(data.date) : 'TBD'}
            </div>
          </div>
          <a href="${portalUrl}" target="_blank" class="btn btn-primary btn-sm" style="white-space: nowrap;">
            Buka Portal Sesi di Tab Baru ↗
          </a>
        </div>
      `;
    } catch (err) {
      alert('Gagal mencari sesi: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Lacak Sesi Saya →';
    }
  },

  // Booking Form Submission
  async handleBookingSubmit(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('btn-submit-booking');
    const pkgSelect = document.getElementById('book-package');
    const opt = pkgSelect ? pkgSelect.selectedOptions[0] : null;

    const payload = {
      name: document.getElementById('book-name').value.trim(),
      phone: document.getElementById('book-phone').value.trim(),
      category: document.getElementById('book-category')?.value || 'Wedding',
      packageId: pkgSelect?.value || '',
      packageName: opt ? opt.textContent.split(' - ')[0] : '',
      packagePrice: opt ? Number(opt.dataset.price) || 0 : 0,
      date: document.getElementById('book-date')?.value || '',
      time: document.getElementById('book-time')?.value || '',
      location: document.getElementById('book-location')?.value.trim() || '',
      notes: document.getElementById('book-notes')?.value.trim() || ''
    };

    if (!payload.name || !payload.phone) {
      alert('Nama dan nomor WhatsApp wajib diisi.');
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Mengirim Permintaan Reservasi...';

      const res = await fetch('/api/public/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengirim reservasi.');
      }

      this.showBookingSuccess(data.project, payload);
      document.getElementById('public-book-form').reset();
      document.getElementById('book-price-preview').style.display = 'none';
    } catch (err) {
      alert(err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Kirim Formulir Reservasi & Diskusikan via WA →';
    }
  },

  showBookingSuccess(project, clientData) {
    const modal = document.getElementById('modal-booking-success');
    if (!modal) return;

    document.getElementById('success-client-name').textContent = clientData.name;
    document.getElementById('success-category').textContent = `${project.category} (${clientData.packageName || 'Paket Foto'})`;
    document.getElementById('success-date').textContent = clientData.date ? this.formatDate(clientData.date) : 'Sesuai kesepakatan';

    // WhatsApp Direct Link
    const waBtn = document.getElementById('success-wa-direct');
    if (waBtn && this.studio.phone) {
      let cleanPhone = this.studio.phone.replace(/\D/g, '');
      if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.substring(1);
      const text = encodeURIComponent(
        `Halo Kak ${this.studio.studioName}! 👋\nSaya baru saja mengisi formulir reservasi pemotretan di website:\n\n• Nama: ${clientData.name}\n• Kategori: ${project.category}\n• Paket: ${clientData.packageName || '-'}\n• Rencana Tanggal: ${clientData.date || '-'}\n• Lokasi: ${clientData.location || '-'}\n\nMohon konfirmasi ketersediaan jadwalnya ya Kak. Terima kasih!`
      );
      waBtn.href = `https://wa.me/${cleanPhone}?text=${text}`;
    }

    // Portal link opens in new tab!
    const portalBtn = document.getElementById('success-view-portal');
    if (portalBtn) {
      portalBtn.href = `/portal?id=${project.id}`;
      portalBtn.target = '_blank';
    }

    modal.style.display = 'flex';
  },

  formatIDR(num) {
    return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
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

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'none';
  }
};

document.addEventListener('DOMContentLoaded', () => {
  PublicApp.init();
});

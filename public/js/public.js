// Public Client Website & Portal Logic
const PublicApp = {
  studio: {
    studioName: 'TEN Photography',
    tagline: 'Visual Storyteller & Professional Photography',
    phone: '',
    email: '',
    instagram: '@tenphotography',
    bankName: '',
    bankAccount: '',
    bankHolder: ''
  },
  packages: [],

  init() {
    this.bindEvents();
    this.loadStudioInfo();
    this.loadPackages();
    this.checkUrlParams();
  },

  bindEvents() {
    // Booking Form Submit
    const bookForm = document.getElementById('public-book-form');
    if (bookForm) {
      bookForm.addEventListener('submit', (e) => this.handleBookingSubmit(e));
    }

    // Tracking Form Submit
    const trackForm = document.getElementById('public-track-form');
    if (trackForm) {
      trackForm.addEventListener('submit', (e) => this.handleTrackSubmit(e));
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
    document.querySelectorAll('.studio-tagline').forEach(el => el.textContent = s.tagline || 'Visual Storyteller & Professional Photography');
    
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
        el.href = `https://wa.me/${cleanPhone}?text=${encodeURIComponent('Halo, saya tertarik dengan layanan fotografi Anda.')}`;
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
      this.populateBookingPackages();
    } catch (e) {
      container.innerHTML = '<div style="color: var(--text-dim); text-align: center; grid-column: 1/-1;">Gagal memuat katalog paket. Silakan muat ulang halaman.</div>';
    }
  },

  renderPackagesGrid(packages) {
    const container = document.getElementById('packages-grid');
    if (!container) return;

    if (packages.length === 0) {
      container.innerHTML = '<div style="color: var(--text-dim); text-align: center; grid-column: 1/-1; padding: 40px 0;">Belum ada paket aktif yang ditampilkan. Hubungi kami via WhatsApp untuk paket kustom.</div>';
      return;
    }

    container.innerHTML = packages.map(p => `
      <div class="package-card">
        <div class="package-badge">${this.escapeHtml(p.category || 'Fotografi')}</div>
        <h3 class="package-name">${this.escapeHtml(p.name)}</h3>
        <div class="package-price">${this.formatIDR(p.price)}</div>
        <div class="package-desc">${this.escapeHtml(p.description || 'Layanan pemotretan profesional dengan fotografer berpengalaman.')}</div>
        <button type="button" class="btn btn-primary" style="width: 100%; margin-top: auto;" onclick="PublicApp.selectPackageForBooking('${p.id}', '${this.escapeHtml(p.category)}')">
          Pilih Paket & Reservasi
        </button>
      </div>
    `).join('');
  },

  populateBookingPackages() {
    this.filterPackagesByCategory();
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

    const bookSection = document.getElementById('booking');
    if (bookSection) {
      bookSection.scrollIntoView({ behavior: 'smooth' });
    }
  },

  onPackageSelected() {
    const pkgSelect = document.getElementById('book-package');
    const priceDisplay = document.getElementById('book-price-preview');
    if (!pkgSelect || !priceDisplay) return;

    const opt = pkgSelect.selectedOptions[0];
    if (opt && opt.dataset.price) {
      priceDisplay.textContent = `Estimasi Investasi: ${this.formatIDR(Number(opt.dataset.price))}`;
      priceDisplay.style.display = 'block';
    } else {
      priceDisplay.style.display = 'none';
    }
  },

  async handleBookingSubmit(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('btn-submit-booking');
    const pkgSelect = document.getElementById('book-package');
    const opt = pkgSelect ? pkgSelect.selectedOptions[0] : null;

    const payload = {
      name: document.getElementById('book-name').value.trim(),
      phone: document.getElementById('book-phone').value.trim(),
      email: document.getElementById('book-email')?.value.trim() || '',
      instagram: document.getElementById('book-instagram')?.value.trim() || '',
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
      submitBtn.textContent = 'Mengirim Permintaan...';

      const res = await fetch('/api/public/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengirim reservasi.');
      }

      // Success Modal
      this.showBookingSuccess(data.project, payload);
      document.getElementById('public-book-form').reset();
      document.getElementById('book-price-preview').style.display = 'none';
    } catch (err) {
      alert(err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '🚀 Kirim Permintaan Reservasi';
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

    // Portal link button
    const portalBtn = document.getElementById('success-view-portal');
    if (portalBtn) {
      portalBtn.onclick = () => {
        modal.style.display = 'none';
        this.loadPortal(project.id);
      };
    }

    modal.style.display = 'flex';
  },

  // Search & Track
  async handleTrackSubmit(e) {
    e.preventDefault();
    const query = document.getElementById('track-input').value.trim();
    if (!query) return;

    const btn = document.getElementById('btn-track-submit');
    const resultBox = document.getElementById('track-search-results');

    try {
      btn.disabled = true;
      btn.textContent = 'Mencari...';

      const res = await fetch(`/api/public/track?q=${encodeURIComponent(query)}`);
      const data = await res.json();

      if (!res.ok || !data.found) {
        resultBox.style.display = 'block';
        resultBox.innerHTML = `
          <div class="alert alert-danger" style="margin-top: 15px;">
            ${data.message || 'Data sesi tidak ditemukan. Periksa kembali nomor WA atau ID Sesi Anda.'}
          </div>
        `;
        return;
      }

      resultBox.style.display = 'block';
      resultBox.innerHTML = `
        <div class="track-card-preview" style="margin-top: 15px;">
          <div>
            <div style="font-weight: 700; color: #fff; font-size: 16px;">${this.escapeHtml(data.title)}</div>
            <div style="color: var(--text-dim); font-size: 13px; margin-top: 2px;">Klien: ${this.escapeHtml(data.clientName)} | Tanggal: ${data.date ? this.formatDate(data.date) : 'TBD'}</div>
            <div style="margin-top: 8px;">
              <span class="badge badge-${data.workflowStatus}">${this.getStatusLabel(data.workflowStatus)}</span>
            </div>
          </div>
          <button type="button" class="btn btn-primary btn-sm" onclick="PublicApp.loadPortal('${data.projectId}')">
            Buka Portal Lengkap ➡️
          </button>
        </div>
      `;
    } catch (err) {
      alert('Gagal melacak sesi: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '🔍 Lacak Sesi';
    }
  },

  checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const portalId = urlParams.get('portal');
    if (portalId) {
      this.loadPortal(portalId);
    }
  },

  // Load Portal Detail
  async loadPortal(projectId) {
    const portalSection = document.getElementById('portal-view-section');
    if (!portalSection) return;

    portalSection.style.display = 'block';
    portalSection.scrollIntoView({ behavior: 'smooth' });

    const contentDiv = document.getElementById('portal-view-content');
    contentDiv.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-dim);">Memuat data sesi foto Anda...</div>';

    try {
      const res = await fetch(`/api/portal/${projectId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Data sesi tidak ditemukan.');
      }

      const p = data.project;
      const s = data.studio || this.studio;

      const descMap = {
        inquiry: 'Sesi foto Anda sedang dalam tahap konsultasi dan konfirmasi konsep.',
        booked: 'Jadwal sesi foto telah dikonfirmasi dan terdaftar.',
        dp_received: 'Uang muka (DP) telah diterima. Jadwal Anda terkunci aman.',
        shooting_done: 'Sesi pemotretan telah selesai dilaksanakan.',
        selection: 'Foto sedang dalam tahap kurasi dan seleksi foto pilihan.',
        editing: 'Foto sedang dalam proses retouching dan color grading estetis.',
        gallery_ready: '🎉 Galeri foto Anda sudah siap dan dapat diunduh sekarang!',
        delivered: 'Seluruh berkas foto telah dikirimkan ke Anda.',
        completed: 'Sesi foto dan pesanan telah selesai secara tuntas.'
      };

      const total = Number(p.totalPrice) || 0;
      const dp = Number(p.dpAmount) || 0;
      const balance = total - dp;

      contentDiv.innerHTML = `
        <div class="portal-card">
          <div class="portal-header">
            <div>
              <span class="badge badge-${p.workflowStatus}" style="font-size: 13px; padding: 6px 12px;">
                ${this.getStatusLabel(p.workflowStatus)}
              </span>
              <h2 style="font-size: 24px; font-weight: 700; color: #fff; margin-top: 10px;">${this.escapeHtml(p.title)}</h2>
              <div style="color: var(--text-muted); font-size: 14px; margin-top: 4px;">Klien: <strong>${this.escapeHtml(p.clientName)}</strong></div>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('portal-view-section').style.display='none'">
              &times; Tutup Portal
            </button>
          </div>

          <div class="portal-status-callout">
            <div style="font-size: 15px; font-weight: 600; color: #fff;">Status Progres Terkini:</div>
            <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">${descMap[p.workflowStatus] || 'Proses sedang berlangsung.'}</div>
          </div>

          <div class="portal-grid">
            <div class="portal-box">
              <div class="portal-box-title">📅 Jadwal & Waktu</div>
              <div class="portal-box-value">${p.date ? this.formatDate(p.date) : 'Belum dijadwalkan'} ${p.time ? `@ ${p.time} WIB` : ''}</div>
            </div>
            <div class="portal-box">
              <div class="portal-box-title">📸 Paket Layanan</div>
              <div class="portal-box-value">${this.escapeHtml(p.category || 'Fotografi')} ${p.packageName ? `(${this.escapeHtml(p.packageName)})` : ''}</div>
            </div>
            <div class="portal-box" style="grid-column: 1/-1;">
              <div class="portal-box-title">📍 Lokasi Pemotretan</div>
              <div class="portal-box-value" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                <span>${this.escapeHtml(p.location || 'Lokasi fleksibel')}</span>
                ${p.mapsUrl ? `<a href="${p.mapsUrl}" target="_blank" class="btn btn-secondary btn-sm">🗺️ Buka di Google Maps</a>` : ''}
              </div>
            </div>
          </div>

          <!-- Section: Download Google Drive -->
          <div class="portal-section-card">
            <h3 style="font-size: 16px; font-weight: 700; color: #fff; margin-bottom: 8px;">📦 Unduhan Berkas / Google Drive</h3>
            ${p.driveUrl ? `
              <div>
                <a href="${p.driveUrl}" target="_blank" class="btn btn-primary" style="padding: 10px 20px; font-size: 15px; display: inline-flex; align-items: center; gap: 8px;">
                  📥 Buka Galeri Google Drive
                </a>
                <div style="font-size: 12px; color: var(--text-dim); margin-top: 8px;">
                  Pastikan Anda mengunduh dan menyimpan berkas foto resolusi tinggi ke perangkat Anda.
                </div>
              </div>
            ` : `
              <div style="font-size: 13px; color: var(--text-dim);">
                Tautan galeri/Google Drive akan aktif di sini setelah sesi pemotretan dan tahap editing selesai.
              </div>
            `}
          </div>

          <!-- Section: Photo Selection Submission -->
          <div class="portal-section-card">
            <h3 style="font-size: 16px; font-weight: 700; color: #fff; margin-bottom: 6px;">🖼️ Kirim Nomor Foto Pilihan (Untuk Retouching)</h3>
            <p style="font-size: 12px; color: var(--text-dim); margin-bottom: 12px;">
              Jika Anda telah melihat foto mentah di link preview, masukkan nomor foto yang ingin diedit di bawah ini (pisahkan dengan koma atau baris baru).
            </p>
            <textarea id="portal-user-selection" class="form-control" style="min-height: 80px;" placeholder="Contoh: IMG_0123, IMG_0145, IMG_0210, IMG_0350">${this.escapeHtml(p.selectedPhotos || '')}</textarea>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; flex-wrap: wrap; gap: 10px;">
              <span id="portal-selection-status-msg" style="font-size: 12px; color: #3fb950; display: ${p.selectedPhotos ? 'inline' : 'none'};">
                ✅ Nomor pilihan foto sudah diterima fotografer.
              </span>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-save-client-selection" onclick="PublicApp.submitPhotoSelection('${p.id}')">
                💾 Simpan Nomor Pilihan ke Fotografer
              </button>
            </div>
          </div>

          <!-- Section: Payment & Invoice Status -->
          <div class="portal-section-card">
            <h3 style="font-size: 16px; font-weight: 700; color: #fff; margin-bottom: 12px;">💳 Rincian Pembayaran</h3>
            <div style="display: flex; flex-direction: column; gap: 8px; font-size: 14px;">
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-muted);">Total Biaya:</span>
                <strong style="color: #fff;">${this.formatIDR(total)}</strong>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-muted);">Uang Muka (DP):</span>
                <span style="color: #388bfd;">${this.formatIDR(dp)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; border-top: 1px solid var(--border-color); padding-top: 8px;">
                <span style="color: var(--text-muted); font-weight: 600;">Sisa Tagihan:</span>
                <strong style="color: ${balance <= 0 ? '#3fb950' : 'var(--danger-text)'}; font-size: 16px;">
                  ${balance <= 0 ? 'LUNAS ✅' : this.formatIDR(balance)}
                </strong>
              </div>
            </div>
            ${s.bankName && s.bankAccount ? `
              <div style="margin-top: 16px; padding: 12px; background: rgba(255,255,255,0.03); border-radius: 8px; font-size: 12px; border: 1px solid var(--border-color);">
                <div style="color: var(--text-dim); font-size: 11px; text-transform: uppercase;">Rekening Transfer Pembayaran:</div>
                <div style="font-weight: 700; color: #fff; font-size: 14px; margin-top: 2px;">${this.escapeHtml(s.bankName)}: ${this.escapeHtml(s.bankAccount)}</div>
                <div style="color: var(--text-muted);">a.n ${this.escapeHtml(s.bankHolder || s.studioName)}</div>
              </div>
            ` : ''}
          </div>

          <div style="text-align: center; margin-top: 20px;">
            ${s.phone ? `
              <a href="https://wa.me/${s.phone.replace(/\D/g, '').replace(/^0/, '62')}?text=${encodeURIComponent(`Halo ${s.studioName}, saya ingin konfirmasi terkait sesi foto ${p.title}.`)}" target="_blank" class="btn btn-secondary">
                💬 Hubungi Fotografer via WhatsApp
              </a>
            ` : ''}
          </div>
        </div>
      `;
    } catch (err) {
      contentDiv.innerHTML = `
        <div class="alert alert-danger" style="text-align: center; padding: 25px;">
          <h3>Data Sesi Tidak Ditemukan</h3>
          <p style="margin-top: 8px; font-size: 13px;">${err.message}</p>
        </div>
      `;
    }
  },

  async submitPhotoSelection(projectId) {
    const input = document.getElementById('portal-user-selection');
    const statusMsg = document.getElementById('portal-selection-status-msg');
    const btn = document.getElementById('btn-save-client-selection');
    if (!input) return;

    try {
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Menyimpan...';
      }
      const res = await fetch(`/api/portal/${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedPhotos: input.value.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan pilihan.');

      if (statusMsg) {
        statusMsg.style.display = 'inline';
        statusMsg.style.color = '#3fb950';
        statusMsg.textContent = '✅ Nomor pilihan foto berhasil terkirim ke fotografer!';
      }
      alert('Nomor foto pilihan Anda berhasil disimpan dan dikirim ke fotografer!');
    } catch (err) {
      alert(err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '💾 Simpan Nomor Pilihan ke Fotografer';
      }
    }
  },

  // Helpers
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

  getStatusLabel(status) {
    const map = {
      inquiry: 'Inquiry / Tanya',
      booked: 'Terjadwal',
      dp_received: 'DP Diterima',
      shooting_done: 'Selesai Foto',
      selection: 'Seleksi Foto',
      editing: 'Proses Editing',
      gallery_ready: 'Galeri Siap',
      delivered: 'Terkirim',
      completed: 'Selesai'
    };
    return map[status] || status;
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

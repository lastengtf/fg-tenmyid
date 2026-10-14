// Dedicated Client Portal Controller
const PortalApp = {
  projectId: null,
  project: null,
  studio: null,
  selectedPhotos: [], // Array of string photo numbers/tags
  selectionQuota: 20,

  init() {
    const urlParams = new URLSearchParams(window.location.search);
    this.projectId = urlParams.get('id') || urlParams.get('portal');

    if (!this.projectId) {
      this.renderError('Tautan tidak valid. ID sesi foto tidak disertakan.');
      return;
    }

    this.bindEvents();
    this.loadProject();
  },

  bindEvents() {
    const addBtn = document.getElementById('btn-add-chip');
    const input = document.getElementById('chip-input');
    const pasteBtn = document.getElementById('btn-paste-chips');
    const saveBtn = document.getElementById('btn-save-selection');

    if (addBtn && input) {
      addBtn.addEventListener('click', () => this.addCurrentInput());
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',') {
          e.preventDefault();
          this.addCurrentInput();
        }
      });
    }

    if (pasteBtn) {
      pasteBtn.addEventListener('click', () => this.promptPastePhotos());
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.savePhotoSelection());
    }
  },

  async loadProject() {
    const loader = document.getElementById('portal-loader');
    const content = document.getElementById('portal-content');

    try {
      const res = await fetch(`/api/portal/${this.projectId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Data sesi foto tidak ditemukan.');
      }

      this.project = data.project;
      this.studio = data.studio || {};
      this.selectionQuota = Number(this.project.selectionQuota) || 20;

      // Parse existing selected photos
      if (this.project.selectedPhotos) {
        this.selectedPhotos = this.project.selectedPhotos
          .split(/[\n,;]+/)
          .map(s => s.trim())
          .filter(Boolean);
        // Deduplicate
        this.selectedPhotos = [...new Set(this.selectedPhotos)];
      } else {
        this.selectedPhotos = [];
      }

      if (loader) loader.style.display = 'none';
      if (content) content.style.display = 'block';

      this.renderProject();
    } catch (err) {
      if (loader) loader.style.display = 'none';
      this.renderError(err.message);
    }
  },

  renderProject() {
    const p = this.project;
    const s = this.studio;

    document.getElementById('studio-name-display').textContent = s.studioName || 'TEN Photography';
    document.getElementById('project-title').textContent = p.title || 'Sesi Foto';
    document.getElementById('client-name').textContent = `Klien: ${p.clientName}`;

    // Workflow status badge
    const badge = document.getElementById('workflow-badge');
    badge.className = `badge badge-${p.workflowStatus}`;
    badge.textContent = this.getStatusLabel(p.workflowStatus);

    // Status description
    const statusDesc = {
      inquiry: 'Sesi foto Anda sedang dalam tahap konsultasi & persiapan konsep.',
      booked: 'Jadwal sesi foto telah dikonfirmasi dan terdaftar.',
      dp_received: 'Uang muka (DP) telah diterima. Jadwal pemotretan Anda terkunci aman.',
      shooting_done: 'Sesi pemotretan telah selesai dilaksanakan.',
      selection: 'Foto sedang dalam tahap kurasi dan seleksi foto pilihan klien.',
      editing: 'Foto pilihan sedang dalam proses retouching & pewarnaan artistik.',
      gallery_ready: '🎉 Galeri foto resolusi tinggi sudah siap dan dapat diunduh sekarang!',
      delivered: 'Seluruh berkas foto final telah dikirimkan ke Anda.',
      completed: 'Sesi foto dan pesanan telah selesai secara tuntas.'
    };
    document.getElementById('status-description').textContent = statusDesc[p.workflowStatus] || 'Proses sedang berlangsung.';

    // Schedule & Info
    document.getElementById('session-datetime').textContent = `${p.date ? this.formatDate(p.date) : 'TBD'} ${p.time ? `@ ${p.time} WIB` : ''}`;
    document.getElementById('session-package').textContent = `${p.category || 'Fotografi'} ${p.packageName ? `(${p.packageName})` : ''}`;
    document.getElementById('session-location').textContent = p.location || 'Lokasi fleksibel';

    const mapsBtn = document.getElementById('session-maps-btn');
    if (p.mapsUrl) {
      mapsBtn.href = p.mapsUrl;
      mapsBtn.style.display = 'inline-flex';
    } else {
      mapsBtn.style.display = 'none';
    }

    // Google Drive Link
    const driveBox = document.getElementById('drive-box-content');
    if (p.driveUrl) {
      driveBox.innerHTML = `
        <div style="margin-top: 4px;">
          <a href="${p.driveUrl}" target="_blank" class="btn btn-primary" style="padding: 11px 22px; font-size: 15px;">
            📥 Buka Galeri Google Drive
          </a>
          <div style="font-size: 12px; color: var(--text-dim); margin-top: 8px;">
            Silakan unduh dan simpan berkas foto Anda dengan aman.
          </div>
        </div>
      `;
    } else {
      driveBox.innerHTML = `
        <div style="font-size: 13px; color: var(--text-dim);">
          Tautan unduhan galeri/Google Drive akan aktif di sini setelah tahap pemotretan dan editing selesai.
        </div>
      `;
    }

    // Render Quota & Chips
    this.renderChips();

    // Payment details
    const total = Number(p.totalPrice) || 0;
    const dp = Number(p.dpAmount) || 0;
    const balance = total - dp;

    document.getElementById('pay-total').textContent = this.formatIDR(total);
    document.getElementById('pay-dp').textContent = this.formatIDR(dp);
    const balanceEl = document.getElementById('pay-balance');
    balanceEl.textContent = balance <= 0 ? 'LUNAS ✅' : this.formatIDR(balance);
    balanceEl.style.color = balance <= 0 ? '#3fb950' : 'var(--danger-text)';

    // Bank transfer details
    const bankBox = document.getElementById('bank-info-box');
    if (s.bankName && s.bankAccount) {
      bankBox.style.display = 'block';
      document.getElementById('bank-name-account').textContent = `${s.bankName}: ${s.bankAccount}`;
      document.getElementById('bank-holder').textContent = `a.n ${s.bankHolder || s.studioName}`;
    } else {
      bankBox.style.display = 'none';
    }

    // Contact WhatsApp
    const waBtn = document.getElementById('btn-wa-photographer');
    if (s.phone) {
      let cleanPhone = s.phone.replace(/\D/g, '').replace(/^0/, '62');
      const text = encodeURIComponent(`Halo ${s.studioName}, saya klien untuk sesi foto "${p.title}".`);
      waBtn.href = `https://wa.me/${cleanPhone}?text=${text}`;
      waBtn.style.display = 'inline-flex';
    } else {
      waBtn.style.display = 'none';
    }
  },

  // --- PHOTO SELECTION CHIPS & QUOTA LOGIC ---
  renderChips() {
    const container = document.getElementById('chips-container');
    const quotaText = document.getElementById('quota-text');
    const quotaBar = document.getElementById('quota-progress-bar');
    const input = document.getElementById('chip-input');
    const addBtn = document.getElementById('btn-add-chip');

    const count = this.selectedPhotos.length;
    const quota = this.selectionQuota;
    const remaining = Math.max(0, quota - count);
    const percentage = Math.min(100, Math.round((count / quota) * 100));

    // Progress bar
    if (quotaBar) {
      quotaBar.style.width = `${percentage}%`;
      if (count >= quota) {
        quotaBar.classList.add('quota-full');
      } else {
        quotaBar.classList.remove('quota-full');
      }
    }

    // Quota text
    if (quotaText) {
      if (count >= quota) {
        quotaText.innerHTML = `<strong>${count} / ${quota} Foto</strong> (Maksimal Kuota Terpenuhi ✅)`;
        quotaText.style.color = '#3fb950';
      } else {
        quotaText.innerHTML = `<strong>${count} / ${quota} Foto</strong> (Sisa Kuota: <strong>${remaining} foto</strong>)`;
        quotaText.style.color = 'var(--text-main)';
      }
    }

    // Disable input if quota full
    if (input && addBtn) {
      if (count >= quota) {
        input.disabled = true;
        input.placeholder = 'Kuota maksimal telah tercapai. Hapus salah satu jika ingin ganti.';
        addBtn.disabled = true;
      } else {
        input.disabled = false;
        input.placeholder = 'Ketik nomor foto (misal: 023 atau IMG_023)...';
        addBtn.disabled = false;
      }
    }

    // Render Chip List
    if (!container) return;
    if (count === 0) {
      container.innerHTML = '<span class="chip-empty-placeholder">Belum ada foto yang dipilih. Masukkan nomor foto di atas.</span>';
      return;
    }

    container.innerHTML = this.selectedPhotos.map((photo, index) => `
      <div class="photo-chip">
        <span>${this.escapeHtml(photo)}</span>
        <span class="chip-remove" onclick="PortalApp.removeChip(${index})" title="Hapus foto ini">&times;</span>
      </div>
    `).join('');
  },

  addCurrentInput() {
    const input = document.getElementById('chip-input');
    if (!input || !input.value.trim()) return;

    let val = input.value.trim().replace(/^,+|,+$/g, '');
    if (!val) return;

    // Check if user entered numbers only, optional auto-prefix
    if (/^\d+$/.test(val)) {
      val = 'IMG_' + val.padStart(4, '0');
    }

    if (this.selectedPhotos.includes(val)) {
      alert(`Nomor foto "${val}" sudah ada di dalam daftar.`);
      input.value = '';
      return;
    }

    if (this.selectedPhotos.length >= this.selectionQuota) {
      alert(`Batas kuota pemilihan paket Anda adalah ${this.selectionQuota} foto. Hapus salah satu foto jika ingin memilih nomor lain.`);
      return;
    }

    this.selectedPhotos.push(val);
    input.value = '';
    this.renderChips();
    this.markUnsaved();
  },

  removeChip(index) {
    if (index >= 0 && index < this.selectedPhotos.length) {
      this.selectedPhotos.splice(index, 1);
      this.renderChips();
      this.markUnsaved();
    }
  },

  promptPastePhotos() {
    const currentCount = this.selectedPhotos.length;
    const quota = this.selectionQuota;
    const remaining = quota - currentCount;

    if (remaining <= 0) {
      alert(`Kuota pemilihan Anda sudah penuh (${quota} foto).`);
      return;
    }

    const raw = prompt(`Tempelkan nomor-nomor foto (pisahkan dengan koma atau baris baru).\nSisa kuota: ${remaining} foto:`);
    if (!raw || !raw.trim()) return;

    const list = raw
      .split(/[\n,;]+/)
      .map(s => {
        let clean = s.trim();
        if (/^\d+$/.test(clean)) {
          clean = 'IMG_' + clean.padStart(4, '0');
        }
        return clean;
      })
      .filter(Boolean);

    let added = 0;
    for (const item of list) {
      if (this.selectedPhotos.length >= quota) break;
      if (!this.selectedPhotos.includes(item)) {
        this.selectedPhotos.push(item);
        added++;
      }
    }

    this.renderChips();
    this.markUnsaved();
    alert(`Berhasil menambahkan ${added} foto.`);
  },

  markUnsaved() {
    const statusMsg = document.getElementById('save-status-msg');
    if (statusMsg) {
      statusMsg.textContent = '⚠️ Ada perubahan belum disimpan. Klik tombol Simpan di bawah.';
      statusMsg.style.color = '#e3b341';
    }
  },

  async savePhotoSelection() {
    const saveBtn = document.getElementById('btn-save-selection');
    const statusMsg = document.getElementById('save-status-msg');

    try {
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Menyimpan...';
      }

      const res = await fetch(`/api/portal/${this.projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedPhotos: this.selectedPhotos })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan pilihan foto.');
      }

      if (statusMsg) {
        statusMsg.textContent = '✅ Pilihan foto Anda berhasil disimpan dan dikirim ke fotografer!';
        statusMsg.style.color = '#3fb950';
      }
      alert('Pilihan foto Anda berhasil dikunci dan dikirim ke tim fotografer!');
    } catch (err) {
      alert(err.message);
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 Kunci & Kirim Pilihan ke Fotografer';
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
      shooting_done: 'Selesai Pemotretan',
      selection: 'Tahap Seleksi Foto',
      editing: 'Proses Retouching & Editing',
      gallery_ready: '🎉 Galeri Siap Diunduh',
      delivered: 'Berkas Dikirimkan',
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

  renderError(msg) {
    const container = document.querySelector('.portal-container');
    if (container) {
      container.innerHTML = `
        <div style="background: var(--bg-surface); border: 1px solid var(--border); border-radius: 14px; padding: 36px 20px; text-align: center; margin-top: 40px;">
          <div style="font-size: 40px; margin-bottom: 12px;">🔍</div>
          <h2 style="color: var(--danger-text); font-size: 20px; font-weight: 700;">Data Sesi Foto Tidak Ditemukan</h2>
          <p style="color: var(--text-muted); font-size: 14px; margin-top: 8px; max-width: 440px; margin-left: auto; margin-right: auto;">
            ${msg || 'Tautan yang Anda tuju salah atau data sesi foto belum tersedia.'}
          </p>
          <a href="/" class="btn btn-secondary" style="margin-top: 20px;">
            &larr; Kembali ke Beranda
          </a>
        </div>
      `;
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  PortalApp.init();
});

// Dedicated Client Portal Controller - Visual Photo Selector with Google Drive Preview & Per-Photo Notes
const PortalApp = {
  projectId: null,
  project: null,
  studio: null,
  selectedPhotos: [], // Array of string photo identifiers (names or IDs)
  photoNotes: {}, // Object: { [photoIdentifier]: "custom note" }
  drivePhotos: [], // Array of { id, name, thumbnailUrl, previewUrl }
  selectionQuota: 20,
  activeFilter: 'all', // 'all' | 'selected' | 'unselected'
  searchQuery: '',
  lightboxIndex: null,
  currentNotePhoto: null,
  hasUnsavedChanges: false,

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
    // Save Selection Buttons (main & sticky)
    const saveBtn = document.getElementById('btn-save-selection');
    const stickySaveBtn = document.getElementById('btn-sticky-save');
    if (saveBtn) saveBtn.addEventListener('click', () => this.savePhotoSelection());
    if (stickySaveBtn) stickySaveBtn.addEventListener('click', () => this.savePhotoSelection());

    // Filter Tabs
    document.querySelectorAll('.photo-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.photo-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeFilter = btn.dataset.filter || 'all';
        this.renderGallery();
      });
    });

    // Search Input
    const searchInput = document.getElementById('photo-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.renderGallery();
      });
    }

    // Toggle Manual Input
    const toggleManualBtn = document.getElementById('btn-toggle-manual-input');
    const manualBox = document.getElementById('manual-chip-box');
    if (toggleManualBtn && manualBox) {
      toggleManualBtn.addEventListener('click', () => {
        const isHidden = manualBox.style.display === 'none';
        manualBox.style.display = isHidden ? 'block' : 'none';
        toggleManualBtn.textContent = isHidden ? '🖼️ Sembunyikan Input Manual' : '✍️ Mode Nomor Manual';
      });
    }

    // Manual Chip Events
    const addChipBtn = document.getElementById('btn-add-chip');
    const chipInput = document.getElementById('chip-input');
    const pasteChipBtn = document.getElementById('btn-paste-chips');

    if (addChipBtn && chipInput) {
      addChipBtn.addEventListener('click', () => this.addCurrentManualInput());
      chipInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',') {
          e.preventDefault();
          this.addCurrentManualInput();
        }
      });
    }

    if (pasteChipBtn) {
      pasteChipBtn.addEventListener('click', () => this.promptPastePhotos());
    }

    // Lightbox Controls
    const lbClose = document.getElementById('lightbox-close');
    const lbPrev = document.getElementById('lightbox-prev');
    const lbNext = document.getElementById('lightbox-next');
    const lbSelect = document.getElementById('lightbox-select-btn');
    const lbNoteBtn = document.getElementById('lightbox-note-btn');

    if (lbClose) lbClose.addEventListener('click', () => this.closeLightbox());
    if (lbPrev) lbPrev.addEventListener('click', () => this.navigateLightbox(-1));
    if (lbNext) lbNext.addEventListener('click', () => this.navigateLightbox(1));
    if (lbSelect) {
      lbSelect.addEventListener('click', () => {
        const photo = this.getVisiblePhotos()[this.lightboxIndex];
        if (photo) {
          this.togglePhotoSelection(photo);
          this.updateLightboxState();
        }
      });
    }
    if (lbNoteBtn) {
      lbNoteBtn.addEventListener('click', () => {
        const photo = this.getVisiblePhotos()[this.lightboxIndex];
        if (photo) {
          this.openNoteModal(photo);
        }
      });
    }

    // Lightbox Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      const lb = document.getElementById('lightbox-modal');
      if (lb && lb.style.display === 'flex') {
        if (e.key === 'Escape') this.closeLightbox();
        else if (e.key === 'ArrowLeft') this.navigateLightbox(-1);
        else if (e.key === 'ArrowRight') this.navigateLightbox(1);
      }
    });

    // Note Modal Controls
    const noteClose = document.getElementById('note-modal-close');
    const noteCancel = document.getElementById('note-modal-cancel');
    const noteSave = document.getElementById('note-modal-save');

    if (noteClose) noteClose.addEventListener('click', () => this.closeNoteModal());
    if (noteCancel) noteCancel.addEventListener('click', () => this.closeNoteModal());
    if (noteSave) noteSave.addEventListener('click', () => this.saveNoteModal());

    // Quick Tag Chips in Note Modal
    document.querySelectorAll('.quick-tag-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tag = btn.dataset.tag;
        const textarea = document.getElementById('note-modal-textarea');
        if (textarea && tag) {
          const current = textarea.value.trim();
          if (current) {
            textarea.value = current + ', ' + tag;
          } else {
            textarea.value = tag;
          }
          textarea.focus();
        }
      });
    });

    // Warn before navigating away if unsaved
    window.addEventListener('beforeunload', (e) => {
      if (this.hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'Anda memiliki pilihan foto yang belum disimpan.';
      }
    });
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
      this.photoNotes = (this.project.photoNotes && typeof this.project.photoNotes === 'object') ? this.project.photoNotes : {};

      // Parse existing selected photos
      if (this.project.selectedPhotos) {
        this.selectedPhotos = this.project.selectedPhotos
          .split(/[\n,;]+/)
          .map(s => s.trim())
          .filter(Boolean);
        this.selectedPhotos = [...new Set(this.selectedPhotos)];
      } else {
        this.selectedPhotos = [];
      }

      // Initial Drive Photos (if cached)
      if (Array.isArray(this.project.drivePhotos) && this.project.drivePhotos.length > 0) {
        this.drivePhotos = this.project.drivePhotos;
      }

      if (loader) loader.style.display = 'none';
      if (content) content.style.display = 'block';

      this.renderProjectHeader();
      this.renderQuota();
      this.renderChips();

      // Fetch fresh photos from Drive endpoint if needed
      await this.fetchDrivePhotos();
    } catch (err) {
      if (loader) loader.style.display = 'none';
      this.renderError(err.message);
    }
  },

  async fetchDrivePhotos() {
    const loadingEl = document.getElementById('photos-loading');
    const emptyEl = document.getElementById('photos-empty-state');
    const emptyDesc = document.getElementById('photos-empty-desc');

    if (this.drivePhotos.length === 0) {
      if (loadingEl) loadingEl.style.display = 'block';
      if (emptyEl) emptyEl.style.display = 'none';
    }

    try {
      const res = await fetch(`/api/portal/${this.projectId}/drive-photos`);
      const data = await res.json();

      if (loadingEl) loadingEl.style.display = 'none';

      if (res.ok && Array.isArray(data.photos) && data.photos.length > 0) {
        this.drivePhotos = data.photos;
        if (emptyEl) emptyEl.style.display = 'none';
        this.renderGallery();
      } else {
        if (this.drivePhotos.length === 0) {
          if (emptyEl) {
            emptyEl.style.display = 'block';
            if (emptyDesc && data.message) emptyDesc.textContent = data.message;
          }
          // If no drive photos, open manual chip box as fallback
          const manualBox = document.getElementById('manual-chip-box');
          if (manualBox) manualBox.style.display = 'block';
        } else {
          this.renderGallery();
        }
      }
    } catch (err) {
      if (loadingEl) loadingEl.style.display = 'none';
      if (this.drivePhotos.length > 0) {
        this.renderGallery();
      } else {
        if (emptyEl) emptyEl.style.display = 'block';
      }
    }
  },

  renderProjectHeader() {
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
    const confirmWaBtn = document.getElementById('btn-confirm-payment-wa');
    if (s.bankName && s.bankAccount) {
      bankBox.style.display = 'block';
      document.getElementById('bank-name-account').textContent = `${s.bankName}: ${s.bankAccount}`;
      document.getElementById('bank-holder').textContent = `a.n ${s.bankHolder || s.studioName}`;
    } else {
      bankBox.style.display = 'none';
    }

    if (confirmWaBtn) {
      if (s.phone) {
        let cleanPhone = s.phone.replace(/\D/g, '').replace(/^0/, '62');
        const payMsg = encodeURIComponent(`Halo ${s.studioName || 'Kak'}! 👋\nSaya *${p.clientName}* ingin konfirmasi pembayaran untuk sesi foto *${p.title}*:\n• Total Tagihan: ${this.formatIDR(total)}\n• Sudah Dibayar/DP: ${this.formatIDR(dp)}\n• Sisa Tagihan: ${balance <= 0 ? 'LUNAS (Rp 0)' : this.formatIDR(balance)}\n\nBukti transfer saya lampirkan berikut ya. Terima kasih!`);
        confirmWaBtn.href = `https://wa.me/${cleanPhone}?text=${payMsg}`;
        confirmWaBtn.style.display = 'inline-flex';
      } else {
        confirmWaBtn.style.display = 'none';
      }
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

  copyBankAccount() {
    const s = this.studio || {};
    if (!s.bankAccount) {
      alert('Nomor rekening belum tersedia.');
      return;
    }
    navigator.clipboard.writeText(s.bankAccount);
    alert(`Nomor rekening ${s.bankAccount} (${s.bankName || ''}) berhasil disalin!`);
  },

  // --- GALLERY RENDERING & FILTERING ---
  getVisiblePhotos() {
    let list = this.drivePhotos;

    // Filter by tab
    if (this.activeFilter === 'selected') {
      list = list.filter(p => this.isPhotoSelected(p));
    } else if (this.activeFilter === 'unselected') {
      list = list.filter(p => !this.isPhotoSelected(p));
    }

    // Filter by search query
    if (this.searchQuery) {
      list = list.filter(p => p.name.toLowerCase().includes(this.searchQuery));
    }

    return list;
  },

  isPhotoSelected(photo) {
    if (!photo) return false;
    // Check match against photo.name or photo.id
    return this.selectedPhotos.includes(photo.name) || this.selectedPhotos.includes(photo.id);
  },

  getPhotoKey(photo) {
    return photo.name || photo.id;
  },

  renderGallery() {
    const grid = document.getElementById('photos-visual-grid');
    if (!grid) return;

    this.updateTabCounters();
    const visiblePhotos = this.getVisiblePhotos();

    if (visiblePhotos.length === 0) {
      if (this.drivePhotos.length > 0) {
        grid.innerHTML = `
          <div style="grid-column: 1/-1; text-align: center; padding: 40px 16px; color: var(--text-dim);">
            🔍 Tidak ada foto yang cocok dengan filter atau pencarian Anda.
          </div>
        `;
      } else {
        grid.innerHTML = '';
      }
      return;
    }

    const watermarkText = (this.studio && this.studio.studioName) ? `PREVIEW • ${this.studio.studioName}` : 'PREVIEW ONLY';

    grid.innerHTML = visiblePhotos.map((photo, index) => {
      const isSelected = this.isPhotoSelected(photo);
      const photoKey = this.getPhotoKey(photo);
      const note = this.photoNotes[photoKey] || '';
      const thumbUrl = photo.thumbnailUrl || `https://lh3.googleusercontent.com/d/${photo.id}=w600-h600`;

      return `
        <div class="photo-card ${isSelected ? 'is-selected' : ''}" data-index="${index}" data-key="${this.escapeHtml(photoKey)}">
          <div class="photo-thumb-wrap" onclick="PortalApp.openLightbox(${index})">
            <img class="photo-thumb" src="${thumbUrl}" alt="${this.escapeHtml(photo.name)}" loading="lazy" oncontextmenu="return false;" draggable="false" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'200\\' height=\\'200\\' viewBox=\\'0 0 200 200\\'><rect fill=\\'%2318202c\\' width=\\'200\\' height=\\'200\\'/><text fill=\\'%236e7681\\' x=\\'50%\\' y=\\'50%\\' text-anchor=\\'middle\\' font-size=\\'14\\'>Foto</text></svg>'">
            <div class="photo-watermark-overlay">${this.escapeHtml(watermarkText)}</div>
            <div class="photo-selected-badge">✓ Terpilih</div>
            <button type="button" class="photo-zoom-btn" onclick="event.stopPropagation(); PortalApp.openLightbox(${index})" title="Perbesar Layar Penuh">🔍</button>
          </div>

          <div class="photo-card-body">
            <div class="photo-info-top">
              <span class="photo-file-name" title="${this.escapeHtml(photo.name)}">${this.escapeHtml(photo.name)}</span>
            </div>

            ${note ? `
              <div class="photo-note-preview" onclick="PortalApp.openNoteModalByKey('${this.escapeHtml(photoKey)}')" title="Klik untuk edit catatan">
                📝 <strong>Catatan:</strong> ${this.escapeHtml(note)}
              </div>
            ` : ''}

            <div class="photo-card-actions">
              <button type="button" class="btn-select-photo" onclick="PortalApp.togglePhotoSelectionByIndex(${index})">
                ${isSelected ? '✓ Terpilih' : '+ Pilih Foto'}
              </button>
              <button type="button" class="btn-note-photo ${note ? 'has-note' : ''}" onclick="PortalApp.openNoteModalByKey('${this.escapeHtml(photoKey)}')" title="Catatan edit khusus untuk foto ini">
                📝
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  updateTabCounters() {
    const allCount = this.drivePhotos.length;
    let selectedCount = 0;
    this.drivePhotos.forEach(p => {
      if (this.isPhotoSelected(p)) selectedCount++;
    });
    const unselectedCount = Math.max(0, allCount - selectedCount);

    const elAll = document.getElementById('tab-count-all');
    const elSelected = document.getElementById('tab-count-selected');
    const elUnselected = document.getElementById('tab-count-unselected');

    if (elAll) elAll.textContent = allCount;
    if (elSelected) elSelected.textContent = selectedCount;
    if (elUnselected) elUnselected.textContent = unselectedCount;
  },

  // --- SELECTION TOGGLE & QUOTA ENFORCEMENT ---
  togglePhotoSelectionByIndex(index) {
    const visiblePhotos = this.getVisiblePhotos();
    const photo = visiblePhotos[index];
    if (photo) {
      this.togglePhotoSelection(photo);
    }
  },

  togglePhotoSelection(photo) {
    const key = this.getPhotoKey(photo);
    const isSelected = this.isPhotoSelected(photo);

    if (isSelected) {
      // Remove from selection
      this.selectedPhotos = this.selectedPhotos.filter(item => item !== key && item !== photo.id && item !== photo.name);
      this.markUnsaved();
    } else {
      // Check quota
      if (this.selectedPhotos.length >= this.selectionQuota) {
        alert(`Batas kuota pemilihan paket Anda adalah ${this.selectionQuota} foto.\nSilakan batalkan pilihan salah satu foto terlebih dahulu sebelum memilih foto baru.`);
        return;
      }
      this.selectedPhotos.push(key);
      this.markUnsaved();
    }

    this.renderQuota();
    this.renderGallery();
    this.renderChips();
  },

  renderQuota() {
    const quotaText = document.getElementById('quota-text');
    const quotaBar = document.getElementById('quota-progress-bar');
    const stickyText = document.getElementById('sticky-quota-text');
    const stickyBar = document.getElementById('portal-sticky-bar');

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

    // Sticky bar
    if (stickyBar) {
      stickyBar.style.display = (count > 0 || this.hasUnsavedChanges) ? 'flex' : 'none';
      if (stickyText) {
        stickyText.textContent = `${count} / ${quota} Foto Terpilih ${remaining === 0 ? ' (Penuh)' : ''}`;
      }
    }
  },

  // --- LIGHTBOX CONTROLS ---
  openLightbox(index) {
    const visiblePhotos = this.getVisiblePhotos();
    if (index < 0 || index >= visiblePhotos.length) return;

    this.lightboxIndex = index;
    const modal = document.getElementById('lightbox-modal');
    if (modal) {
      modal.style.display = 'flex';
      this.updateLightboxState();
    }
  },

  closeLightbox() {
    const modal = document.getElementById('lightbox-modal');
    if (modal) {
      modal.style.display = 'none';
    }
    this.lightboxIndex = null;
  },

  navigateLightbox(dir) {
    const visiblePhotos = this.getVisiblePhotos();
    if (visiblePhotos.length === 0 || this.lightboxIndex === null) return;

    let newIndex = this.lightboxIndex + dir;
    if (newIndex < 0) newIndex = visiblePhotos.length - 1;
    if (newIndex >= visiblePhotos.length) newIndex = 0;

    this.lightboxIndex = newIndex;
    this.updateLightboxState();
  },

  updateLightboxState() {
    const visiblePhotos = this.getVisiblePhotos();
    if (this.lightboxIndex === null || !visiblePhotos[this.lightboxIndex]) return;

    const photo = visiblePhotos[this.lightboxIndex];
    const isSelected = this.isPhotoSelected(photo);
    const key = this.getPhotoKey(photo);
    const note = this.photoNotes[key] || '';

    const img = document.getElementById('lightbox-image');
    const counter = document.getElementById('lightbox-counter');
    const filename = document.getElementById('lightbox-filename');
    const selectBtn = document.getElementById('lightbox-select-btn');
    const noteDisplay = document.getElementById('lightbox-note-display');

    const previewUrl = photo.previewUrl || `https://lh3.googleusercontent.com/d/${photo.id}=s1600`;
    if (img) img.src = previewUrl;

    const watermarkEl = document.getElementById('lightbox-watermark');
    if (watermarkEl) {
      watermarkEl.textContent = (this.studio && this.studio.studioName) ? `PREVIEW • ${this.studio.studioName}` : 'PREVIEW ONLY';
    }

    if (counter) counter.textContent = `Foto ${this.lightboxIndex + 1} dari ${visiblePhotos.length}`;
    if (filename) filename.textContent = photo.name || 'Foto';

    if (noteDisplay) {
      noteDisplay.textContent = note ? `📝 Catatan: ${note}` : '';
    }

    if (selectBtn) {
      if (isSelected) {
        selectBtn.className = 'btn btn-secondary btn-sm';
        selectBtn.textContent = '✕ Batalkan Pilihan';
      } else {
        selectBtn.className = 'btn btn-primary btn-sm';
        selectBtn.textContent = '✓ Pilih Foto Ini';
      }
    }
  },

  // --- PER-PHOTO NOTE MODAL ---
  openNoteModalByKey(photoKey) {
    let photo = this.drivePhotos.find(p => this.getPhotoKey(p) === photoKey || p.name === photoKey || p.id === photoKey);
    if (!photo) {
      photo = { name: photoKey, id: photoKey, thumbnailUrl: '' };
    }
    this.openNoteModal(photo);
  },

  openNoteModal(photo) {
    this.currentNotePhoto = photo;
    const modal = document.getElementById('note-modal');
    const nameEl = document.getElementById('note-photo-name');
    const thumbEl = document.getElementById('note-photo-thumb');
    const textarea = document.getElementById('note-modal-textarea');

    const key = this.getPhotoKey(photo);
    if (nameEl) nameEl.textContent = photo.name || key;
    if (thumbEl) {
      thumbEl.src = photo.thumbnailUrl || (photo.id ? `https://lh3.googleusercontent.com/d/${photo.id}=w600-h600` : '');
    }
    if (textarea) {
      textarea.value = this.photoNotes[key] || '';
      textarea.focus();
    }
    if (modal) modal.style.display = 'flex';
  },

  closeNoteModal() {
    const modal = document.getElementById('note-modal');
    if (modal) modal.style.display = 'none';
    this.currentNotePhoto = null;
  },

  saveNoteModal() {
    if (!this.currentNotePhoto) return;
    const key = this.getPhotoKey(this.currentNotePhoto);
    const textarea = document.getElementById('note-modal-textarea');
    const noteText = textarea ? textarea.value.trim() : '';

    if (noteText) {
      this.photoNotes[key] = noteText;
      // If photo not selected yet, suggest auto-selecting it
      if (!this.isPhotoSelected(this.currentNotePhoto) && this.selectedPhotos.length < this.selectionQuota) {
        this.selectedPhotos.push(key);
      }
    } else {
      delete this.photoNotes[key];
    }

    this.markUnsaved();
    this.closeNoteModal();
    this.renderQuota();
    this.renderGallery();
    this.renderChips();
    if (this.lightboxIndex !== null) {
      this.updateLightboxState();
    }
  },

  // --- MANUAL CHIPS LOGIC & SYNC ---
  renderChips() {
    const container = document.getElementById('chips-container');
    const input = document.getElementById('chip-input');
    const addBtn = document.getElementById('btn-add-chip');

    const count = this.selectedPhotos.length;
    const quota = this.selectionQuota;

    if (input && addBtn) {
      if (count >= quota) {
        input.disabled = true;
        input.placeholder = 'Kuota maksimal telah tercapai.';
        addBtn.disabled = true;
      } else {
        input.disabled = false;
        input.placeholder = 'Ketik nomor foto (misal: 023 atau IMG_023)...';
        addBtn.disabled = false;
      }
    }

    if (!container) return;
    if (count === 0) {
      container.innerHTML = '<span class="chip-empty-placeholder">Belum ada foto yang dipilih.</span>';
      return;
    }

    container.innerHTML = this.selectedPhotos.map((photo, index) => {
      const note = this.photoNotes[photo] || '';
      return `
        <div class="photo-chip">
          <span>${this.escapeHtml(photo)}</span>
          ${note ? `<span title="${this.escapeHtml(note)}" style="color: #fbbf24; cursor: pointer;" onclick="PortalApp.openNoteModalByKey('${this.escapeHtml(photo)}')">📝</span>` : ''}
          <span class="chip-remove" onclick="PortalApp.removeChip(${index})" title="Hapus foto ini">&times;</span>
        </div>
      `;
    }).join('');
  },

  addCurrentManualInput() {
    const input = document.getElementById('chip-input');
    if (!input || !input.value.trim()) return;

    let val = input.value.trim().replace(/^,+|,+$/g, '');
    if (!val) return;

    if (/^\d+$/.test(val)) {
      val = 'IMG_' + val.padStart(4, '0');
    }

    if (this.selectedPhotos.includes(val)) {
      alert(`Nomor foto "${val}" sudah ada di dalam daftar pilihan.`);
      input.value = '';
      return;
    }

    if (this.selectedPhotos.length >= this.selectionQuota) {
      alert(`Batas kuota pemilihan paket Anda adalah ${this.selectionQuota} foto.`);
      return;
    }

    this.selectedPhotos.push(val);
    input.value = '';
    this.markUnsaved();
    this.renderQuota();
    this.renderGallery();
    this.renderChips();
  },

  removeChip(index) {
    if (index >= 0 && index < this.selectedPhotos.length) {
      const removed = this.selectedPhotos.splice(index, 1)[0];
      this.markUnsaved();
      this.renderQuota();
      this.renderGallery();
      this.renderChips();
    }
  },

  promptPastePhotos() {
    const count = this.selectedPhotos.length;
    const quota = this.selectionQuota;
    const remaining = quota - count;

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

    this.markUnsaved();
    this.renderQuota();
    this.renderGallery();
    this.renderChips();
    alert(`Berhasil menambahkan ${added} foto.`);
  },

  markUnsaved() {
    this.hasUnsavedChanges = true;
    const statusMsg = document.getElementById('save-status-msg');
    const unsavedBadge = document.getElementById('sticky-unsaved-badge');

    if (statusMsg) {
      statusMsg.textContent = '⚠️ Ada pilihan/catatan belum disimpan. Klik tombol Simpan di bawah.';
      statusMsg.style.color = '#e3b341';
    }
    if (unsavedBadge) unsavedBadge.style.display = 'inline-block';
  },

  async savePhotoSelection() {
    const saveBtn = document.getElementById('btn-save-selection');
    const stickySaveBtn = document.getElementById('btn-sticky-save');
    const statusMsg = document.getElementById('save-status-msg');
    const unsavedBadge = document.getElementById('sticky-unsaved-badge');

    try {
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Menyimpan...';
      }
      if (stickySaveBtn) {
        stickySaveBtn.disabled = true;
        stickySaveBtn.textContent = 'Menyimpan...';
      }

      const res = await fetch(`/api/portal/${this.projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedPhotos: this.selectedPhotos,
          photoNotes: this.photoNotes
        })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan pilihan foto.');
      }

      this.hasUnsavedChanges = false;
      if (statusMsg) {
        statusMsg.textContent = '✅ Pilihan foto dan catatan Anda berhasil disimpan dan dikirim ke fotografer!';
        statusMsg.style.color = '#3fb950';
      }
      if (unsavedBadge) unsavedBadge.style.display = 'none';

      // Show confirmation modal with instant WhatsApp notify button
      const confirmModal = document.getElementById('modal-saved-confirm');
      const confirmDesc = document.getElementById('saved-confirm-desc');
      const notifyWaBtn = document.getElementById('btn-saved-notify-wa');

      if (confirmDesc) {
        confirmDesc.textContent = `Pilihan ${this.selectedPhotos.length} foto Anda dan instruksi khusus telah tersimpan di sistem fotografer.`;
      }

      if (notifyWaBtn) {
        const s = this.studio || {};
        if (s.phone) {
          let cleanPhone = s.phone.replace(/\D/g, '').replace(/^0/, '62');
          const origin = window.location.origin;
          const msg = encodeURIComponent(`Halo ${s.studioName || 'Kak'}! 👋\nSaya *${this.project.clientName}* sudah selesai memilih *${this.selectedPhotos.length} foto* untuk sesi *${this.project.title}* di portal klien:\n👉 ${origin}/portal?id=${this.projectId}\n\nMohon dicek ya Kak, terima kasih!`);
          notifyWaBtn.href = `https://wa.me/${cleanPhone}?text=${msg}`;
          notifyWaBtn.style.display = 'inline-flex';
        } else {
          notifyWaBtn.style.display = 'none';
        }
      }

      if (confirmModal) {
        confirmModal.style.display = 'flex';
      }
    } catch (err) {
      alert(err.message);
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 Simpan Pilihan & Catatan Foto';
      }
      if (stickySaveBtn) {
        stickySaveBtn.disabled = false;
        stickySaveBtn.textContent = '💾 Simpan Pilihan Foto';
      }
    }
  },

  // --- DIGITAL INVOICE / RECEIPT MODAL ---
  openInvoiceModal() {
    const p = this.project;
    const s = this.studio;
    const modal = document.getElementById('portal-invoice-modal');
    const content = document.getElementById('portal-invoice-content');
    if (!modal || !content || !p) return;

    const total = Number(p.totalPrice) || 0;
    const dp = Number(p.dpAmount) || 0;
    const balance = total - dp;
    const pkgPrice = Number(p.packagePrice) || 0;
    const addOns = Number(p.addOnsPrice) || 0;

    content.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #222; padding-bottom: 14px; margin-bottom: 16px;">
        <div>
          <h2 style="font-size: 20px; font-weight: 800; color: #111; margin: 0;">${this.escapeHtml(s.studioName || 'TEN Photography')}</h2>
          <div style="font-size: 12px; color: #555; margin-top: 2px;">
            ${s.phone ? `WA/Telp: ${this.escapeHtml(s.phone)}<br>` : ''}
            ${s.instagram ? `Instagram: ${this.escapeHtml(s.instagram)}` : ''}
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 16px; font-weight: 800; color: #111; text-transform: uppercase;">KWITANSI PEMBAYARAN</div>
          <div style="font-size: 12px; color: #555; margin-top: 2px;">No: INV-${p.id.substring(0, 8).toUpperCase()}</div>
          <div style="font-size: 12px; color: #555;">Tgl: ${this.formatDate(p.date || new Date().toISOString())}</div>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; margin-bottom: 18px; font-size: 13px; line-height: 1.5;">
        <div>
          <div style="color: #666; font-size: 11px; text-transform: uppercase; font-weight: 700;">Diberikan Kepada (Klien):</div>
          <div style="font-weight: 700; color: #111; font-size: 15px;">${this.escapeHtml(p.clientName)}</div>
          <div style="color: #555;">${this.escapeHtml(p.clientPhone || '')}</div>
        </div>
        <div style="text-align: right;">
          <div style="color: #666; font-size: 11px; text-transform: uppercase; font-weight: 700;">Detail Sesi Foto:</div>
          <div style="font-weight: 600; color: #111;">${this.escapeHtml(p.title)}</div>
          <div style="color: #555;">${this.escapeHtml(p.location || '-')}</div>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 13px;">
        <thead>
          <tr style="background: #f4f4f5; border-top: 1px solid #ddd; border-bottom: 1px solid #ddd;">
            <th style="text-align: left; padding: 8px 10px; color: #333;">Deskripsi Layanan</th>
            <th style="text-align: right; padding: 8px 10px; color: #333;">Jumlah</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px;">
              <strong>Paket Foto: ${this.escapeHtml(p.category)} ${p.packageName ? `(${this.escapeHtml(p.packageName)})` : ''}</strong>
              <div style="font-size: 11px; color: #666;">Termasuk ${p.selectionQuota || 20} foto pilihan hasil retouch & color grading</div>
            </td>
            <td style="padding: 10px; text-align: right; font-weight: 600;">${this.formatIDR(pkgPrice || total)}</td>
          </tr>
          ${addOns > 0 ? `
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 10px;">Tambahan Layanan / Add-ons</td>
              <td style="padding: 10px; text-align: right; font-weight: 600;">${this.formatIDR(addOns)}</td>
            </tr>
          ` : ''}
          <tr style="background: #fafafa; font-weight: 700;">
            <td style="padding: 10px; text-align: right;">Total Nilai Sesi:</td>
            <td style="padding: 10px; text-align: right;">${this.formatIDR(total)}</td>
          </tr>
          <tr style="color: #2563eb;">
            <td style="padding: 8px 10px; text-align: right;">Uang Muka (DP) Terbayar:</td>
            <td style="padding: 8px 10px; text-align: right; font-weight: 600;">- ${this.formatIDR(dp)}</td>
          </tr>
          <tr style="border-top: 2px solid #222; font-size: 15px; font-weight: 800;">
            <td style="padding: 10px; text-align: right;">Sisa Tagihan:</td>
            <td style="padding: 10px; text-align: right; color: ${balance <= 0 ? '#16a34a' : '#dc2626'};">
              ${balance <= 0 ? 'LUNAS (Rp 0) ✅' : this.formatIDR(balance)}
            </td>
          </tr>
        </tbody>
      </table>

      ${s.bankName && s.bankAccount ? `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; font-size: 12px; margin-bottom: 16px;">
          <strong>Rekening Pembayaran:</strong><br>
          Bank: ${this.escapeHtml(s.bankName)} | No. Rek: <strong>${this.escapeHtml(s.bankAccount)}</strong> | a.n ${this.escapeHtml(s.bankHolder || s.studioName)}
        </div>
      ` : ''}

      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 24px; font-size: 12px; color: #555;">
        <div>
          <em>Terima kasih telah mempercayakan momen Anda kepada ${this.escapeHtml(s.studioName || 'kami')}!</em>
        </div>
        <div style="text-align: center; width: 180px;">
          <div style="margin-bottom: 40px;">Hormat Kami,</div>
          <div style="font-weight: 700; color: #111; border-top: 1px solid #888; padding-top: 4px;">${this.escapeHtml(s.studioName || 'TEN Photography')}</div>
        </div>
      </div>
    `;

    modal.style.display = 'flex';
  },

  closeInvoiceModal() {
    const modal = document.getElementById('portal-invoice-modal');
    if (modal) modal.style.display = 'none';
  },

  // --- HELPERS ---
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

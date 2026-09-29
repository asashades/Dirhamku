// ============================================================
// APP UPDATE CHECKER - COMPREHENSIVE
// ============================================================
const APP_VERSION = '5.0.1';
const UPDATE_COUNTDOWN_SECONDS = 5;

let _updatePending = null;
let _updateSkipped = localStorage.getItem('update_skipped_version');
let _autoUpdateTimer = null;
let _currentLatestVersion = null;

const updateManager = {
    // Compare version strings (e.g., "5.1" > "5.0")
    compareVersions: (current, latest) => {
        const c = current.split('.').map(Number);
        const l = latest.split('.').map(Number);
        if (l[0] !== c[0]) return l[0] - c[0];
        if (l[1] !== c[1]) return l[1] - c[1];
        return 0;
    },

    // Show snackbar toast
    showSnackbar: (message, type = 'info', duration = 4000) => {
        const container = document.getElementById('snackbarContainer');
        if (!container) return;

        const id = 'snack_' + Date.now();
        const bgClass = type === 'success' ? 'bg-success' : type === 'error' ? 'bg-danger' : 'bg-primary';
        const icon = type === 'success' ? 'ph-check-circle' : type === 'error' ? 'ph-warning-circle' : 'ph-info';

        const html = `<div id="${id}" class="pointer-events-auto bg-white rounded-xl shadow-2xl border border-gray-100 px-4 py-3 flex items-center gap-3 w-full animate-[fadeIn_0.3s_ease-out]">
            <i class="ph-fill ${icon} ${bgClass.replace('bg-', 'text-')} text-lg"></i>
            <p class="text-sm font-medium text-gray-700 flex-1">${message}</p>
            <button onclick="document.getElementById('${id}').remove()" class="text-gray-400 hover:text-gray-600">
                <i class="ph ph-x"></i>
            </button>
        </div>`;

        container.insertAdjacentHTML('beforeend', html);
        setTimeout(() => document.getElementById(id)?.remove(), duration);
    },

    // Update version status in Settings
    updateVersionStatusUI: function(current, latest, isUpdateAvailable) {
        const statusEl = document.getElementById('updateStatusBadge');
        if (!statusEl) return;

        if (isUpdateAvailable) {
            statusEl.className = 'px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-700';
            statusEl.innerHTML = `<i class="ph ph-arrow-up mr-0.5"></i>v${latest} tersedia`;
        } else {
            statusEl.className = 'px-2 py-0.5 rounded-full text-[9px] font-bold bg-green-100 text-green-700';
            statusEl.innerHTML = `<i class="ph ph-check mr-0.5"></i>Sudah terbaru`;
        }
    },

    // Show update banner with countdown
    showUpdateBanner: function(version, changelog, isMandatory = false) {
        const banner = document.getElementById('updateBanner');
        const versionEl = document.getElementById('updateBannerVersion');
        const changelogEl = document.getElementById('updateBannerChangelog');
        const progressBar = document.getElementById('updateProgressBar');
        const progressText = document.getElementById('updateProgressText');
        const updateBtn = document.getElementById('updateBannerBtn');
        const skipBtn = document.getElementById('updateBannerSkip');

        if (!banner) return;

        // Update content
        versionEl.textContent = `v${version}`;
        if (changelogEl) {
            changelogEl.textContent = changelog?.id || 'Update baru tersedia!';
        }
        if (progressBar) progressBar.style.width = '0%';
        if (progressText) progressText.textContent = `Update otomatis dalam ${UPDATE_COUNTDOWN_SECONDS} detik...`;

        // Show/hide skip button
        if (skipBtn) {
            skipBtn.classList.toggle('hidden', isMandatory);
        }

        // Update button text
        if (updateBtn) {
            updateBtn.innerHTML = `<i class="ph ph-rocket mr-1"></i>Update Sekarang`;
        }

        // Show banner
        banner.classList.remove('-translate-y-full', 'bg-gradient-to-r', 'from-green-600', 'to-teal-600');
        banner.classList.add('pointer-events-auto');

        if (isMandatory) {
            banner.querySelector('div > div').classList.add('from-red-600', 'to-red-700');
            banner.querySelector('div > div').classList.remove('from-primary', 'to-blue-900');
        }

        // Start countdown for auto-update
        let countdown = UPDATE_COUNTDOWN_SECONDS;
        if (!isMandatory) {
            _autoUpdateTimer = setInterval(() => {
                countdown--;
                if (progressText) progressText.textContent = `Update otomatis dalam ${countdown} detik...`;
                if (progressBar) progressBar.style.width = `${((UPDATE_COUNTDOWN_SECONDS - countdown) / UPDATE_COUNTDOWN_SECONDS) * 100}%`;

                if (countdown <= 0) {
                    clearInterval(_autoUpdateTimer);
                    this.performUpdate();
                }
            }, 1000);
        }
    },

    // Cancel auto-update countdown
    cancelAutoUpdate: function() {
        if (_autoUpdateTimer) {
            clearInterval(_autoUpdateTimer);
            _autoUpdateTimer = null;
        }
    },

    // Show modal for mandatory updates
    showUpdateModal: function(oldVersion, newVersion, changelog) {
        const modal = document.getElementById('updateModal');
        if (!modal) return;

        document.getElementById('updateModalOldVersion').textContent = 'v' + oldVersion;
        document.getElementById('updateModalNewVersion').textContent = 'v' + newVersion;
        const changelogEl = document.getElementById('updateModalChangelog');
        if (changelogEl) {
            changelogEl.textContent = changelog?.id || 'Update baru tersedia dengan berbagai perbaikan';
        }

        modal.classList.remove('hidden');
    },

    // Perform the actual update
    performUpdate: async function() {
        this.cancelAutoUpdate();

        const banner = document.getElementById('updateBanner');
        const modal = document.getElementById('updateModal');
        const progressBar = document.getElementById('updateProgressBar');
        const progressText = document.getElementById('updateProgressText');
        const updateBtn = document.getElementById('updateBannerBtn');

        if (updateBtn) updateBtn.disabled = true;
        if (progressText) progressText.textContent = 'Mempersiapkan update...';
        if (progressBar) progressBar.style.width = '20%';

        try {
            // Hide modal if visible
            if (modal) modal.classList.add('hidden');

            // Step 1: Unregister old service workers
            if (progressText) progressText.textContent = 'Membersihkan cache lama...';
            if (progressBar) progressBar.style.width = '40%';

            const regs = await navigator.serviceWorker.getRegistrations();
            for (let reg of regs) {
                await reg.unregister();
            }

            // Step 2: Clear all caches
            if (progressText) progressText.textContent = 'Menghapus cache...';
            if (progressBar) progressBar.style.width = '60%';

            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));

            // Step 3: Clear localStorage (except important data)
            if (progressText) progressText.textContent = 'Menyegarkan data...';
            if (progressBar) progressBar.style.width = '80%';

            // Step 4: Reload with force refresh
            if (progressText) progressText.textContent = 'Memuat versi baru...';
            if (progressBar) progressBar.style.width = '100%';

            // Small delay for UX
            await new Promise(resolve => setTimeout(resolve, 500));

            // Force reload bypassing cache
            window.location.reload(true);

        } catch (e) {
            console.error('Update failed:', e);
            this.cancelAutoUpdate();
            if (progressText) progressText.textContent = 'Update gagal!';
            if (progressBar) progressBar.classList.add('bg-red-500');
            if (updateBtn) {
                updateBtn.disabled = false;
                updateBtn.innerHTML = `<i class="ph ph-warning mr-1"></i>Coba Lagi`;
            }
            this.showSnackbar('Update gagal. Silakan coba lagi.', 'error', 6000);
        }
    },

    // Skip this version
    skipVersion: function(version) {
        this.cancelAutoUpdate();
        localStorage.setItem('update_skipped_version', version);
        _updateSkipped = version;

        const banner = document.getElementById('updateBanner');
        if (banner) {
            banner.classList.add('-translate-y-full');
            banner.classList.remove('pointer-events-auto');
        }

        this.showSnackbar(`Update v${version} dilewati`, 'info', 3000);
    },

    // Main check function - called on app load
    checkForUpdate: async function(showStatus = false) {
        // Skip if offline
        if (!navigator.onLine) {
            if (showStatus) this.showSnackbar('Offline - tidak bisa cek update', 'info', 3000);
            return;
        }

        try {
            const response = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store' });
            if (!response.ok) {
                if (showStatus) this.showSnackbar('Tidak ada info update', 'info', 3000);
                return;
            }

            const data = await response.json();
            const latestVersion = data.version;
            _currentLatestVersion = latestVersion;

            // Update status UI in Settings
            this.updateVersionStatusUI(APP_VERSION, latestVersion, this.compareVersions(APP_VERSION, latestVersion) < 0);

            // No update needed
            if (this.compareVersions(APP_VERSION, latestVersion) >= 0) {
                if (showStatus) this.showSnackbar(`App sudah versi terbaru (v${APP_VERSION})`, 'success', 3000);
                return;
            }

            // Check if user skipped this version (ignore skip if manual check from settings)
            if (!showStatus && _updateSkipped === latestVersion) {
                return;
            }

            // Check mandatory - if current version < min_version, force update
            if (data.min_version && this.compareVersions(APP_VERSION, data.min_version) < 0) {
                // Mandatory update - show modal instead of banner
                this.showUpdateModal(APP_VERSION, latestVersion, data.changelog);
                return;
            }

            // Optional update - show banner with auto-update countdown
            // Also stop auto-update timer if manually checking so it doesn't suddenly refresh on them
            if (showStatus) {
                this.cancelAutoUpdate();
            }
            
            _updatePending = { version: latestVersion, changelog: data.changelog, isMandatory: false };
            await this.showUpdateBanner(latestVersion, data.changelog, false);
            
            // If checking manually, we already cancelled auto-update above. Let's cancel it again just to be safe, 
            // since showUpdateBanner might have restarted it if isMandatory=false
            if (showStatus) {
                this.cancelAutoUpdate();
                const progressText = document.getElementById('updateProgressText');
                const progressBar = document.getElementById('updateProgressBar');
                if (progressText) progressText.textContent = 'Menunggu konfirmasi...';
                if (progressBar) progressBar.style.width = '100%';
            }

        } catch (e) {
            console.warn('Update check failed:', e);
            if (showStatus) this.showSnackbar('Gagal cek update', 'error', 3000);
        }
    }
};

// ============================================================
// DIRHAMKU 5.0 - APP LOGIC
// ============================================================

const firebaseConfig = {
    apiKey: "AIzaSyBsVunf9Qo7lnTVPrNO-QMj-3KEqWnYKAs",
    authDomain: "dirhamku.firebaseapp.com",
    projectId: "dirhamku",
    storageBucket: "dirhamku.firebasestorage.app",
    messagingSenderId: "253744245667",
    appId: "1:253744245667:web:b8cfca196eb03a56fe8816",
    measurementId: "G-K0G28QSTXG"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Enable offline persistence with modern cache settings
db.settings({
    cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
    experimentalAutoDetectLongPolling: true
});
// Note: multi-tab persistence via enablePersistence is auto-enabled with cache settings in compat SDK
db.enablePersistence({ synchronizeTabs: true }).catch(err => {
    if (err.code === 'failed-precondition') {
        console.warn('Persistence failed: multiple tabs open');
    } else if (err.code === 'unimplemented') {
        console.warn('Persistence not available in this browser');
    }
});

// ============================================================
// MANDATORY UPDATE CHECK - runs before app initialization
// ============================================================
(function checkMandatoryUpdate() {
    // Only check on page load (not after login)
    fetch('/version.json?t=' + Date.now(), { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
            if (!data) return;
            const latestVersion = data.version;
            if (updateManager.compareVersions(APP_VERSION, latestVersion) < 0 &&
                data.min_version && updateManager.compareVersions(APP_VERSION, data.min_version) < 0) {
                // Force update detected - show modal immediately
                updateManager.showUpdateModal(APP_VERSION, latestVersion, data.changelog);
            }
        })
        .catch(() => {});
})();

// ============================================================
// SOUND ENGINE (Web Audio API — no external files)
// ============================================================
const SFX = (() => {
    let ctx = null;
    function getCtx() {
        if (!ctx) {
            try {
                ctx = new (window.AudioContext || window.webkitAudioContext)();
            } catch(e) {
                return null;
            }
        }
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
    }

    // Initialize AudioContext on first user interaction to comply with autoplay policy
    function initOnGesture() {
        if (ctx) return;
        const handler = () => {
            getCtx();
            document.removeEventListener('click', handler);
            document.removeEventListener('touchstart', handler);
            document.removeEventListener('keydown', handler);
        };
        document.addEventListener('click', handler, { once: true });
        document.addEventListener('touchstart', handler, { once: true });
        document.addEventListener('keydown', handler, { once: true });
    }
    // Schedule lazy init
    initOnGesture();
    function isEnabled() {
        return localStorage.getItem('sfx_enabled') !== 'false';
    }

    // Bell chime helper — single clean bell tone
    function bell(ac, freq, startTime, vol, decay) {
        const osc  = ac.createOscillator();
        const osc2 = ac.createOscillator(); // slight detuned partial for warmth
        const gain = ac.createGain();
        osc.type  = 'sine';
        osc2.type = 'sine';
        osc.frequency.value  = freq;
        osc2.frequency.value = freq * 2.756; // inharmonic upper partial (bell character)
        const g2 = ac.createGain();
        g2.gain.value = 0.15; // upper partial quieter
        osc2.connect(g2); g2.connect(gain);
        osc.connect(gain);
        gain.connect(ac.destination);
        // Fast attack, natural exponential decay — like a struck bell
        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.linearRampToValueAtTime(vol, startTime + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + decay);
        osc.start(startTime);  osc.stop(startTime + decay + 0.05);
        osc2.start(startTime); osc2.stop(startTime + decay + 0.05);
    }

    // Notification bell: two-tone chime (high → higher), clean & pleasant
    function coin() {
        if (!isEnabled()) return;
        try {
            const ac  = getCtx();
            const now = ac.currentTime;
            // Two chime hits — interval of a major third, iPhone-like
            bell(ac, 1318.5, now,        0.28, 0.7);  // E6
            bell(ac, 1567.9, now + 0.16, 0.22, 0.9);  // G6
        } catch(e) {}
    }

    // Page flip: short filtered white-noise whoosh
    function page() {
        if (!isEnabled()) return;
        try {
            const ac = getCtx();
            const now = ac.currentTime;
            const bufSize = ac.sampleRate * 0.12;
            const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);
            const src = ac.createBufferSource();
            src.buffer = buf;
            const filter = ac.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(3000, now);
            filter.frequency.linearRampToValueAtTime(800, now + 0.1);
            filter.Q.value = 0.8;
            const gain = ac.createGain();
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
            src.connect(filter); filter.connect(gain); gain.connect(ac.destination);
            src.start(now); src.stop(now + 0.13);
        } catch(e) {}
    }

    // WhatsApp-style receive bubble: soft low-mid pop
    function bubble() {
        if (!isEnabled()) return;
        try {
            const ac = getCtx();
            const now = ac.currentTime;
            // Sine pop — rounded & soft
            const osc = ac.createOscillator();
            const gain = ac.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(620, now);
            osc.frequency.exponentialRampToValueAtTime(380, now + 0.07);
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.linearRampToValueAtTime(0.22, now + 0.007);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
            osc.connect(gain); gain.connect(ac.destination);
            osc.start(now); osc.stop(now + 0.13);
        } catch(e) {}
    }

    return { coin, page, bubble, isEnabled };
})();

// ============================================================
// DEFAULT VOCABULARY (HARDCODED - SOURCE OF TRUTH)
// ============================================================
const DEFAULT_EXPENSE_KEYWORDS = [
    'pengeluaran', 'expense', 'beli', 'bayar', 'transaksi', 'keluar', 'keluar duit', 'keluar uang',
    'kepake', 'kepakai', 'dipake', 'dipakai', 'habis', 'habis buat', 'kepake buat', 'dipake buat',
    'jajan', 'makan', 'ngopi', 'beli makan', 'beli kopi', 'belanja', 'checkout', 'order', 'pesan',
    'pesen', 'beli barang', 'isi bensin', 'bensin', 'parkir', 'gojek', 'grab', 'ojek', 'tol',
    'tiket', 'bayar listrik', 'bayar air', 'bayar wifi', 'bayar kos', 'bayar kontrakan',
    'bayar cicilan', 'bayar utang', 'bayar tagihan', 'minum', 'tagihan', 'pulsa', 'titip',
    'cicilan', 'kos', 'dana keluar', 'cash out', 'add expense', 'listrik'
];

const DEFAULT_INCOME_KEYWORDS = [
    'pemasukan', 'income', 'tabungan', 'ditabungan', 'gaji', 'gajian', 'payday', 'bonus', 'thr',
    'komisi', 'fee', 'honor', 'upah', 'tip', 'tips', 'pendapatan', 'hasil', 'dapet', 'dapat',
    'dapet duit', 'dapat duit', 'masuk', 'masuk uang', 'uang masuk', 'masuk duit', 'transfer masuk',
    'ada transfer', 'ada uang masuk', 'nambah', 'bertambah', 'cair', 'cair dana', 'refund',
    'refund masuk', 'cashback', 'profit', 'untung', 'hasil jual', 'jual', 'laku', 'closing',
    'tombok', 'penerimaan', 'dana masuk', 'cash in', 'add income', 'dikasih', 'nemu uang',
    'freelance', 'rezeki', 'rejeki', 'angpao', 'nemu', 'narik duit', 'nabung'
];

const DEFAULT_CATEGORY_MAP = {
    // Food & Beverage
    "food": "Food", "makan": "Food", "bakso": "Food", "ayam": "Food", "nasi": "Food",
    "sate": "Food", "mie": "Food", "indomie": "Food", "soto": "Food", "roti": "Food",
    "buah": "Food", "sayur": "Food", "lauk": "Food", "mcd": "Food", "kfc": "Food",
    "pizza": "Food", "burger": "Food", "warteg": "Food", "resto": "Food", 
    "restoran": "Food", "cafe": "Food", "breakfast": "Food", "lunch": "Food", 
    "dinner": "Food", "sarapan": "Food",
    
    // Snack & Drink
    "drink": "Snack & Drink", "coffee": "Snack & Drink", "kopi": "Snack & Drink",
    "jajan": "Snack & Drink", "snack": "Snack & Drink", "es": "Snack & Drink",
    "teh": "Snack & Drink", "juice": "Snack & Drink", "bubble": "Snack & Drink",
    "boba": "Snack & Drink", "starbucks": "Snack & Drink", "minum": "Snack & Drink",
    // Transport
    "transport": "Transport", "bensin": "Transport", "gojek": "Transport",
    "grab": "Transport", "tol": "Transport", "parkir": "Transport", "ojol": "Transport",
    "uber": "Transport", "taxi": "Transport", "taksi": "Transport", "kereta": "Transport",
    "bus": "Transport", "angkot": "Transport", "mrt": "Transport", "lrt": "Transport",
    "bbm": "Transport", "solar": "Transport", "pertamax": "Transport",
    // Bills & Utilities
    "bills": "Bills", "internet": "Bills", "listrik": "Bills", "air": "Bills",
    "wifi": "Bills", "pulsa": "Bills", "token": "Bills", "pdam": "Bills",
    "indihome": "Bills", "telkom": "Bills", "paket": "Bills", "kuota": "Bills",
    // Housing
    "rent": "Housing", "kos": "Housing", "kontrakan": "Housing", "sewa": "Housing",
    "housing": "Housing", "apartemen": "Housing", "rumah": "Housing",
    // Health
    "health": "Health", "obat": "Health", "dokter": "Health", "klinik": "Health",
    "vitamin": "Health", "rs": "Health", "rumahsakit": "Health", "apotek": "Health",
    "farmasi": "Health", "medical": "Health", "periksa": "Health",
    // Education
    "education": "Education", "book": "Education", "buku": "Education", "kursus": "Education",
    "les": "Education", "sekolah": "Education", "kuliah": "Education", "spp": "Education",
    "training": "Education", "seminar": "Education", "workshop": "Education",
    // Shopping
    "shopping": "Shopping", "baju": "Shopping", "belanja": "Shopping", "sepatu": "Shopping",
    "celana": "Shopping", "tas": "Shopping", "skincare": "Shopping", "makeup": "Shopping",
    "kosmetik": "Shopping", "elektronik": "Shopping", "gadget": "Shopping",
    "hp": "Shopping", "laptop": "Shopping", "shopee": "Shopping", "tokped": "Shopping",
    "tokopedia": "Shopping", "lazada": "Shopping", "olshop": "Shopping",
    // Entertainment
    "entertainment": "Entertainment", "nonton": "Entertainment", "bioskop": "Entertainment",
    "game": "Entertainment", "spotify": "Entertainment", "netflix": "Entertainment",
    "youtube": "Entertainment", "disney": "Entertainment", "hiburan": "Entertainment",
    "karaoke": "Entertainment", "rekreasi": "Entertainment", "wisata": "Entertainment",
    "liburan": "Entertainment", "piknik": "Entertainment", "jalan": "Entertainment",
    // Social
    "social": "Social", "sedekah": "Social", "donasi": "Social", "kado": "Social",
    "gift": "Social", "zakat": "Social", "infaq": "Social", "sumbangan": "Social",
    "traktir": "Social",
    // Finance
    "finance": "Finance", "admin": "Finance", "bank": "Finance", "transfer": "Finance",
    "cicilan": "Finance", "kredit": "Finance", "asuransi": "Finance", "pajak": "Finance",
    "tabungan": "Finance", "investasi": "Finance",
    // Others
    "others": "Others", "lain": "Others", "lainnya": "Others",
    // Income types
    "salary": "Salary", "gaji": "Salary", "bonus": "Bonus", "thr": "Bonus",
    "freelance": "Salary", "honor": "Salary", "upah": "Salary", "komisi": "Salary",
    "dividen": "Bonus", "cashback": "Bonus", "refund": "Bonus"
};

const DEFAULT_COMMANDS = {
    'cek_saldo':       ['saldo', 'cek saldo', 'semua saldo', 'berapa saldo'],
    'ringkasan':       ['summary', 'ringkasan', 'rekap', 'laporan bulan ini', 'rekap keuangan', 'pemasukan', 'pengeluaran bulan ini'],
    'health_score':    ['health score', 'skor keuangan', 'financial score', 'skor finansial', 'berapa skor', 'cara improve score', 'ningkatin score'],
    'spending_dna':    ['spending dna', 'tipe belanja', 'dna belanja', 'spending type'],
    'spending_nature': ['spending nature', 'komposisi belanja', 'needs wants must'],
    'weekday_weekend': ['weekday vs weekend', 'weekend vs weekday', 'lebih boros kapan', 'boros weekday', 'boros weekend'],
    'latte_factor':    ['latte factor', 'pengeluaran receh', 'kebiasaan belanja'],
    'dana_darurat':    ['dana darurat', 'emergency fund', 'tabungan darurat', 'cukup dana darurat'],
    'budget_pacing':   ['budget pacing', 'sisa budget', 'pacing budget', 'budget sisa'],
    'kategori':        ['kategori terbesar', 'paling boros', 'top kategori', 'pengeluaran terbesar'],
    'tips_hemat':      ['tips hemat', 'cara hemat', 'hemat bulan ini', 'gimana hemat'],
    'transfer':        ['transfer'],
    'help':            ['help', 'bantu', 'tolong', 'panduan'],
    'tanya':           ['tanya', 'tanya ai']
};

// User custom vocabulary state
let userCustomVocabulary = {
    expense: [],
    income: [],
    categories: {}
};

let userCustomCommands = {};

let CATEGORY_MAP_CLIENT = { ...DEFAULT_CATEGORY_MAP };
let INCOME_CATEGORIES = ['salary', 'gaji', 'bonus', 'thr', 'dividend', 'profit', 'laba', 'penjualan', 'freelance', 'investasi'];

// ============================================================
// VOCABULARY MERGE FUNCTIONS
// ============================================================
function mergeVocabulary() {
    // Merge custom categories into category map (custom wins)
    CATEGORY_MAP_CLIENT = { ...DEFAULT_CATEGORY_MAP };
    for (const [keyword, category] of Object.entries(userCustomVocabulary.categories || {})) {
        CATEGORY_MAP_CLIENT[keyword.toLowerCase()] = category;
    }
}

function buildExpenseRegex() {
    const all = [...DEFAULT_EXPENSE_KEYWORDS, ...(userCustomVocabulary.expense || [])];
    return new RegExp('^\\+|\\b(' + all.join('|') + ')\\b', 'i');
}

function buildIncomeRegex() {
    const all = [...DEFAULT_INCOME_KEYWORDS, ...(userCustomVocabulary.income || [])];
    return new RegExp('^\\+|\\b(' + all.join('|') + ')\\b', 'i');
}

function loadUserVocabulary(profile) {
    userCustomVocabulary = {
        expense: profile.customVocabulary?.expense || [],
        income: profile.customVocabulary?.income || [],
        categories: profile.customVocabulary?.categories || {}
    };
    userCustomCommands = profile.customCommands || {};
    mergeVocabulary();
}

function saveUserVocabulary() {
    if (!currentUser) return;
    const updates = {
        customVocabulary: userCustomVocabulary,
        customCommands: userCustomCommands
    };
    return db.collection('users').doc(currentUser.uid).update(updates);
}

// ============================================================
// CONSTANTS & STATE
// ============================================================
const DEFAULT_MONTHLY_BUDGET = 3000000;

let currentUser = null;
let currentProfile = null;
let accounts = [];
let allTransactions = []; // Cached transactions
let pendingChatTxs = []; // Array of pending transactions for chat confirmation flow
let sessionAccountId = null; // Remembers active wallet for current chat session
let chatMemory = [];
let chatAiMode = false; // false = local-first (default), true = always use AI // Stores last 10 turns of chat history [{role, parts}] for multi-turn AI context
let geminiModelCache = { key: null, models: [], fetchedAt: 0 };
let selectedTxAccountFilter = 'all';
let txCarouselScrollTimer = null;
let activeMonthDate = new Date();

const AVAILABLE_ACC_ICONS = [
    'ph-wallet', 'ph-bank', 'ph-money', 'ph-credit-card', 'ph-coins',
    'ph-device-mobile', 'ph-briefcase', 'ph-piggy-bank', 'ph-handbag', 'ph-star',
    'ph-heart', 'ph-house', 'ph-shopping-bag', 'ph-car', 'ph-airplane-tilt',
    'ph-currency-dollar', 'ph-chart-line-up', 'ph-receipt', 'ph-trophy',
    'ph-shield', 'ph-suitcase', 'ph-graduation-cap', 'ph-key', 'ph-lock',
    'ph-vault', 'ph-cash-register', 'ph-safe', 'ph-gem', 'ph-leaf'
];
const AVAILABLE_ACC_COLORS = [
    '#040720', '#1CBDB3', '#10B981', '#3B82F6', '#6366F1',
    '#8B5CF6', '#F59E0B', '#EF4444', '#F97316', '#D946EF', '#64748B', '#111827'
];

const AVAILABLE_ICONS = [
    // 🍔 Makanan & Minuman
    'ph-hamburger', 'ph-coffee', 'ph-wine', 'ph-fork-knife', 'ph-pizza',
    'ph-beer-bottle', 'ph-cooking-pot', 'ph-ice-cream', 'ph-cake', 'ph-egg',
    // 🚗 Transportasi
    'ph-car', 'ph-bicycle', 'ph-motorcycle', 'ph-airplane-tilt', 'ph-train',
    'ph-bus', 'ph-taxi', 'ph-boat',
    // 🏠 Rumah & Kehidupan
    'ph-house', 'ph-couch', 'ph-lamp', 'ph-wrench', 'ph-bed',
    'ph-toilet', 'ph-broom', 'ph-plug',
    // 👕 Belanja & Fashion
    'ph-basket', 'ph-shopping-bag', 'ph-t-shirt', 'ph-sneaker', 'ph-handbag',
    'ph-watch', 'ph-sunglasses', 'ph-ring',
    // 💊 Kesehatan
    'ph-first-aid', 'ph-heart', 'ph-pill', 'ph-syringe', 'ph-tooth',
    'ph-bandaids', 'ph-hospital', 'ph-stethoscope',
    // 📚 Pendidikan
    'ph-books', 'ph-pencil', 'ph-graduation-cap', 'ph-notebook',
    'ph-chalkboard', 'ph-student', 'ph-article',
    // 🎮 Hiburan
    'ph-game-controller', 'ph-music-notes', 'ph-film-strip', 'ph-television',
    'ph-headphones', 'ph-microphone', 'ph-camera', 'ph-palette', 'ph-video-camera',
    // 💻 Teknologi
    'ph-desktop', 'ph-laptop', 'ph-device-mobile', 'ph-cpu', 'ph-wifi',
    'ph-keyboard', 'ph-printer',
    // 💰 Keuangan
    'ph-money', 'ph-coins', 'ph-piggy-bank', 'ph-chart-line-up',
    'ph-credit-card', 'ph-receipt', 'ph-currency-dollar', 'ph-chart-bar',
    // 🌟 Gaya Hidup
    'ph-scissors', 'ph-baby', 'ph-paw-print', 'ph-gift', 'ph-trophy',
    'ph-medal', 'ph-fire', 'ph-star', 'ph-sun', 'ph-leaf', 'ph-flower',
    // 👥 Sosial
    'ph-users', 'ph-chat', 'ph-phone', 'ph-envelope', 'ph-briefcase',
    'ph-tag', 'ph-lightning', 'ph-globe', 'ph-heart-straight', 'ph-smiley'
];

const AVAILABLE_COLORS = [
    '#EF4444', '#F97316', '#F59E0B', '#10B981', '#14B8A6', '#06B6D4',
    '#3B82F6', '#6366F1', '#8B5CF6', '#D946EF', '#F43F5E', '#64748B'
];

const DEFAULT_CATEGORIES = [
    { id: 'cat_food', name: 'Food', type: 'Expense', icon: 'ph-hamburger', color: '#EF4444', nature: 'wants' },
    { id: 'cat_snack_drink', name: 'Snack & Drink', type: 'Expense', icon: 'ph-coffee', color: '#FCD34D', nature: 'wants' },
    { id: 'cat_transport', name: 'Transport', type: 'Expense', icon: 'ph-car', color: '#F97316', nature: 'needs' },
    { id: 'cat_bills', name: 'Bills', type: 'Expense', icon: 'ph-lightning', color: '#F59E0B', nature: 'must' },
    { id: 'cat_housing', name: 'Housing', type: 'Expense', icon: 'ph-house', color: '#14B8A6', nature: 'must' },
    { id: 'cat_health', name: 'Health', type: 'Expense', icon: 'ph-first-aid', color: '#3B82F6', nature: 'must' },
    { id: 'cat_education', name: 'Education', type: 'Expense', icon: 'ph-books', color: '#8B5CF6', nature: 'needs' },
    { id: 'cat_shopping', name: 'Shopping', type: 'Expense', icon: 'ph-basket', color: '#D946EF', nature: 'wants' },
    { id: 'cat_entertainment', name: 'Entertainment', type: 'Expense', icon: 'ph-game-controller', color: '#F43F5E', nature: 'wants' },
    { id: 'cat_social', name: 'Social', type: 'Expense', icon: 'ph-gift', color: '#64748B', nature: 'wants', exclude_from_budget: true },
    { id: 'cat_salary', name: 'Salary', type: 'Income', icon: 'ph-money', color: '#10B981', nature: null },
    { id: 'cat_bonus', name: 'Bonus', type: 'Income', icon: 'ph-chart-line-up', color: '#06B6D4', nature: null }
];

let customCategories = [];

// ============================================================
// AUTH FUNCTIONS
// ============================================================
function getAuthErrorMessage(code) {
    const messages = {
        'auth/user-not-found': 'Akun tidak ditemukan',
        'auth/wrong-password': 'Password salah',
        'auth/email-already-in-use': 'Email sudah terdaftar',
        'auth/weak-password': 'Password minimal 6 karakter',
        'auth/invalid-email': 'Format email tidak valid'
    };
    return messages[code] || 'Terjadi kesalahan.';
}

function showAuthError(id, msg, isError=true) {
    const el = document.getElementById(id);
    el.textContent = msg; el.classList.remove('hidden');
    el.className = `text-xs mt-3 text-center ${isError ? 'text-red-500' : 'text-green-500'}`;
}

function hideAuthErrors() { document.getElementById('loginError').classList.add('hidden'); document.getElementById('registerError').classList.add('hidden'); }
window.showLoginForm = () => { document.getElementById('loginForm').classList.remove('hidden'); document.getElementById('registerForm').classList.add('hidden'); hideAuthErrors(); }
window.showRegisterForm = () => { document.getElementById('loginForm').classList.add('hidden'); document.getElementById('registerForm').classList.remove('hidden'); hideAuthErrors(); }
window.handleLogout = () => { if(confirm('Yakin ingin keluar?')) auth.signOut(); }

window.signInWithGoogle = async () => {
    try { await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); } catch(err) { if(err.code !== 'auth/popup-closed-by-user') showAuthError('loginError', err.message); }
}
window.signInWithEmail = async () => {
    const e = document.getElementById('loginEmail').value, p = document.getElementById('loginPassword').value;
    if(!e || !p) return showAuthError('loginError', 'Isi email & password');
    try { await auth.signInWithEmailAndPassword(e,p); } catch(err) { showAuthError('loginError', getAuthErrorMessage(err.code)); }
}
window.registerWithEmail = async () => {
    const n = document.getElementById('registerName').value, e = document.getElementById('registerEmail').value, p = document.getElementById('registerPassword').value;
    if(!n||!e||!p) return showAuthError('registerError', 'Isi semua field');
    try { const cred = await auth.createUserWithEmailAndPassword(e,p); await cred.user.updateProfile({displayName: n}); } catch(err) { showAuthError('registerError', getAuthErrorMessage(err.code)); }
}
window.handleForgotPassword = async () => {
    const e = document.getElementById('loginEmail').value;
    if(!e) return showAuthError('loginError', 'Masukkan email');
    try { await auth.sendPasswordResetEmail(e); showAuthError('loginError', 'Link terkirim', false); } catch(err) { showAuthError('loginError', getAuthErrorMessage(err.code)); }
}

// ============================================================
// ONBOARDING
// ============================================================
let _obStep = 1;
const _OB_TOTAL = 4;
let _obData = { monthlyIncome: 0, monthlyBudget: 0, savingsTargetPct: 20, savingsTargetRp: 0, savingsTargetType: 'pct', paydayDate: 25, collected: false };
let _obShownThisSession = false;
let _isNewUser = false;

window.showOnboardingScreen = function() {
    _obStep = 1;
    _obData = { monthlyIncome: 0, monthlyBudget: 0, savingsTargetPct: 20, savingsTargetRp: 0, savingsTargetType: 'pct', paydayDate: 25, collected: false };
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('appScreen').classList.add('hidden');
    document.getElementById('onboardingScreen').classList.remove('hidden');
    _obShownThisSession = true;
    _obRender();
};

function _obRender() {
    document.getElementById('ob-progress').style.width = `${(_obStep / _OB_TOTAL) * 100}%`;
    document.getElementById('ob-step-label').textContent = `${_obStep} dari ${_OB_TOTAL}`;
    for (let i = 1; i <= _OB_TOTAL; i++) {
        const p = document.getElementById(`ob-step-${i}`);
        if (p) p.classList.toggle('hidden', i !== _obStep);
    }
    // Pre-fill values on revisit
    if (_obStep === 2) {
        const el = document.getElementById('ob-budget');
        if (el && !el.value && _obData.monthlyBudget) el.value = _obData.monthlyBudget;
        const hint = document.getElementById('ob-budget-hint');
        if (hint && _obData.monthlyIncome) hint.textContent = `80% dari gajimu = Rp ${Math.round(_obData.monthlyIncome * 0.8).toLocaleString('id-ID')}`;
    }
    if (_obStep === 3) {
        const pctEl = document.getElementById('ob-savings-pct');
        if (pctEl && !pctEl.value) pctEl.value = _obData.savingsTargetPct;
        const hint = document.getElementById('ob-savings-hint');
        if (hint && _obData.monthlyIncome) hint.textContent = `20% dari gajimu = Rp ${Math.round(_obData.monthlyIncome * 0.2).toLocaleString('id-ID')}`;
    }
    if (_obStep === 4) {
        const el = document.getElementById('ob-payday');
        if (el && !el.value) el.value = _obData.paydayDate;
    }
    const backBtn = document.getElementById('ob-back-btn');
    if (backBtn) backBtn.classList.toggle('invisible', _obStep === 1);
    const nextBtn = document.getElementById('ob-next-btn');
    if (nextBtn) nextBtn.textContent = _obStep === _OB_TOTAL ? 'Lanjut ke Login →' : 'Lanjut →';
    const errEl = document.getElementById('ob-error');
    if (errEl) { errEl.textContent = ''; errEl.classList.add('hidden'); }
}

function _obError(msg) {
    const el = document.getElementById('ob-error');
    if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}

window.obToggleSavings = function(type) {
    _obData.savingsTargetType = type;
    document.getElementById('ob-savings-pct-wrap').classList.toggle('hidden', type !== 'pct');
    document.getElementById('ob-savings-rp-wrap').classList.toggle('hidden', type !== 'rp');
    document.getElementById('ob-sav-btn-pct').className = `flex-1 py-2 rounded-xl text-sm font-bold transition ${type === 'pct' ? 'bg-secondary text-primary' : 'bg-white/10 text-white/50'}`;
    document.getElementById('ob-sav-btn-rp').className = `flex-1 py-2 rounded-xl text-sm font-bold transition ${type === 'rp' ? 'bg-secondary text-primary' : 'bg-white/10 text-white/50'}`;
};

window.onboardingNext = function() {
    if (_obStep === 1) {
        const v = parseInt(document.getElementById('ob-income').value);
        if (!v || v < 100000) return _obError('Masukkan gaji yang valid (min Rp 100.000)');
        _obData.monthlyIncome = v;
        _obData.monthlyBudget = Math.round(v * 0.8);
        _obData.savingsTargetRp = Math.round(v * 0.2);
    } else if (_obStep === 2) {
        const v = parseInt(document.getElementById('ob-budget').value);
        if (!v || v < 10000) return _obError('Masukkan budget yang valid');
        _obData.monthlyBudget = v;
    } else if (_obStep === 3) {
        if (_obData.savingsTargetType === 'pct') {
            const pct = parseFloat(document.getElementById('ob-savings-pct').value);
            if (isNaN(pct) || pct < 0 || pct > 100) return _obError('Masukkan persentase 0–100');
            _obData.savingsTargetPct = pct;
            _obData.savingsTargetRp = Math.round(_obData.monthlyIncome * pct / 100);
        } else {
            const rp = parseInt(document.getElementById('ob-savings-rp').value);
            if (isNaN(rp) || rp < 0) return _obError('Masukkan nominal yang valid');
            _obData.savingsTargetRp = rp;
            _obData.savingsTargetPct = _obData.monthlyIncome > 0 ? Math.round(rp / _obData.monthlyIncome * 100) : 20;
        }
    } else if (_obStep === 4) {
        const day = parseInt(document.getElementById('ob-payday').value);
        if (!day || day < 1 || day > 31) return _obError('Masukkan tanggal 1–31');
        _obData.paydayDate = day;
        _obCompleteOnboarding();
        return;
    }
    _obStep++;
    _obRender();
};

window.onboardingBack = function() {
    if (_obStep > 1) { _obStep--; _obRender(); }
};

window.onboardingSkip = function() {
    if (!_obData.monthlyIncome) _obData.monthlyIncome = 5000000;
    if (!_obData.monthlyBudget) _obData.monthlyBudget = 4000000;
    if (!_obData.savingsTargetRp) _obData.savingsTargetRp = 1000000;
    if (!_obData.savingsTargetPct) _obData.savingsTargetPct = 20;
    if (!_obData.paydayDate) _obData.paydayDate = 25;
    _obCompleteOnboarding();
};

function _obCompleteOnboarding() {
    _obData.collected = true;
    document.getElementById('onboardingScreen').classList.add('hidden');
    document.getElementById('authScreen').classList.remove('hidden');
    // Reset button state
    const nextBtn = document.getElementById('ob-next-btn');
    if (nextBtn) { nextBtn.textContent = 'Lanjut ke Login →'; nextBtn.disabled = false; }
}

// ============================================================
// APP LOGIC
// ============================================================
window.app = {
    _txBalancesVisible: true,

    toLocalDateString: function(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    parseLocalDateString: function(dateStr) {
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day);
    },

    createLocalNoonDate: function(dateStr) {
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day, 12, 0, 0, 0);
    },

    setReportSixMoMode: function(mode) {
        this._reportSixMoMode = mode;
        this.renderReport();
    },

    getCurrentMonthKey: function(date = new Date()) {
        return this.toLocalDateString(date).slice(0, 7);
    },

    init: function() {
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                currentUser = user;
                document.getElementById('authScreen').classList.add('hidden');
                document.getElementById('onboardingScreen').classList.add('hidden');
                document.getElementById('userGreeting').textContent = `Halo, ${user.displayName || user.email.split('@')[0]}`;
                document.getElementById('settingsName').textContent = user.displayName;
                document.getElementById('settingsEmail').textContent = user.email;
                await this.initProfile();
                // If new user and onboarding data was collected before login, save it
                if (_isNewUser && _obData.collected) {
                    try {
                        const obUpdates = {
                            monthlyIncome: _obData.monthlyIncome,
                            monthlyBudget: _obData.monthlyBudget,
                            savingsTargetRp: _obData.savingsTargetRp,
                            savingsTargetPct: _obData.savingsTargetPct,
                            paydayDate: _obData.paydayDate,
                            onboardingComplete: true
                        };
                        await db.collection('users').doc(currentUser.uid).update(obUpdates);
                        Object.assign(currentProfile, obUpdates);
                    } catch(e) { console.warn('onboarding save failed', e); }
                    _obData.collected = false;
                }
                document.getElementById('appScreen').classList.remove('hidden');
                this.initFormOptions();
                await this.loadData();
                this.updateMonthLabels();
                this.setupSwipeHandlers();
                this.switchTab('home');

                // Check for app updates (run after UI is ready)
                setTimeout(() => updateManager.checkForUpdate(), 2000);

                // Update version display in Settings
                document.getElementById('settingsVersion').textContent = APP_VERSION;
                document.querySelectorAll('.auth-version').forEach(el => el.textContent = APP_VERSION);
            } else {
                currentUser = null;
                document.getElementById('appScreen').classList.add('hidden');
                // First visit ever: show onboarding wizard first; on logout: go straight to auth
                if (!_obShownThisSession) {
                    showOnboardingScreen();
                } else {
                    document.getElementById('onboardingScreen').classList.add('hidden');
                    document.getElementById('authScreen').classList.remove('hidden');
                }
            }
        });

        // Load and render dashboard card settings
        this.renderDashboardSettings();
    },

    navigateMonth: function(delta) {
        const proposed = new Date(activeMonthDate.getFullYear(), activeMonthDate.getMonth() + delta, 1);
        const now = new Date();
        const nowFirst = new Date(now.getFullYear(), now.getMonth(), 1);
        if (proposed > nowFirst) return; // no future months
        activeMonthDate = proposed;
        this.updateMonthLabels();
        const activeTab = document.querySelector('.nav-btn.text-primary')?.dataset.tab;
        if (activeTab === 'home') this.renderHome();
        else if (activeTab === 'transactions') this.updateTransactionsView();
        else if (activeTab === 'report') this.renderReport();
    },

    updateMonthLabels: function() {
        const label = activeMonthDate.toLocaleString('id-ID', { month: 'short', year: 'numeric' });
        const now = new Date();
        const isCurrentMonth = activeMonthDate.getFullYear() === now.getFullYear() && activeMonthDate.getMonth() === now.getMonth();
        ['homeMonthLabel', 'txMonthLabel', 'reportMonthLabel'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = label;
        });
        ['homeNextMonthBtn', 'txNextMonthBtn', 'reportNextMonthBtn'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.opacity = isCurrentMonth ? '0.3' : '1';
        });
    },

    setupSwipeHandlers: function() {
        // Month-swipe only on the Home tab (tab-transactions uses native carousel scroll)
        const el = document.getElementById('tab-home');
        if (!el) return;
        let startX = 0, startY = 0, locked = false;
        el.addEventListener('touchstart', e => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            locked = false;
        }, { passive: true });
        el.addEventListener('touchmove', e => {
            if (locked) return;
            const dx = Math.abs(e.touches[0].clientX - startX);
            const dy = Math.abs(e.touches[0].clientY - startY);
            locked = true; // lock direction after first move
        }, { passive: true });
        el.addEventListener('touchend', e => {
            const dx = e.changedTouches[0].clientX - startX;
            const dy = e.changedTouches[0].clientY - startY;
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.8) this.navigateMonth(dx > 0 ? -1 : 1);
        }, { passive: true });
    },

    openRecurringModal: async function() {
        const sheet = document.getElementById('sheetRecurring');
        if (sheet) {
            sheet.classList.remove('hidden');
            sheet.classList.add('flex', 'animate-slide-up');
            // Refresh transaction cache first so paid-detection is always accurate
            await this.loadData();
            this.loadRecurringTransactions();
        }
    },

    closeRecurringSheet: function() {
        const sheet = document.getElementById('sheetRecurring');
        if (sheet) {
            sheet.classList.remove('animate-slide-up');
            sheet.classList.add('animate-slide-down');
            setTimeout(() => {
                sheet.classList.add('hidden');
                sheet.classList.remove('flex', 'animate-slide-down');
            }, 300);
        }
    },

    initProfile: async function() {
        const ref = db.collection('users').doc(currentUser.uid);
        const doc = await ref.get();
        if(!doc.exists) {
            _isNewUser = true;
            currentProfile = { accounts: [{id: 'main', name: 'Main Wallet', type: 'Cash'}], monthlyBudget: DEFAULT_MONTHLY_BUDGET, categories: DEFAULT_CATEGORIES, geminiApiKey: '', onboardingComplete: false };
            await ref.set({ displayName: currentUser.displayName, email: currentUser.email, accounts: currentProfile.accounts, monthlyBudget: currentProfile.monthlyBudget, categories: DEFAULT_CATEGORIES, geminiApiKey: '', onboardingComplete: false, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        } else {
            currentProfile = doc.data();
            let updates = {};
            if(!currentProfile.accounts || currentProfile.accounts.length === 0) {
                currentProfile.accounts = [{id: 'main', name: 'Main Wallet', type: 'Cash'}];
                updates.accounts = currentProfile.accounts;
            }
            if(!currentProfile.categories || currentProfile.categories.length === 0) {
                currentProfile.categories = DEFAULT_CATEGORIES;
                updates.categories = currentProfile.categories;
            }
            if(typeof currentProfile.geminiApiKey !== 'string') {
                currentProfile.geminiApiKey = '';
                updates.geminiApiKey = '';
            }
            // Migration: existing users are considered to have completed onboarding
            if (currentProfile.onboardingComplete === undefined) {
                currentProfile.onboardingComplete = true;
                updates.onboardingComplete = true;
            }
            // Migration: inject nature into existing categories that don't have it
            let categoriesNeedUpdate = false;
            const defaultNatureMap = {};
            DEFAULT_CATEGORIES.forEach(d => { defaultNatureMap[d.id] = d.nature; });
            currentProfile.categories = (currentProfile.categories || DEFAULT_CATEGORIES).map(c => {
                if (c.type === 'Expense' && c.nature === undefined) {
                    categoriesNeedUpdate = true;
                    return { ...c, nature: defaultNatureMap[c.id] || 'wants' };
                }
                if (c.type === 'Income' && c.nature === undefined) {
                    categoriesNeedUpdate = true;
                    return { ...c, nature: null };
                }
                return c;
            });
            if (categoriesNeedUpdate) updates.categories = currentProfile.categories;
            // Migration: inject purpose + is_excluded_from_budget into existing accounts
            let accountsNeedUpdate = false;
            currentProfile.accounts = (currentProfile.accounts || []).map(a => {
                let changed = false;
                const updated = { ...a };
                if (!updated.purpose) { updated.purpose = 'daily'; changed = true; }
                if (updated.is_excluded_from_budget === undefined) { updated.is_excluded_from_budget = false; changed = true; }
                if (changed) accountsNeedUpdate = true;
                return updated;
            });
            if (accountsNeedUpdate) updates.accounts = currentProfile.accounts;
            if(Object.keys(updates).length > 0) {
                await ref.update(updates);
            }
        }
        accounts = currentProfile.accounts;
        customCategories = currentProfile.categories || DEFAULT_CATEGORIES;
        loadUserVocabulary(currentProfile);
        this.renderAccountsList();
        this.renderCategoriesList();
    },

    // Calculator state
    _calcDisplay: '0',
    _calcPendingOp: null,
    _calcPendingVal: null,
    _calcJustEvaled: false,

    initFormOptions: function() {
        // Set today's date & time
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        const todayStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
        const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
        document.getElementById('formDate').value = todayStr;
        document.getElementById('formTime').value = timeStr;
        this.updateFormDateLabel();
        this.updateFormTimeLabel();

        // Populate accounts
        this.renderAccountsList();

        // Reset calculator
        this._calcDisplay = '0';
        this._calcPendingOp = null;
        this._calcPendingVal = null;
        this._calcJustEvaled = false;
        this._updateCalcDisplay();

        // Default to Expense
        this.setFormType('Expense');

        // Render category grid in popup
        // Render category grid in popup — show expense cats by default
        const firstExpCat = customCategories.find(c => c.type === 'Expense') || customCategories[0];
        if (firstExpCat) {
            document.getElementById('formCategory').value = firstExpCat.name;
            const lbl = document.getElementById('formCategoryLabel');
            if (lbl) lbl.textContent = firstExpCat.name;
        }

        // Keyboard support (PC)
        if (!this._calcKeyListenerAttached) {
            this._calcKeyListenerAttached = true;
            document.addEventListener('keydown', (e) => {
                // Only active when input tab is visible
                const formMode = document.getElementById('inputFormMode');
                if (!formMode || formMode.classList.contains('hidden')) return;
                // Don't intercept if user is typing in formNote or other text inputs
                const active = document.activeElement;
                if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') && active.id === 'formNote') return;
                const key = e.key;
                if (/^[0-9]$/.test(key)) { e.preventDefault(); this.calcInput(key); }
                else if (key === 'Backspace') { e.preventDefault(); this.calcBackspace(); }
                else if (key === '+') { e.preventDefault(); this.calcOp('+'); }
                else if (key === '-') { e.preventDefault(); this.calcOp('-'); }
                else if (key === '*') { e.preventDefault(); this.calcOp('*'); }
                else if (key === '/') { e.preventDefault(); this.calcOp('/'); }
                else if (key === 'Enter' || key === '=') { e.preventDefault(); this.calcEquals(); }
                else if (key === 'Tab') { /* allow tab navigation */ }
                else if (key === 'Escape') { app.switchTab('home'); }
            });
        }
    },

    setFormType: function(type) {
        const btnExp = document.getElementById('formTypeBtnExpense');
        const btnInc = document.getElementById('formTypeBtnIncome');
        const btnTrf = document.getElementById('formTypeBtnTransfer');
        const stdFields = document.getElementById('formStandardFields');
        const trfFields = document.getElementById('formTransferFields');
        // Reset all buttons to inactive style
        [btnExp, btnInc, btnTrf].forEach(b => {
            if (b) b.className = 'w-12 h-12 rounded-xl flex items-center justify-center transition text-gray-400';
        });
        if (type === 'Expense') {
            if (btnExp) btnExp.className = 'w-12 h-12 rounded-xl flex items-center justify-center transition bg-danger text-white shadow-sm';
            if (stdFields) stdFields.classList.remove('hidden');
            if (trfFields) trfFields.classList.add('hidden');
            // Update category to first expense category
            const firstExpCat = customCategories.find(c => c.type === 'Expense') || customCategories[0];
            if (firstExpCat && (!document.getElementById('formCategory').value || this._lastFormType !== 'Expense')) {
                document.getElementById('formCategory').value = firstExpCat.name;
                const lbl = document.getElementById('formCategoryLabel');
                if (lbl) lbl.textContent = firstExpCat.name;
            }
        } else if (type === 'Income') {
            if (btnInc) btnInc.className = 'w-12 h-12 rounded-xl flex items-center justify-center transition bg-success text-white shadow-sm';
            if (stdFields) stdFields.classList.remove('hidden');
            if (trfFields) trfFields.classList.add('hidden');
            // Update category to first income category
            const firstIncCat = customCategories.find(c => c.type === 'Income') || customCategories[0];
            if (firstIncCat) {
                document.getElementById('formCategory').value = firstIncCat.name;
                const lbl = document.getElementById('formCategoryLabel');
                if (lbl) lbl.textContent = firstIncCat.name;
            }
        } else {
            if (btnTrf) btnTrf.className = 'w-12 h-12 rounded-xl flex items-center justify-center transition bg-blue-500 text-white shadow-sm';
            if (stdFields) stdFields.classList.add('hidden');
            if (trfFields) trfFields.classList.remove('hidden');
        }
        this._lastFormType = this._formType;
        this._formType = type;
        // Show/hide budget toggle row — only relevant for Expense in non-recurring mode
        const budgetToggleRow = document.getElementById('formBudgetToggleRow');
        if (budgetToggleRow) budgetToggleRow.style.display = (type === 'Expense' && !this._recurringMode) ? 'flex' : 'none';
        // Show/hide recurring fields
        const recFields = document.getElementById('formRecurringFields');
        if (recFields) recFields.style.display = this._recurringMode ? 'block' : 'none';
        // Auto-set toggle based on category default when switching type
        if (type === 'Expense') {
            const catVal = document.getElementById('formCategory')?.value;
            const catDef = customCategories.find(c => c.name === catVal);
            const excToggle = document.getElementById('formExcludeBudget');
            if (excToggle) excToggle.checked = !(catDef?.exclude_from_budget === true);
        }
        // Update display color
        const display = document.getElementById('formAmountDisplay');
        if (display) {
            display.style.color = type === 'Expense' ? '#EF4444' : type === 'Income' ? '#10B981' : '#3B82F6';
        }
    },

    updateFormDateLabel: function() {
        const val = document.getElementById('formDate')?.value;
        if (!val) return;
        const d = new Date(val + 'T12:00:00');
        const today = new Date();
        const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
        const isToday = d.toDateString() === today.toDateString();
        const isYest = d.toDateString() === yesterday.toDateString();
        const lbl = document.getElementById('formDateLabel');
        if (lbl) lbl.textContent = isToday ? 'Hari ini' : isYest ? 'Kemarin' : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    },

    updateFormTimeLabel: function() {
        const val = document.getElementById('formTime')?.value;
        if (!val) return;
        const lbl = document.getElementById('formTimeLabel');
        if (lbl) lbl.textContent = val;
    },

    // Calculator functions
    _updateCalcDisplay: function() {
        const el = document.getElementById('formAmountDisplay');
        const hidden = document.getElementById('formAmount');
        const raw = this._calcDisplay;
        const num = parseFloat(raw);
        if (el) el.textContent = isNaN(num) ? raw : this.format(num);
        if (hidden) hidden.value = isNaN(num) ? 0 : Math.round(num);
    },

    calcInput: function(digit) {
        if (this._calcJustEvaled) { this._calcDisplay = '0'; this._calcJustEvaled = false; }
        if (digit === '000') {
            if (this._calcDisplay === '0') return;
            this._calcDisplay += '000';
        } else if (digit === '0' && this._calcDisplay === '0') {
            return;
        } else if (this._calcDisplay === '0') {
            this._calcDisplay = digit;
        } else {
            if (this._calcDisplay.replace(/[^0-9]/g, '').length >= 13) return;
            this._calcDisplay += digit;
        }
        this._updateCalcDisplay();
    },

    calcBackspace: function() {
        if (this._calcDisplay.length <= 1 || this._calcJustEvaled) {
            this._calcDisplay = '0';
            this._calcJustEvaled = false;
        } else {
            this._calcDisplay = this._calcDisplay.slice(0, -1);
        }
        this._updateCalcDisplay();
    },

    calcOp: function(op) {
        const current = parseFloat(this._calcDisplay);
        if (this._calcPendingOp && !this._calcJustEvaled) {
            this.calcEquals();
        }
        this._calcPendingVal = parseFloat(this._calcDisplay);
        this._calcPendingOp = op;
        this._calcJustEvaled = true;
    },

    calcEquals: function() {
        if (this._calcPendingOp === null) return;
        const a = this._calcPendingVal;
        const b = parseFloat(this._calcDisplay);
        let result = 0;
        if (this._calcPendingOp === '+') result = a + b;
        else if (this._calcPendingOp === '-') result = a - b;
        else if (this._calcPendingOp === '*') result = a * b;
        else if (this._calcPendingOp === '/') result = b !== 0 ? a / b : 0;
        this._calcDisplay = String(Math.round(result));
        this._calcPendingOp = null;
        this._calcPendingVal = null;
        this._calcJustEvaled = true;
        this._updateCalcDisplay();
    },

    openCategoryPopup: function(fieldId = 'formCategory') {
        this._activeCategoryField = fieldId;
        const popup = document.getElementById('categoryPopup');
        if (!popup) return;
        popup.classList.remove('hidden');
        popup.classList.add('flex');
        
        const currentType = fieldId === 'formCategory' ? (this._formType || 'Expense') : 'Expense';
        const filtered = currentType === 'Transfer'
            ? customCategories
            : customCategories.filter(c => !c.type || c.type === currentType);
            
        const container = document.getElementById('formCategoryGrid');
        if (!container) return;
        const selectedCat = document.getElementById(fieldId)?.value;
        container.innerHTML = filtered.map(cat => {
            const isSel = cat.name === selectedCat;
            return `
                <button type="button" onclick="app.selectCategoryInGrid('formCategoryGrid','${fieldId}','${cat.name}')"
                    class="flex flex-col items-center gap-1 p-2 rounded-2xl border-2 transition text-center ${isSel ? 'border-secondary bg-secondary/5' : 'border-gray-100 bg-gray-50'}"
                    data-catgrid-btn="${cat.name}">
                    <div class="w-8 h-8 rounded-xl flex items-center justify-center" style="background:${cat.color}20;color:${cat.color}">
                        <i class="ph-fill ${cat.icon} text-sm"></i>
                    </div>
                    <span class="text-[9px] font-bold text-primary max-w-full truncate px-1">${cat.name}</span>
                </button>
            `;
        }).join('');
    },

    closeCategoryPopup: function() {
        const popup = document.getElementById('categoryPopup');
        if (!popup) return;
        popup.classList.add('hidden');
        popup.classList.remove('flex');
        
        const fieldId = this._activeCategoryField || 'formCategory';
        const catVal = document.getElementById(fieldId)?.value;
        const lbl = document.getElementById(fieldId + 'Label');
        const iconEl = document.getElementById(fieldId + 'Icon');
        
        if (catVal) {
            const def = this.getCategoryDef(catVal);
            if (lbl) lbl.textContent = catVal;
            if (iconEl) {
                iconEl.innerHTML = `<i class="ph-fill ${def.icon} text-sm"></i>`;
                iconEl.style.background = `${def.color}20`;
                iconEl.style.color = def.color;
            }
            // Auto-set budget toggle from category default
            if (fieldId === 'formCategory') {
                const catDef = customCategories.find(c => c.name === catVal);
                const excToggle = document.getElementById('formExcludeBudget');
                if (excToggle && catDef) excToggle.checked = !catDef.exclude_from_budget;
            }
        }
        // Show/hide budget toggle row for Expense only
        const type = this._formType || 'Expense';
        const toggleRow = document.getElementById('formBudgetToggleRow');
        if (toggleRow) toggleRow.style.display = type === 'Expense' ? 'flex' : 'none';
    },

    // ─── Account Popup ────────────────────────────────────────────────────────
    openAccountPopup: function(fieldId) {
        this._activeAccountField = fieldId;
        const popup = document.getElementById('accountPopup');
        if (!popup) return;
        popup.classList.remove('hidden');
        popup.classList.add('flex');
        
        const currentVal = document.getElementById(fieldId)?.value;
        this.renderAccountGrid('formAccountGrid', currentVal, fieldId);
    },

    closeAccountPopup: function() {
        const popup = document.getElementById('accountPopup');
        if (!popup) return;
        popup.classList.add('hidden');
        popup.classList.remove('flex');
        
        // Update label for the active field
        const fieldId = this._activeAccountField;
        if (fieldId) {
            const accId = document.getElementById(fieldId)?.value;
            const acc = accounts.find(a => a.id === accId);
            if (acc) {
                const labelEl = document.getElementById(fieldId + 'Label');
                const iconEl = document.getElementById(fieldId + 'Icon');
                if (labelEl) labelEl.textContent = acc.name;
                if (iconEl) {
                    const ic = acc.icon || 'ph-wallet';
                    const col = acc.color || '#040720';
                    iconEl.innerHTML = `<i class="ph-fill ${ic} text-sm"></i>`;
                    iconEl.style.background = `${col}20`;
                    iconEl.style.color = col;
                }
            }
        }
    },

    renderAccountGrid: function(containerId, selectedId, hiddenInputId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = accounts.map(acc => {
            const isSel = acc.id === selectedId;
            const ic = acc.icon || 'ph-wallet';
            const col = acc.color || '#040720';
            return `
                <button type="button" onclick="app.selectAccountInGrid('${containerId}','${hiddenInputId}','${acc.id}')"
                    class="flex flex-col items-center gap-1 p-2 rounded-2xl border-2 transition text-center ${isSel ? 'border-secondary bg-secondary/5' : 'border-gray-100 bg-gray-50'}"
                    data-accgrid-btn="${acc.id}">
                    <div class="w-8 h-8 rounded-xl flex items-center justify-center" style="background:${col}20;color:${col}">
                        <i class="ph-fill ${ic} text-sm"></i>
                    </div>
                    <span class="text-[9px] font-bold text-primary leading-tight truncate w-full">${acc.name}</span>
                </button>
            `;
        }).join('');
    },

    selectAccountInGrid: function(containerId, hiddenInputId, accId) {
        document.querySelectorAll(`#${containerId} [data-accgrid-btn]`).forEach(btn => {
            const isThis = btn.dataset.accgridBtn === accId;
            btn.classList.toggle('border-secondary', isThis);
            btn.classList.toggle('bg-secondary/5', isThis);
            btn.classList.toggle('border-gray-100', !isThis);
            btn.classList.toggle('bg-gray-50', !isThis);
        });
        if (hiddenInputId) {
            const hidden = document.getElementById(hiddenInputId);
            if (hidden) hidden.value = accId;
        }
        setTimeout(() => this.closeAccountPopup(), 150);
    },

    getCategoryDef: function(catName) {
        if (!catName) return { name: 'Transfer', icon: 'ph-arrows-left-right', color: '#6366F1' };
        let def = customCategories.find(c => c.name.toLowerCase() === catName.toLowerCase());
        if(!def) {
            // Fallback generic
            const isInc = CATEGORY_MAP_CLIENT[catName.toLowerCase()] === 'Salary' || CATEGORY_MAP_CLIENT[catName.toLowerCase()] === 'Bonus';
            def = { name: catName, icon: isInc ? 'ph-arrow-down-left' : 'ph-tag', color: isInc ? '#10B981' : '#6B7280' };
        }
        return def;
    },

    loadData: async function() {
        // Fetch all transactions (for a robust dashboard)
        const snap = await db.collection('users').doc(currentUser.uid).collection('transactions').orderBy('date', 'desc').get();
        allTransactions = snap.docs.map(d => {
            const rawDate = d.data().date.toDate();
            return { id: d.id, ...d.data(), dateStr: d.data().dateKey || this.toLocalDateString(rawDate) };
        });
        
        // Calculate dynamic balances for accounts
        accounts.forEach(a => a.balance = 0);
        allTransactions.forEach(tx => {
            if(tx.type === 'Transfer') {
                const fromAcc = accounts.find(a => a.id === tx.fromAccountId);
                const toAcc = accounts.find(a => a.id === tx.toAccountId);
                if(fromAcc) fromAcc.balance -= tx.amount;
                if(toAcc) toAcc.balance += tx.amount;
            } else {
                let acc = accounts.find(a => a.id === tx.accountId) || accounts[0];
                if(tx.type === 'Income') acc.balance += tx.amount;
                else acc.balance -= tx.amount;
            }
        });

        // Update home UI global variables
        const totalBal = accounts.reduce((sum, a) => sum + a.balance, 0);
        document.getElementById('homeTotalBalance').textContent = `Rp ${this.format(totalBal)}`;
        
        this.renderHome();
        this.renderToday();
        this.renderTransactions();
        // Check inconsistency (yesterday had no transactions and no daily log)
        this.checkInconsistency();
        // Update NoSpend button state
        this.checkNoSpendToday().then(isDone => {
            const btn = document.getElementById('noSpendBtn');
            const done = document.getElementById('noSpendDoneLabel');
            const today = this.toLocalDateString(new Date());
            const hasTxToday = allTransactions.some(tx => tx.dateStr === today && tx.type === 'Expense');
            if (hasTxToday) {
                // Has expense today — disable button and show info
                if (btn) { btn.disabled = true; btn.classList.add('opacity-40', 'cursor-not-allowed'); btn.classList.remove('hidden'); }
                done?.classList.add('hidden');
                const hint = document.getElementById('noSpendHint');
                if (hint) { hint.textContent = '⚠️ Ada pengeluaran hari ini. No Spend Day tidak bisa dicatat.'; hint.classList.remove('hidden'); }
            } else if (isDone) {
                btn?.classList.add('hidden');
                done?.classList.remove('hidden');
                const hint = document.getElementById('noSpendHint');
                if (hint) hint.classList.add('hidden');
            } else {
                if (btn) { btn.disabled = false; btn.classList.remove('hidden', 'opacity-40', 'cursor-not-allowed'); }
                done?.classList.add('hidden');
                const hint = document.getElementById('noSpendHint');
                if (hint) hint.classList.add('hidden');
            }
        });
        
        this.loadSubscriptionCard();
    },

    _statusChart: null,
    _perfChart: null,
    _homeTopCategoryChart: null,

    // ─── Deep Insight Logic Engine ────────────────────────────────────────────
    evaluateBudgetPacing: function(totalSpent, monthlyBudget, daysInMonth, daysPassed) {
        if (daysInMonth <= 0 || monthlyBudget <= 0) return { safeLimit: 0, hardLimit: monthlyBudget, isSurplusProjected: false, pacingPct: 0 };
        const safeLimit = (monthlyBudget / daysInMonth) * daysPassed;
        const hardLimit = monthlyBudget;
        const projectedMonthEnd = daysPassed > 0 ? (totalSpent / daysPassed) * daysInMonth : 0;
        const isSurplusProjected = projectedMonthEnd < hardLimit;
        const pacingPct = safeLimit > 0 ? Math.round((totalSpent / safeLimit) * 100) : 0;
        return { safeLimit, hardLimit, isSurplusProjected, projectedMonthEnd, pacingPct };
    },

    calculateEmergencyFundScore: function(accountsList, avgMonthlyExpense) {
        const emergencyFunds = accountsList.filter(a => a.purpose === 'emergency_fund' || a.is_excluded_from_budget);
        const totalEmergency = emergencyFunds.reduce((s, a) => s + (a.balance || 0), 0);
        if (avgMonthlyExpense <= 0) return { score: 0, months: 0, label: 'N/A', color: '#64748B' };
        const months = totalEmergency / avgMonthlyExpense;
        let score, label, color;
        if (months >= 6) { score = 100; label = 'Solid 💪'; color = '#10B981'; }
        else if (months >= 3) { score = Math.round((months / 6) * 100); label = 'Aman ✅'; color = '#1CBDB3'; }
        else if (months >= 1) { score = Math.round((months / 6) * 100); label = 'Perlu Top-Up ⚠️'; color = '#F59E0B'; }
        else { score = Math.round((months / 6) * 100); label = 'Bahaya 🚨'; color = '#EF4444'; }
        return { score: Math.min(score, 100), months: totalEmergency > 0 ? parseFloat(months.toFixed(1)) || 0.1 : 0, label, color, totalEmergency };
    },

    evaluateNatureBreakdown: function(expenseTxs, categoriesList) {
        const catNatureMap = {};
        categoriesList.forEach(c => { catNatureMap[c.name] = c.nature || 'wants'; });
        let must = 0, needs = 0, wants = 0, total = 0;
        expenseTxs.forEach(tx => {
            const nature = catNatureMap[tx.category] || 'wants';
            if (nature === 'must') must += tx.amount;
            else if (nature === 'needs') needs += tx.amount;
            else wants += tx.amount;
            total += tx.amount;
        });
        const pct = (v) => total > 0 ? Math.round((v / total) * 100) : 0;
        return { must, needs, wants, total, mustPct: pct(must), needsPct: pct(needs), wantsPct: pct(wants),
            mustOverload: pct(must) > 50, wantsOverload: pct(wants) > 30 };
    },

    generateDeepInsight: function(pacing, nature, efScore) {
        const lines = [];
        if (pacing.pacingPct > 120) {
            lines.push(`⚡ Lo udah overspend ${pacing.pacingPct - 100}% dari pace aman bulan ini. Ini bukan drill, bestie.`);
        } else if (pacing.pacingPct > 100) {
            lines.push(`⚠️ Pace lo lagi sedikit over budget. Masih bisa diselamatkan kalau mulai rem dari sekarang.`);
        } else if (pacing.isSurplusProjected) {
            const projSurplus = Math.round(pacing.hardLimit - pacing.projectedMonthEnd);
            lines.push(`✅ Lo on-track! Proyeksi pengeluaran akhir bulan Rp ${this.format(Math.round(pacing.projectedMonthEnd))} dari budget Rp ${this.format(pacing.hardLimit)} → ada sisa budget Rp ${this.format(projSurplus)} kalau pace ini dijaga.`);
        }
        if (nature.mustOverload) {
            lines.push(`🔒 ${nature.mustPct}% spending lo itu kebutuhan wajib (must). Mungkin udah saatnya review fixed cost?`);
        }
        if (nature.wantsOverload) {
            lines.push(`🛍️ Kategori "Wants" nyedot ${nature.wantsPct}% total expense lo. Coba cek apakah worth it semua.`);
        }
        if (efScore.months < 3) {
            const monthsStr = efScore.totalEmergency > 0 ? efScore.months : 0;
            const pctStr = efScore.score > 0 ? ` (${efScore.score}%)` : '';
            lines.push(`🚨 Dana darurat lo cuma cukup ${monthsStr} bulan${pctStr}. Target minimal 3 bulan dulu ya!`);
        }
        if (lines.length === 0) {
            lines.push(`🔥 Keuangan lo lagi sehat! Keep it up, jangan lupa invest sisanya.`);
        }
        return lines.join(' · ');
    },

    // ─── No Spend Day ─────────────────────────────────────────────────────────
    logNoSpendDay: async function() {
        if (!currentUser) return;
        const today = this.toLocalDateString(new Date());
        const docId = `${today}_${currentUser.uid}`;
        try {
            await db.collection('daily_logs').doc(docId).set({
                user_id: currentUser.uid, date: today, status: 'no_spend',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            this.toast('No Spend Day dicatat! 🎉 Keren banget!');
            this.triggerConfetti();
            document.getElementById('noSpendBtn')?.classList.add('hidden');
            document.getElementById('noSpendDoneLabel')?.classList.remove('hidden');
            this.updateStreaksAsync();
        } catch(e) { this.toast(e.message, true); }
    },

    revokeNoSpendIfNeeded: async function() {
        if (!currentUser) return;
        const today = this.toLocalDateString(new Date());
        const hasTxToday = allTransactions.some(tx => tx.dateStr === today && tx.type === 'Expense');
        if (!hasTxToday) return; // no expense today, nothing to revoke
        const docId = `${today}_${currentUser.uid}`;
        try {
            const doc = await db.collection('daily_logs').doc(docId).get();
            if (doc.exists && doc.data().status === 'no_spend') {
                await db.collection('daily_logs').doc(docId).delete();
            }
        } catch(e) { /* silent */ }
        // Update UI
        const btn = document.getElementById('noSpendBtn');
        const done = document.getElementById('noSpendDoneLabel');
        const hint = document.getElementById('noSpendHint');
        if (btn) { btn.disabled = true; btn.classList.remove('hidden'); btn.classList.add('opacity-40', 'cursor-not-allowed'); }
        done?.classList.add('hidden');
        if (hint) { hint.textContent = '⚠️ Ada pengeluaran hari ini. No Spend Day tidak bisa dicatat.'; hint.classList.remove('hidden'); }
    },



    triggerConfetti: function() {
        const colors = ['#FFB800', '#1CBDB3', '#10B981', '#EF4444', '#8B5CF6'];
        const el = document.createElement('canvas');
        el.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999';
        document.body.appendChild(el);
        const ctx = el.getContext('2d');
        el.width = window.innerWidth; el.height = window.innerHeight;
        const particles = Array.from({length: 80}, () => ({
            x: Math.random() * el.width, y: -10,
            vx: (Math.random() - 0.5) * 4, vy: Math.random() * 3 + 2,
            color: colors[Math.floor(Math.random() * colors.length)],
            size: Math.random() * 8 + 4, rot: Math.random() * 360
        }));
        let frame = 0;
        const animate = () => {
            ctx.clearRect(0, 0, el.width, el.height);
            particles.forEach(p => {
                p.x += p.vx; p.y += p.vy; p.rot += 5;
                ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot * Math.PI / 180);
                ctx.fillStyle = p.color; ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size * 0.6);
                ctx.restore();
            });
            frame++;
            if (frame < 120) requestAnimationFrame(animate);
            else el.remove();
        };
        requestAnimationFrame(animate);
    },

    checkNoSpendToday: async function() {
        if (!currentUser) return false;
        const today = this.toLocalDateString(new Date());
        const docId = `${today}_${currentUser.uid}`;
        try {
            const doc = await db.collection('daily_logs').doc(docId).get();
            return doc.exists && doc.data().status === 'no_spend';
        } catch(e) { return false; }
    },

    checkInconsistency: async function() {
        if (!currentUser) return;
        const today = new Date();
        const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
        const yesterdayStr = this.toLocalDateString(yesterday);
        const hasYesterdayTx = allTransactions.some(tx => tx.dateStr === yesterdayStr);
        if (hasYesterdayTx) return; // Normal - had transactions

        const docId = `${yesterdayStr}_${currentUser.uid}`;
        try {
            const doc = await db.collection('daily_logs').doc(docId).get();
            if (doc.exists) return; // Had a logged no-spend day
            // No transactions AND no log — show inconsistency modal
            const modal = document.getElementById('inconsistencyModal');
            if (modal) {
                document.getElementById('inconsistencyDate').textContent = yesterday.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
                modal.classList.remove('hidden');
                modal.classList.add('flex');
            }
        } catch(e) { /* silent */ }
    },

    closeInconsistencyModal: function() {
        const modal = document.getElementById('inconsistencyModal');
        if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
    },

    markYesterdayNoSpend: async function() {
        const today = new Date();
        const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
        const yesterdayStr = this.toLocalDateString(yesterday);
        const docId = `${yesterdayStr}_${currentUser.uid}`;
        try {
            await db.collection('daily_logs').doc(docId).set({
                user_id: currentUser.uid, date: yesterdayStr, status: 'no_spend',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            this.toast('Kemarin dicatat No Spend Day! 🎉');
            this.triggerConfetti();
        } catch(e) { this.toast(e.message, true); }
        this.closeInconsistencyModal();
    },

    formatInsightText: function(template) {
        return template.replace(/Rp\s[\d.]+/g, (match) => `<span class="font-bold text-emerald-700">${match}</span>`);
    },

    setActiveTabDisplay: function(tab) {
        document.querySelectorAll('main > div[id^="tab-"]').forEach(el => {
            el.classList.add('hidden');
            el.classList.remove('flex');
        });
        const activeTab = document.getElementById('tab-' + tab);
        if (!activeTab) return;
        activeTab.classList.remove('hidden');
        if (['home', 'today', 'transactions', 'input', 'settings', 'report'].includes(tab)) activeTab.classList.add('flex');
    },

    // ── Dashboard Settings ──────────────────────────────────────────────────
    _dashboardCardDefs: [
        { id: 'cardTodayMini', label: "Today's Budget", desc: 'Ringkasan sisa budget hari ini (buka Day Mode)', icon: 'ph-coins', hex: '#F59E0B' },
        { id: 'cardPerformance', label: 'Performance Card', desc: 'Saving rate & performa bulanan', icon: 'ph-gauge', hex: '#FFB800' },
        { id: 'cardStatus', label: 'Status Card', desc: 'Progres budget & grafik harian', icon: 'ph-wallet', hex: '#1CBDB3' },
        { id: 'cardTopTransactions', label: 'Top Spending', desc: 'Top spending & polar chart kategori', icon: 'ph-flame', hex: '#EF4444' },
        { id: 'cardInsightCarousel', label: 'Deep Insights', desc: 'Financial health & smart insights', icon: 'ph-brain', hex: '#040720' },
        { id: 'cardGamificationStreaks', label: 'Konsistensi Bulanan', desc: 'Tracking & under budget bulan ini', icon: 'ph-calendar-check', hex: '#F97316' },
        { id: 'cardSubscriptions', label: 'Kelola Langganan', desc: 'Ringkasan & total biaya langganan', icon: 'ph-repeat', hex: '#8B5CF6' },
        { id: 'cardPayday', label: 'Payday Countdown', desc: 'Sisa hari & sisa budget harian ke gajian', icon: 'ph-calendar-check', hex: '#6366F1' },
        { id: 'cardNoSpend', label: 'No Spend Day', desc: 'Tantangan harian tanpa pengeluaran', icon: 'ph-leaf', hex: '#10B981' },
        { id: 'cardRecentTransactions', label: 'Recent Transactions', desc: '5 transaksi terakhir', icon: 'ph-clock-counter-clockwise', hex: '#94A3B8' }
    ],

    getDashboardPrefs: function() {
        try {
            const saved = localStorage.getItem('dirhamku_dashboard_prefs');
            if (saved) {
                const prefs = JSON.parse(saved);
                // Merge with defaults for any new cards
                const defaultIds = this._dashboardCardDefs.map(d => d.id);
                const savedIds = prefs.order || [];
                // Add any new cards not in saved order
                const mergedOrder = [...savedIds.filter(id => defaultIds.includes(id))];
                defaultIds.forEach(id => { if (!mergedOrder.includes(id)) { if (id === 'cardTodayMini') mergedOrder.unshift(id); else mergedOrder.push(id); } });
                return {
                    order: mergedOrder,
                    visibility: { ...Object.fromEntries(defaultIds.map(id => [id, true])), ...(prefs.visibility || {}) }
                };
            }
        } catch(e) { /* ignore */ }
        return {
            order: this._dashboardCardDefs.map(d => d.id),
            visibility: Object.fromEntries(this._dashboardCardDefs.map(d => [d.id, true]))
        };
    },

    saveDashboardPrefs: function(prefs) {
        try {
            localStorage.setItem('dirhamku_dashboard_prefs', JSON.stringify(prefs));
        } catch(e) { /* ignore */ }
    },

    renderDashboardSettings: function() {
        const container = document.getElementById('settingsCardsToggle');
        if (!container) return;
        const prefs = this.getDashboardPrefs();
        const orderedDefs = prefs.order.map(id => this._dashboardCardDefs.find(d => d.id === id)).filter(Boolean);

        container.innerHTML = orderedDefs.map((def, idx) => {
            const isVisible = prefs.visibility[def.id] !== false;
            const isFirst = idx === 0;
            const isLast = idx === orderedDefs.length - 1;
            return `
            <div class="flex items-center gap-2 bg-gray-50 rounded-2xl pl-4 pr-2 py-2.5 transition-all" data-card-setting="${def.id}">
                <div class="flex items-center gap-3 flex-1 min-w-0">
                    <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style="background:${def.hex}15;color:${def.hex}">
                        <i class="ph-fill ${def.icon} text-base"></i>
                    </div>
                    <div class="min-w-0">
                        <p class="text-sm font-bold text-primary truncate">${def.label}</p>
                        <p class="text-[10px] text-gray-400 truncate">${def.desc}</p>
                    </div>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                    <button onclick="app.moveDashboardCard('${def.id}',-1)" class="w-7 h-7 rounded-lg flex items-center justify-center transition active:scale-90 ${isFirst ? 'text-gray-200 pointer-events-none' : 'text-gray-400 hover:bg-gray-200 active:bg-gray-300'}">
                        <i class="ph-bold ph-caret-up text-xs"></i>
                    </button>
                    <button onclick="app.moveDashboardCard('${def.id}',1)" class="w-7 h-7 rounded-lg flex items-center justify-center transition active:scale-90 ${isLast ? 'text-gray-200 pointer-events-none' : 'text-gray-400 hover:bg-gray-200 active:bg-gray-300'}">
                        <i class="ph-bold ph-caret-down text-xs"></i>
                    </button>
                    <label class="relative inline-flex items-center cursor-pointer ml-1">
                        <input type="checkbox" class="sr-only peer" ${isVisible ? 'checked' : ''}
                            onchange="app.toggleDashboardCard('${def.id}', this.checked)">
                        <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-secondary"></div>
                    </label>
                </div>
            </div>`;
        }).join('');
    },

    toggleDashboardCard: function(cardId, visible) {
        const prefs = this.getDashboardPrefs();
        prefs.visibility[cardId] = visible;
        this.saveDashboardPrefs(prefs);
        this.renderHome();
    },

    moveDashboardCard: function(cardId, direction) {
        const prefs = this.getDashboardPrefs();
        const idx = prefs.order.indexOf(cardId);
        if (idx < 0) return;
        const newIdx = idx + direction;
        if (newIdx < 0 || newIdx >= prefs.order.length) return;
        // Swap
        [prefs.order[idx], prefs.order[newIdx]] = [prefs.order[newIdx], prefs.order[idx]];
        this.saveDashboardPrefs(prefs);
        this.renderDashboardSettings();
        this.applyDashboardCardOrder();
    },

    applyDashboardCardOrder: function() {
        const prefs = this.getDashboardPrefs();
        const container = document.getElementById('homeCardsContainer');
        if (!container) return;
        // The first child is hero income/expense card — don't move it
        const heroCard = container.children[0];
        // Collect all orderable cards
        const cardElements = {};
        prefs.order.forEach(id => {
            const el = document.getElementById(id);
            if (el) cardElements[id] = el;
        });
        // Re-append in order (hero stays first)
        prefs.order.forEach(id => {
            if (cardElements[id]) {
                container.appendChild(cardElements[id]);
            }
        });
    },

    updateStreaksAsync: async function() {
        // Proxy to new implementation using current activeMonthDate
        return this.updateConsistencyCard(activeMonthDate || new Date());
    },

    updateConsistencyCard: async function(viewDate) {
        if (!currentUser) return;
        try {
            const now = new Date();
            const vYear = viewDate.getFullYear();
            const vMonth = viewDate.getMonth();
            const isCurrentMonth = vYear === now.getFullYear() && vMonth === now.getMonth();
            const daysInMonth = new Date(vYear, vMonth + 1, 0).getDate();
            // How many days of this month have passed (all days if past month, today's date if current)
            const daysPassed = isCurrentMonth ? now.getDate() : daysInMonth;
            const monthPrefix = `${vYear}-${String(vMonth + 1).padStart(2, '0')}`;

            const budget = currentProfile.monthlyBudget || DEFAULT_MONTHLY_BUDGET;
            const dailyBudget = Math.round(budget / daysInMonth);

            // Group transactions by date — only for the viewed month
            // All transaction types count for tracking; only non-excluded expenses for under-budget
            const txByDate = {};
            allTransactions.forEach(tx => {
                if (!tx.dateStr || !tx.dateStr.startsWith(monthPrefix)) return;
                if (!txByDate[tx.dateStr]) txByDate[tx.dateStr] = { expense: 0, count: 0 };
                txByDate[tx.dateStr].count++; // all types (income, expense, transfer)
                if (tx.type === 'Expense') {
                    // Respect exclude_from_budget on transaction or its category
                    const catDef = (currentProfile.categories || []).find(c => c.name === tx.category);
                    const excluded = tx.exclude_from_budget === true || (tx.exclude_from_budget === undefined && catDef?.exclude_from_budget === true);
                    if (!excluded) txByDate[tx.dateStr].expense += tx.amount;
                }
            });

            // Fetch no-spend days for the viewed month only
            const noSpendDates = new Set();
            try {
                const snapshot = await db.collection('daily_logs')
                    .where('user_id', '==', currentUser.uid)
                    .where('date', '>=', `${monthPrefix}-01`)
                    .where('date', '<=', `${monthPrefix}-31`)
                    .get();
                snapshot.forEach(doc => {
                    const d = doc.data();
                    if (d.status === 'no_spend' && d.date) noSpendDates.add(d.date);
                });
            } catch(e) { console.warn('daily_logs fetch failed (non-fatal):', e); }

            // ── Count consistency days ─────────────────────────────────────────
            let trackingDays = 0;
            let underBudgetDays = 0;

            for (let d = 1; d <= daysPassed; d++) {
                const dateStr = `${monthPrefix}-${String(d).padStart(2, '0')}`;
                // Tracking: at least 1 transaction (any type) OR no-spend day logged
                if ((txByDate[dateStr] && txByDate[dateStr].count > 0) || noSpendDates.has(dateStr)) {
                    trackingDays++;
                }
                // Under budget: budgetable expenses on that day ≤ daily budget
                const dayExpense = txByDate[dateStr] ? txByDate[dateStr].expense : 0;
                if (dayExpense <= dailyBudget) underBudgetDays++;
            }

            // ── Motivational message ──────────────────────────────────────────
            const monthNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
            const monthLabel = `${monthNames[vMonth]} ${vYear}`;
            const trackPct = daysPassed > 0 ? Math.round(trackingDays / daysPassed * 100) : 0;
            const budgetPct = daysPassed > 0 ? Math.round(underBudgetDays / daysPassed * 100) : 0;

            let msg = '';
            const isFuture = !isCurrentMonth && viewDate > now;
            if (isFuture) {
                msg = 'Belum ada data untuk bulan ini. Yuk mulai catat! ✍️';
            } else if (daysPassed === 0) {
                msg = 'Mulai catat transaksi hari ini! 💪';
            } else if (!isCurrentMonth) {
                // Past month — recap
                if (trackPct >= 90 && budgetPct >= 80) {
                    msg = `Bulan ${monthNames[vMonth]} luar biasa! Konsisten ${trackingDays}/${daysPassed} hari & hemat ${underBudgetDays}/${daysPassed} hari. 🏆`;
                } else if (trackPct >= 70) {
                    msg = `Bulan ${monthNames[vMonth]}: tracking ${trackingDays}/${daysPassed} hari dan ${underBudgetDays}/${daysPassed} hari di bawah budget. 👍`;
                } else {
                    msg = `Bulan ${monthNames[vMonth]}: tracking ${trackingDays}/${daysPassed} hari dan ${underBudgetDays}/${daysPassed} hari di bawah budget.`;
                }
            } else if (trackingDays === 0) {
                msg = 'Yuk mulai catat transaksi biar makin terkontrol! ✍️';
            } else if (trackPct >= 90 && budgetPct >= 80) {
                msg = `Luar biasa! Konsisten tracking ${trackingDays}/${daysPassed} hari dan hemat ${underBudgetDays}/${daysPassed} hari bulan ini! 🏆`;
            } else if (trackPct >= 70 && budgetPct >= 60) {
                msg = `Wow, kamu konsisten tracking ${trackingDays}/${daysPassed} hari dan ${underBudgetDays}/${daysPassed} hari di bawah budget! 🎉`;
            } else if (trackPct >= 50) {
                msg = `Tracking ${trackingDays}/${daysPassed} hari dan hemat ${underBudgetDays}/${daysPassed} hari. Tetap semangat! 💪`;
            } else {
                msg = `Sudah tracking ${trackingDays}/${daysPassed} hari dan ${underBudgetDays}/${daysPassed} hari di bawah budget. Bisa lebih baik! 🌱`;
            }

            // ── Update UI ─────────────────────────────────────────────────────
            const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
            setEl('trackingConsistencyCount', trackingDays);
            setEl('trackingConsistencyTotal', daysPassed);
            setEl('underBudgetCount', underBudgetDays);
            setEl('underBudgetTotal', daysPassed);
            setEl('consistencyMonthLabel', monthLabel);
            setEl('consistencyMessage', msg);
            setEl('dailyBudgetHint', `Budget harian: Rp ${dailyBudget.toLocaleString('id-ID')}`);

            const trackBar = document.getElementById('trackingConsistencyBar');
            if (trackBar) trackBar.style.width = `${daysPassed > 0 ? Math.round(trackingDays / daysPassed * 100) : 0}%`;
            const budgetBar = document.getElementById('underBudgetBar');
            if (budgetBar) budgetBar.style.width = `${daysPassed > 0 ? Math.round(underBudgetDays / daysPassed * 100) : 0}%`;

        } catch(e) { console.error('Error updating consistency card:', e); }
    },

    calculateMoodRing: function(budgetExp, inc, exp, monthTxs, viewDate) {
        const now = new Date();
        const isCurrentMonth = viewDate.getFullYear() === now.getFullYear() && viewDate.getMonth() === now.getMonth();
        const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
        const daysPassed = isCurrentMonth ? now.getDate() : daysInMonth;
        const budget = currentProfile.monthlyBudget || DEFAULT_MONTHLY_BUDGET;
        const dailyBudget = budget / daysInMonth;
        const todayStr = this.toLocalDateString(now);

        // 1. Budget Pace score (40 pts)
        let paceScore = 0;
        if (daysPassed > 0) {
            const expectedByToday = dailyBudget * daysPassed;
            const ratio = expectedByToday > 0 ? budgetExp / expectedByToday : 0;
            if (ratio <= 0.8) paceScore = 40;
            else if (ratio <= 1.0) paceScore = 30;
            else if (ratio <= 1.2) paceScore = 15;
            else paceScore = 0;
        } else { paceScore = 40; }

        // 2. Today's spending score (30 pts) — only relevant for current month
        let todayScore = 0;
        if (isCurrentMonth) {
            const todaySpent = monthTxs
                .filter(tx => tx.type === 'Expense' && tx.dateStr === todayStr)
                .reduce((s, tx) => {
                    const catDef = customCategories.find(c => c.name === tx.category);
                    const isExcluded = tx.exclude_from_budget === true || (tx.exclude_from_budget === undefined && catDef?.exclude_from_budget === true);
                    return isExcluded ? s : s + tx.amount;
                }, 0);
            if (todaySpent === 0) todayScore = 30;
            else if (todaySpent <= dailyBudget) todayScore = 20;
            else if (todaySpent <= dailyBudget * 2) todayScore = 10;
            else todayScore = 0;
        } else { todayScore = 20; } // past month, neutral

        // 3. Streak score (20 pts) — count consecutive days under daily budget
        let streak = 0;
        if (isCurrentMonth) {
            for (let d = daysPassed - 1; d >= 1; d--) {
                const dStr = this.toLocalDateString(new Date(viewDate.getFullYear(), viewDate.getMonth(), d));
                const daySpent = monthTxs
                    .filter(tx => tx.type === 'Expense' && tx.dateStr === dStr)
                    .reduce((s, tx) => {
                        const catDef = customCategories.find(c => c.name === tx.category);
                        const isExcluded = tx.exclude_from_budget === true || (tx.exclude_from_budget === undefined && catDef?.exclude_from_budget === true);
                        return isExcluded ? s : s + tx.amount;
                    }, 0);
                if (daySpent <= dailyBudget) streak++;
                else break;
            }
        }
        const streakScore = streak >= 7 ? 20 : streak >= 3 ? 12 : streak >= 1 ? 6 : 0;

        // 4. Saving rate MTD (10 pts)
        let srScore = 0;
        if (inc > 0) {
            const sr = (inc - exp) / inc * 100;
            if (sr >= 20) srScore = 10;
            else if (sr >= 10) srScore = 6;
            else if (sr > 0) srScore = 3;
        }

        const total = paceScore + todayScore + streakScore + srScore;

        let color, iconClass, label;
        if (total >= 80) {
            color = '#10B981'; iconClass = 'ph-smiley';
            const labels = ['Finansial lagi glowing ✨', 'Dompet sehat, vibes bagus 🌿', 'Lo lagi on fire! 🔥'];
            label = labels[streak % labels.length];
        } else if (total >= 60) {
            color = '#F59E0B'; iconClass = 'ph-smiley-meh';
            const labels = ['Masih oke, jaga ritme 🎯', 'Stabil, jangan kendor ya', 'Good vibes, lanjutkan! 👌'];
            label = labels[streak % labels.length];
        } else if (total >= 40) {
            color = '#F97316'; iconClass = 'ph-smiley-sad';
            const labels = ['Pace mulai ngepas ⚡', 'Hati-hati, mulai miring nih', 'Agak boros hari ini 😬'];
            label = labels[daysPassed % labels.length];
        } else {
            color = '#EF4444'; iconClass = 'ph-smiley-sad';
            const labels = ['Budget SOS mode 🚨', 'Dompet menangis 😭', 'Perlu rem sekarang!'];
            label = labels[daysPassed % labels.length];
        }

        return { total, color, iconClass, label, streak };
    },

    renderHome: function() {
        this.updateMonthLabels();
        this.updateConsistencyCard(activeMonthDate || new Date());
        const viewDate = activeMonthDate;
        const now = new Date();
        const curYear = viewDate.getFullYear(), curMonth = viewDate.getMonth();
        const curMonthStr = this.getCurrentMonthKey(viewDate);
        const monthTxs = allTransactions.filter(tx => tx.dateStr.startsWith(curMonthStr));

        // Previous month transactions
        const prevDate = new Date(curYear, curMonth - 1, 1);
        const prevMonthStr = this.getCurrentMonthKey(prevDate);
        const todayLocal = this.toLocalDateString(now);
        const prevLocal = this.toLocalDateString(prevDate);
        const prevMonthTxs = allTransactions.filter(tx => tx.dateStr.startsWith(prevMonthStr));

        let inc = 0, exp = 0, budgetExp = 0, cats = {};
        monthTxs.forEach(tx => {
            if(tx.type === 'Income') inc += tx.amount;
            else if(tx.type === 'Expense') {
                exp += tx.amount;
                cats[tx.category] = (cats[tx.category]||0) + tx.amount;
                // Only count in-budget transactions for budget tracking
                const catDef = customCategories.find(c => c.name === tx.category);
                const isExcluded = tx.exclude_from_budget === true || (tx.exclude_from_budget === undefined && catDef?.exclude_from_budget === true);
                if (!isExcluded) budgetExp += tx.amount;
            }
        });

        let prevInc = 0, prevExp = 0;
        prevMonthTxs.forEach(tx => {
            if(tx.type === 'Income') prevInc += tx.amount;
            else if(tx.type === 'Expense') prevExp += tx.amount;
        });

        document.getElementById('homeIncome').textContent = `Rp ${this.format(inc)}`;
        document.getElementById('homeExpense').textContent = `Rp ${this.format(exp)}`;

        // Mood Ring
        const isCurrentMonth = viewDate.getFullYear() === now.getFullYear() && viewDate.getMonth() === now.getMonth();
        const mood = this.calculateMoodRing(budgetExp, inc, exp, monthTxs, viewDate);
        const moodIcon = document.getElementById('moodRingIcon');
        const moodLabel = document.getElementById('moodRingLabel');
        if (moodIcon) {
            moodIcon.className = `ph-fill ${mood.iconClass} text-sm shrink-0 transition-colors`;
            moodIcon.style.color = mood.color;
        }
        if (moodLabel) moodLabel.textContent = mood.label;

        const prefs = this.getDashboardPrefs();
        const showPerf = prefs.visibility.cardPerformance !== false;
        const showStatus = prefs.visibility.cardStatus !== false;
        const showGenZ = prefs.visibility.cardTopTransactions !== false;
        const showInsight = prefs.visibility.cardInsightCarousel !== false;
        const showConsistency = prefs.visibility.cardGamificationStreaks !== false;
        const showSubscriptions = prefs.visibility.cardSubscriptions !== false;
        const showPayday = prefs.visibility.cardPayday !== false;
        const showNoSpend = prefs.visibility.cardNoSpend !== false;
        const showRecent = prefs.visibility.cardRecentTransactions !== false;
        const showMini = prefs.visibility.cardTodayMini !== false;

        if (!showGenZ && this._homeTopCategoryChart) {
            this._homeTopCategoryChart.destroy();
            this._homeTopCategoryChart = null;
        }

        const miniEl = document.getElementById('cardTodayMini');
        if (miniEl) miniEl.style.display = showMini ? 'block' : 'none';
        document.getElementById('cardPerformance').style.display = showPerf ? 'block' : 'none';
        document.getElementById('cardStatus').style.display = showStatus ? 'block' : 'none';
        document.getElementById('cardTopTransactions').style.display = showGenZ ? 'block' : 'none';
        document.getElementById('cardInsightCarousel').style.display = showInsight ? 'block' : 'none';
        document.getElementById('cardGamificationStreaks').style.display = showConsistency ? 'block' : 'none';
        document.getElementById('cardSubscriptions').style.display = showSubscriptions ? 'block' : 'none';
        document.getElementById('cardPayday').style.display = showPayday ? 'block' : 'none';
        document.getElementById('cardNoSpend').style.display = showNoSpend ? 'block' : 'none';
        document.getElementById('cardRecentTransactions').style.display = showRecent ? 'block' : 'none';

        // Apply card order from settings
        this.applyDashboardCardOrder();

        if(showPayday) this.renderPaydayCard(budgetExp);
        if(showPerf) this.buildPerformanceCard(inc, exp, prevInc, prevExp, cats, viewDate);
        if(showStatus) this.buildStatusCard(budgetExp, monthTxs, viewDate);

        // Update No Spend Streak
        if (showNoSpend) {
            (async () => {
                try {
                    if (!currentUser) return;
                    const badge = document.getElementById('noSpendStreakBadge');
                    const countEl = document.getElementById('noSpendStreakCount');
                    if (!badge || !countEl) return;
                    // Count consecutive no-spend days ending today (up to 30 days)
                    let streak = 0;
                    const today = new Date();
                    for (let i = 0; i < 30; i++) {
                        const d = new Date(today); d.setDate(today.getDate() - i);
                        const dStr = this.toLocalDateString(d);
                        const hasTx = allTransactions.some(tx => tx.dateStr === dStr && tx.type === 'Expense');
                        if (hasTx) break;
                        const docId = `${dStr}_${currentUser.uid}`;
                        const doc = await db.collection('daily_logs').doc(docId).get();
                        if (doc.exists && doc.data().status === 'no_spend') streak++;
                        else break;
                    }
                    if (streak >= 2) {
                        countEl.textContent = streak;
                        badge.classList.remove('hidden');
                        badge.classList.add('flex');
                    } else {
                        badge.classList.add('hidden');
                        badge.classList.remove('flex');
                    }
                } catch(e) { /* silent */ }
            })();
        }

        if(showGenZ) { try { // guarded block
            const expTxs = monthTxs.filter(t => t.type === 'Expense').sort((a,b) => b.amount - a.amount).slice(0, 3);
            const sortedCats = Object.keys(cats).map(k => ({ cat: k, amt: cats[k] })).sort((a,b) => b.amt - a.amt);
            const topFiveCats = sortedCats.slice(0, 5);
            const othersAmount = sortedCats.slice(5).reduce((sum, item) => sum + item.amt, 0);
            const totalExpForChart = sortedCats.reduce((sum, item) => sum + item.amt, 0);
            const polarCats = [
                ...topFiveCats,
                { cat: 'Lainnya', amt: othersAmount }
            ];
            while (polarCats.length < 6) {
                polarCats.splice(polarCats.length - 1, 0, { cat: `Kategori ${polarCats.length + 1}`, amt: 0 });
            }

            const polarColors = polarCats.map((c) => {
                if (c.cat === 'Lainnya') return '#94A3B8';
                return this.getCategoryDef(c.cat).color;
            });
            const polarBackgroundColors = polarColors.map(col => {
                // hex to rgba 60%
                const r = parseInt(col.slice(1,3),16), g = parseInt(col.slice(3,5),16), b = parseInt(col.slice(5,7),16);
                return `rgba(${r},${g},${b},0.60)`;
            });

            const topCat = sortedCats[0];
            const topCatPct = totalExpForChart > 0 && topCat ? Math.round((topCat.amt / totalExpForChart) * 100) : 0;
            const _gnWantsVisible = sortedCats.slice(0, 5).filter(c => { const def = customCategories?.find(x => x.name === c.cat); return def?.nature === 'wants'; });
            const _gnWantsHidden = sortedCats.slice(5).filter(c => { const def = customCategories?.find(x => x.name === c.cat); return def?.nature === 'wants'; });
            const _gnHiddenWantsAmt = _gnWantsHidden.reduce((s, c) => s + c.amt, 0);
            const _gnHiddenWantsPct = totalExpForChart > 0 && _gnHiddenWantsAmt > 0 ? Math.round((_gnHiddenWantsAmt / totalExpForChart) * 100) : 0;
            const _gnTopCatNature = sortedCats[0] ? (customCategories?.find(x => x.name === sortedCats[0].cat)?.nature || '') : '';
            const _gnTotalWantsAmt = sortedCats.filter(c => { const def = customCategories?.find(x => x.name === c.cat); return def?.nature === 'wants'; }).reduce((s, c) => s + c.amt, 0);
            const _gnTotalWantsPct = totalExpForChart > 0 ? Math.round((_gnTotalWantsAmt / totalExpForChart) * 100) : 0;
            const genZInsight = totalExpForChart <= 0
                ? 'Belum ada spending bulan ini, gas catat transaksi dulu biar chart-nya gak kosong, bestie ✨'
                : _gnHiddenWantsPct >= 10
                    ? `Psst! Di balik "Lainnya" ada ${_gnHiddenWantsPct}% wants spending (Rp ${this.format(_gnHiddenWantsAmt)}) yang keselip. Jangan sampe lo gak sadar jajan segini bestie 👀`
                    : _gnTotalWantsPct >= 45
                        ? `Wah, ${_gnTotalWantsPct}% dari pengeluaran lo itu kategori Wants! ${topCat.cat} paling royal di ${topCatPct}%. Coba tahan dikit biar dompet bisa napas 😮‍💨`
                        : topCatPct >= 40 && _gnTopCatNature === 'must'
                            ? `${topCat.cat} nyedot ${topCatPct}% karena emang kebutuhan primer. Fixed cost lo berat — coba cari cara buat boost income ya 💪`
                            : topCatPct >= 40
                                ? `Heads up bestie, kategori ${topCat.cat} lagi nyedot ${topCatPct}% pengeluaran lo. Rem dikit biar dompet gak mode panic 😵‍💫`
                                : `Cakep! Spending lo cukup ke-sebar. Kategori ${topCat.cat} paling gede di ${topCatPct}%, masih aman buat jaga cashflow 🔥`;

            const txRows = expTxs.length ? expTxs.map((t, i) => {
                const def = this.getCategoryDef(t.category);
                const medals = ['🥇','🥈','🥉'];
                const dateObj = this.parseLocalDateString(t.dateStr);
                const dateLabel = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
                return `
                <div class="flex items-center gap-3 bg-gray-50 rounded-2xl p-3">
                    <span class="text-lg leading-none">${medals[i]}</span>
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style="background:${def.color}15;color:${def.color}">
                        <i class="ph-fill ${def.icon} text-base"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-xs font-bold text-primary truncate">${t.note || t.category}</p>
                        <p class="text-[10px] text-gray-400 mt-0.5">${dateLabel} · ${t.category}</p>
                    </div>
                    <span class="text-xs font-bold text-danger shrink-0">-Rp ${this.format(t.amount)}</span>
                </div>`;
            }).join('') : '<p class="text-xs text-gray-400 text-center py-3">Belum ada transaksi</p>';

            const catRows = polarCats.length ? polarCats.map((c, i) => {
                const pct = totalExpForChart > 0 ? Math.round((c.amt / totalExpForChart) * 100) : 0;
                const displayName = c.cat === 'Lainnya' ? 'Lainnya' : c.cat;
                return `
                <div class="flex items-center justify-between gap-2 text-[11px]">
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${polarColors[i]}"></span>
                        <span class="font-semibold text-primary truncate">${displayName}</span>
                    </div>
                    <span class="text-gray-500 font-semibold shrink-0">${pct}% • Rp ${this.format(c.amt)}</span>
                </div>`;
            }).join('') : '<p class="text-xs text-gray-400 text-center py-3">Belum ada data</p>';

            document.getElementById('homeTopSpendingContent').innerHTML = `
                <div class="flex items-center justify-between mb-5">
                    <div class="flex items-center gap-2.5">
                        <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-red-500/10 to-orange-500/10 text-danger flex items-center justify-center">
                            <i class="ph-fill ph-flame text-base"></i>
                        </div>
                        <div>
                            <p class="text-[9px] uppercase tracking-[0.15em] text-gray-400 font-bold">Bulan ini</p>
                            <p class="text-sm font-bold text-primary font-heading leading-none">Top Spending</p>
                        </div>
                    </div>
                    <div class="bg-danger/10 px-3 py-1.5 rounded-xl">
                        <p class="text-[9px] text-danger/70 font-bold uppercase">Total</p>
                        <p class="text-sm font-bold text-danger font-heading">Rp ${this.format(exp)}</p>
                    </div>
                </div>
                <div class="space-y-4">
                    <div>
                        <p class="text-[10px] uppercase tracking-[0.15em] text-gray-400 font-bold mb-2.5 flex items-center gap-1.5"><i class="ph-fill ph-trophy text-secondary"></i>Top 3 Transaksi</p>
                        <div class="space-y-2">${txRows}</div>
                    </div>
                    <hr class="border-gray-100">
                    <div>
                        <p class="text-[10px] uppercase tracking-[0.15em] text-gray-400 font-bold mb-2.5 flex items-center gap-1.5"><i class="ph-fill ph-chart-polar text-tertiary"></i>Top Kategori (Polar 6 Area)</p>
                        <div class="h-56 w-full"><canvas id="homeTopCategoryPolarChart"></canvas></div>
                        <div class="space-y-2 mt-3">${catRows}</div>
                        <div class="mt-3 rounded-2xl bg-secondary/10 border border-secondary/20 p-3">
                            <p class="text-[11px] leading-relaxed text-primary"><span class="font-bold">Insight Gen-Z:</span> ${genZInsight}</p>
                        </div>
                    </div>
                </div>
            `;

            if (this._homeTopCategoryChart) this._homeTopCategoryChart.destroy();
            const topCatCtx = document.getElementById('homeTopCategoryPolarChart')?.getContext('2d');
            if (topCatCtx) {
                this._homeTopCategoryChart = new Chart(topCatCtx, {
                    type: 'polarArea',
                    data: {
                        labels: polarCats.map(c => c.cat),
                        datasets: [{
                            data: polarCats.map(c => c.amt),
                            backgroundColor: polarBackgroundColors,
                            borderColor: polarColors,
                            borderWidth: 1.5
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                callbacks: {
                                    label: (context) => {
                                        const value = context.parsed?.r ?? 0;
                                        return `${context.label}: Rp ${this.format(value)}`;
                                    }
                                }
                            }
                        },
                        scales: {
                            r: {
                                ticks: {
                                    display: false,
                                    backdropColor: 'transparent'
                                },
                                grid: { color: 'rgba(148, 163, 184, 0.2)' },
                                angleLines: { color: 'rgba(148, 163, 184, 0.2)' }
                            }
                        }
                    }
                });
            }
        } catch(e) { console.error('renderHome showGenZ error:', e); }
        } // end if(showGenZ)

        // ── InsightCarousel Deep Insights ─────────────────────────────────────
        try { this.renderInsightCarousel(monthTxs, viewDate); } catch(e) { console.error('renderInsightCarousel error:', e); }

        // Recent 5
        const recent = allTransactions.slice(0,5);
        document.getElementById('homeRecentList').innerHTML = recent.map(t => {
            const def = this.getCategoryDef(t.category);
            return `
            <div class="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center" style="background:${t.type==='Transfer'?'#DBEAFE':def.color+'20'};color:${t.type==='Transfer'?'#3B82F6':def.color}"><i class="ph-bold ${t.type==='Transfer'?'ph-arrows-left-right':def.icon}"></i></div>
                    <div><p class="text-xs font-bold text-primary">${t.note || t.category || 'Transfer'}</p><p class="text-[9px] text-gray-400">${t.dateStr}</p></div>
                </div>
                <div class="text-xs font-bold ${t.type==='Income'?'text-success':t.type==='Expense'?'text-primary':'text-blue-500'}">${t.type==='Expense'?'-':''} Rp ${this.format(t.amount)}</div>
            </div>
            `;
        }).join('');
    },

    renderPaydayCard: function(budgetExp) {
        const paydayDate = currentProfile.paydayDate || 25; // default to 25
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const today = now.getDate();
        const curMonthStr = this.getCurrentMonthKey(now);

        // Calculate next payday (follows the income-anchored cycle used by Day Mode when it's available)
        let nextPayday = new Date(year, month, paydayDate);
        if (today > paydayDate) {
            nextPayday = new Date(year, month + 1, paydayDate);
        }
        const cyc = this.getBudgetCycle(now);
        const followCycle = cyc.source === 'salary' || cyc.source === 'largest';
        if (followCycle) nextPayday = cyc.end;

        // Calculate days left
        const diffTime = nextPayday - now;
        const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const totalDaysInCycle = followCycle ? cyc.totalDays : new Date(nextPayday.getFullYear(), nextPayday.getMonth(), 0).getDate();

        // Update UI
        const targetDateStr = nextPayday.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();
        document.getElementById('paydayTargetDate').textContent = targetDateStr;
        document.getElementById('paydayDaysLeft').textContent = daysLeft;
        const totalDaysEl = document.getElementById('paydayTotalDays');
        if (totalDaysEl) totalDaysEl.textContent = totalDaysInCycle + ' DAYS';

        // Circular Gauge Calculation
        const gauge = document.getElementById('paydayGauge');
        const circumference = 2 * Math.PI * 36;
        const progress = Math.max(0, 1 - (daysLeft / totalDaysInCycle));
        if (gauge) {
            gauge.style.strokeDashoffset = circumference * (1 - progress);
        }

        // Build per-day transaction map for the current month
        const monthTxs = allTransactions.filter(tx => (tx.dateStr || '').startsWith(curMonthStr));
        const dailyBudget = (currentProfile.monthlyBudget || DEFAULT_MONTHLY_BUDGET) / totalDaysInCycle;
        const dayMap = {}; // { 'YYYY-MM-DD': { hasTx, totalExp } }
        monthTxs.forEach(tx => {
            const dk = tx.dateStr || '';
            if (!dk) return;
            if (!dayMap[dk]) dayMap[dk] = { hasTx: false, totalExp: 0 };
            dayMap[dk].hasTx = true;
            if (tx.type === 'Expense') dayMap[dk].totalExp += tx.amount;
        });

        // Generate smart dot calendar — max 7 per row via CSS grid
        const grid = document.getElementById('paydayCalendarGrid');
        if (grid) {
            let dotsHTML = '';
            for (let i = 1; i <= totalDaysInCycle; i++) {
                const dk = `${year}-${String(month + 1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
                const dayData = dayMap[dk];
                let dotClass, title, innerHTML = '';
                if (i === today && month === now.getMonth() && year === now.getFullYear()) {
                    // Today — blue highlight, slightly bigger
                    dotClass = 'w-2 h-2 rounded-full bg-blue-500 shadow shadow-blue-300 ring-2 ring-blue-200';
                    title = `Hari ini (${i})`;
                } else if (i > today) {
                    // Future — light indigo
                    dotClass = 'w-1.5 h-1.5 rounded-full bg-indigo-100';
                    title = `${i}`;
                } else if (!dayData || !dayData.hasTx) {
                    // Past, no records — gray
                    dotClass = 'w-1.5 h-1.5 rounded-full bg-gray-300';
                    title = `${i}: tidak ada catatan`;
                } else if (dayData.totalExp > dailyBudget * 1.2) {
                    // Over budget day — red
                    dotClass = 'w-1.5 h-1.5 rounded-full bg-red-400';
                    title = `${i}: over budget`;
                } else {
                    // Has transactions, on track — green
                    dotClass = 'w-1.5 h-1.5 rounded-full bg-emerald-400';
                    title = `${i}: tercatat`;
                }
                dotsHTML += `<div class="flex items-center justify-center"><div class="${dotClass} flex items-center justify-center" title="${title}">${innerHTML}</div></div>`;
            }
            // Payday bullseye always at the very end as the goal/destination
            dotsHTML += `<div class="flex items-center justify-center"><div class="w-4 h-4 rounded-full border-2 border-indigo-500 flex items-center justify-center" title="Payday! (${paydayDate})"><div class="w-1.5 h-1.5 rounded-full bg-indigo-500"></div></div></div>`;
            grid.innerHTML = dotsHTML;
        }

        // Income-based insight
        const monthIncome = monthTxs.filter(t => t.type === 'Income').reduce((s, t) => s + t.amount, 0);
        const monthExpense = monthTxs.filter(t => t.type === 'Expense').reduce((s, t) => s + t.amount, 0);
        const incomeLeft = Math.max(0, monthIncome - monthExpense);
        const savingsTarget = Math.round(monthIncome * 0.2);
        const spendableLeft = Math.max(0, incomeLeft - savingsTarget);
        const dailyAllowance = daysLeft > 0 ? Math.floor(spendableLeft / daysLeft) : 0;

        let insightStr = '';
        if (daysLeft === 0) {
            insightStr = "Payday! 🎉 Saatnya atur budget bulan baru yang fresh.";
        } else if (daysLeft === 1) {
            insightStr = "Besok payday lhooo! 🎉 Tahan dulu ya, sehari lagi!";
        } else if (monthIncome === 0) {
            insightStr = `Belum ada income bulan ini. Catat pemasukan dulu biar kalkulasinya akurat ya!`;
        } else if (incomeLeft <= 0) {
            insightStr = `Pengeluaran udah melebihi income bulan ini! 🚨 ${daysLeft} hari lagi gajian. Rem pengeluaran sekarang.`;
        } else if (spendableLeft <= 0) {
            insightStr = `Sisa income Rp ${this.format(incomeLeft)} sebaiknya full disimpen buat target 20% saving. ${daysLeft} hari lagi gajian, tahan dulu! 💪`;
        } else {
            insightStr = `Sisa income Rp ${this.format(incomeLeft)} untuk ${daysLeft} hari. Jangan lupa simpan 20% (Rp ${this.format(savingsTarget)}) — batas aman harimu sekitar Rp ${this.format(dailyAllowance)}/hari. 🎯`;
        }
        document.getElementById('paydayInsight').textContent = insightStr;
    },

    showDayDetail: function(year, month, day) {
        const txs = (this._reportDailyTxs && this._reportDailyTxs[day - 1]) || [];
        const inc = txs.filter(t => t.type === 'Income').reduce((s, t) => s + t.amount, 0);
        const exp = txs.filter(t => t.type === 'Expense').reduce((s, t) => s + t.amount, 0);
        const bal = inc - exp;
        const dateLabel = new Date(year, month, day).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        const fmt = v => 'Rp ' + this.format(v);
        const balColor = bal >= 0 ? 'text-emerald-500' : 'text-red-500';

        const maxShow = 6;
        const shown = txs.slice(0, maxShow);
        const rest = txs.length - maxShow;
        const restAmt = rest > 0 ? txs.slice(maxShow).reduce((s, t) => s + (t.type === 'Expense' ? t.amount : -t.amount), 0) : 0;
        const txRows = shown.map(tx => {
            const def = this.getCategoryDef(tx.category);
            const isInc = tx.type === 'Income';
            return `<div class="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style="background:${def.color}15;color:${def.color}"><i class="ph-fill ${def.icon} text-sm"></i></div>
                <div class="flex-1 min-w-0">
                    <p class="text-xs font-bold text-primary truncate">${tx.note || tx.category}</p>
                    <p class="text-[10px] text-gray-400">${tx.category}</p>
                </div>
                <span class="text-xs font-bold ${isInc ? 'text-emerald-500' : 'text-red-500'}">${isInc ? '+' : '-'}${fmt(tx.amount)}</span>
            </div>`;
        }).join('');
        const restRow = rest > 0 ? `<p class="text-[10px] text-gray-400 text-center pt-2">+${rest} transaksi lainnya sejumlah ${fmt(Math.abs(restAmt))}</p>` : '';

        document.getElementById('dayDetailDate').textContent = day;
        document.getElementById('dayDetailDateLabel').textContent = dateLabel;
        document.getElementById('dayDetailInc').textContent = inc > 0 ? '+' + fmt(inc) : '-';
        document.getElementById('dayDetailExp').textContent = exp > 0 ? '-' + fmt(exp) : '-';
        document.getElementById('dayDetailBal').textContent = (bal >= 0 ? '+' : '') + fmt(bal);
        document.getElementById('dayDetailBal').className = `text-sm font-extrabold ${balColor}`;
        document.getElementById('dayDetailTxList').innerHTML = txs.length > 0 ? txRows + restRow : '<p class="text-[11px] text-gray-400 text-center py-4">Tidak ada transaksi</p>';

        const modal = document.getElementById('dayDetailModal');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    },

    closeDayDetail: function() {
        const modal = document.getElementById('dayDetailModal');
        modal.classList.remove('flex');
        modal.classList.add('hidden');
    },

    savePayday: async function() {
        const val = parseInt(document.getElementById('settingsPaydayInput').value);
        if (!val || val < 1 || val > 31) return this.toast('Tanggal tidak valid', true);
        try {
            await db.collection('users').doc(currentUser.uid).update({ paydayDate: val });
            currentProfile.paydayDate = val;
            this.toast('Tanggal gajian disimpan!');
        } catch(e) { this.toast(e.message, true); }
    },

    // ── DAY MODE: Today's Budget ────────────────────────────────────────────
    // Income & recurring bills are spread evenly across the payday cycle.
    // Whatever isn't spent rolls over to the next day.
    _recurringCache: null,      // recurring_transactions docs (null = not loaded yet)
    _todayState: null,
    _todayLastLeft: null,
    _todayIntro: false,
    _todayGreeted: false,
    _todayTaglineTimer: null,
    _todayTaglineIdx: 0,
    _todayTaglines: [
        "We spread your bills out daily, just like your income. What's left is yours to spend.",
        "Anything you don't spend rolls over to tomorrow's budget.",
        "These numbers will change as you spend, save, or add money."
    ],

    getHomeMode: function() {
        try { return localStorage.getItem('dirhamku_home_mode') === 'day' ? 'day' : 'month'; } catch(e) { return 'month'; }
    },

    setHomeMode: function(mode) {
        try { localStorage.setItem('dirhamku_home_mode', mode === 'day' ? 'day' : 'month'); } catch(e) { /* ignore */ }
        this.switchTab(mode === 'day' ? 'today' : 'home');
    },

    _isTodayActive: function() {
        const el = document.getElementById('tab-today');
        return !!el && !el.classList.contains('hidden');
    },

    // Moves the single chat UI between the Input tab and Day Mode, keeping its history & listeners.
    _mountChat: function(where) {
        const chat = document.getElementById('inputChatMode');
        const slot = document.getElementById('todayChatSlot');
        const tabInput = document.getElementById('tab-input');
        const form = document.getElementById('inputFormMode');
        if (!chat || !slot || !tabInput || !form) return;
        if (where === 'today') {
            if (chat.parentElement !== slot) slot.appendChild(chat);
            chat.classList.remove('hidden');
            chat.classList.add('flex');
        } else if (chat.parentElement !== tabInput) {
            tabInput.insertBefore(chat, form);
            const formVisible = !form.classList.contains('hidden');
            chat.classList.toggle('hidden', formVisible);
            chat.classList.toggle('flex', !formVisible);
        }
    },

    _dayDiff: function(a, b) {
        return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
    },

    // Finds the income that starts the current budget cycle, so the cycle follows when money actually
    // arrived (salary on the 1st, paid early on a weekend, paid late...) instead of a fixed date.
    //   1) latest Salary/Gaji income within 45 days (ignoring small ones, <50% of the biggest)
    //   2) else the biggest income within 45 days
    _detectCycleAnchor: function(today) {
        const todayStr = this.toLocalDateString(today);
        const minStr = this.toLocalDateString(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 45));
        const incomes = allTransactions.filter(tx => tx.type === 'Income' && tx.dateStr && tx.dateStr >= minStr && tx.dateStr <= todayStr);
        if (!incomes.length) return null;
        const salaries = incomes.filter(tx => /^(salary|gaji)$/i.test((tx.category || '').trim()));
        if (salaries.length) {
            const maxAmt = Math.max(...salaries.map(tx => tx.amount));
            const pick = salaries.filter(tx => tx.amount >= maxAmt * 0.5).sort((a, b) => b.dateStr.localeCompare(a.dateStr))[0];
            return { kind: 'salary', dateStr: pick.dateStr, amount: pick.amount };
        }
        const pick = incomes.slice().sort((a, b) => (b.amount - a.amount) || b.dateStr.localeCompare(a.dateStr))[0];
        return { kind: 'largest', dateStr: pick.dateStr, amount: pick.amount };
    },

    // Current budget cycle [start, end): from the last payday to the next one.
    // source: 'salary' | 'largest' (auto, anchored on a real income) | 'default' (auto but no income yet) | 'manual'
    getBudgetCycle: function(now = new Date()) {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const manualDay = Math.min(Math.max(parseInt(currentProfile?.paydayDate) || 25, 1), 31);
        const clampDay = (y, m, day) => new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()));
        const isManual = currentProfile?.dayModeCycle === 'manual';
        const anchor = isManual ? null : this._detectCycleAnchor(today);
        let start, end, source;
        if (anchor) {
            source = anchor.kind;
            start = this.parseLocalDateString(anchor.dateStr);
            end = clampDay(start.getFullYear(), start.getMonth() + 1, start.getDate());
        } else {
            source = isManual ? 'manual' : 'default';
            start = clampDay(today.getFullYear(), today.getMonth(), manualDay);
            if (start > today) start = clampDay(today.getFullYear(), today.getMonth() - 1, manualDay);
            end = clampDay(start.getFullYear(), start.getMonth() + 1, manualDay);
        }
        const dayIndex = this._dayDiff(start, today);
        // Next salary hasn't arrived by the expected date: keep the cycle open, everything left is for today.
        const overdue = dayIndex >= this._dayDiff(start, end);
        if (overdue) end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
        return {
            start, end, today, source, anchor, overdue, manualDay,
            lastDay: new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1),
            totalDays: this._dayDiff(start, end),
            dayIndex,
            startStr: this.toLocalDateString(start),
            todayStr: this.toLocalDateString(today)
        };
    },

    _isBudgetExcluded: function(tx) {
        const catDef = customCategories.find(c => c.name === tx.category);
        return tx.exclude_from_budget === true || (tx.exclude_from_budget === undefined && catDef?.exclude_from_budget === true);
    },

    // Expenses that eat the daily budget: not a recurring bill (already reserved) and not excluded from budget.
    _isDailySpend: function(tx) {
        return tx.type === 'Expense' && !tx.recurringId && !this._isBudgetExcluded(tx) && !(this._billMatched && this._billMatched.has(tx.id));
    },

    _isSavingsAccount: function(accountId) {
        const a = accounts.find(x => x.id === accountId);
        return !!a && (a.purpose === 'emergency_fund' || a.is_excluded_from_budget === true);
    },

    _billMatched: null,   // txId -> bill, manual expenses recognised as paying a recurring bill this cycle

    // A bill is already reserved out of the budget, so paying it must not also eat the daily budget.
    // Payments made with the ✓ button carry recurringId; manual ones are matched by category + amount (±10%).
    // Each bill can claim at most as many payments as it has occurrences per cycle (paid ones count).
    _matchManualBills: function(bills, c) {
        const matched = new Map();
        const paid = {};
        const expenses = allTransactions.filter(tx => tx.type === 'Expense' && tx.dateStr && tx.dateStr >= c.startStr && tx.dateStr <= c.todayStr);
        expenses.forEach(tx => { if (tx.recurringId) (paid[tx.recurringId] = paid[tx.recurringId] || []).push(tx); });
        const pool = expenses.filter(tx => !tx.recurringId && !this._isBudgetExcluded(tx));
        const norm = t => (t || '').toLowerCase().trim();
        bills.forEach(b => {
            b.paidTxs = paid[b.id] ? paid[b.id].slice() : [];
            const slots = Math.max(1, Math.round(b.perCycle / b.amount)) - b.paidTxs.length;
            if (slots <= 0) return;
            const name = norm(b.name);
            pool.filter(tx => !matched.has(tx.id) && norm(tx.category) === norm(b.category) && Math.abs(tx.amount - b.amount) <= b.amount * 0.1)
                .map(tx => { const n = norm(tx.note); return { tx, noteMiss: name && n && (n.includes(name) || name.includes(n)) ? 0 : 1, diff: Math.abs(tx.amount - b.amount) }; })
                .sort((x, y) => x.noteMiss - y.noteMiss || x.diff - y.diff || x.tx.dateStr.localeCompare(y.tx.dateStr))
                .slice(0, slots)
                .forEach(({ tx }) => { matched.set(tx.id, b); b.paidTxs.push(tx); });
        });
        return matched;
    },

    computeTodayBudget: function() {
        const c = this.getBudgetCycle();
        const yesterdayStr = this.toLocalDateString(new Date(c.today.getFullYear(), c.today.getMonth(), c.today.getDate() - 1));
        const bills = (this._recurringCache || [])
            .filter(r => Number(r.amount) > 0 && (!r.endDate || r.endDate >= c.startStr))
            .map(r => {
                const amt = Number(r.amount);
                let perCycle = amt;
                if (r.frequency === 'weekly') perCycle = amt * c.totalDays / 7;
                else if (r.frequency === 'yearly') perCycle = amt / 12;
                else if (r.frequency === 'daily') perCycle = amt * c.totalDays;
                return { id: r.id, name: r.note || r.category || 'Tagihan', category: r.category, amount: amt, frequency: r.frequency, perCycle, perDay: perCycle / c.totalDays };
            })
            .sort((a, b) => b.perCycle - a.perCycle);
        const billsTotal = bills.reduce((s, b) => s + b.perCycle, 0);
        this._billMatched = this._recurringCache ? this._matchManualBills(bills, c) : new Map();

        // Per-day money movements within the cycle (up to today)
        const income = {}, spend = {}, savNet = {};
        let incomeCount = 0;
        allTransactions.forEach(tx => {
            const d = tx.dateStr;
            if (!d || d < c.startStr || d > c.todayStr) return;
            if (tx.type === 'Income') {
                income[d] = (income[d] || 0) + tx.amount;
                incomeCount++;
            } else if (tx.type === 'Transfer') {
                const fromS = this._isSavingsAccount(tx.fromAccountId);
                const toS = this._isSavingsAccount(tx.toAccountId);
                if (!fromS && toS) savNet[d] = (savNet[d] || 0) - tx.amount;
                else if (fromS && !toS) savNet[d] = (savNet[d] || 0) + tx.amount;
            } else if (this._isDailySpend(tx)) {
                spend[d] = (spend[d] || 0) + tx.amount;
            }
        });
        const sumWhere = (map, test) => Object.keys(map).filter(test).reduce((s, k) => s + map[k], 0);

        // Money available for day X = income & savings moves up to X − bills − spending before X,
        // spread over the days left (X until payday). Income pushes the daily budget up,
        // spending pushes it down, and whatever isn't spent rolls into the following days.
        const poolFor = (x) => sumWhere(income, d => d <= x) + sumWhere(savNet, d => d <= x) - billsTotal - sumWhere(spend, d => d < x);
        // Days the remaining money is spread over (incl. today). When salary is late, use a 7-day buffer
        // instead of dumping everything on one day.
        const daysLeft = c.overdue ? 7 : c.totalDays - c.dayIndex;
        const pool = poolFor(c.todayStr);
        const todayBudget = pool / daysLeft;
        const spentToday = spend[c.todayStr] || 0;
        const left = todayBudget - spentToday;
        const yesterdayBudget = c.dayIndex > 0 ? poolFor(yesterdayStr) / (daysLeft + 1) : null;
        const tomorrow = daysLeft > 1 ? (pool - spentToday) / (daysLeft - 1) : null;
        const pct = todayBudget > 0 ? Math.min(1, Math.max(0, left / todayBudget)) : 0;

        const incomeTotal = sumWhere(income, () => true);
        const savingsNet = sumWhere(savNet, () => true);
        // Budget and spending for any day of the cycle (used by the 7-day history)
        const dayInfo = (ds) => {
            if (ds < c.startStr || ds > c.todayStr) return null;
            const dl = c.overdue ? 7 : c.totalDays - this._dayDiff(c.start, this.parseLocalDateString(ds));
            return { budget: poolFor(ds) / dl, spent: spend[ds] || 0 };
        };
        // Why today's budget moved vs yesterday: yesterday's leftover (or overspend) and money that arrived
        // today are each spread over the days left.
        const spentYesterday = spend[yesterdayStr] || 0;
        const trendWhy = yesterdayBudget === null ? null : {
            rollover: (yesterdayBudget - spentYesterday) / daysLeft,
            arrived: ((income[c.todayStr] || 0) + (savNet[c.todayStr] || 0)) / daysLeft,
            spentYesterday
        };
        let state;
        if (this._recurringCache === null) state = 'loading';
        else if (incomeTotal <= 0) state = 'setup';
        else if (left < 0 || todayBudget <= 0) state = 'over';
        else if (pct < 0.2) state = 'low';
        else if (pct < 0.5) state = 'mid';
        else state = 'good';

        return {
            cycle: c, incomeTotal, incomeToday: income[c.todayStr] || 0, incomeCount, bills, billsTotal,
            spentBefore: sumWhere(spend, d => d < c.todayStr), spentToday, savingsNet,
            pool, daysLeft, todayBudget, yesterdayBudget, tomorrow, left, pct, state,
            trend: yesterdayBudget === null ? 0 : todayBudget - yesterdayBudget,
            trendWhy, dayInfo,
            cycleLeft: pool - spentToday
        };
    },

    _rp: function(v) {
        return `${v < 0 ? '-' : ''}Rp ${this.format(Math.abs(v))}`;
    },

    _rpShort: function(v) {
        const abs = Math.abs(v), sign = v < 0 ? '-' : '';
        if (abs >= 1000000) return `${sign}${(abs / 1000000).toFixed(abs >= 10000000 ? 0 : 1).replace('.', ',').replace(',0', '')}jt`;
        if (abs >= 1000) return `${sign}${Math.round(abs / 1000)}rb`;
        return `${sign}${Math.round(abs)}`;
    },

    _animateNumber: function(el, from, to, dur = 900) {
        if (!el) return;
        if (el._raf) cancelAnimationFrame(el._raf);
        if (from === to || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { el.textContent = this._rp(to); return; }
        const t0 = performance.now();
        const step = (now) => {
            const t = Math.min(1, (now - t0) / dur);
            const e = 1 - Math.pow(1 - t, 3);
            el.textContent = this._rp(from + (to - from) * e);
            if (t < 1) el._raf = requestAnimationFrame(step);
        };
        el._raf = requestAnimationFrame(step);
    },

    _setTodayFill: function(pct, fromEmpty) {
        const coins = document.getElementById('jarCoins');
        const bat = document.getElementById('batteryLevel');
        if (!coins || !bat) return;
        // Coin pile top sits at y≈24 when full; slide it down below the jar floor as it empties.
        const apply = () => {
            coins.style.transform = `translateY(${pct <= 0 ? 84 : 4 + (1 - pct) * 64}px)`;
            bat.style.transform = `scaleX(${Math.max(pct, 0.001)})`;
        };
        if (fromEmpty) {
            [coins, bat].forEach(el => { el.style.transition = 'none'; });
            coins.style.transform = 'translateY(84px)';
            bat.style.transform = 'scaleX(0.001)';
            coins.getBoundingClientRect();
            [coins, bat].forEach(el => { el.style.transition = ''; });
            requestAnimationFrame(() => requestAnimationFrame(apply));
        } else {
            apply();
        }
    },

    // Builds a natural-looking coin heap inside the jar once: coins settle in loose layers,
    // tilted at random angles with a visible rim, mixed gold/silver, darker toward the back.
    _buildJarCoins: function() {
        const g = document.getElementById('jarPile');
        if (!g || g.childElementCount) return;
        let seed = 11;
        const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
        const range = (a, b) => a + rnd() * (b - a);
        // Heap surface: a soft dome (higher in the middle) with a couple of lumps, so the top isn't flat.
        const bumps = [range(0, Math.PI * 2), range(0, Math.PI * 2)];
        const surface = x => 21 + 7 * Math.pow((x - 60) / 40, 2) + 2.2 * Math.sin(x / 7 + bumps[0]) + 1.4 * Math.sin(x / 3.3 + bumps[1]);
        const coins = [];
        for (let y = 96; y > 12; y -= range(3.2, 4.4)) {
            let x = range(18, 26);
            while (x < 102) {
                const r = range(5.2, 7.6);
                const kind = rnd();
                let tilt, rot;
                if (kind < 0.62) { tilt = range(0.26, 0.42); rot = range(-16, 16); }            // lying flat
                else if (kind < 0.9) { tilt = range(0.45, 0.8); rot = range(-38, 38); }         // tilted, face showing
                else { tilt = range(0.22, 0.32); rot = (rnd() < 0.5 ? -1 : 1) * range(52, 85); } // on its edge
                const cx = x + range(-2, 2), cy = y + range(-1.6, 1.6);
                if (cy >= surface(cx)) coins.push({ x: cx, y: cy, r, ry: r * tilt, rot, silver: rnd() < 0.3, back: rnd() < 0.35 ? 1 : 0, th: range(1.1, 1.9) });
                x += r * range(1.25, 1.75);
            }
        }
        // Back layer first, then bottom-to-top so upper coins rest on the ones below.
        coins.sort((a, b) => (b.back - a.back) || (b.y - a.y));
        const f = n => n.toFixed(1);
        g.innerHTML = coins.map(c => {
            const rim = c.silver ? '#5F6B7A' : '#946408';
            const ring = c.silver ? 'rgba(255,255,255,.55)' : 'rgba(255,240,180,.6)';
            return `<g transform="translate(${f(c.x)} ${f(c.y)}) rotate(${f(c.rot)})">` +
                `<ellipse cy="${f(c.th)}" rx="${f(c.r)}" ry="${f(c.ry)}" fill="${rim}"/>` +
                `<ellipse rx="${f(c.r)}" ry="${f(c.ry)}" fill="url(#${c.silver ? 'coinSilver' : 'coinGold'})"/>` +
                `<ellipse rx="${f(c.r * 0.72)}" ry="${f(c.ry * 0.72)}" fill="none" stroke="${ring}" stroke-width=".6"/>` +
                `<path d="M${f(-c.r * 0.62)} ${f(-c.ry * 0.25)} A${f(c.r * 0.7)} ${f(c.ry * 0.7)} 0 0 1 ${f(-c.r * 0.05)} ${f(-c.ry * 0.72)}" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width=".7" stroke-linecap="round"/>` +
                (c.back ? `<ellipse rx="${f(c.r)}" ry="${f(c.ry)}" fill="#040720" fill-opacity=".28"/>` : '') +
                `</g>`;
        }).join('');
    },

    // Coins pop out of the jar when money leaves, drop in when money arrives.
    _todayFx: function(delta, base) {
        const fx = document.getElementById('todayFx');
        if (!fx || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
        const out = delta < 0;
        const count = Math.min(6, Math.max(1, Math.ceil(Math.abs(delta) / Math.max(1, Math.abs(base)) * 4)));
        for (let i = 0; i < count; i++) {
            const coin = document.createElement('div');
            coin.className = `today-coin ${out ? 'out' : 'in'}${Math.random() < 0.3 ? ' silver' : ''}`;
            coin.style.left = '50%';
            coin.style.top = '10%';
            coin.style.setProperty('--dx', `${Math.round((Math.random() - 0.5) * 70)}px`);
            coin.style.animationDelay = `${i * 110}ms`;
            fx.appendChild(coin);
            setTimeout(() => coin.remove(), 1300 + i * 110);
        }
        const lbl = document.createElement('div');
        lbl.className = 'today-delta';
        lbl.style.color = out ? '#FCA5A5' : '#6EE7B7';
        lbl.textContent = `${out ? '-' : '+'}${this._rpShort(Math.abs(delta))}`;
        fx.appendChild(lbl);
        setTimeout(() => lbl.remove(), 1700);
        if (!out) {
            SFX.coin();
            const pile = document.getElementById('jarPile');
            if (pile) setTimeout(() => { pile.classList.remove('settle'); pile.getBoundingClientRect(); pile.classList.add('settle'); }, 650);
        }
    },

    getTodayVisual: function() {
        try { return localStorage.getItem('dirhamku_today_visual') === 'battery' ? 'battery' : 'jar'; } catch(e) { return 'jar'; }
    },

    toggleTodayVisual: function() {
        const next = this.getTodayVisual() === 'jar' ? 'battery' : 'jar';
        try { localStorage.setItem('dirhamku_today_visual', next); } catch(e) { /* ignore */ }
        this._applyTodayVisual();
        this._setTodayFill(this._todayState?.pct || 0, true);
    },

    _applyTodayVisual: function() {
        const isBattery = this.getTodayVisual() === 'battery';
        this._buildJarCoins();
        document.getElementById('todayJar')?.classList.toggle('hidden', isBattery);
        document.getElementById('todayBattery')?.classList.toggle('hidden', !isBattery);
    },

    showToday: function() {
        this._todayIntro = true;
        this._applyTodayVisual();
        this.renderToday();
        this._startTodayTagline();
        setTimeout(() => this.scrollChatToBottom(), 100);
    },

    _startTodayTagline: function() {
        this._stopTodayTagline();
        this._todayTaglineTimer = setInterval(() => {
            const s = this._todayState;
            if (!s || ['setup', 'loading'].includes(s.state) || s.incomeTotal <= s.billsTotal) return;
            const el = document.getElementById('todayTagline');
            if (!el || document.getElementById('todayHero')?.classList.contains('is-compact')) return;
            el.classList.add('is-out');
            setTimeout(() => {
                this._todayTaglineIdx = (this._todayTaglineIdx + 1) % this._todayTaglines.length;
                el.textContent = this._todayTaglines[this._todayTaglineIdx];
                el.classList.remove('is-out');
            }, 400);
        }, 6000);
    },

    _stopTodayTagline: function() {
        if (this._todayTaglineTimer) clearInterval(this._todayTaglineTimer);
        this._todayTaglineTimer = null;
    },

    renderToday: function() {
        const hero = document.getElementById('todayHero');
        if (!hero || !currentProfile) return;
        const s = this.computeTodayBudget();
        this._todayState = s;
        this._renderTodayMini(s);
        const active = this._isTodayActive();

        document.getElementById('todayDateLabel').textContent = s.cycle.today.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' });
        hero.dataset.state = s.state;
        hero.dataset.charging = (s.state !== 'setup' && s.trend > 0) ? '1' : '0';

        const amountEl = document.getElementById('todayLeftAmount');
        const ofEl = document.getElementById('todayOfLabel');
        const labelEl = document.getElementById('todayLeftLabel');
        const chipsEl = document.getElementById('todayChips');
        const taglineEl = document.getElementById('todayTagline');
        const taglineIcon = document.getElementById('todayTaglineIcon');
        const bar = document.getElementById('todayBar');

        const _te = document.getElementById('todayTrend');
        if (_te && (s.state === 'loading' || s.state === 'setup')) { _te.classList.add('hidden'); _te.classList.remove('inline-flex'); }
        if (s.state === 'loading') {
            amountEl.textContent = 'Rp —';
            ofEl.textContent = 'Menghitung budget...';
            return;
        }

        if (s.state === 'setup') {
            labelEl.textContent = 'Budget hari ini';
            amountEl.textContent = 'Rp 0';
            ofEl.textContent = 'Belum ada income masuk siklus ini';
            bar.style.width = '0%';
            chipsEl.innerHTML = `<button onclick="app.prefillChat('+ 5jt gaji')" class="today-chip !bg-secondary !text-primary !border-secondary active:scale-95 transition"><i class="ph-bold ph-plus"></i> Catat income di chat</button>
                <span class="today-chip"><i class="ph-bold ph-hourglass-medium"></i> ${s.cycle.source === 'default' ? 'Siklus tgl ' + s.cycle.manualDay : s.daysLeft + ' hari ke gajian'}</span>`;
            taglineIcon.className = 'ph-fill ph-coins text-secondary text-sm mt-px shrink-0';
            taglineEl.textContent = 'Toplesnya masih kosong. Begitu income lo kecatat, otomatis dibagi rata per hari (udah dipotong tagihan & langganan).';
            this._setTodayFill(0, false);
            this._todayLastLeft = null;
            if (active && !this._todayGreeted) {
                this._todayGreeted = true;
                this.addChatBubble(`☀️ <b>Day Mode on!</b> Belum ada income yang masuk siklus ini, jadi toplesnya masih kosong 🫙<br>Catat gaji/pemasukan lo di sini, misal <code>+ 5jt gaji</code> — jatah harian langsung kebagi otomatis.`, 'bot', true);
            }
            return;
        }

        const introFrom = this._todayIntro ? 0 : null;
        const prev = this._todayLastLeft;
        labelEl.textContent = s.left < 0 ? 'Over budget hari ini' : 'Sisa hari ini';
        this._animateNumber(amountEl, introFrom ?? (prev ?? s.left), s.left);
        ofEl.textContent = s.todayBudget > 0
            ? `dari jatah ${this._rp(s.todayBudget)} · terpakai ${this._rpShort(s.spentToday)}`
            : `uang siklus ini udah minus ${this._rpShort(Math.abs(s.pool))}`;
        bar.style.width = `${Math.round(s.pct * 100)}%`;
        this._setTodayFill(s.pct, this._todayIntro);
        if (active && !this._todayIntro && prev !== null && Math.abs(s.left - prev) >= 1) this._todayFx(s.left - prev, s.todayBudget);
        this._todayIntro = false;
        this._todayLastLeft = s.left;

        const hasTrend = s.yesterdayBudget !== null && Math.abs(s.trend) >= 1000;
        const trendChip = !hasTrend
            ? `<span class="today-chip"><i class="ph-bold ph-calendar-blank"></i> Jatah ${this._rpShort(s.todayBudget)}/hari</span>`
            : s.trend > 0
                ? `<button onclick="app.openTodayBreakdown('why')" class="today-chip text-emerald-300 active:scale-95 transition"><i class="ph-bold ph-trend-up"></i> Jatah naik ${this._rpShort(s.trend)} dari kemarin</button>`
                : `<button onclick="app.openTodayBreakdown('why')" class="today-chip text-red-300 active:scale-95 transition"><i class="ph-bold ph-trend-down"></i> Jatah turun ${this._rpShort(Math.abs(s.trend))} dari kemarin</button>`;
        const trendEl = document.getElementById('todayTrend');
        if (trendEl) {
            trendEl.classList.toggle('hidden', !hasTrend);
            trendEl.classList.toggle('inline-flex', hasTrend);
            trendEl.classList.toggle('today-trend-up', hasTrend && s.trend > 0);
            trendEl.classList.toggle('today-trend-down', hasTrend && s.trend < 0);
            if (hasTrend) trendEl.innerHTML = `<i class="ph-bold ${s.trend > 0 ? 'ph-arrow-up' : 'ph-arrow-down'}"></i>${this._rpShort(Math.abs(s.trend))}`;
        }
        const tomorrowChip = s.cycle.overdue
            ? `<span class="today-chip text-amber-300"><i class="ph-bold ph-hourglass-medium"></i> Gaji belum masuk</span>`
            : s.tomorrow === null
            ? `<span class="today-chip text-emerald-300"><i class="ph-bold ph-confetti"></i> Besok gajian!</span>`
            : `<span class="today-chip ${s.tomorrow < 0 ? 'text-red-300' : ''}"><i class="ph-bold ph-sun-horizon"></i> Besok ${s.tomorrow < 0 ? `minus ${this._rpShort(Math.abs(s.tomorrow))}` : `~${this._rpShort(s.tomorrow)}`}</span>`;
        chipsEl.innerHTML = `
            ${trendChip}
            ${tomorrowChip}
            ${s.cycle.overdue ? '' : `<span class="today-chip"><i class="ph-bold ph-hourglass-medium"></i> ${s.daysLeft} hari ke gajian</span>`}
            <span class="today-chip"><i class="ph-bold ph-arrow-down-left"></i> Income ${this._rpShort(s.incomeTotal)}</span>`;

        if (s.incomeTotal <= s.billsTotal) {
            taglineIcon.className = 'ph-fill ph-warning text-red-300 text-sm mt-px shrink-0';
            taglineEl.textContent = `Income yang masuk (${this._rp(s.incomeTotal)}) belum nutup tagihan & langganan (${this._rp(s.billsTotal)}). Tahan jajan dulu ya bestie 🚨`;
        } else {
            taglineIcon.className = 'ph-fill ph-sparkle text-secondary text-sm mt-px shrink-0';
            taglineEl.textContent = this._todayTaglines[this._todayTaglineIdx];
        }

        if (active && !this._todayGreeted) {
            this._todayGreeted = true;
            this.addChatBubble(
                `☀️ <b>Day Mode on!</b> Jatah lo hari ini <b>${this._rp(s.todayBudget)}</b>, sisa <b>${this._rp(s.left)}</b>.<br>` +
                `Ketik aja pengeluaran lo, misal <code>kopi 25rb</code> — koin di toplesnya langsung berkurang 🫙`,
                'bot', true
            );
        }

        const sheet = document.getElementById('todayBreakdownSheet');
        if (sheet && !sheet.classList.contains('hidden')) this.renderTodayBreakdown();
    },

    // Compact Today's Budget card on the Home (Month) view
    _renderTodayMini: function(s) {
        const card = document.getElementById('cardTodayMini');
        if (!card) return;
        card.dataset.state = s.state;
        const left = document.getElementById('miniLeft'), sub = document.getElementById('miniSub');
        const bar = document.getElementById('miniBar'), fill = document.getElementById('miniJarFill'), tr = document.getElementById('miniTrend');
        const setFill = pct => { if (fill) fill.style.transform = `translateY(${pct <= 0 ? 74 : Math.round((1 - pct) * 46)}px)`; };
        const hasTrend = s.state !== 'loading' && s.state !== 'setup' && s.yesterdayBudget !== null && Math.abs(s.trend) >= 1000;
        if (tr) {
            tr.classList.toggle('hidden', !hasTrend);
            tr.classList.toggle('inline-flex', hasTrend);
            tr.classList.toggle('today-trend-up', hasTrend && s.trend > 0);
            tr.classList.toggle('today-trend-down', hasTrend && s.trend < 0);
            if (hasTrend) tr.innerHTML = `<i class="ph-bold ${s.trend > 0 ? 'ph-arrow-up' : 'ph-arrow-down'}"></i>${this._rpShort(Math.abs(s.trend))}`;
        }
        if (s.state === 'loading') { left.textContent = 'Rp —'; sub.textContent = 'Menghitung...'; bar.style.width = '0%'; setFill(0); return; }
        if (s.state === 'setup') { left.textContent = 'Rp 0'; sub.textContent = 'Belum ada income siklus ini · tap buat mulai'; bar.style.width = '0%'; setFill(0); return; }
        left.textContent = this._rp(s.left);
        sub.textContent = s.left < 0
            ? `over dari jatah ${this._rp(s.todayBudget)} · ${s.cycle.overdue ? 'gaji belum masuk' : s.daysLeft + ' hari ke gajian'}`
            : `dari jatah ${this._rp(s.todayBudget)} · ${s.cycle.overdue ? 'gaji belum masuk' : s.daysLeft + ' hari ke gajian'}`;
        bar.style.width = `${Math.round(s.pct * 100)}%`;
        setFill(s.pct);
    },

    prefillChat: function(text) {
        const input = document.getElementById('chatInput');
        if (!input) return;
        input.value = text;
        input.focus();
        input.setSelectionRange(2, text.indexOf(' ', 2) > 0 ? text.indexOf(' ', 2) : text.length);
    },

    // Short summary used by chat after saving / on "budget hari ini".
    todaySummaryText: function(newBillPayments = []) {
        const s = this._todayState || this.computeTodayBudget();
        const billNote = newBillPayments.length
            ? newBillPayments.map(([, b]) => `🧾 Dikenali sebagai bayar <b>${b.name}</b>, udah dicadangin di tagihan, jadi <b>nggak ngurangin jatah harian</b>.`).join('<br>') + '<br>'
            : '';
        return billNote + this._todaySummaryCore(s);
    },

    _todaySummaryCore: function(s) {
        if (s.state === 'setup') return '🫙 Belum ada income masuk siklus ini. Catat dulu, misal <code>+ 5jt gaji</code>, nanti jatah harian kebagi otomatis.';
        const next = s.tomorrow === null ? 'Besok gajian 🎉' : (s.tomorrow < 0 ? `Jatah besok masih minus <b>${this._rp(Math.abs(s.tomorrow))}</b>.` : `Jatah besok jadi ~<b>${this._rp(s.tomorrow)}</b>.`);
        if (s.left < 0) return `🚨 Hari ini over <b>${this._rp(Math.abs(s.left))}</b>. ${next} Rem dulu ya bestie 🙏`;
        return `🫙 Sisa hari ini <b>${this._rp(s.left)}</b> dari jatah ${this._rp(s.todayBudget)}. ${next}`;
    },

    _todayDaySel: null,

    openTodayBreakdown: function(focus) {
        this._todayDaySel = null;
        this.renderTodayBreakdown();
        this.openSettingsSheet('todayBreakdownSheet');
        const box = document.getElementById('todayBreakdownContent');
        if (box) box.scrollTop = 0;
        if (focus === 'why') setTimeout(() => document.getElementById('todayWhy')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 120);
    },

    selectTodayDay: function(ds) {
        const box = document.getElementById('todayBreakdownContent');
        const top = box ? box.scrollTop : 0;
        this._todayDaySel = ds;
        this.renderTodayBreakdown();
        if (box) box.scrollTop = top;
    },

    editTxFromDay: function(id) {
        this.closeSettingsSheet('todayBreakdownSheet');
        this.openEditTxModal(id);
    },

    renderTodayBreakdown: function() {
        const content = document.getElementById('todayBreakdownContent');
        if (!content || !currentProfile) return;
        const s = this.computeTodayBudget();
        const c = s.cycle;
        const fmtD = d => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        document.getElementById('todayBreakdownCycle').textContent = `Siklus ${fmtD(c.start)} – ${fmtD(c.lastDay)} · hari ke-${c.dayIndex + 1} dari ${c.totalDays}`;

        const isAuto = c.source !== 'manual';
        const cycleNote = c.source === 'salary'
            ? { icon: 'ph-check-circle', color: 'text-success', text: `Gaji <b>${this._rp(c.anchor.amount)}</b> masuk <b>${fmtD(this.parseLocalDateString(c.anchor.dateStr))}</b>, ${c.overdue ? 'Gaji berikutnya belum masuk, jadi sisa uang dibagi 7 hari dulu biar nggak kebablasan. Begitu gaji dicatat, siklus otomatis pindah.' : `jadi siklus jalan sampai <b>${fmtD(c.lastDay)}</b>.`}` }
            : c.source === 'largest'
            ? { icon: 'ph-info', color: 'text-amber-500', text: `Belum ada income kategori <b>Salary/Gaji</b>, jadi dipakai income terbesar (<b>${this._rp(c.anchor.amount)}</b>, ${fmtD(this.parseLocalDateString(c.anchor.dateStr))}). Catat gaji pakai kata "gaji" biar akurat.` }
            : c.source === 'default'
            ? { icon: 'ph-info', color: 'text-amber-500', text: `Belum ada income 45 hari terakhir, jadi sementara pakai siklus tanggal <b>${c.manualDay}</b>. Begitu gaji dicatat, siklus otomatis pindah ke tanggal gaji masuk.` }
            : { icon: 'ph-push-pin', color: 'text-indigo-400', text: `Pakai tanggal gajian tetap: tiap tanggal <b>${c.manualDay}</b>. Matikan opsi otomatis kalau ini bukan yang lo mau.` };
        const row = (label, sub, value, cls = 'text-primary', bold = false) => `
            <div class="flex items-center justify-between gap-3 py-2 ${bold ? 'border-t border-gray-200 mt-1 pt-3' : ''}">
                <div class="min-w-0">
                    <p class="text-xs ${bold ? 'font-bold text-primary' : 'font-semibold text-gray-600'}">${label}</p>
                    ${sub ? `<p class="text-[10px] text-gray-400">${sub}</p>` : ''}
                </div>
                <p class="text-sm font-bold font-heading shrink-0 ${cls}">${value}</p>
            </div>`;

        let math = row('Income masuk', `${s.incomeCount} transaksi sejak ${fmtD(c.start)}`, `+${this._rp(s.incomeTotal)}`, 'text-success');
        math += row(`Tagihan & langganan (${s.bills.length})`, 'Dicadangin di awal siklus', `-${this._rp(s.billsTotal)}`, 'text-danger');
        math += row('Pengeluaran sebelum hari ini', c.dayIndex > 0 ? `${c.dayIndex} hari terakhir` : 'Hari pertama siklus', `-${this._rp(s.spentBefore)}`, 'text-danger');
        if (Math.abs(s.savingsNet) >= 1) math += row(s.savingsNet < 0 ? 'Ditabung' : 'Ambil dari tabungan', 'Transfer dengan akun dana darurat', `${s.savingsNet < 0 ? '-' : '+'}${this._rp(Math.abs(s.savingsNet))}`, s.savingsNet < 0 ? 'text-danger' : 'text-success');
        math += row('Uang buat sisa siklus', c.overdue ? `÷ ${s.daysLeft} hari (gaji telat, dijatah 7 hari dulu)` : `÷ ${s.daysLeft} hari sampai gajian`, this._rp(s.pool), s.pool < 0 ? 'text-danger' : 'text-primary', true);
        math += row('Jatah hari ini', s.yesterdayBudget === null ? '' : `Kemarin ${this._rp(s.yesterdayBudget)} (${s.trend >= 0 ? 'naik' : 'turun'} ${this._rpShort(Math.abs(s.trend))})`, this._rp(s.todayBudget), s.todayBudget < 0 ? 'text-danger' : 'text-primary', true);
        math += row('Terpakai hari ini', 'Di luar tagihan recurring & transaksi non-budget', `-${this._rp(s.spentToday)}`, 'text-danger');
        math += row(s.left < 0 ? 'Over budget' : 'Sisa hari ini', s.tomorrow === null ? 'Besok gajian 🎉' : `Jatah besok ~${this._rp(s.tomorrow)}`, this._rp(s.left), s.left < 0 ? 'text-danger' : 'text-success', true);

        // Last 7 days: each day against the budget it actually had (tap a bar for its transactions)
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(c.today.getFullYear(), c.today.getMonth(), c.today.getDate() - i);
            const ds = this.toLocalDateString(d);
            const info = s.dayInfo(ds);
            const spent = info ? info.spent : allTransactions.filter(tx => tx.dateStr === ds && this._isDailySpend(tx)).reduce((sum, tx) => sum + tx.amount, 0);
            days.push({ d, ds, spent, budget: info ? Math.max(0, info.budget) : null, isToday: i === 0 });
        }
        const sel = days.find(d => d.ds === this._todayDaySel) || days[days.length - 1];
        const maxV = Math.max(...days.map(d => Math.max(d.spent, d.budget || 0)), 1);
        const bars = days.map(day => {
            const h = Math.max(4, Math.round((day.spent / maxV) * 100));
            const over = day.budget !== null && day.spent > day.budget;
            const color = over ? '#EF4444' : (day.isToday ? '#FFB800' : '#1CBDB3');
            const isSel = day === sel;
            const tick = day.budget !== null ? `<div class="absolute left-[-2px] right-[-2px] border-t-2 border-primary/50 pointer-events-none" style="bottom:${Math.min(100, Math.round((day.budget / maxV) * 100))}%"></div>` : '';
            return `
                <button type="button" onclick="app.selectTodayDay('${day.ds}')" class="flex-1 flex flex-col items-center gap-1 min-w-0 active:scale-95 transition">
                    <span class="text-[8px] font-bold ${isSel ? 'text-primary' : 'text-gray-400'}">${day.spent > 0 ? this._rpShort(day.spent) : '–'}</span>
                    <div class="relative w-full h-20 flex items-end">${tick}<div class="today-weekbar w-full rounded-lg ${isSel ? 'ring-2 ring-primary/40 ring-offset-1' : ''}" style="height:${h}%;background:${color}"></div></div>
                    <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isSel ? 'bg-primary text-white' : (day.isToday ? 'text-primary' : 'text-gray-400')}">${day.d.toLocaleDateString('id-ID', { weekday: 'short' }).slice(0, 3)}</span>
                </button>`;
        }).join('');

        // Detail of the selected day
        const selTxs = allTransactions.filter(tx => tx.dateStr === sel.ds);
        const selDate = sel.d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' });
        let selBadge = '';
        if (sel.budget !== null) {
            const diff = sel.budget - sel.spent;
            selBadge = diff >= 0
                ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">Hemat ${this._rpShort(diff)}</span>`
                : `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600">Over ${this._rpShort(Math.abs(diff))}</span>`;
        }
        const txRows = selTxs.length ? selTxs.map(tx => {
            const def = this.getCategoryDef(tx.category);
            let tag = '', sign = '-', amtCls = 'text-primary';
            if (tx.type === 'Income') { sign = '+'; amtCls = 'text-success'; tag = 'Income'; }
            else if (tx.type === 'Transfer') { sign = ''; amtCls = 'text-blue-500'; tag = 'Transfer'; }
            else if (tx.recurringId) tag = 'Tagihan ✓';
            else if (this._billMatched && this._billMatched.has(tx.id)) tag = 'Tagihan (dikenali)';
            else if (this._isBudgetExcluded(tx)) tag = 'Non-budget';
            const eats = this._isDailySpend(tx);
            const isTr = tx.type === 'Transfer';
            return `
                <button type="button" onclick="app.editTxFromDay('${tx.id}')" class="w-full flex items-center gap-3 text-left active:opacity-70 transition">
                    <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style="background:${isTr ? '#DBEAFE' : def.color + '15'};color:${isTr ? '#3B82F6' : def.color}"><i class="ph-fill ${isTr ? 'ph-arrows-left-right' : def.icon} text-sm"></i></div>
                    <div class="flex-1 min-w-0">
                        <p class="text-xs font-bold text-primary truncate">${tx.note || tx.category || 'Transfer'}</p>
                        <p class="text-[10px] text-gray-400">${tx.category || ''}${tag ? ` · <span class="${tx.type === 'Expense' ? 'text-tertiary' : ''} font-bold">${tag}</span>` : ''}${eats ? ' · <span class="text-danger font-bold">makan jatah</span>' : ''}</p>
                    </div>
                    <span class="text-xs font-bold shrink-0 ${amtCls}">${sign}Rp ${this.format(tx.amount)}</span>
                </button>`;
        }).join('') : `<p class="text-[11px] text-gray-400 text-center py-2">Belum ada transaksi di hari ini 🫙</p>`;

        const billRows = s.bills.length ? s.bills.slice(0, 6).map(b => {
            const def = this.getCategoryDef(b.category);
            return `
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style="background:${def.color}15;color:${def.color}"><i class="ph-fill ${def.icon} text-sm"></i></div>
                    <div class="flex-1 min-w-0">
                        <p class="text-xs font-bold text-primary truncate">${b.name}</p>
                        <p class="text-[10px] text-gray-400">${this._rp(b.amount)} · ${{ monthly: 'bulanan', weekly: 'mingguan', yearly: 'tahunan', daily: 'harian' }[b.frequency] || b.frequency}${b.paidTxs && b.paidTxs.length ? ` · <span class="text-success font-bold"><i class="ph-bold ph-check"></i> dibayar ${fmtD(this.parseLocalDateString(b.paidTxs.map(t => t.dateStr).sort().pop()))}</span>` : ''}</p>
                    </div>
                    <span class="text-xs font-bold text-danger shrink-0">${this._rpShort(b.perDay)}/hari</span>
                </div>`;
        }).join('') + (s.bills.length > 6 ? `<p class="text-[10px] text-gray-400 text-center">+${s.bills.length - 6} lainnya</p>` : '')
            : `<p class="text-[11px] text-gray-400">Belum ada tagihan/langganan recurring.</p>`;

        let whyCard = '';
        if (s.trendWhy && Math.abs(s.trend) >= 1) {
            const w = s.trendWhy, sg = v => `${v >= 0 ? '+' : '-'}${this._rp(Math.abs(v)).replace('-', '')}`;
            const up = s.trend > 0;
            whyCard = `
            <div id="todayWhy" class="rounded-2xl p-4 ${up ? 'bg-emerald-50' : 'bg-red-50'}">
                <p class="text-[10px] uppercase tracking-[0.15em] font-bold mb-1 ${up ? 'text-emerald-600' : 'text-red-500'}">Kenapa jatah ${up ? 'naik' : 'turun'} ${this._rpShort(Math.abs(s.trend))}?</p>
                <p class="text-[10px] text-gray-500 mb-2">Dibanding kemarin (${this._rp(s.yesterdayBudget)}). Uang yang berubah dibagi rata ke sisa ${s.daysLeft} hari.</p>
                ${row(w.rollover >= 0 ? 'Kemarin hemat' : 'Kemarin over', `Jatah ${this._rpShort(s.yesterdayBudget)}, terpakai ${this._rpShort(w.spentYesterday)}`, sg(w.rollover), w.rollover >= 0 ? 'text-success' : 'text-danger')}
                ${Math.abs(w.arrived) >= 1 ? row(w.arrived >= 0 ? 'Uang masuk hari ini' : 'Ditabung hari ini', 'Income / transfer dari-ke tabungan', sg(w.arrived), w.arrived >= 0 ? 'text-success' : 'text-danger') : ''}
                ${row('Jatah hari ini', `Kemarin ${this._rp(s.yesterdayBudget)}`, this._rp(s.todayBudget), 'text-primary', true)}
            </div>`;
        }

        content.innerHTML = `
            <div class="rounded-2xl bg-primary text-white p-4 space-y-1.5">
                ${this._todayTaglines.map((t, i) => `<p class="text-[11px] leading-snug ${i === 0 ? 'font-bold' : 'text-white/70'}"><i class="ph-fill ${['ph-calendar-check', 'ph-arrow-bend-down-right', 'ph-lightning'][i]} text-secondary mr-1"></i>${t}</p>`).join('')}
            </div>

            <div class="bg-gray-50 rounded-2xl px-4 py-2">${math}</div>

            ${whyCard}

            <div class="bg-gray-50 rounded-2xl p-4">
                <div class="flex items-center justify-between mb-3">
                    <p class="text-[10px] uppercase tracking-[0.15em] text-gray-400 font-bold">7 hari terakhir</p>
                    <p class="text-[9px] text-gray-400 flex items-center gap-1"><span class="inline-block w-3 border-t-2 border-primary/50"></span> jatah hari itu · tap batang</p>
                </div>
                <div class="flex items-end gap-1.5">${bars}</div>
                <div class="mt-3 pt-3 border-t border-gray-200">
                    <div class="flex items-center justify-between gap-2 mb-1">
                        <p class="text-xs font-bold text-primary">${selDate}</p>
                        ${selBadge}
                    </div>
                    <p class="text-[10px] text-gray-400 mb-3">${sel.budget !== null ? `Jatah ${this._rp(sel.budget)} · terpakai ${this._rp(sel.spent)}` : `Sebelum siklus ini · terpakai ${this._rp(sel.spent)}`}</p>
                    <div class="space-y-2.5">${txRows}</div>
                </div>
            </div>

            <div class="bg-gray-50 rounded-2xl p-4 space-y-3">
                <div class="flex items-center justify-between">
                    <p class="text-[10px] uppercase tracking-[0.15em] text-gray-400 font-bold">Tagihan dibagi per hari</p>
                    <button onclick="app.closeSettingsSheet('todayBreakdownSheet'); app.switchTab('transactions'); setTimeout(() => app.openRecurringModal(), 200)" class="text-[10px] font-bold text-tertiary uppercase">Kelola</button>
                </div>
                ${billRows}
                ${this._billMatched && this._billMatched.size ? `<p class="text-[10px] text-gray-400 leading-relaxed pt-1 border-t border-gray-200"><i class="ph-fill ph-receipt text-success"></i> ${this._billMatched.size} pengeluaran manual dikenali sebagai bayar tagihan (kategori sama, nominal mirip), jadi nggak makan jatah harian.</p>` : ''}
            </div>

            <div class="bg-gray-50 rounded-2xl p-4 space-y-3">
                <p class="text-[10px] uppercase tracking-[0.15em] text-gray-400 font-bold">Siklus budget</p>
                <div class="flex items-center justify-between gap-3">
                    <div class="min-w-0">
                        <p class="text-sm font-bold text-primary">Otomatis dari income</p>
                        <p class="text-[10px] text-gray-400">Siklus mulai saat gaji lo masuk</p>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer shrink-0">
                        <input type="checkbox" class="sr-only peer" ${isAuto ? 'checked' : ''} onchange="app.setDayModeCycle(this.checked)">
                        <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-secondary"></div>
                    </label>
                </div>
                <div class="rounded-xl bg-white border border-gray-100 px-3 py-2.5 flex items-start gap-2">
                    <i class="ph-fill ${cycleNote.icon} ${cycleNote.color} text-base mt-px shrink-0"></i>
                    <p class="text-[11px] text-gray-500 leading-relaxed">${cycleNote.text}</p>
                </div>
                ${isAuto ? '' : `
                <label class="block">
                    <span class="text-[10px] font-bold text-gray-400 uppercase">Tanggal gajian tetap</span>
                    <div class="mt-1 bg-white rounded-xl px-3 py-2.5 flex items-center gap-2 border border-gray-100">
                        <i class="ph-fill ph-calendar-check text-indigo-400"></i>
                        <input type="number" id="todayPaydayInput" inputmode="numeric" min="1" max="31" value="${currentProfile.paydayDate || 25}" class="flex-1 min-w-0 bg-transparent text-base font-bold font-heading text-primary outline-none">
                    </div>
                </label>
                <button onclick="app.saveDayModeSettings()" class="w-full bg-secondary text-primary font-bold py-3 rounded-2xl shadow-sm active:scale-95 transition flex items-center justify-center gap-2 text-sm">
                    <i class="ph-bold ph-check"></i> Simpan
                </button>`}
            </div>`;
    },

    setDayModeCycle: async function(auto) {
        try {
            await db.collection('users').doc(currentUser.uid).update({ dayModeCycle: auto ? 'auto' : 'manual' });
            currentProfile.dayModeCycle = auto ? 'auto' : 'manual';
            this._todayIntro = true;
            this.renderToday();
            this.renderTodayBreakdown();
        } catch(e) { this.toast(e.message, true); this.renderTodayBreakdown(); }
    },

    saveDayModeSettings: async function() {
        const payday = parseInt(document.getElementById('todayPaydayInput')?.value, 10);
        if (!payday || payday < 1 || payday > 31) return this.toast('Tanggal gajian tidak valid', true);
        try {
            await db.collection('users').doc(currentUser.uid).update({ paydayDate: payday });
            currentProfile.paydayDate = payday;
            this._todayIntro = true;
            this.renderToday();
            this.renderTodayBreakdown();
            this.toast('Siklus budget disimpan! 🫙');
        } catch(e) { this.toast(e.message, true); }
    },

    toggleSfx: function() {
        const enabled = SFX.isEnabled();
        const newState = !enabled;
        localStorage.setItem('sfx_enabled', newState ? 'true' : 'false');
        this._updateSfxToggleUI(newState);
        if (newState) SFX.coin(); // preview sound when turning on
    },

    _updateSfxToggleUI: function(enabled) {
        const btn = document.getElementById('sfxToggleBtn');
        const thumb = document.getElementById('sfxToggleThumb');
        const desc = document.getElementById('sfxSettingDesc');
        const icon = document.getElementById('sfxSettingIcon');
        if (!btn) return;
        if (enabled) {
            btn.className = 'relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none bg-green-500';
            thumb.className = 'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 translate-x-5';
            if (desc) desc.textContent = 'Koin & navigasi aktif';
            if (icon) { icon.className = 'ph-fill ph-speaker-high text-green-500 text-lg'; }
        } else {
            btn.className = 'relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none bg-gray-300';
            thumb.className = 'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 translate-x-0';
            if (desc) desc.textContent = 'Efek suara dimatikan';
            if (icon) { icon.className = 'ph-fill ph-speaker-slash text-gray-400 text-lg'; }
        }
    },

    saveDisplayName: async function() {
        const input = document.getElementById('settingsNameInput');
        const errEl = document.getElementById('settingsProfileError');
        const btn = document.getElementById('saveNameBtn');
        const name = input?.value?.trim();
        if (!name || name.length < 2) {
            if (errEl) { errEl.textContent = 'Nama minimal 2 karakter'; errEl.classList.remove('hidden'); }
            return;
        }
        if (errEl) errEl.classList.add('hidden');
        if (btn) { btn.disabled = true; btn.innerHTML = '<span class="loader-dark"></span>'; }
        try {
            // Update Firebase Auth displayName
            await currentUser.updateProfile({ displayName: name });
            // Update Firestore profile
            await db.collection('users').doc(currentUser.uid).update({ displayName: name });
            currentProfile.displayName = name;
            // Update UI
            document.getElementById('settingsName').textContent = name;
            document.getElementById('userGreeting').textContent = `Halo, ${name}`;
            this.closeSettingsSheet('settingsProfileSheet');
            this.toast('Nama berhasil diubah! 🎉');
        } catch(e) {
            if (errEl) { errEl.textContent = e.message; errEl.classList.remove('hidden'); }
        }
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ph-fill ph-check-circle text-lg"></i> SIMPAN NAMA'; }
    },

    // ── InsightCarousel Renderer ──────────────────────────────────────────────
    renderInsightCarousel: function(monthTxs, viewDate) {
        const container = document.getElementById('insightCarousel');
        if (!container) return;

        const now = new Date();
        const isCurrentMonth = viewDate.getFullYear() === now.getFullYear() && viewDate.getMonth() === now.getMonth();
        const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
        const daysPassed = isCurrentMonth ? now.getDate() : daysInMonth;

        const monthlyBudget = currentProfile.monthlyBudget || 3000000;
        const expTxs = monthTxs.filter(t => t.type === 'Expense');
        const totalExp = expTxs.reduce((s, t) => s + t.amount, 0);

        const pacing = this.evaluateBudgetPacing(totalExp, monthlyBudget, daysInMonth, daysPassed);
        const nature = this.evaluateNatureBreakdown(expTxs, customCategories);

        // 3-month rolling avg expense for EF calculation (more accurate)
        let rollingExpSum = 0, rollingMonthCount = 0;
        for (let ri = 1; ri <= 3; ri++) {
            const rDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - ri, 1);
            const rKey = this.getCurrentMonthKey(rDate);
            const rDays = new Date(rDate.getFullYear(), rDate.getMonth() + 1, 0).getDate();
            const rExp = allTransactions.filter(tx => (tx.dateStr || '').startsWith(rKey) && tx.type === 'Expense').reduce((s, t) => s + t.amount, 0);
            if (rExp > 0) { rollingExpSum += rExp; rollingMonthCount++; }
        }
        const avgExpForEF = rollingMonthCount > 0 ? Math.round(rollingExpSum / rollingMonthCount) : (totalExp > 0 ? totalExp : 1000000);
        const efScore = this.calculateEmergencyFundScore(accounts, avgExpForEF);
        const savageInsight = this.generateDeepInsight(pacing, nature, efScore);

        // Card 1: Budget Pacing
        const pacingColor = pacing.pacingPct > 120 ? '#EF4444' : pacing.pacingPct > 100 ? '#F59E0B' : '#10B981';
        const pacingIcon = pacing.pacingPct > 120 ? 'ph-warning' : pacing.pacingPct > 100 ? 'ph-warning-circle' : 'ph-check-circle';
        const pacingLabel = pacing.pacingPct > 120 ? 'Overspend!' : pacing.pacingPct > 100 ? 'Sedikit Over' : 'On Track';

        // Card 2: Nature Breakdown
        const natureBars = [
            { label: 'Must', pct: nature.mustPct, color: '#EF4444', icon: 'ph-lock-key', over: nature.mustPct > 50 },
            { label: 'Needs', pct: nature.needsPct, color: '#F59E0B', icon: 'ph-check', over: false },
            { label: 'Wants', pct: nature.wantsPct, color: '#6366F1', icon: 'ph-sparkle', over: nature.wantsPct > 30 },
        ];

        const card1 = `
        <div class="snap-center shrink-0 w-64 bg-white rounded-3xl p-4 border border-gray-100 shadow-sm">
            <div class="flex items-center gap-2.5 mb-3">
                <div class="w-9 h-9 rounded-2xl flex items-center justify-center" style="background:${pacingColor}15;color:${pacingColor}">
                    <i class="ph-fill ${pacingIcon} text-base"></i>
                </div>
                <div>
                    <p class="text-[9px] font-bold uppercase tracking-widest text-gray-400">Budget Pacing</p>
                    <p class="text-sm font-bold text-primary font-heading leading-none">${pacingLabel}</p>
                </div>
            </div>
            <div class="mb-2">
                <div class="flex justify-between text-[10px] mb-1">
                    <span class="text-gray-500">Spent: <b>Rp ${this.format(Math.round(totalExp))}</b></span>
                    <span style="color:${pacingColor}" class="font-bold">${pacing.pacingPct}% pace</span>
                </div>
                <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div class="h-full rounded-full transition-all" style="width:${Math.min(pacing.pacingPct,100)}%;background:${pacingColor}"></div>
                </div>
            </div>
            <p class="text-[10px] text-gray-400 leading-relaxed">${pacing.isSurplusProjected ? '✅ Projected surplus bulan ini!' : `⚠️ Proyeksi akhir bulan: Rp ${this.format(Math.round(pacing.projectedMonthEnd))}`}</p>
        </div>`;

        // Stacked bar for spending nature
        const _snItems = [
            { label: 'Must', pct: nature.mustPct, color: '#EF4444', icon: 'ph-lock-key' },
            { label: 'Needs', pct: nature.needsPct, color: '#F59E0B', icon: 'ph-check-circle' },
            { label: 'Wants', pct: nature.wantsPct, color: '#6366F1', icon: 'ph-sparkle' },
        ].filter(t => t.pct > 0);
        const _snBar = _snItems.length > 0 ? `
            <div class="flex h-9 rounded-2xl overflow-hidden gap-px mt-3 mb-3">
                ${_snItems.map(t => `
                <div class="flex items-center justify-center gap-1 overflow-hidden" style="flex:${t.pct};background:${t.color}" title="${t.label} ${t.pct}%">
                    ${t.pct >= 15 ? `<i class="ph-bold ${t.icon} text-white text-[10px] shrink-0"></i>` : ''}
                    ${t.pct >= 10 ? `<span class="text-white text-[10px] font-extrabold leading-none">${t.pct}%</span>` : ''}
                </div>`).join('')}
            </div>
            <div class="flex gap-3 flex-wrap">
                ${_snItems.map(t => `
                <div class="flex items-center gap-1.5">
                    <div class="w-2 h-2 rounded-full shrink-0" style="background:${t.color}"></div>
                    <span class="text-[10px] text-gray-500">${t.label}</span>
                </div>`).join('')}
            </div>
            <p class="text-[10px] text-gray-400 mt-2">Total: Rp ${this.format(nature.total)}</p>`
        : `<p class="text-[10px] text-gray-400 mt-3">Belum ada expense bulan ini</p>`;

        const card2 = `
        <div class="snap-center shrink-0 w-64 bg-white rounded-3xl p-4 border border-gray-100 shadow-sm">
            <div class="flex items-center gap-2.5 mb-1">
                <div class="w-9 h-9 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                    <i class="ph-fill ph-chart-pie text-base"></i>
                </div>
                <div>
                    <p class="text-[9px] font-bold uppercase tracking-widest text-gray-400">Spending Nature</p>
                    <p class="text-sm font-bold text-primary font-heading leading-none">Must / Needs / Wants</p>
                </div>
            </div>
            ${_snBar}
        </div>`;

        const card3 = `
        <div class="snap-center shrink-0 w-64 bg-white rounded-3xl p-4 border border-gray-100 shadow-sm">
            <div class="flex items-center gap-2.5 mb-3">
                <div class="w-9 h-9 rounded-2xl flex items-center justify-center" style="background:${efScore.color}15;color:${efScore.color}">
                    <i class="ph-fill ph-shield-check text-base"></i>
                </div>
                <div>
                    <p class="text-[9px] font-bold uppercase tracking-widest text-gray-400">Emergency Fund</p>
                    <p class="text-sm font-bold text-primary font-heading leading-none">${efScore.label}</p>
                </div>
            </div>
            <div class="mb-2">
                <div class="flex justify-between text-[10px] mb-1">
                    <span class="text-gray-500">${efScore.months} bulan coverage</span>
                    <span class="font-bold" style="color:${efScore.color}">${efScore.score}%</span>
                </div>
                <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div class="h-full rounded-full transition-all" style="width:${efScore.score}%;background:${efScore.color}"></div>
                </div>
            </div>
            <p class="text-[10px] text-gray-400 leading-relaxed">${efScore.totalEmergency > 0 ? `Dana: Rp ${this.format(Math.round(efScore.totalEmergency))}` : 'Tandai akun sbg Emergency Fund di Settings'}</p>
        </div>`;

        const card4 = `
        <div class="snap-center shrink-0 w-64 bg-gradient-to-br from-primary to-[#0a1040] rounded-3xl p-4 border border-primary/20 shadow-sm">
            <div class="flex items-center gap-2.5 mb-3">
                <div class="w-9 h-9 rounded-2xl bg-secondary/20 text-secondary flex items-center justify-center">
                    <i class="ph-fill ph-robot text-base"></i>
                </div>
                <div>
                    <p class="text-[9px] font-bold uppercase tracking-widest text-white/50">AI Insight</p>
                    <p class="text-sm font-bold text-white font-heading leading-none">Deep Analysis</p>
                </div>
            </div>
            <p class="text-[11px] text-white/80 leading-relaxed">${savageInsight}</p>
        </div>`;

        // Card 5: Latte Factor Detection
        const latteCard = this.buildLatteFactorCard(expTxs);

        container.innerHTML = card2 + card3 + latteCard + card4;
    },

    // ── Latte Factor Card ──
    buildLatteFactorCard: function(expTxs) {
        // Normalize note/category to lowercase tokens and group by keyword
        const keywordMap = {};
        // Collect all category names to exclude from keyword detection
        const catNames = new Set((customCategories || []).map(c => c.name.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim()));
        expTxs.forEach(tx => {
            // Only use tx.note (uraian), NOT tx.category — category names shouldn't be latte factors
            const noteRaw = (tx.note || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
            const tokens = noteRaw.split(/\s+/).filter(w => w.length >= 3 && !catNames.has(w));
            const seen = new Set();
            tokens.forEach(token => {
                if (seen.has(token)) return;
                seen.add(token);
                if (!keywordMap[token]) keywordMap[token] = { count: 0, total: 0, label: token };
                keywordMap[token].count++;
                keywordMap[token].total += tx.amount;
            });
        });
        // Filter: keyword appears >= 3x AND total is 'latte-factor' level (not rent/salary level, < 2x budget)
        const budget = currentProfile?.monthlyBudget || 3000000;
        const candidates = Object.values(keywordMap)
            .filter(k => k.count >= 3 && k.total < budget * 1.5 && k.total > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, 3);

        if (candidates.length === 0) return '';

        const top = candidates[0];

        // Opportunity Cost calculation
        const oppItems = [
            { name: 'porsi Ayam Geprek', price: 15000 },
            { name: 'gelas Es Kopi Susu', price: 20000 },
            { name: 'bulan langganan Netflix', price: 65000 },
            { name: 'gram Emas Antam Mini', price: 1300000 },
            { name: 'lot Reksadana', price: 100000 },
        ];
        // Pick the item that gives the most "impressive" whole number (prefer 3-100 range)
        let bestOpp = null;
        for (const item of oppItems) {
            const qty = Math.floor(top.total / item.price);
            if (qty >= 2 && qty <= 200) { bestOpp = { qty, name: item.name }; break; }
        }
        if (!bestOpp) {
            const item = oppItems[0];
            bestOpp = { qty: Math.floor(top.total / item.price), name: item.name };
        }
        const oppText = bestOpp.qty >= 1
            ? ` Sadar nggak, duit segitu setara <b>${bestOpp.qty} ${bestOpp.name}</b>. Kurangin dikit, lumayan buat nebelin Dana Darurat 🚨`
            : ' Kurangin dikit, lumayan bisa dialihin buat nebelin Dana Darurat.';

        const latteText = `Bro, jajan '<b>${top.label}</b>' lo bulan ini tembus <b>${top.count}x</b> dengan total <b>Rp ${this.format(top.total)}</b>!${oppText}`;

        const othersHtml = candidates.slice(1).map(k =>
            `<div class="flex justify-between text-[10px] text-gray-400 mt-1.5"><span class="capitalize">${k.label}</span><span class="font-bold">x${k.count} &bull; Rp ${this.format(k.total)}</span></div>`
        ).join('');

        return `
        <div class="snap-center shrink-0 w-64 bg-white rounded-3xl p-4 border border-amber-200 shadow-sm" style="background:linear-gradient(135deg,#fffbeb,#fff)">
            <div class="flex items-center gap-2.5 mb-3">
                <div class="w-9 h-9 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
                    <i class="ph-fill ph-coffee text-base"></i>
                </div>
                <div>
                    <p class="text-[9px] font-bold uppercase tracking-widest text-amber-400">Latte Factor ☕</p>
                    <p class="text-sm font-bold text-primary font-heading leading-none">Pengeluaran Tersembunyi</p>
                </div>
            </div>
            <p class="text-[11px] text-gray-600 leading-relaxed mb-2">${latteText}</p>
            ${othersHtml}
        </div>`;
    },

    // ── FULL STATUS CARD (like old /status) ──
    buildStatusCard: function(totalExpense, monthTxs, now) {
        const budget = currentProfile.monthlyBudget || DEFAULT_MONTHLY_BUDGET;
        const year = now.getFullYear(), month = now.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const _today = new Date();
        const _isCurrentMonth = year === _today.getFullYear() && month === _today.getMonth();
        const daysPassed = _isCurrentMonth ? _today.getDate() : daysInMonth;
        const remainingBudget = budget - totalExpense;
        const avgDaily = daysPassed > 0 ? Math.round(totalExpense / daysPassed) : 0;
        const remainingDays = daysInMonth - daysPassed;
        const dailySuggestion = remainingDays > 0 ? Math.max(0, Math.round(remainingBudget / remainingDays)) : 0;

        // Historical avg daily spending (last 3 months) for Batas Aman
        let histDailySum = 0, histMonthCount = 0;
        const histExpTxs = [];
        for (let hi = 1; hi <= 3; hi++) {
            const hDate = new Date(year, month - hi, 1);
            const hKey = this.getCurrentMonthKey(hDate);
            const hDays = new Date(year, month - hi + 1, 0).getDate();
            const hTxs = allTransactions.filter(tx => (tx.dateStr || '').startsWith(hKey) && tx.type === 'Expense');
            const hExp = hTxs.reduce((s, t) => s + t.amount, 0);
            if (hExp > 0) { histDailySum += hExp / hDays; histMonthCount++; histExpTxs.push(...hTxs); }
        }
        const historicalAvgDaily = histMonthCount > 0 ? Math.round(histDailySum / histMonthCount) : avgDaily;
        // IQR outlier detection on historical transactions
        const histOutliers = this.calcIQROutliers(histExpTxs);
        const hasHistOutliers = histOutliers.length > 0;
        // Median of all historical expense transactions (as a proxy for typical daily spend)
        const histMedianTx = hasHistOutliers ? Math.round(this.calcMedian(histExpTxs.map(t => t.amount))) : 0;
        const monthName = now.toLocaleString('id-ID', { month: 'long' });
        const uniqueCategories = new Set(monthTxs.filter(tx => tx.type === 'Expense').map(tx => tx.category).filter(Boolean));
        const periodStart = new Date(year, month, 1);
        const periodEnd = new Date(year, month + 1, 0);
        const progressPercent = budget > 0 ? (totalExpense / budget) * 100 : 0;
        const clampedProgress = Math.min(Math.max(progressPercent, 0), 100);
        const progressLabelLeft = Math.min(Math.max(clampedProgress, 10), 90);

        // Build cumulative chart data (only in-budget expenses)
        const dailyTotals = new Array(daysInMonth).fill(0);
        monthTxs.forEach(tx => {
            if (tx.type === 'Expense' && tx.dateStr) {
                const catDef = customCategories.find(c => c.name === tx.category);
                const isExcluded = tx.exclude_from_budget === true || (tx.exclude_from_budget === undefined && catDef?.exclude_from_budget === true);
                if (isExcluded) return;
                try {
                    const d = this.parseLocalDateString(tx.dateStr).getDate();
                    if (d >= 1 && d <= daysInMonth) dailyTotals[d - 1] += tx.amount;
                } catch(e) {}
            }
        });
        const cumulativeData = [];
        let runningTotal = 0;
        for (let i = 0; i < daysInMonth; i++) {
            runningTotal += dailyTotals[i];
            // Include today's point (i <= daysPassed - 1)
            cumulativeData.push(i <= daysPassed - 1 ? runningTotal : null);
        }
        // If no local transaction data but we know totalExpense, force the endpoint
        if (totalExpense > 0 && cumulativeData[daysPassed - 1] === 0) {
            cumulativeData[daysPassed - 1] = totalExpense;
        }
        const currentTotal = daysPassed > 0 ? (cumulativeData[daysPassed - 1] ?? totalExpense) : 0;
        const projectedEnd = Math.max(currentTotal, Math.round(currentTotal + (avgDaily * remainingDays)));
        const predictedData = Array.from({ length: daysInMonth }, (_, index) => {
            if (index < Math.max(daysPassed - 1, 0)) return null;
            if (index === Math.max(daysPassed - 1, 0)) return currentTotal;
            return Math.round(currentTotal + (avgDaily * (index - (daysPassed - 1))));
        });
        const chartLabels = Array.from({ length: daysInMonth }, (_, i) => i + 1);
        const yMax = Math.max(budget, projectedEnd, currentTotal, 1) * 1.1;
        const trendTone = projectedEnd > budget ? 'text-danger' : 'text-tertiary';
        const insightHeadline = projectedEnd > budget
            ? `⚠️ Kalau ritme ini lanjut, proyeksi akhir bulan: Rp ${this.format(projectedEnd)} — melebihi budget! Rem sekarang.`
            : `✅ Ritme aman! Proyeksi akhir bulan: Rp ${this.format(projectedEnd)} — masih di bawah budget.`;

        const container = document.getElementById('homeStatusContent');
        container.className = '';
        container.innerHTML = `
            <div class="space-y-4">
                <div class="flex items-start justify-between gap-3">
                    <div class="w-10 h-10 rounded-2xl bg-primary/5 text-primary flex items-center justify-center shrink-0">
                        <i class="ph-fill ph-wallet text-lg"></i>
                    </div>
                    <div class="flex-1 text-center min-w-0">
                        <p class="text-[11px] uppercase tracking-[0.2em] text-gray-400 font-bold mb-1">Budget Status</p>
                        <h4 class="text-2xl font-heading font-bold text-primary leading-none">Rp ${this.format(remainingBudget)}</h4>
                        <p class="text-[11px] text-gray-400 mt-1">Sisa ${remainingDays} hari &bull; ${uniqueCategories.size} kategori aktif</p>
                    </div>
                </div>

                <div>
                    <div class="relative mb-2 h-7">
                        <div class="absolute -translate-x-1/2 top-0" style="left:${progressLabelLeft}%">
                            <div class="bg-primary text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm whitespace-nowrap">${progressPercent.toFixed(1)}% kepakai</div>
                            <div class="w-2.5 h-2.5 rotate-45 bg-primary mx-auto -mt-1"></div>
                        </div>
                    </div>
                    <div class="h-3 rounded-full bg-gray-100 overflow-hidden">
                        <div class="h-full rounded-full bg-gradient-to-r from-[#1CBDB3] via-[#32C7BE] to-[#FFB800]" style="width:${Math.max(clampedProgress, 4)}%"></div>
                    </div>
                    <div class="flex justify-between text-[10px] text-gray-400 font-semibold mt-2">
                        <span>${periodStart.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                        <span>${periodEnd.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-2">
                    <div class="bg-gray-50 rounded-2xl p-3 text-center">
                        <p class="text-[10px] text-gray-400 font-bold uppercase mb-1">Spent</p>
                        <p class="text-sm font-bold text-primary font-heading">Rp ${this.format(totalExpense)}</p>
                    </div>
                    <div class="bg-gray-50 rounded-2xl p-3 text-center">
                        <p class="text-[10px] text-gray-400 font-bold uppercase mb-1">Prediksi</p>
                        <p class="text-sm font-bold ${trendTone} font-heading">Rp ${this.format(projectedEnd)}</p>
                    </div>
                    <div class="${hasHistOutliers ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-100'} rounded-2xl p-3 border text-center">
                        <p class="text-[9px] font-bold uppercase ${hasHistOutliers ? 'text-amber-500' : 'text-blue-400'} mb-1">${hasHistOutliers ? '🎯 Tipikal Harian' : 'Batas Aman/Hari'}</p>
                        <p class="text-sm font-heading font-bold ${hasHistOutliers ? 'text-amber-700' : 'text-blue-700'}">Rp ${this.format(hasHistOutliers ? histMedianTx : historicalAvgDaily)}</p>
                        <p class="text-[9px] ${hasHistOutliers ? 'text-amber-400' : 'text-blue-400'} mt-0.5">${hasHistOutliers ? `avg: Rp ${this.format(historicalAvgDaily)} (ada outlier)` : 'rata-rata historis'}</p>
                    </div>
                    <div class="bg-orange-50 rounded-2xl p-3 border border-orange-100 text-center">
                        <p class="text-[9px] font-bold uppercase text-orange-400 mb-1">Batas Maks/Hari</p>
                        <p class="text-sm font-heading font-bold text-orange-600">Rp ${this.format(dailySuggestion)}</p>
                        <p class="text-[9px] text-orange-400 mt-0.5">sisa budget / sisa hari</p>
                    </div>
                </div>

                <div class="h-64 relative w-full"><canvas id="homeStatusChart"></canvas></div>

                <div class="bg-gray-50 rounded-2xl border border-gray-100 p-3 flex items-start gap-3">
                        <div class="w-8 h-8 rounded-xl bg-white text-tertiary shadow-sm flex items-center justify-center shrink-0 mt-0.5">
                            <i class="ph-fill ph-info"></i>
                        </div>
                        <div class="min-w-0">
                            <p class="text-[11px] font-bold text-primary mb-0.5">Insight bulan ${monthName}</p>
                            <p class="text-xs leading-relaxed text-gray-500">${this.formatInsightText(insightHeadline)}</p>
                        </div>
                </div>
            </div>
        `;

        // Render chart
        if (this._statusChart) this._statusChart.destroy();
        const ctx = document.getElementById('homeStatusChart')?.getContext('2d');
        if (ctx) {
            const gradient = ctx.createLinearGradient(0, 0, 0, 260);
            gradient.addColorStop(0, 'rgba(28, 189, 179, 0.4)');
            gradient.addColorStop(1, 'rgba(28, 189, 179, 0.0)');
            const currentIndex = Math.max(daysPassed - 1, 0);
            const markerPlugin = {
                id: 'dirhamkuStatusMarker',
                afterDatasetsDraw: (chart) => {
                    const { ctx: chartCtx, chartArea, scales } = chart;
                    if (!chartArea || !scales.x || !scales.y) return;
                    const x = scales.x.getPixelForValue(currentIndex);
                    chartCtx.save();
                    chartCtx.setLineDash([6, 6]);
                    chartCtx.strokeStyle = 'rgba(4, 7, 32, 0.25)';
                    chartCtx.lineWidth = 1;
                    chartCtx.beginPath();
                    chartCtx.moveTo(x, chartArea.top);
                    chartCtx.lineTo(x, chartArea.bottom);
                    chartCtx.stroke();
                    chartCtx.setLineDash([]);
                    chartCtx.fillStyle = '#040720';
                    chartCtx.font = '600 10px Montserrat';
                    chartCtx.textAlign = 'center';
                    chartCtx.fillText('Hari ini', x, chartArea.top - 8);
                    chartCtx.restore();
                }
            };
            this._statusChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: chartLabels,
                    datasets: [{
                        label: 'Budget', data: Array(chartLabels.length).fill(budget),
                        borderColor: '#FFB800', borderDash: [5, 5],
                        fill: false, pointRadius: 0, pointHoverRadius: 0, borderWidth: 1.5
                    }, {
                        label: 'Prediksi', data: predictedData,
                        borderColor: 'rgba(4,7,32,0.55)', backgroundColor: 'transparent',
                        fill: false, tension: 0.3, pointRadius: 0, pointHoverRadius: 4, pointHitRadius: 20, borderDash: [7, 7], borderWidth: 1.8, spanGaps: false
                    }, {
                        label: 'Spending', data: cumulativeData,
                        borderColor: '#1CBDB3', backgroundColor: gradient,
                        fill: true, tension: 0.38, spanGaps: false,
                        pointRadius: (ctx2) => ctx2.dataIndex === daysPassed - 1 ? 4 : 0,
                        pointBackgroundColor: '#1CBDB3',
                        pointHoverRadius: 5, pointHitRadius: 24, borderWidth: 2.5
                    }]
                },
                plugins: [markerPlugin],
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: { padding: { top: 20 } },
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: '#040720',
                            padding: 12,
                            displayColors: false,
                            callbacks: {
                                title: (items) => {
                                    const day = items[0]?.label;
                                    return `${day} ${monthName} ${year}`;
                                },
                                label: (item) => `${item.dataset.label}: Rp ${this.format(item.parsed.y || 0)}`,
                                afterBody: (items) => {
                                    const dayIndex = items[0]?.dataIndex ?? 0;
                                    const daySpend = dailyTotals[dayIndex] || 0;
                                    return dayIndex < daysPassed ? `Spend hari itu: Rp ${this.format(daySpend)}` : `Saran sisa harian: Rp ${this.format(dailySuggestion)}`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false, drawBorder: false },
                            ticks: {
                                color: '#94A3B8',
                                font: { size: 10, weight: '600' },
                                maxRotation: 0,
                                autoSkip: false,
                                callback: (value, index) => {
                                    const day = chartLabels[index];
                                    const anchors = new Set([1, Math.ceil(daysInMonth / 3), Math.ceil((daysInMonth / 3) * 2), daysInMonth]);
                                    return anchors.has(day) ? `${day} ${now.toLocaleString('id-ID', { month: 'short' })}` : '';
                                }
                            }
                        },
                        y: {
                            min: 0,
                            max: yMax,
                            grid: { color: 'rgba(148, 163, 184, 0.15)', drawBorder: false },
                            ticks: {
                                color: '#94A3B8',
                                font: { size: 10, weight: '600' },
                                callback: (value) => `Rp ${this.format(value)}`
                            }
                        }
                    },
                    elements: { point: { radius: 0 } }
                }
            });
        }
    },

    // ── FULL PERFORMANCE CARD (like old /performance) ──
    buildPerformanceCard: function(inc, exp, prevInc, prevExp, cats, now) {
        const balance = inc - exp;
        const prevBalance = prevInc - prevExp;
        const savingPercent = inc > 0 ? (balance / inc) * 100 : 0;
        let percentDiff = 0;
        if (prevBalance !== 0) percentDiff = Math.round(((balance - prevBalance) / Math.abs(prevBalance)) * 100);
        else if (balance !== 0) percentDiff = 100;
        const isMore = percentDiff >= 0;
        const monthName = now.toLocaleString('id-ID', { month: 'long' });
        const year = now.getFullYear();

        // Gen-Z encourage text based on saving rate
        let encourageIcon, encourageColor, encourageText;
        if (savingPercent === 0 || inc === 0) {
            encourageIcon = '😬';
            encourageColor = '#EF4444';
            encourageText = `Saving gak ada lho saat ini bestie 😭 Bulan ${monthName} belum ada yang masuk kantong tabungan. Coba lebih disiplin lagi dalam spending-nya ya!`;
        } else if (savingPercent < 5) {
            encourageIcon = '⚠️';
            encourageColor = '#EF4444';
            encourageText = `Aduh, hati-hati nih! Saving rate kamu cuma ${savingPercent.toFixed(1)}% — tipis banget. Yuk mulai rem pengeluaran sebelum kebablasan! 🛑`;
        } else if (savingPercent < 10) {
            encourageIcon = '👍';
            encourageColor = '#F59E0B';
            encourageText = `Lumayan bagus! Saving rate ${savingPercent.toFixed(1)}% udah ada, tapi masih bisa ditingkatin lagi nih. Kurangin dikit pengeluaran yang gak penting ya! ✨`;
        } else if (savingPercent < 25) {
            encourageIcon = '🙌';
            encourageColor = '#1CBDB3';
            encourageText = `Oke banget! Saving rate ${savingPercent.toFixed(1)}% — kamu udah on track. Keep it up dan coba push ke 25% next month! 💪`;
        } else {
            encourageIcon = '🔥';
            encourageColor = '#10B981';
            encourageText = `Gila keren banget! Saving rate kamu ${savingPercent.toFixed(1)}% di bulan ${monthName} ini. Financial goals? Udah keliatan! Tetap semangat dan jangan berhenti! 🚀`;
        }

        const gaugeColor = savingPercent >= 25 ? '#10B981' : savingPercent >= 10 ? '#1CBDB3' : savingPercent >= 5 ? '#F59E0B' : '#EF4444';

        const container = document.getElementById('homePerformanceContent');
        container.className = '';
        container.innerHTML = `
            <div class="flex flex-col items-center mb-5">
                <div class="relative w-48 h-24 mb-4"><canvas id="homePerfGauge"></canvas>
                    <div class="absolute inset-x-0 bottom-0 text-center -mb-1">
                        <span class="text-2xl font-bold text-primary font-heading">${savingPercent.toFixed(1)}%</span>
                        <p class="text-[9px] text-gray-400 uppercase font-bold">Saving Rate</p>
                    </div>
                </div>
                <p class="text-xs text-gray-500 leading-relaxed text-center px-2">
                    Di <b>${monthName} ${year}</b> kamu nge-save <b class="text-secondary">Rp ${this.format(balance)}</b>, setara <b>${savingPercent.toFixed(1)}%</b> dari pemasukan, <span class="${isMore ? 'text-green-600' : 'text-red-500'} font-bold">${Math.abs(percentDiff)}% lebih ${isMore ? 'banyak' : 'sedikit'}</span> dari bulan lalu.
                </p>
            </div>
            <div class="flex items-start gap-3 rounded-2xl p-3.5" style="background:${encourageColor}10;border:1px solid ${encourageColor}20">
                <span class="text-2xl leading-none shrink-0 mt-0.5">${encourageIcon}</span>
                <p class="text-[11px] leading-relaxed" style="color:${encourageColor}">${encourageText}</p>
            </div>
        `;

        // Render gauge chart
        if (this._perfChart) this._perfChart.destroy();
        const ctx = document.getElementById('homePerfGauge')?.getContext('2d');
        if (ctx) {
            const savingRate = Math.min(Math.max(savingPercent, 0), 100);
            this._perfChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Saved', 'Spent'],
                    datasets: [{ data: [savingRate, 100 - savingRate], backgroundColor: [gaugeColor, '#E5E7EB'], borderWidth: 0, cutout: '75%' }]
                },
                options: { rotation: -90, circumference: 180, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } } }
            });
        }
    },

    getRelevantTransactionsForAccount: function(accountId) {
        if (accountId === 'all') return [...allTransactions];
        return allTransactions.filter(tx => {
            if (tx.type === 'Transfer') return tx.fromAccountId === accountId || tx.toAccountId === accountId;
            return tx.accountId === accountId;
        });
    },

    getTransactionsByCurrentFilter: function() {
        const monthKey = this.getCurrentMonthKey(activeMonthDate);
        let txs = this.getRelevantTransactionsForAccount(selectedTxAccountFilter);
        txs = txs.filter(tx => (tx.dateStr || '').startsWith(monthKey));
        return txs;
    },

    getTransactionScopeSummary: function(accountId) {
        const relatedTxs = this.getRelevantTransactionsForAccount(accountId);
        let inc = 0;
        let exp = 0;

        relatedTxs.forEach(tx => {
            if (accountId === 'all') {
                if (tx.type === 'Income') inc += tx.amount;
                else if (tx.type === 'Expense') exp += tx.amount;
                return;
            }

            if (tx.type === 'Transfer') {
                if (tx.toAccountId === accountId) inc += tx.amount;
                if (tx.fromAccountId === accountId) exp += tx.amount;
            } else if (tx.accountId === accountId) {
                if (tx.type === 'Income') inc += tx.amount;
                if (tx.type === 'Expense') exp += tx.amount;
            }
        });

        const balance = accountId === 'all'
            ? accounts.reduce((sum, account) => sum + (account.balance || 0), 0)
            : (accounts.find(account => account.id === accountId)?.balance || 0);

        return { inc, exp, balance, count: relatedTxs.length };
    },

    getTransactionMonthHealth: function(accountId) {
        const currentMonthKey = this.getCurrentMonthKey(activeMonthDate);
        const relatedTxs = this.getRelevantTransactionsForAccount(accountId).filter(tx => (tx.dateStr || '').startsWith(currentMonthKey));
        let income = 0;
        let expense = 0;

        relatedTxs.forEach(tx => {
            if (accountId === 'all') {
                if (tx.type === 'Income') income += tx.amount;
                else if (tx.type === 'Expense') expense += tx.amount;
                return;
            }

            if (tx.type === 'Transfer') {
                if (tx.toAccountId === accountId) income += tx.amount;
                if (tx.fromAccountId === accountId) expense += tx.amount;
            } else if (tx.accountId === accountId) {
                if (tx.type === 'Income') income += tx.amount;
                if (tx.type === 'Expense') expense += tx.amount;
            }
        });

        const net = income - expense;
        const percent = income > 0 ? Math.max(0, Math.min(100, (net / income) * 100)) : 0;
        return { income, expense, net, percent };
    },

    getTransactionDaySummary: function(transactions) {
        let income = 0;
        let expense = 0;

        transactions.forEach(tx => {
            if (tx.type === 'Income') income += tx.amount;
            else if (tx.type === 'Expense') expense += tx.amount;
            else if (tx.type === 'Transfer' && selectedTxAccountFilter !== 'all') {
                if (tx.toAccountId === selectedTxAccountFilter) income += tx.amount;
                if (tx.fromAccountId === selectedTxAccountFilter) expense += tx.amount;
            }
        });

        return { income, expense };
    },

    renderTransactionAccountFilters: function() {
        const filterContainer = document.getElementById('txTimeFilter');
        const cardContainer = document.getElementById('txSingleSummaryCard');
        if (!filterContainer || !cardContainer) return;

        const scopes = [{ id: 'all', name: 'All', type: 'Overview' }, ...accounts.map(account => ({ id: account.id, name: account.name, type: account.type }))];

        // Ensure selected filter is valid
        if (!scopes.find(s => s.id === selectedTxAccountFilter)) selectedTxAccountFilter = 'all';

        // Render Horizontal Pills
        filterContainer.classList.remove('hidden');
        filterContainer.innerHTML = scopes.map(scope => {
            const isSelected = selectedTxAccountFilter === scope.id;
            return `<button type="button" data-account-filter="${scope.id}" 
                    class="px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition border ${isSelected ? 'bg-primary text-white border-primary shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}">
                ${scope.name}
            </button>`;
        }).join('');

        filterContainer.querySelectorAll('[data-account-filter]').forEach(button => {
            button.addEventListener('click', () => {
                this.selectTransactionAccount(button.dataset.accountFilter, true);
            });
        });

        // Render Single Summary Card
        const scope = scopes.find(s => s.id === selectedTxAccountFilter) || scopes[0];
        const summary = this.getTransactionScopeSummary(scope.id);
        const health = this.getTransactionMonthHealth(scope.id);
        const accObj = accounts.find(a => a.id === scope.id);
        const rawAccColor = accObj?.color || '#2E6CF6';
        const accIcon = accObj?.icon || 'ph-wallet';

        // ── Derive monochromatic palette from account color ──────────────
        const hexToRgb = (hex) => {
            const h = hex.replace('#','');
            return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
        };
        const luminance = ([r,g,b]) => {
            const toLinear = c => { const s = c/255; return s <= 0.04045 ? s/12.92 : Math.pow((s+0.055)/1.055,2.4); };
            return 0.2126*toLinear(r) + 0.7152*toLinear(g) + 0.0722*toLinear(b);
        };
        const blendWithDark = ([r,g,b], alpha) => {
            const base = [10, 12, 30]; // very dark navy base
            return `rgb(${Math.round(base[0]*(1-alpha)+r*alpha)},${Math.round(base[1]*(1-alpha)+g*alpha)},${Math.round(base[2]*(1-alpha)+b*alpha)})`;
        };
        const accRgb = hexToRgb(rawAccColor);
        const isAll = scope.id === 'all';
        const accentColor = isAll ? '#1CBDB3' : rawAccColor;
        const cardBg = isAll ? blendWithDark([28,189,179], 0.08) : blendWithDark(accRgb, 0.10);
        const cardBorder = isAll ? 'rgba(28,189,179,0.25)' : `rgba(${accRgb[0]},${accRgb[1]},${accRgb[2]},0.25)`;
        const iconBg = isAll ? 'rgba(28,189,179,0.15)' : `rgba(${accRgb[0]},${accRgb[1]},${accRgb[2]},0.15)`;
        const subBg = isAll ? 'rgba(28,189,179,0.08)' : `rgba(${accRgb[0]},${accRgb[1]},${accRgb[2]},0.08)`;

        const textMain = '#ffffff';
        const textFaint = 'rgba(255,255,255,0.35)';

        const subtitle = isAll ? 'Portfolio' : (scope.type || 'Cash');
        const balanceLabel = this._txBalancesVisible ? `Rp ${this.format(summary.balance)}` : '••••••••';

        // ── Battery: graduated partial fill ─────────────────────────────
        const pct = Math.max(0, Math.min(100, health.percent));
        const batteryBars = `<div class="flex gap-1.5 p-1.5 rounded-lg" style="background:rgba(255,255,255,0.07)">${
            Array.from({length: 4}, (_, i) => {
                const segStart = i * 25;
                const segEnd   = (i + 1) * 25;
                const fillPct  = pct <= segStart ? 0 : pct >= segEnd ? 100 : Math.round((pct - segStart) / 25 * 100);
                const emptyBg  = 'rgba(255,255,255,0.10)';
                return `<div class="h-3 flex-1 rounded-[5px] relative overflow-hidden" style="background:${emptyBg}">
                    <div class="absolute inset-y-0 left-0 rounded-[5px]" style="width:${fillPct}%;background:${accentColor}"></div>
                </div>`;
            }).join('')
        }</div>`;

        cardContainer.innerHTML = `
            <div class="text-left rounded-[20px] p-4 w-full"
                style="background:${cardBg};border:1px solid ${cardBorder}">
                <div class="flex items-start justify-between gap-3 mb-3">
                    <div class="min-w-0 flex items-center gap-2.5">
                        <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style="background:${iconBg};color:${accentColor}">
                            <i class="ph-fill ${accIcon} text-base"></i>
                        </div>
                        <div class="min-w-0">
                            <p class="text-[9px] uppercase tracking-[0.2em] font-bold" style="color:${textFaint}">${subtitle}</p>
                            <h3 class="text-sm font-bold font-heading leading-tight truncate mt-0.5" style="color:${textMain}">${scope.name}</h3>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <div class="text-right shrink-0">
                            <p class="text-[9px] uppercase tracking-[0.2em] font-bold" style="color:${textFaint}">Health</p>
                            <p class="text-base font-heading font-bold leading-none" style="color:${accentColor}">${Math.round(pct)}%</p>
                        </div>
                        <button onclick="app.openAccountOverview()" class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 active:scale-90 transition" style="background:rgba(255,255,255,0.1)" title="Lihat Detail">
                            <i class="ph-bold ph-arrow-square-out text-white text-sm"></i>
                        </button>
                    </div>
                </div>
                <div class="mb-3">
                    ${batteryBars}
                    <div class="flex items-center justify-between text-[9px] font-bold mt-1.5" style="color:${textFaint}">
                        <span>Bulan ini</span>
                        <span>Net Rp ${this.format(health.net)}</span>
                    </div>
                </div>
                <div class="mb-3">
                    <p class="text-[9px] uppercase tracking-[0.18em] font-bold mb-0.5" style="color:${textFaint}">Balance</p>
                    <p class="text-xl font-heading font-bold tracking-tight leading-none" style="color:${textMain}">${balanceLabel}</p>
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <div class="rounded-xl px-3 py-2" style="background:${subBg};border:1px solid ${cardBorder}">
                        <p class="text-[9px] uppercase font-bold mb-0.5" style="color:${textFaint}">Income</p>
                        <p class="font-bold text-[11px] leading-none" style="color:#34d399">Rp ${this.format(health.income)}</p>
                    </div>
                    <div class="rounded-xl px-3 py-2" style="background:${subBg};border:1px solid ${cardBorder}">
                        <p class="text-[9px] uppercase font-bold mb-0.5" style="color:${textFaint}">Expense</p>
                        <p class="font-bold text-[11px] leading-none" style="color:#fb7185">Rp ${this.format(health.expense)}</p>
                    </div>
                </div>
            </div>
        `;
    },

    selectTransactionAccount: function(accountId, syncView = false) {
        selectedTxAccountFilter = accountId;
        this.renderTransactionAccountFilters();
        this.updateTransactionsView();
    },

    updateTransactionsView: function() {
        const cont = document.getElementById('txListContainer');
        if (!cont) return;
        const filteredTransactions = this.getTransactionsByCurrentFilter();
        if (filteredTransactions.length === 0) {
            cont.innerHTML = '<div class="text-center text-gray-400 mt-10">Kosong</div>';
            return;
        }

        const groups = filteredTransactions.reduce((acc, tx) => {
            const key = tx.dateStr;
            if (!acc[key]) acc[key] = [];
            acc[key].push(tx);
            return acc;
        }, {});

        const html = Object.entries(groups).map(([dateKey, txs]) => {
            const dateObj = this.parseLocalDateString(dateKey);
            const day = dateObj.getDate();
            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
            const monthShort = String(dateObj.getMonth() + 1).padStart(2, '0');
            const yearShort = String(dateObj.getFullYear()).slice(-2);
            const daySummary = this.getTransactionDaySummary(txs);

            const rows = txs.map(tx => {
                const accName = tx.type === 'Transfer'
                    ? `${accounts.find(a => a.id === tx.fromAccountId)?.name || 'Akun'} → ${accounts.find(a => a.id === tx.toAccountId)?.name || 'Akun'}`
                    : (accounts.find(a => a.id === tx.accountId)?.name || 'Main Wallet');
                const def = this.getCategoryDef(tx.category || 'Transfer');
                const iconColor = tx.type === 'Transfer' ? '#3B82F6' : def.color;
                const iconBg = tx.type === 'Transfer' ? '#DBEAFE' : `${def.color}20`;
                const amountPrefix = tx.type === 'Expense' ? '-' : tx.type === 'Income' ? '+' : '';
                const amountClass = tx.type === 'Income' ? 'text-success' : tx.type === 'Transfer' ? 'text-blue-500' : 'text-danger';

                return `
                    <button type="button" class="w-full flex justify-between items-center gap-2.5 px-3 py-2.5 text-left active:scale-[0.99] transition ${txs.length > 1 ? 'border-b border-gray-100 last:border-b-0' : ''}" onclick="app.openEditTxModal('${tx.id}')">
                        <div class="flex items-center gap-2.5 min-w-0 flex-1">
                            <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style="background:${iconBg};color:${iconColor}"><i class="ph-fill ${tx.type==='Transfer'?'ph-arrows-left-right':def.icon} text-sm"></i></div>
                            <div class="min-w-0 flex-1">
                                <div class="flex items-center gap-1.5 min-w-0">
                                    <p class="font-bold text-primary text-[12px] truncate leading-tight">${tx.note || tx.category || 'Transfer'}</p>
                                    ${tx.category ? `<span class="shrink-0 bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full text-[9px] font-bold">${tx.category}</span>` : ''}
                                    ${(tx.exclude_from_budget === true || (tx.exclude_from_budget === undefined && (() => { const cd = customCategories.find(c => c.name === tx.category); return cd?.exclude_from_budget === true; })())) ? `<span class="shrink-0 bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full text-[9px] font-bold">non-budget</span>` : ''}
                                </div>
                                <p class="text-[10px] text-gray-400 font-bold flex gap-1 items-center flex-wrap mt-0.5 leading-none">
                                    <span class="inline-flex items-center gap-1"><i class="ph-fill ph-wallet"></i>${accName}</span>
                                </p>
                            </div>
                        </div>
                        <span class="font-bold ${amountClass} text-[12px] whitespace-nowrap">${amountPrefix} Rp ${this.format(tx.amount)}</span>
                    </button>
                `;
            }).join('');

            return `
                <section class="space-y-1.5">
                    <div class="flex items-center gap-2 px-1 text-[11px] font-bold text-primary">
                        <div class="flex items-baseline gap-1.5 min-w-0">
                            <span class="text-[18px] leading-none font-heading">${day}</span>
                            <span class="text-gray-500 uppercase">${dayName}</span>
                            <span class="text-gray-400">${monthShort}/${yearShort}</span>
                        </div>
                        <div class="ml-auto flex items-center gap-2 text-[10px] whitespace-nowrap">
                            <span class="text-success">Rp ${this.format(daySummary.income)}</span>
                            <span class="text-danger">Rp ${this.format(daySummary.expense)}</span>
                        </div>
                    </div>
                    <div class="bg-white rounded-[20px] border border-gray-100 overflow-hidden">${rows}</div>
                </section>
            `;
        }).join('');

        cont.innerHTML = html;
    },

    renderTransactions: function() {
        this.updateMonthLabels();
        if (selectedTxAccountFilter !== 'all' && !accounts.some(account => account.id === selectedTxAccountFilter)) {
            selectedTxAccountFilter = 'all';
        }
        this.renderTransactionAccountFilters();
        this.updateTransactionsView();
    },

    toggleBalanceVis: function() {
        this._txBalancesVisible = !this._txBalancesVisible;
        this.renderTransactionAccountFilters();
        const homeBal = document.getElementById('homeTotalBalance');
        if (homeBal) {
            if (this._txBalancesVisible) {
                const total = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
                homeBal.textContent = `Rp ${this.format(total)}`;
            } else {
                homeBal.textContent = 'Rp ••••••••';
            }
        }
    },

    deleteTx: async function(id) {
        try {
            await db.collection('users').doc(currentUser.uid).collection('transactions').doc(id).delete();
            this.toast('Dihapus');
            this.loadData();
        } catch(e) { this.toast(e.message, true); }
    },

    // Accounts logic
    renderAccountsList: function() {
        // Update form accounts visual display
        const updateAccountUI = (fieldId, accId) => {
            const acc = accounts.find(a => a.id === accId) || accounts[0];
            if (acc) {
                const hidden = document.getElementById(fieldId);
                const label = document.getElementById(fieldId + 'Label');
                const icon = document.getElementById(fieldId + 'Icon');
                if (hidden) hidden.value = acc.id;
                if (label) label.textContent = acc.name;
                if (icon) {
                    const ic = acc.icon || 'ph-wallet';
                    const col = acc.color || '#040720';
                    icon.innerHTML = `<i class="ph-fill ${ic} text-sm"></i>`;
                    icon.style.background = `${col}20`;
                    icon.style.color = col;
                }
            }
        };

        if (accounts.length > 0) {
            updateAccountUI('formAccount', document.getElementById('formAccount')?.value);
            updateAccountUI('formFromAccount', document.getElementById('formFromAccount')?.value);
            // For ToAccount, if it's the same as FromAccount, pick the second one if available
            let toAccId = document.getElementById('formToAccount')?.value;
            if (toAccId === document.getElementById('formFromAccount')?.value && accounts.length > 1) {
                toAccId = accounts[1].id;
            }
            updateAccountUI('formToAccount', toAccId);
        }

        const list = document.getElementById('settingsAccountsList');
        if(list) {
            list.innerHTML = accounts.map(a => {
                const ic = a.icon || 'ph-wallet';
                const col = a.color || '#040720';
                return `
                <div class="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style="background:${col}20;color:${col}">
                            <i class="ph-fill ${ic} text-sm"></i>
                        </div>
                        <div><p class="font-bold text-sm text-primary">${a.name}</p><p class="text-[10px] text-gray-400">${a.type}</p></div>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="font-bold text-sm text-secondary">Rp ${this.format(a.balance||0)}</span>
                        <button onclick="app.openAccountModal('${a.id}')" class="w-7 h-7 flex items-center justify-center bg-gray-100 rounded-full text-gray-400 active:scale-95 transition"><i class="ph-bold ph-pencil-simple text-xs"></i></button>
                    </div>
                </div>
            `}).join('');
        }
    },

    // Category Logic
    renderCategoriesList: function() {
        const list = document.getElementById('settingsCategoriesList');
        if(!list) return;
        if(customCategories.length === 0) { list.innerHTML = '<p class="text-xs text-gray-400">Belum ada kategori.</p>'; return; }
        
        const exps = customCategories.filter(c => c.type === 'Expense');
        const incs = customCategories.filter(c => c.type === 'Income');

        const mapCat = (c) => `
            <div class="flex flex-col border-b border-gray-50 last:border-0 py-2">
                <div class="flex justify-between items-center cursor-pointer active:scale-95 transition" onclick="app.openCategoryModal('${c.id}')">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style="background:${c.color}20;color:${c.color}">
                            <i class="ph-fill ${c.icon}"></i>
                        </div>
                        <div>
                            <p class="font-bold text-sm text-primary">${c.name}</p>
                            <p class="text-[10px] text-gray-400 capitalize">${c.type}${c.nature ? ' &bull; ' + c.nature : ''}</p>
                        </div>
                    </div>
                    <i class="ph-bold ph-pencil-simple text-gray-300"></i>
                </div>
            </div>
        `;

        let html = '';
        if (exps.length > 0) {
            html += `<p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2 mb-1">Pengeluaran</p>`;
            html += exps.map(mapCat).join('');
        }
        if (incs.length > 0) {
            html += `<p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-4 mb-1">Pemasukan</p>`;
            html += incs.map(mapCat).join('');
        }
        list.innerHTML = html;
    },

    openSettingsSheet: function(id) {
        const el = document.getElementById(id);
        if (!el) return;
        // Pre-fill profile sheet with current display name
        if (id === 'settingsProfileSheet') {
            const input = document.getElementById('settingsNameInput');
            const errEl = document.getElementById('settingsProfileError');
            if (input) input.value = (currentProfile && currentProfile.displayName) || (currentUser && currentUser.displayName) || '';
            if (errEl) errEl.classList.add('hidden');
        }
        // Pre-render vocabulary/command sheets
        if (id === 'settingsVocabularySheet') this.renderVocabularySheet();
        if (id === 'settingsCommandsSheet') this.renderCommandsSheet();
        el.classList.remove('hidden');
        el.classList.add('flex');
    },

    closeSettingsSheet: function(id) {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.add('hidden');
        el.classList.remove('flex');
    },

    // ── SETTINGS SPEED DIAL ──────────────────────────────────
    currentSettingsTab: 'settings',

    switchSettingsTab: function(tab) {
        this.currentSettingsTab = tab;
        // Update tab buttons
        document.querySelectorAll('.settings-tab-btn').forEach(btn => {
            if (btn.id === 'settingsTabBtn-' + tab) {
                btn.classList.add('bg-primary', 'text-white');
                btn.classList.remove('text-gray-500', 'hover:bg-gray-50');
            } else {
                btn.classList.remove('bg-primary', 'text-white');
                btn.classList.add('text-gray-500', 'hover:bg-gray-50');
            }
        });
        // Show/hide panels
        document.querySelectorAll('.settings-panel').forEach(panel => {
            panel.classList.add('hidden');
        });
        const panel = document.getElementById('settingsPanel-' + tab);
        if (panel) panel.classList.remove('hidden');
        // Render content if needed
        if (tab === 'faq') this.renderFaqPanel();
        if (tab === 'kosakata') {
            this.switchKosakataTab('kosakata');
        }
    },

    // ── KOSAKATA TABS ────────────────────────────────────────
    currentKosakataTab: 'kosakata',

    switchKosakataTab: function(tab) {
        this.currentKosakataTab = tab;
        // Update tab buttons
        document.querySelectorAll('.kosakata-tab-btn').forEach(btn => {
            if (btn.id === 'kosakataTabBtn-' + tab) {
                btn.classList.add('bg-primary', 'text-white');
                btn.classList.remove('text-gray-500', 'hover:bg-gray-50');
            } else {
                btn.classList.remove('bg-primary', 'text-white');
                btn.classList.add('text-gray-500', 'hover:bg-gray-50');
            }
        });
        // Show/hide content
        document.querySelectorAll('.kosakata-content').forEach(content => {
            content.classList.add('hidden');
        });
        const content = document.getElementById('kosakataContent-' + tab);
        if (content) content.classList.remove('hidden');
        // Render content
        if (tab === 'kosakata') this.renderVocabularySheet();
        if (tab === 'perintah') this.renderCommandsSheet();
    },

    renderFaqPanel: function() {
        const faqPanel = document.getElementById('settingsPanel-faq');
        if (!faqPanel) return;
        if (faqPanel.querySelector('div.bg-white')) return; // Already has content
        // Clone FAQ content from bottom
        const faqItems = document.getElementById('faqItemsContainer');
        if (faqItems) {
            faqPanel.innerHTML = faqItems.innerHTML;
        }
    },

    // ── EXPORT DATA ──────────────────────────────────────────
    exportData: function() {
        if (!currentUser || !allTransactions) return;
        const payload = {
            version: '5.0',
            exportedAt: new Date().toISOString(),
            uid: currentUser.uid,
            profile: {
                displayName: currentProfile.displayName || currentUser.displayName,
                monthlyBudget: currentProfile.monthlyBudget,
                monthlyIncome: currentProfile.monthlyIncome || 0,
                savingsTargetPct: currentProfile.savingsTargetPct || 20,
                savingsTargetRp: currentProfile.savingsTargetRp || 0,
                paydayDate: currentProfile.paydayDate || 25,
                accounts: currentProfile.accounts || [],
                categories: currentProfile.categories || [],
            },
            transactions: allTransactions.map(tx => {
                const { id, ...rest } = tx;
                return { _id: id, ...rest, date: tx.dateStr };
            })
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const dateTag = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `dirhamku-backup-${dateTag}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },

    // ── IMPORT DATA ──────────────────────────────────────────
    _importPayload: null,

    triggerImport: function() {
        const el = document.getElementById('importFileInput');
        if (el) { el.value = ''; el.click(); }
    },

    handleImportFile: function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                this._validateAndPreviewImport(data);
            } catch(err) {
                alert('File tidak valid. Pastikan file adalah backup JSON dari Dirhamku.');
            }
        };
        reader.readAsText(file);
    },

    _validateAndPreviewImport: function(data) {
        if (!data.transactions || !Array.isArray(data.transactions)) {
            alert('Format file tidak dikenali. Pastikan file adalah export dari Dirhamku.');
            return;
        }
        this._importPayload = data;
        const txCount = data.transactions.length;
        const fromDate = data.transactions.length ? data.transactions[data.transactions.length - 1].date : '-';
        const toDate = data.transactions.length ? data.transactions[0].date : '-';
        const expCount = data.transactions.filter(t => t.type === 'Expense').length;
        const incCount = data.transactions.filter(t => t.type === 'Income').length;
        const trfCount = data.transactions.filter(t => t.type === 'Transfer').length;
        const existingIds = new Set(allTransactions.map(t => t.id));
        const newCount = data.transactions.filter(t => !existingIds.has(t._id)).length;
        const dupCount = txCount - newCount;

        const card = document.getElementById('importSummaryCard');
        card.innerHTML = `
            <div class="flex items-center gap-3 pb-3 border-b border-gray-50">
                <i class="ph-fill ph-file-code text-blue-500 text-2xl"></i>
                <div>
                    <p class="text-sm font-bold text-primary">${data.profile?.displayName || 'Dirhamku Backup'}</p>
                    <p class="text-[11px] text-gray-400">${data.exportedAt ? new Date(data.exportedAt).toLocaleString('id-ID') : 'Tanggal tidak diketahui'}</p>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-3 pt-1">
                <div class="bg-gray-50 rounded-xl p-3 text-center">
                    <p class="text-xl font-bold text-primary">${txCount.toLocaleString('id-ID')}</p>
                    <p class="text-[10px] text-gray-400 mt-0.5">Total Transaksi</p>
                </div>
                <div class="bg-green-50 rounded-xl p-3 text-center">
                    <p class="text-xl font-bold text-success">${newCount.toLocaleString('id-ID')}</p>
                    <p class="text-[10px] text-gray-400 mt-0.5">Transaksi Baru</p>
                </div>
                <div class="bg-gray-50 rounded-xl p-3 text-center">
                    <p class="text-xl font-bold text-gray-500">${dupCount.toLocaleString('id-ID')}</p>
                    <p class="text-[10px] text-gray-400 mt-0.5">Sudah Ada</p>
                </div>
                <div class="bg-blue-50 rounded-xl p-3 text-center">
                    <p class="text-xs font-bold text-blue-600">${fromDate} s/d ${toDate}</p>
                    <p class="text-[10px] text-gray-400 mt-0.5">Rentang Tanggal</p>
                </div>
            </div>
            <div class="flex gap-2 text-[11px] pt-1">
                <span class="flex-1 text-center bg-danger/10 text-danger font-bold rounded-lg py-1.5">${expCount} Pengeluaran</span>
                <span class="flex-1 text-center bg-success/10 text-success font-bold rounded-lg py-1.5">${incCount} Pemasukan</span>
                <span class="flex-1 text-center bg-yellow-100 text-yellow-700 font-bold rounded-lg py-1.5">${trfCount} Transfer</span>
            </div>
        `;

        const warning = document.getElementById('importWarning');
        const warningText = document.getElementById('importWarningText');
        if (dupCount > 0) {
            warningText.textContent = `${dupCount} transaksi sudah ada di datamu. Mode Merge akan melewatinya otomatis.`;
            warning.classList.remove('hidden');
        } else {
            warning.classList.add('hidden');
        }

        // Reset mode to merge
        document.querySelectorAll('input[name="importMode"]').forEach(r => { r.checked = r.value === 'merge'; });
        document.getElementById('importProgressText').classList.add('hidden');
        const btn = document.getElementById('importConfirmBtn');
        btn.disabled = false;
        btn.innerHTML = '<i class="ph-fill ph-check-circle text-lg"></i> Konfirmasi Import';

        const sheet = document.getElementById('sheetImport');
        sheet.classList.remove('hidden');
        sheet.classList.add('flex');
    },

    closeImportSheet: function() {
        const sheet = document.getElementById('sheetImport');
        sheet.classList.add('hidden');
        sheet.classList.remove('flex');
        this._importPayload = null;
    },

    confirmImport: async function() {
        if (!this._importPayload) return;
        const mode = document.querySelector('input[name="importMode"]:checked')?.value || 'merge';
        const data = this._importPayload;
        const btn = document.getElementById('importConfirmBtn');
        const progress = document.getElementById('importProgressText');

        if (mode === 'replace') {
            if (!confirm('⚠️ Semua transaksi yang ada akan dihapus dan diganti! Yakin lanjutkan?')) return;
        }

        btn.disabled = true;
        btn.innerHTML = '<span class="loader"></span>';
        progress.classList.remove('hidden');

        try {
            const txRef = db.collection('users').doc(currentUser.uid).collection('transactions');

            if (mode === 'replace') {
                progress.textContent = 'Menghapus data lama...';
                const existing = await txRef.get();
                const delBatches = [];
                let batch = db.batch();
                let count = 0;
                existing.docs.forEach(doc => {
                    batch.delete(doc.ref);
                    count++;
                    if (count % 499 === 0) { delBatches.push(batch.commit()); batch = db.batch(); count = 0; }
                });
                if (count > 0) delBatches.push(batch.commit());
                await Promise.all(delBatches);
            }

            const existingIds = mode === 'merge' ? new Set(allTransactions.map(t => t.id)) : new Set();
            const toImport = data.transactions.filter(tx => !existingIds.has(tx._id));
            let done = 0;
            const total = toImport.length;

            // Batch write in groups of 499
            for (let i = 0; i < toImport.length; i += 499) {
                const batch = db.batch();
                toImport.slice(i, i + 499).forEach(tx => {
                    const { _id, date, dateStr, ...fields } = tx;
                    const docRef = _id ? txRef.doc(_id) : txRef.doc();
                    // Convert date string back to Firestore timestamp-friendly format
                    const dateObj = new Date(date + 'T12:00:00');
                    batch.set(docRef, { ...fields, date: firebase.firestore.Timestamp.fromDate(dateObj), dateKey: date });
                });
                await batch.commit();
                done += Math.min(499, toImport.length - i);
                progress.textContent = `Mengimpor... ${done} / ${total}`;
            }

            // Save profile settings if replace mode
            if (mode === 'replace' && data.profile) {
                const profUpdates = {};
                if (data.profile.monthlyBudget) profUpdates.monthlyBudget = data.profile.monthlyBudget;
                if (data.profile.monthlyIncome) profUpdates.monthlyIncome = data.profile.monthlyIncome;
                if (data.profile.paydayDate) profUpdates.paydayDate = data.profile.paydayDate;
                if (data.profile.savingsTargetPct) profUpdates.savingsTargetPct = data.profile.savingsTargetPct;
                if (data.profile.savingsTargetRp) profUpdates.savingsTargetRp = data.profile.savingsTargetRp;
                if (Object.keys(profUpdates).length) {
                    await db.collection('users').doc(currentUser.uid).update(profUpdates);
                    Object.assign(currentProfile, profUpdates);
                }
            }

            progress.textContent = `✅ Berhasil import ${done} transaksi!`;
            btn.innerHTML = '<i class="ph-fill ph-check-circle text-lg"></i> Selesai';
            btn.disabled = false;

            // Reload data
            await this.loadData();

            setTimeout(() => this.closeImportSheet(), 1500);
        } catch(err) {
            console.error('Import error', err);
            progress.textContent = '❌ Gagal import: ' + err.message;
            btn.disabled = false;
            btn.innerHTML = '<i class="ph-fill ph-check-circle text-lg"></i> Coba Lagi';
        }
    },

    openCategoryModal: function(catId = null) {
        document.getElementById('categoryModal').classList.remove('hidden');
        const iconGrid = document.getElementById('editCatIconGrid');
        const colorGrid = document.getElementById('editCatColorGrid');
        
        const renderIcons = (selIcon) => {
            iconGrid.innerHTML = AVAILABLE_ICONS.map(ic => `
                <div onclick="document.getElementById('editCatIcon').value='${ic}'; this.parentElement.querySelectorAll('div').forEach(d=>d.classList.remove('border-secondary','bg-secondary/10','text-secondary')); this.parentElement.querySelectorAll('div').forEach(d=>d.classList.add('border-gray-100','text-gray-400')); this.classList.remove('border-gray-100','text-gray-400'); this.classList.add('border-secondary','bg-secondary/10','text-secondary');" 
                     class="w-10 h-10 flex items-center justify-center border-2 rounded-xl text-xl cursor-pointer transition ${ic === selIcon ? 'border-secondary bg-secondary/10 text-secondary' : 'border-gray-100 text-gray-400'}">
                    <i class="ph-bold ${ic}"></i>
                </div>
            `).join('');
        };

        const renderColors = (selCol) => {
            colorGrid.innerHTML = AVAILABLE_COLORS.map(col => `
                <div onclick="document.getElementById('editCatColor').value='${col}'; this.parentElement.querySelectorAll('div').forEach(d=>d.classList.remove('ring-4')); this.classList.add('ring-4');"
                     class="w-8 h-8 rounded-full cursor-pointer transition ring-offset-2 ring-gray-300 ${col === selCol ? 'ring-4' : ''}" style="background-color:${col}">
                </div>
            `).join('');
        };

        if(catId) {
            const cat = customCategories.find(c => c.id === catId);
            document.getElementById('editCatId').value = cat.id;
            document.getElementById('editCatName').value = cat.name;
            document.querySelector(`input[name="editCatType"][value="${cat.type}"]`).checked = true;
            document.getElementById('editCatIcon').value = cat.icon;
            document.getElementById('editCatColor').value = cat.color;
            document.getElementById('btnDeleteCat').classList.remove('hidden');
            const excEl = document.getElementById('editCatExcludeBudget');
            if (excEl) excEl.checked = !!cat.exclude_from_budget;
            // Nature pills
            document.querySelectorAll('[data-nature-pill]').forEach(p => {
                p.classList.toggle('ring-2', p.dataset.naturePill === (cat.nature || 'wants'));
                p.classList.toggle('opacity-100', p.dataset.naturePill === (cat.nature || 'wants'));
                p.classList.toggle('opacity-40', p.dataset.naturePill !== (cat.nature || 'wants'));
            });
            const natInput = document.getElementById('editCatNature');
            if (natInput) natInput.value = cat.nature || (cat.type === 'Income' ? '' : 'wants');
            renderIcons(cat.icon);
            renderColors(cat.color);
        } else {
            document.getElementById('editCatId').value = '';
            document.getElementById('editCatName').value = '';
            document.querySelector(`input[name="editCatType"][value="Expense"]`).checked = true;
            document.getElementById('editCatIcon').value = AVAILABLE_ICONS[0];
            document.getElementById('editCatColor').value = AVAILABLE_COLORS[0];
            document.getElementById('btnDeleteCat').classList.add('hidden');
            const excElNew = document.getElementById('editCatExcludeBudget');
            if (excElNew) excElNew.checked = false;
            // Reset nature pills
            document.querySelectorAll('[data-nature-pill]').forEach(p => {
                p.classList.toggle('ring-2', p.dataset.naturePill === 'wants');
                p.classList.toggle('opacity-100', p.dataset.naturePill === 'wants');
                p.classList.toggle('opacity-40', p.dataset.naturePill !== 'wants');
            });
            const natInput = document.getElementById('editCatNature');
            if (natInput) natInput.value = 'wants';
            renderIcons(AVAILABLE_ICONS[0]);
            renderColors(AVAILABLE_COLORS[0]);
        }
    },

    saveCategory: async function() {
        const id = document.getElementById('editCatId').value;
        const name = document.getElementById('editCatName').value.trim();
        const type = document.querySelector('input[name="editCatType"]:checked').value;
        const icon = document.getElementById('editCatIcon').value;
        const color = document.getElementById('editCatColor').value;
        const nature = document.getElementById('editCatNature')?.value || (type === 'Income' ? null : 'wants');
        const exclude_from_budget = document.getElementById('editCatExcludeBudget')?.checked === true;
        if(!name) return this.toast('Nama kategori wajib diisi', true);

        if(id) {
            const idx = customCategories.findIndex(c => c.id === id);
            if(idx > -1) customCategories[idx] = { id, name, type, icon, color, nature, exclude_from_budget };
        } else {
            customCategories.push({ id: 'cat_' + Date.now().toString(), name, type, icon, color, nature, exclude_from_budget });
        }

        try {
            await db.collection('users').doc(currentUser.uid).update({ categories: customCategories });
            this.toast('Kategori disimpan');
            document.getElementById('categoryModal').classList.add('hidden');
            this.renderCategoriesList();
            this.initFormOptions();
        } catch(e) { this.toast(e.message, true); }
    },

    deleteCategory: async function() {
        const id = document.getElementById('editCatId').value;
        if(confirm('Kategori ini akan dihapus? (Transaksi lama akan mencari fallback icon generic)')) {
            customCategories = customCategories.filter(c => c.id !== id);
            try {
                await db.collection('users').doc(currentUser.uid).update({ categories: customCategories });
                this.toast('Kategori dihapus');
                document.getElementById('categoryModal').classList.add('hidden');
                this.renderCategoriesList();
                this.initFormOptions();
            } catch(e) { this.toast(e.message, true); }
        }
    },

    // ─── Category Grid ────────────────────────────────────────────────────────
    renderCategoryGrid: function(containerId, selectedCat, hiddenInputId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = customCategories.map(cat => {
            const isSel = cat.name === selectedCat;
            return `
                <button type="button" onclick="app.selectCategoryInGrid('${containerId}','${hiddenInputId}','${cat.name}')"
                    class="flex flex-col items-center gap-1 p-2 rounded-2xl border-2 transition text-center ${isSel ? 'border-secondary bg-secondary/5' : 'border-gray-100 bg-gray-50'}"
                    data-catgrid-btn="${cat.name}">
                    <div class="w-8 h-8 rounded-xl flex items-center justify-center" style="background:${cat.color}20;color:${cat.color}">
                        <i class="ph-fill ${cat.icon} text-sm"></i>
                    </div>
                    <span class="text-[9px] font-bold text-primary leading-tight truncate w-full">${cat.name}</span>
                </button>
            `;
        }).join('');
        if (hiddenInputId) {
            const hidden = document.getElementById(hiddenInputId);
            if (hidden) hidden.value = selectedCat || customCategories[0]?.name || '';
        }
    },

    selectCategoryInGrid: function(containerId, hiddenInputId, catName) {
        document.querySelectorAll(`#${containerId} [data-catgrid-btn]`).forEach(btn => {
            const isThis = btn.dataset.catgridBtn === catName;
            btn.classList.toggle('border-secondary', isThis);
            btn.classList.toggle('bg-secondary/5', isThis);
            btn.classList.toggle('border-gray-100', !isThis);
            btn.classList.toggle('bg-gray-50', !isThis);
        });
        if (hiddenInputId) {
            const hidden = document.getElementById(hiddenInputId);
            if (hidden) hidden.value = catName;
        }
        // Auto-close popup if selecting from the form popup
        if (containerId === 'formCategoryGrid') {
            setTimeout(() => this.closeCategoryPopup(), 150);
        }
    },

    // ─── Edit Transaction Modal (Reused Input Form) ───────────────────────────
    openEditTxModal: function(txId) {
        const tx = allTransactions.find(t => t.id === txId);
        if (!tx) return;
        this._editModeTxId = txId;
        this.switchTab('input');
        this.setInputMode('form');

        const deleteBtn = document.getElementById('formDeleteBtn');
        const spacer = document.getElementById('formSpacer');
        if (deleteBtn) deleteBtn.classList.remove('hidden');
        if (spacer) spacer.classList.add('hidden');

        this.setFormType(tx.type);

        this._calcDisplay = tx.amount.toString();
        this._calcPendingOp = null;
        this._calcPendingVal = null;
        this._calcJustEvaled = true;
        this._updateCalcDisplay();

        document.getElementById('formNote').value = tx.note || '';

        // Restore exclude_from_budget toggle
        const excToggle = document.getElementById('formExcludeBudget');
        if (excToggle) {
            if (tx.exclude_from_budget !== undefined) {
                excToggle.checked = !tx.exclude_from_budget;
            } else {
                // fallback to category default
                const catDef = customCategories.find(c => c.name === tx.category);
                excToggle.checked = !(catDef?.exclude_from_budget === true);
            }
        }

        if (tx.date) {
            let d;
            if (tx.date.toDate) d = tx.date.toDate();
            else d = new Date(tx.date);
            const dateStr = this.toLocalDateString(d);
            const timeStr = d.toTimeString().substring(0,5);
            document.getElementById('formDate').value = dateStr;
            const timeEl = document.getElementById('formTime');
            if (timeEl) timeEl.value = timeStr;
            
            document.getElementById('formDateLabel').textContent = dateStr;
            document.getElementById('formTimeLabel').textContent = timeStr;
        }

        setTimeout(() => { 
            if (tx.type === 'Transfer') {
                this.selectAccountInGrid('formFromAccountGrid', 'formFromAccount', tx.fromAccountId);
                this.selectAccountInGrid('formToAccountGrid', 'formToAccount', tx.toAccountId);
            } else {
                this.selectAccountInGrid('formAccountGrid', 'formAccount', tx.accountId);
                this.selectCategoryInGrid('formCategoryGrid', 'formCategory', tx.category);
            }
        }, 50);
    },

    closeFormMode: function() {
        const wasEditing = !!this._editModeTxId;
        const wasRecurring = !!this._recurringMode;
        this._editModeTxId = null;
        this._recurringMode = false;
        const deleteBtn = document.getElementById('formDeleteBtn');
        const spacer = document.getElementById('formSpacer');
        if (deleteBtn) deleteBtn.classList.add('hidden');
        if (spacer) spacer.classList.remove('hidden');
        
        // Reset recurring fields
        const recFields = document.getElementById('formRecurringFields');
        if (recFields) recFields.style.display = 'none';
        // Show date/time pills again
        const datePills = document.querySelector('#inputFormMode .flex.gap-2.justify-center');
        if (datePills) datePills.style.display = 'flex';
        // Show type switcher
        const typeSwitcher = document.querySelector('#inputFormMode .flex.bg-gray-100.rounded-2xl');
        if (typeSwitcher) typeSwitcher.style.display = 'flex';
        
        this._calcDisplay = '0';
        this._calcPendingOp = null;
        this._calcPendingVal = null;
        this._calcJustEvaled = false;
        this._updateCalcDisplay();
        document.getElementById('formNote').value = '';
        const today = new Date();
        document.getElementById('formDate').value = this.toLocalDateString(today);
        document.getElementById('formDateLabel').textContent = 'Hari ini';
        const timeEl = document.getElementById('formTime');
        if(timeEl) timeEl.value = today.toTimeString().substring(0,5);
        document.getElementById('formTimeLabel').textContent = 'Sekarang';
        
        if (wasRecurring) {
            this.switchTab('transactions');
            // Re-open recurring list
            setTimeout(() => this.openRecurringModal(), 100);
        } else {
            this.switchTab(wasEditing ? 'transactions' : 'home');
        }
    },

    deleteFormTx: function() {
        if (!this._editModeTxId) return;
        const modal = document.getElementById('deleteConfirmModal');
        if (modal) modal.classList.remove('hidden');
    },

    confirmDeleteTx: async function() {
        const modal = document.getElementById('deleteConfirmModal');
        if (modal) modal.classList.add('hidden');
        if (!this._editModeTxId) return;
        try {
            await db.collection('users').doc(currentUser.uid).collection('transactions').doc(this._editModeTxId).delete();
            this.toast('Transaksi dihapus');
            this.closeFormMode();
            this.loadData();
        } catch(e) { this.toast(e.message, true); }
    },

    cancelDeleteTx: function() {
        const modal = document.getElementById('deleteConfirmModal');
        if (modal) modal.classList.add('hidden');
    },

    // ─── Account Modal ────────────────────────────────────────────────────────
    openAccountModal: function(accId = null) {
        const acc = accId ? accounts.find(a => a.id === accId) : null;
        const selIcon = acc?.icon || AVAILABLE_ACC_ICONS[0];
        const selColor = acc?.color || AVAILABLE_ACC_COLORS[0];
        document.getElementById('editAccId').value = accId || '';
        document.getElementById('editAccName').value = acc?.name || '';
        
        const balanceInput = document.getElementById('editAccBalance');
        if (balanceInput) {
            const currentBal = acc ? (acc.balance || 0) : 0;
            balanceInput.value = currentBal;
            balanceInput.dataset.initBalance = currentBal;
        }

        document.querySelectorAll('input[name="editAccType"]').forEach(r => { r.checked = r.value === (acc?.type || 'Cash'); });
        const iconGrid = document.getElementById('editAccIconGrid');
        iconGrid.innerHTML = AVAILABLE_ACC_ICONS.map(ic => `
            <div onclick="document.getElementById('editAccIcon').value='${ic}'; this.parentElement.querySelectorAll('div').forEach(d=>{d.classList.remove('border-secondary','bg-secondary/10','text-secondary'); d.classList.add('border-gray-100','text-gray-400')}); this.classList.remove('border-gray-100','text-gray-400'); this.classList.add('border-secondary','bg-secondary/10','text-secondary');"
                 class="w-10 h-10 flex items-center justify-center border-2 rounded-xl text-xl cursor-pointer transition ${ic === selIcon ? 'border-secondary bg-secondary/10 text-secondary' : 'border-gray-100 text-gray-400'}">
                <i class="ph-fill ${ic}"></i>
            </div>
        `).join('');
        const colorGrid = document.getElementById('editAccColorGrid');
        colorGrid.innerHTML = AVAILABLE_ACC_COLORS.map(col => `
            <div onclick="document.getElementById('editAccColor').value='${col}'; this.parentElement.querySelectorAll('div').forEach(d=>d.classList.remove('ring-4')); this.classList.add('ring-4');"
                 class="w-8 h-8 rounded-full cursor-pointer transition ring-offset-2 ring-secondary ${col === selColor ? 'ring-4' : ''}" style="background-color:${col}">
            </div>
        `).join('');
        document.getElementById('editAccIcon').value = selIcon;
        document.getElementById('editAccColor').value = selColor;
        document.getElementById('btnDeleteAcc').classList.toggle('hidden', !accId);
        // Purpose
        const purposeVal = acc?.purpose || 'daily';
        document.querySelectorAll('[data-purpose-btn]').forEach(b => {
            const isActive = b.dataset.purposeBtn === purposeVal;
            b.classList.toggle('bg-secondary', isActive);
            b.classList.toggle('text-primary', isActive);
            b.classList.toggle('font-bold', isActive);
            b.classList.toggle('bg-gray-100', !isActive);
            b.classList.toggle('text-gray-500', !isActive);
        });
        const purposeInput = document.getElementById('editAccPurpose');
        if (purposeInput) purposeInput.value = purposeVal;
        // is_excluded_from_budget toggle
        const excludeToggle = document.getElementById('editAccExclude');
        if (excludeToggle) excludeToggle.checked = acc?.is_excluded_from_budget || false;
        const modal = document.getElementById('accountModal');
        modal.classList.remove('hidden'); modal.classList.add('flex');
    },

    closeAccountModal: function() {
        const modal = document.getElementById('accountModal');
        modal.classList.add('hidden'); modal.classList.remove('flex');
    },

    saveAccount: async function() {
        const id = document.getElementById('editAccId').value;
        const name = document.getElementById('editAccName').value.trim();
        const type = document.querySelector('input[name="editAccType"]:checked')?.value || 'Cash';
        const icon = document.getElementById('editAccIcon').value;
        const color = document.getElementById('editAccColor').value;
        const purpose = document.getElementById('editAccPurpose')?.value || 'daily';
        const is_excluded_from_budget = document.getElementById('editAccExclude')?.checked || false;
        if (!name) return this.toast('Nama akun wajib diisi', true);
        
        let targetAccountId = id;
        
        if (id) {
            const idx = accounts.findIndex(a => a.id === id);
            if (idx > -1) accounts[idx] = { ...accounts[idx], name, type, icon, color, purpose, is_excluded_from_budget };
        } else {
            targetAccountId = Date.now().toString();
            accounts.push({ id: targetAccountId, name, type, icon, color, balance: 0, purpose, is_excluded_from_budget });
        }
        currentProfile.accounts = accounts;
        
        try {
            await db.collection('users').doc(currentUser.uid).update({ accounts });
            
            // Handle balance adjustment
            const balanceInput = document.getElementById('editAccBalance');
            if (balanceInput && balanceInput.value !== '') {
                const newBal = parseFloat(balanceInput.value);
                const initBal = parseFloat(balanceInput.dataset.initBalance || 0);
                const diff = newBal - initBal;
                
                if (diff !== 0) {
                    const tx = {
                        type: diff > 0 ? 'Income' : 'Expense',
                        amount: Math.abs(diff),
                        category: 'Adjustment',
                        accountId: targetAccountId,
                        note: 'Balance Adjustment',
                        dateStr: this.toLocalDateString(new Date()),
                        exclude_from_budget: true,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    };
                    await db.collection('users').doc(currentUser.uid).collection('transactions').add(tx);
                    // Reload transactions so balances update
                    await this.loadData();
                }
            }
            
            this.toast('Akun disimpan');
            this.closeAccountModal();
            this.renderAccountsList();
            this.renderTransactionAccountFilters();
        } catch(e) { this.toast(e.message, true); }
    },

    deleteAccount: async function() {
        const id = document.getElementById('editAccId').value;
        if (!id || !confirm('Hapus akun ini?')) return;
        accounts = accounts.filter(a => a.id !== id);
        currentProfile.accounts = accounts;
        try {
            await db.collection('users').doc(currentUser.uid).update({ accounts });
            this.toast('Akun dihapus');
            this.closeAccountModal();
            this.renderAccountsList();
        } catch(e) { this.toast(e.message, true); }
    },

    // ─── Search Functions ──────────────────────────────────────────────────────
    openSearch: function() {
        const overlay = document.getElementById('txSearchOverlay');
        if (!overlay) return;
        overlay.classList.remove('hidden');
        overlay.classList.add('flex');
        setTimeout(() => document.getElementById('txSearchInput')?.focus(), 100);
        document.getElementById('txSearchInput').oninput = (e) => this.performSearch(e.target.value);
        document.getElementById('txSearchResults').innerHTML = '<p class="text-center text-gray-400 text-sm mt-10">Ketik untuk mencari transaksi...</p>';
    },

    closeSearch: function() {
        const overlay = document.getElementById('txSearchOverlay');
        if (!overlay) return;
        overlay.classList.add('hidden');
        overlay.classList.remove('flex');
        document.getElementById('txSearchInput').value = '';
    },

    performSearch: function(query) {
        const results = document.getElementById('txSearchResults');
        if (!results) return;
        const q = query.toLowerCase().trim();
        if (!q) { results.innerHTML = '<p class="text-center text-gray-400 text-sm mt-10">Ketik untuk mencari transaksi...</p>'; return; }
        const matched = allTransactions.filter(tx => {
            const note = (tx.note || '').toLowerCase();
            const cat = (tx.category || '').toLowerCase();
            const amt = String(tx.amount);
            return note.includes(q) || cat.includes(q) || amt.includes(q);
        }).slice(0, 20);
        if (matched.length === 0) { results.innerHTML = '<p class="text-center text-gray-400 text-sm mt-10">Tidak ditemukan</p>'; return; }

        // Calculate totals
        let totalExp = 0, totalInc = 0;
        matched.forEach(tx => {
            if (tx.type === 'Expense') totalExp += tx.amount;
            else if (tx.type === 'Income') totalInc += tx.amount;
        });
        const netAmt = totalInc - totalExp;
        const netColor = netAmt >= 0 ? 'text-success' : 'text-danger';
        const netPrefix = netAmt >= 0 ? '+' : '-';

        const totalBanner = `<div class="bg-white rounded-2xl p-3.5 border border-gray-100 mb-1">
            <div class="flex items-center justify-between mb-2">
                <p class="text-[10px] font-bold text-gray-400 uppercase">${matched.length} transaksi ditemukan</p>
                <p class="text-xs font-bold ${netColor}">${netPrefix} Rp ${this.format(Math.abs(netAmt))}</p>
            </div>
            <div class="flex gap-3">
                ${totalExp > 0 ? `<span class="text-[10px] text-danger font-bold flex items-center gap-1"><i class="ph-bold ph-arrow-up-right text-[9px]"></i>Rp ${this.format(totalExp)}</span>` : ''}
                ${totalInc > 0 ? `<span class="text-[10px] text-success font-bold flex items-center gap-1"><i class="ph-bold ph-arrow-down-left text-[9px]"></i>Rp ${this.format(totalInc)}</span>` : ''}
            </div>
        </div>`;

        results.innerHTML = totalBanner + matched.map(tx => {
            const def = this.getCategoryDef(tx.category || 'Others');
            const iconColor = tx.type === 'Transfer' ? '#3B82F6' : def.color;
            const iconBg = tx.type === 'Transfer' ? '#DBEAFE' : `${def.color}20`;
            const prefix = tx.type === 'Expense' ? '-' : tx.type === 'Income' ? '+' : '';
            const cls = tx.type === 'Income' ? 'text-success' : tx.type === 'Transfer' ? 'text-blue-500' : 'text-danger';
            return `<button type="button" class="w-full flex justify-between items-center gap-2.5 bg-white rounded-2xl p-3 border border-gray-100 text-left active:scale-[0.99] transition" onclick="app.closeSearch(); app.openEditTxModal('${tx.id}')">
                <div class="flex items-center gap-2.5 min-w-0 flex-1">
                    <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style="background:${iconBg};color:${iconColor}"><i class="ph-fill ${tx.type==='Transfer'?'ph-arrows-left-right':def.icon} text-sm"></i></div>
                    <div class="min-w-0"><p class="font-bold text-primary text-xs truncate">${tx.note || tx.category || 'Transfer'}</p><p class="text-[10px] text-gray-400">${tx.dateStr} · ${tx.category || 'Transfer'}</p></div>
                </div>
                <span class="font-bold ${cls} text-xs whitespace-nowrap">${prefix} Rp ${this.format(tx.amount)}</span>
            </button>`;
        }).join('');
    },

    // ── REPORT TAB ─────────────────────────────────────────────────────────────
    _reportCharts: [],
    _cashflowChartMode: 'waterfall',

    renderReport: function() {
        this.updateMonthLabels();
        const viewDate = activeMonthDate;
        const year = viewDate.getFullYear(), month = viewDate.getMonth();
        const monthStr = this.getCurrentMonthKey(viewDate);
        const monthName = viewDate.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const now = new Date();
        const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month;
        const daysPassed = isCurrentMonth ? now.getDate() : daysInMonth;

        const monthTxs = allTransactions.filter(tx => (tx.dateStr || '').startsWith(monthStr));
        let inc = 0, exp = 0, expInBudget = 0, cats = {}, incomeCats = {};
        monthTxs.forEach(tx => {
            if (tx.type === 'Income') { inc += tx.amount; incomeCats[tx.category || 'Other'] = (incomeCats[tx.category || 'Other'] || 0) + tx.amount; }
            else if (tx.type === 'Expense') {
                exp += tx.amount;
                cats[tx.category || 'Other'] = (cats[tx.category || 'Other'] || 0) + tx.amount;
                const catDef = customCategories.find(c => c.name === tx.category);
                const isExcluded = tx.exclude_from_budget === true || (tx.exclude_from_budget === undefined && catDef?.exclude_from_budget === true);
                if (!isExcluded) expInBudget += tx.amount;
            }
        });
        const surplus = inc - exp;
        const avgDaily = daysPassed > 0 ? Math.round(exp / daysPassed) : 0;
        const savingRate = inc > 0 ? ((surplus / inc) * 100) : 0;
        const budget = currentProfile?.monthlyBudget || DEFAULT_MONTHLY_BUDGET;
        const budgetUsed = budget > 0 ? Math.min((expInBudget / budget) * 100, 100) : 0;

        // --- Previous Month Calculations for Comparison ---
        const prevMonthDate = new Date(year, month - 1, 1);
        const prevMonthStr = this.getCurrentMonthKey(prevMonthDate);
        const prevDaysInMonth = new Date(year, month, 0).getDate();
        const prevDaysPassed = (prevMonthDate.getFullYear() === now.getFullYear() && prevMonthDate.getMonth() === now.getMonth()) ? now.getDate() : prevDaysInMonth;
        const prevMonthTxs = allTransactions.filter(tx => (tx.dateStr || '').startsWith(prevMonthStr));
        let prevInc = 0, prevExp = 0;
        prevMonthTxs.forEach(tx => {
            if (tx.type === 'Income') prevInc += tx.amount;
            else if (tx.type === 'Expense') prevExp += tx.amount;
        });
        const prevSurplus = prevInc - prevExp;
        const prevAvgDaily = prevDaysPassed > 0 ? Math.round(prevExp / prevDaysPassed) : 0;

        function renderComp(curr, prev, inverseColor = false) {
            if (prev === 0) return '';
            const diff = curr - prev;
            if (diff === 0) return `<div class="flex items-center gap-1 mt-1 text-[9px] font-bold text-gray-400"><span>= Rp 0</span></div>`;
            const pct = Math.round(Math.abs(diff / prev) * 100);
            const isUp = diff > 0;
            const sign = isUp ? '+' : '-';
            const iconCls = isUp ? 'ph-trend-up' : 'ph-trend-down';
            let colorCls;
            if (inverseColor) {
               colorCls = isUp ? 'text-danger' : 'text-success'; // Expenses: up is bad(red), down is good(green)
            } else {
               colorCls = isUp ? 'text-success' : 'text-danger'; // Income/Surplus: up is good(green), down is bad(red)
            }
            return `<div class="flex items-center gap-0.5 mt-0.5 ${colorCls} text-[9px] font-bold"><i class="ph-bold ${iconCls}"></i><span>${sign} Rp ${app.format(Math.abs(diff))} (${pct}%)</span></div>`;
        }

        const compInc = renderComp(inc, prevInc, false);
        const compExp = renderComp(exp, prevExp, true);
        const compSurplus = renderComp(surplus, prevSurplus, false);
        const compAvgDaily = renderComp(avgDaily, prevAvgDaily, true);
        // --------------------------------------------------

        // Destroy old charts
        this._reportCharts.forEach(c => { try { c.destroy(); } catch(e) {} });
        this._reportCharts = [];

        // ── Detailed Score Calculation (Revamped, max 100) ──────────────
        // trackedDays: unique dates with any transaction this month (no Firestore query needed)
        const trackedDaysSet = new Set();
        monthTxs.forEach(tx => { if (tx.dateStr) trackedDaysSet.add(tx.dateStr); });
        const trackedDays = trackedDaysSet.size;

        // 1. Needs vs Wants Efficiency (max 25 pts)
        const repNature = this.evaluateNatureBreakdown(monthTxs.filter(t => t.type === 'Expense'), customCategories);
        const eNeeds = repNature.needs, eWants = repNature.wants, eMust = repNature.must;
        let effScore = 0, effDetail = '';
        if (exp > inc && inc > 0) {
            effScore = 0; effDetail = 'Overbudget (Exp > Inc)';
        } else {
            const useInc = inc > 0 ? inc : (exp > 0 ? exp : 1);
            const needsPctInc = Math.round((eNeeds / useInc) * 100);
            const wantsPctInc = Math.round((eWants / useInc) * 100);
            if (needsPctInc > 60 || wantsPctInc > 40) { effScore = 5; effDetail = 'Bocor'; }
            else if (needsPctInc > 50 || wantsPctInc > 30) { effScore = 15; effDetail = 'Warning (N>50% / W>30%)'; }
            else { effScore = 25; effDetail = 'Sangat Efisien'; }
        }
        
        // 2. Fixed Cost Burden (max 20 pts)
        const useIncFixed = inc > 0 ? inc : (exp > 0 ? exp : 1);
        const mustPctInc = Math.round((eMust / useIncFixed) * 100);
        let fixedScore = 0, fixedDetail = '';
        if (mustPctInc > 40) { fixedScore = 0; fixedDetail = 'Gali Lubang (>40%)'; }
        else if (mustPctInc >= 30) { fixedScore = 10; fixedDetail = 'Hati-hati (30-40%)'; }
        else { fixedScore = 20; fixedDetail = 'Sehat (<30%)'; }

        // 3. Emergency Fund Readiness (max 20 pts)
        const avgMonthlyExp = exp > 0 ? exp : 1000000;
        const reportEfScore = this.calculateEmergencyFundScore(accounts, avgMonthlyExp);
        let efMetricScore = 0, efDetail = '';
        if (reportEfScore.months >= 3) { efMetricScore = 20; efDetail = 'Aman Sentosa'; }
        else if (reportEfScore.months >= 1) { efMetricScore = 10; efDetail = 'Lumayan (1-3 bln)'; }
        else if (reportEfScore.totalEmergency > 0) { efMetricScore = 5; efDetail = 'Baru Mulai (<1 bln)'; }
        else { efMetricScore = 0; efDetail = 'Kosong Melompong'; }

        // 4. Savings Rate (max 20 pts)
        let savingsRateScore = 0, srDetail = '';
        if (savingRate >= 20) { savingsRateScore = 20; srDetail = 'Top Tier (≥20%)'; }
        else if (savingRate >= 10) { savingsRateScore = 15; srDetail = 'Cukup (10-19%)'; }
        else if (savingRate > 0) { savingsRateScore = 5; srDetail = 'Tipis (1-9%)'; }
        else { savingsRateScore = 0; srDetail = 'Boncos (≤0%)'; }

        // 5. Tracking Consistency (max 15 pts)
        const _nowDate = new Date();
        const _isCurrentMonth = viewDate.getFullYear() === _nowDate.getFullYear() && viewDate.getMonth() === _nowDate.getMonth();
        const _daysInMonthToConsider = _isCurrentMonth ? _nowDate.getDate() : new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
        const trackPct = _daysInMonthToConsider > 0 ? trackedDays / _daysInMonthToConsider : 0;
        
        let trackingScore = 0, trDetail = '';
        if (trackPct >= 0.8) { trackingScore = 15; trDetail = `Rajin Banget (${Math.round(trackPct*100)}%)`; }
        else if (trackPct >= 0.5) { trackingScore = 10; trDetail = `Bolong Dikit (${Math.round(trackPct*100)}%)`; }
        else if (trackPct >= 0.2) { trackingScore = 5; trDetail = `Males-malesan (${Math.round(trackPct*100)}%)`; }
        else { trackingScore = 0; trDetail = `Ghosting (${Math.round(trackPct*100)}%)`; }

        const score = Math.max(0, Math.min(100, effScore + fixedScore + efMetricScore + savingsRateScore + trackingScore));
        const scoreLabel = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Needs Attention';
        const scoreColor = score >= 80 ? '#10B981' : score >= 60 ? '#1CBDB3' : score >= 40 ? '#F59E0B' : '#EF4444';

        // Build metrics array for rendering
        const healthMetrics = [
            { icon: 'ph-sparkle', label: 'Needs vs Wants', value: `${Math.round((eNeeds+eWants)/(inc||1)*100)}%`, detail: effDetail, pts: effScore, max: 25, color: '#8B5CF6' },
            { icon: 'ph-lock-key', label: 'Fixed Cost Burden', value: `${mustPctInc}%`, detail: fixedDetail, pts: fixedScore, max: 20, color: '#3B82F6' },
            { icon: 'ph-first-aid-kit', label: 'Emergency Fund', value: `${reportEfScore.months} bln`, detail: efDetail, pts: efMetricScore, max: 20, color: reportEfScore.color },
            { icon: 'ph-piggy-bank', label: 'Savings Rate', value: `${savingRate.toFixed(1)}%`, detail: srDetail, pts: savingsRateScore, max: 20, color: '#10B981' },
            { icon: 'ph-calendar-check', label: 'Tracking Consistency', value: `${trackedDays} hari`, detail: trDetail, pts: trackingScore, max: 15, color: '#F59E0B' }
        ];

        // Insight text
        const healthInsight = score >= 80 ? 'Keuanganmu dalam kondisi prima! Pertahankan kebiasaan menabung dan tracking yang konsisten. 👏'
            : score >= 60 ? 'Performa keuanganmu cukup baik. Tingkatkan konsistensi tracking dan coba diversifikasi sumber income untuk skor lebih tinggi.'
            : score >= 40 ? 'Ada ruang untuk perbaikan. Fokus pada pengendalian pengeluaran dan mulai tracking harian secara rutin.'
            : 'Keuanganmu perlu perhatian serius. Prioritaskan mengurangi pengeluaran dan buat budget yang realistis.';
        const healthInsightIcon = score >= 60 ? 'ph-thumbs-up' : score >= 40 ? 'ph-lightbulb' : 'ph-warning';

        // Expense breakdown sorted
        const expCats = Object.entries(cats).map(([k, v]) => ({ cat: k, amt: v, pct: exp > 0 ? (v / exp * 100) : 0 })).sort((a, b) => b.amt - a.amt);
        const incCats = Object.entries(incomeCats).map(([k, v]) => ({ cat: k, amt: v, pct: inc > 0 ? (v / inc * 100) : 0 })).sort((a, b) => b.amt - a.amt);

        // Day of week spending
        const dayOfWeekTotals = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
        const dayOfWeekNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
        // Daily activity
        const dailyTotals = new Array(daysInMonth).fill(0);
        const dailyIncome = new Array(daysInMonth).fill(0);
        const dailyExpense = new Array(daysInMonth).fill(0);
        const dailyTxs = Array.from({length: daysInMonth}, () => []);
        monthTxs.forEach(tx => {
            if (!tx.dateStr) return;
            try {
                const d = this.parseLocalDateString(tx.dateStr);
                const dayNum = d.getDate();
                if (tx.type === 'Expense') {
                    dayOfWeekTotals[d.getDay()] += tx.amount;
                    if (dayNum >= 1 && dayNum <= daysInMonth) {
                        dailyTotals[dayNum - 1] += tx.amount;
                        dailyExpense[dayNum - 1] += tx.amount;
                    }
                } else if (tx.type === 'Income') {
                    if (dayNum >= 1 && dayNum <= daysInMonth) {
                        dailyIncome[dayNum - 1] += tx.amount;
                    }
                }
                if (dayNum >= 1 && dayNum <= daysInMonth) dailyTxs[dayNum - 1].push(tx);
            } catch(e) {}
        });
        // Store for popup access
        this._reportDailyTxs = dailyTxs;
        this._reportYear = year;
        this._reportMonth = month;
        const maxDayOfWeek = Math.max(...dayOfWeekTotals, 1);
        const maxDaily = Math.max(...dailyTotals, 1);

        // Weekday / Weekend averages (needed early for insights)
        const _weekdayTotals = dayOfWeekTotals.slice(1, 6);
        const _weekendTotals = [dayOfWeekTotals[0], dayOfWeekTotals[6]];
        const _weekdayDaysInMonth = [1,2,3,4,5].reduce((sum, dow) => {
            let count = 0;
            for (let d = 1; d <= daysInMonth; d++) { if (new Date(year, month, d).getDay() === dow) count++; }
            return sum + count;
        }, 0);
        const _weekendDaysInMonth = [0,6].reduce((sum, dow) => {
            let count = 0;
            for (let d = 1; d <= daysInMonth; d++) { if (new Date(year, month, d).getDay() === dow) count++; }
            return sum + count;
        }, 0);
        const _weekdayTotalAmt = _weekdayTotals.reduce((s, v) => s + v, 0);
        const _weekendTotalAmt = _weekendTotals.reduce((s, v) => s + v, 0);
        const weekdayAvgDay = _weekdayDaysInMonth > 0 ? Math.round(_weekdayTotalAmt / _weekdayDaysInMonth) : 0;
        const weekendAvgDay = _weekendDaysInMonth > 0 ? Math.round(_weekendTotalAmt / _weekendDaysInMonth) : 0;

        // Calendar grid (weeks)
        const fmt = v => v >= 1000000 ? (v/1000000).toFixed(1)+'jt' : v >= 1000 ? Math.round(v/1000)+'k' : String(v);
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        let calendarHtml = '<div class="grid grid-cols-7 gap-1">';
        dayOfWeekNames.forEach(d => { calendarHtml += `<div class="text-[9px] font-bold text-gray-400 py-1 text-center">${d}</div>`; });
        for (let i = 0; i < firstDayOfMonth; i++) calendarHtml += '<div></div>';
        for (let d = 1; d <= daysInMonth; d++) {
            const exp = dailyExpense[d - 1];
            const inc = dailyIncome[d - 1];
            const bal = inc - exp;
            const hasData = exp > 0 || inc > 0;
            const intensity = exp > 0 ? Math.max(0.12, Math.min(1, exp / maxDaily)) : 0;
            const bg = exp > 0 ? `rgba(249,115,22,${intensity})` : (inc > 0 ? 'rgba(16,185,129,0.12)' : '#F3F4F6');
            const textColor = intensity > 0.55 ? 'white' : '#374151';
            const subColor = intensity > 0.55 ? 'rgba(255,255,255,0.85)' : '#6B7280';
            const isFuture = isCurrentMonth && d > now.getDate();
            const isToday = isCurrentMonth && d === now.getDate();
            const todayRing = isToday ? 'outline: 2px solid #F97316; outline-offset: 1px;' : '';
            const tooltip = `${d}: Income Rp ${this.format(inc)} | Keluar Rp ${this.format(exp)} | Balance Rp ${this.format(bal)}`;
            const clickable = !isFuture && hasData ? `onclick="app.showDayDetail(${year},${month},${d})" style="cursor:pointer;aspect-ratio:1/1.15;background:${bg};${todayRing}"` : `style="aspect-ratio:1/1.15;background:${bg};${todayRing}"`;
            calendarHtml += `<div class="w-full rounded-lg relative flex flex-col justify-between p-1 ${isFuture ? 'opacity-30' : 'active:scale-95 transition'}" ${clickable} title="${tooltip}">`;
            // Date + income dot top-right
            calendarHtml += `<div class="flex items-center justify-end gap-0.5">${inc > 0 ? `<div class="w-1 h-1 rounded-full bg-gray-900 shrink-0"></div>` : ''}<span class="text-[10px] font-black" style="color:${textColor}">${d}</span></div>`;
            if (exp > 0) {
                calendarHtml += `<span class="text-[8px] font-bold leading-tight" style="color:${subColor}">-${fmt(exp)}</span>`;
            }
            calendarHtml += `</div>`;
        }
        calendarHtml += '</div>';

        // Insights
        // ── IQR Outlier Detection for Report ──────────────────────────
        const expOnlyTxs = monthTxs.filter(tx => tx.type === 'Expense');
        const reportOutliers = this.calcIQROutliers(expOnlyTxs);
        const activeDailyTotals = dailyTotals.filter(v => v > 0);
        const reportMedianTx = activeDailyTotals.length >= 4 ? Math.round(this.calcMedian(activeDailyTotals)) : (activeDailyTotals.length > 0 ? Math.round(this.calcMedian(activeDailyTotals)) : 0);
        let outlierCardHtml = '';
        if (reportOutliers.length > 0) {
            const totalOutlierAmt = reportOutliers.reduce((s, t) => s + t.amount, 0);
            const expWithoutOutliers = exp - totalOutlierAmt;
            const avgDailyWithout = daysPassed > 0 ? Math.round(expWithoutOutliers / daysPassed) : 0;
            const outlierList = reportOutliers
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 3)
                .map(t => `<div class="flex items-center justify-between py-1.5 border-b border-amber-100 last:border-0">
                    <div class="flex items-center gap-2 min-w-0">
                        <div class="w-6 h-6 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0"><i class="ph-fill ph-lightning text-xs"></i></div>
                        <span class="text-xs font-semibold text-primary truncate">${t.note || t.category || 'Pengeluaran'}</span>
                    </div>
                    <span class="text-xs font-bold text-amber-600 shrink-0 ml-2">Rp ${this.format(t.amount)}</span>
                </div>`).join('');
            const multiSuffix = reportOutliers.length > 3 ? `<p class="text-[10px] text-amber-400 mt-1">+${reportOutliers.length - 3} transaksi outlier lainnya</p>` : '';
            outlierCardHtml = `<div class="flex items-start gap-3 rounded-2xl p-3.5 border" style="background:rgba(251,191,36,0.08);border-color:rgba(251,191,36,0.3)">
                <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-amber-500" style="background:rgba(251,191,36,0.15)"><i class="ph-fill ph-lightning text-base"></i></div>
                <div class="flex-1 min-w-0">
                    <p class="text-xs font-bold text-primary mb-0.5">⚡ ${reportOutliers.length} Pengeluaran Outlier Terdeteksi</p>
                    <p class="text-[11px] text-gray-500 leading-relaxed mb-2">Transaksi di bawah ini <b>jauh di atas kebiasaan</b> kamu (IQR method). Tanpa mereka, rata-rata harianmu cuma <b>Rp ${this.format(avgDailyWithout)}/hari</b> — bukan Rp ${this.format(avgDaily)}/hari. Jangan panik dulu! 😎</p>
                    <div class="bg-white rounded-xl p-2.5 border border-amber-100">${outlierList}${multiSuffix}</div>
                    <div class="flex items-center justify-between mt-2.5 bg-white rounded-xl px-3 py-2 border border-amber-100">
                        <span class="text-[10px] font-bold text-gray-500">Tipikal pengeluaran harian</span>
                        <span class="text-xs font-heading font-bold text-amber-600">Rp ${this.format(reportMedianTx)}/hari</span>
                    </div>
                </div>
            </div>`;
        }
        // ───────────────────────────────────────────────────────────────

        const insights = [];
        if (savingRate >= 20) insights.push({ icon: 'ph-trophy', color: '#10B981', title: 'Surplus Keren! 🔥', text: `Surplus lu nyisa Rp ${this.format(Math.abs(surplus))} (${savingRate.toFixed(1)}%)! Daripada nganggur kena inflasi, pindahin 50%-nya ke Dana Darurat atau investasi sekarang yuk.` });
        else if (savingRate >= 0) insights.push({ icon: 'ph-warning', color: '#F59E0B', title: 'Saving Rate Masih Tipis ⚠️', text: `Saving rate cuma ${savingRate.toFixed(1)}% nih — idealnya minimal 20%. Coba review pengeluaran minggu ini, pasti ada yang bisa dipangkas.` });
        else insights.push({ icon: 'ph-warning-circle', color: '#EF4444', title: 'Defisit! Bahaya Nih 🚨', text: `Lu udah ngabisin lebih dari pendapatan bulan ini. Defisit Rp ${this.format(Math.abs(surplus))} — ini serius, segera audit spending-mu!` });

        if (expCats.length > 0) {
            const topCat = expCats[0];
            const topCatNature = customCategories?.find(x => x.name === topCat.cat)?.nature || '';
            const _oppItems = [
                { name: 'porsi Ayam Geprek', price: 15000 },
                { name: 'gelas Es Kopi Susu', price: 20000 },
                { name: 'bulan langganan Netflix', price: 65000 },
                { name: 'gram Emas Antam Mini', price: 1300000 },
                { name: 'lot Reksadana', price: 100000 },
            ];
            let _topCatOpp = null;
            for (const item of _oppItems) {
                const qty = Math.floor(topCat.amt / item.price);
                if (qty >= 2 && qty <= 200) { _topCatOpp = { qty, name: item.name }; break; }
            }
            if (!_topCatOpp) { const fi = _oppItems[0]; _topCatOpp = { qty: Math.floor(topCat.amt / fi.price), name: fi.name }; }
            const _oppSuffix = _topCatOpp.qty >= 1 ? ` Opportunity cost-nya: duit segitu setara <b>${_topCatOpp.qty} ${_topCatOpp.name}</b>.` : '';
            const _wantsVerb = topCatNature === 'wants' ? ' Coba direm dikit checkout-nya bulan depan! 🛒' : (topCat.pct > 40 ? ' Coba kurangi spending di kategori ini.' : '');
            insights.push({ icon: 'ph-chart-pie', color: topCat.pct > 40 ? '#EF4444' : '#3B82F6', title: `Kategori Terbesar: ${topCat.cat}`, text: `${topCat.cat} menghabiskan ${topCat.pct.toFixed(1)}% (Rp ${this.format(topCat.amt)}) dari total pengeluaran bulan ini.${_oppSuffix}${_wantsVerb}` });
        }
        const weekendSpend = dayOfWeekTotals[0] + dayOfWeekTotals[6];
        const weekdaySpend = dayOfWeekTotals.slice(1, 6).reduce((s, v) => s + v, 0);
        if (weekendSpend > weekdaySpend * 0.5 && weekendSpend > 0) {
            const weekendRatio = weekdayAvgDay > 0 ? (weekendAvgDay / weekdayAvgDay).toFixed(1) : '?';
            insights.push({ icon: 'ph-sun', color: '#F97316', title: 'Weekend Spender! 🛍️', text: `Weekend kemaren lu jajan Rp ${this.format(weekendAvgDay)}/hari — ${weekendRatio}x lipat dibanding hari biasa (Rp ${this.format(weekdayAvgDay)}/hari). Awas lifestyle creep, kurang-kurangin balas dendamnya bro!` });
        }
        if (expInBudget <= budget && budget > 0) insights.push({ icon: 'ph-check-circle', color: '#10B981', title: 'On Budget! ✅', text: `Pengeluaranmu masih di bawah budget Rp ${this.format(budget)}. Sisa budget Rp ${this.format(budget - expInBudget)}.` });
        else if (budget > 0) insights.push({ icon: 'ph-x-circle', color: '#EF4444', title: 'Over Budget! ⚠️', text: `Pengeluaranmu melewati budget sebesar Rp ${this.format(expInBudget - budget)}. Perlu evaluasi spending.` });

        const insightsHtml = insights.map(ins => `
            <div class="flex items-start gap-3 bg-gray-50 rounded-2xl p-3.5 border border-gray-100">
                <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style="background:${ins.color}15;color:${ins.color}"><i class="ph-fill ${ins.icon} text-base"></i></div>
                <div class="min-w-0"><p class="text-xs font-bold text-primary mb-0.5">${ins.title}</p><p class="text-[11px] text-gray-500 leading-relaxed">${ins.text}</p></div>
            </div>`).join('');

        // Expense breakdown table
        const expTableHtml = expCats.length > 0 ? expCats.map(c => {
            const def = this.getCategoryDef(c.cat);
            return `<div class="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style="background:${def.color}15;color:${def.color}"><i class="ph-fill ${def.icon} text-sm"></i></div>
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-center mb-1"><span class="text-xs font-bold text-primary">${c.cat}</span><span class="text-xs font-bold" style="color:${def.color}">Rp ${this.format(c.amt)}</span></div>
                    <div class="h-1.5 rounded-full bg-gray-100 overflow-hidden"><div class="h-full rounded-full" style="width:${c.pct}%;background:${def.color}"></div></div>
                </div>
                <span class="text-[10px] font-bold text-gray-400 shrink-0 w-10 text-right">${c.pct.toFixed(0)}%</span>
            </div>`;
        }).join('') : '<p class="text-xs text-gray-400 text-center py-4">Belum ada pengeluaran</p>';

        // Income breakdown table
        const incTableHtml = incCats.length > 0 ? incCats.map(c => {
            const def = this.getCategoryDef(c.cat);
            return `<div class="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style="background:${def.color}15;color:${def.color}"><i class="ph-fill ${def.icon} text-sm"></i></div>
                <div class="flex-1 min-w-0"><p class="text-xs font-bold text-primary">${c.cat}</p><p class="text-[10px] text-gray-400">${c.pct.toFixed(1)}% dari total pemasukan</p></div>
                <span class="text-xs font-bold text-success shrink-0">Rp ${this.format(c.amt)}</span>
            </div>`;
        }).join('') : '<p class="text-xs text-gray-400 text-center py-4">Belum ada pemasukan</p>';

        const container = document.getElementById('reportContent');
        if (!container) return;
        // Weekday / Weekend data for summary banner
        const weekdayTotals = dayOfWeekTotals.slice(1, 6);
        const weekendTotals = [dayOfWeekTotals[0], dayOfWeekTotals[6]];
        const weekdayCount = monthTxs.filter(tx => tx.type === 'Expense' && tx.dateStr && (() => { try { const d = this.parseLocalDateString(tx.dateStr); return d.getDay() >= 1 && d.getDay() <= 5; } catch(e) { return false; } })()).length;
        const weekendCount = monthTxs.filter(tx => tx.type === 'Expense' && tx.dateStr && (() => { try { const d = this.parseLocalDateString(tx.dateStr); return d.getDay() === 0 || d.getDay() === 6; } catch(e) { return false; } })()).length;
        const weekdayDaysInMonth = _weekdayDaysInMonth;
        const weekendDaysInMonth = _weekendDaysInMonth;
        const weekdayTotalAmt = _weekdayTotalAmt;
        const weekendTotalAmt = _weekendTotalAmt;
        // weekdayAvgDay / weekendAvgDay already declared above

        // Build CSS-only Day-of-Week bar chart
        const dowMax = Math.max(...dayOfWeekTotals, 1);
        const dowBarsHtml = dayOfWeekTotals.map((val, i) => {
            const isWeekend = i === 0 || i === 6;
            const barColor = isWeekend ? '#F97316' : '#3B82F6';
            const barBg = isWeekend ? 'rgba(249,115,22,0.1)' : 'rgba(59,130,246,0.1)';
            const heightPct = Math.round((val / dowMax) * 100);
            const label = val > 0 ? (val >= 1000000 ? `${(val/1000000).toFixed(1)}jt` : val >= 1000 ? `${Math.round(val/1000)}k` : `${val}`) : '-';
            return `<div class="flex flex-col items-center gap-1" style="flex:1">
                <span class="text-[9px] font-bold" style="color:${val > 0 ? barColor : '#CBD5E1'}">${label}</span>
                <div class="w-full rounded-t-lg flex items-end" style="height:80px;background:${barBg}">
                    <div class="w-full rounded-t-lg transition-all" style="height:${Math.max(heightPct, val > 0 ? 4 : 0)}%;background:${val > 0 ? barColor : 'transparent'}"></div>
                </div>
                <span class="text-[9px] font-bold text-gray-500">${dayOfWeekNames[i]}</span>
            </div>`;
        }).join('');

        // Build 6-Month Spending CSS-only Chart
        this._reportSixMoMode = this._reportSixMoMode || 'Expense';
        const monthsData = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(year, month - i, 1);
            const mKey = this.getCurrentMonthKey(d);
            const mName = d.toLocaleString('id-ID', { month: 'short' });
            let mExp = 0, mInc = 0;
            allTransactions.filter(tx => (tx.dateStr || '').startsWith(mKey)).forEach(tx => {
                if (tx.type === 'Expense') mExp += tx.amount;
                if (tx.type === 'Income') mInc += tx.amount;
            });
            let val = 0;
            if (this._reportSixMoMode === 'Expense') val = mExp;
            else if (this._reportSixMoMode === 'Income') val = mInc;
            else if (this._reportSixMoMode === 'Surplus') val = mInc - mExp;

            monthsData.push({ label: mName, value: val, hasData: mExp > 0 || mInc > 0, isCurrent: i === 0 });
        }
        // Average: only months with actual data (non-zero income or expense)
        const activeMonths = monthsData.filter(m => m.hasData);
        const avgVal = activeMonths.length > 0 ? activeMonths.reduce((s, m) => s + m.value, 0) / activeMonths.length : 0;
        const max6Mo = Math.max(...monthsData.map(m => Math.abs(m.value)), Math.abs(avgVal), 1);
        const avgHeightPct = Math.round((Math.abs(avgVal) / max6Mo) * 100);
        const avgLabel = Math.abs(avgVal) >= 1000000 ? `${(Math.abs(avgVal)/1000000).toFixed(1)}jt`.replace('.0jt','jt') : Math.abs(avgVal) >= 1000 ? `${Math.round(Math.abs(avgVal)/1000)}k` : `${Math.round(Math.abs(avgVal))}`;
        const avgColor = this._reportSixMoMode === 'Income' ? '#10B981' : this._reportSixMoMode === 'Surplus' ? (avgVal >= 0 ? '#10B981' : '#EF4444') : '#EF4444';
        const sixMoBarsHtml = monthsData.map(m => {
            const barColor = m.isCurrent ? '#F97316' : '#3B82F6';
            const barBg = m.isCurrent ? 'rgba(249,115,22,0.1)' : 'rgba(59,130,246,0.1)';
            const heightPct = Math.round((Math.abs(m.value) / max6Mo) * 100);
            const valLabel = Math.abs(m.value);
            let label = valLabel > 0 ? (valLabel >= 1000000 ? `${(valLabel/1000000).toFixed(1)}jt`.replace('.0jt', 'jt') : valLabel >= 1000 ? `${Math.round(valLabel/1000)}k` : `${valLabel}`) : '-';
            if (m.value < 0) label = '-' + label;
            const barBgColor = m.value < 0 ? '#EF4444' : barColor;
            return `<div class="flex flex-col items-center justify-end gap-1" style="flex:1">
                <span class="text-[9px] font-bold" style="color:${m.value !== 0 ? barBgColor : '#CBD5E1'}">${label}</span>
                <div class="w-full rounded-t-lg flex items-end" style="height:80px;background:${barBg}">
                    <div class="w-full rounded-t-lg transition-all" style="height:${Math.max(heightPct, m.value !== 0 ? 4 : 0)}%;background:${m.value !== 0 ? barBgColor : 'transparent'}"></div>
                </div>
                <span class="text-[9px] font-bold text-gray-500 whitespace-nowrap">${m.label}</span>
            </div>`;
        }).join('');

        // Spending DNA Card computation
        const _dnaExpCatsSorted = Object.entries(cats).map(([k,v]) => ({ cat: k, amt: v, pct: exp > 0 ? v/exp*100 : 0 })).sort((a,b) => b.amt - a.amt);
        const _dnaTop1 = _dnaExpCatsSorted[0];
        const _dnaTop1Nature = _dnaTop1 ? (customCategories?.find(x => x.name === _dnaTop1.cat)?.nature || '') : '';
        const _dnaWantsPct = repNature?.wantsPct || 0;
        const _dnaMustPct = repNature?.mustPct || 0;
        const _dnaTopInWants = _dnaExpCatsSorted.slice(0,3).some(c => { const def = customCategories?.find(x => x.name === c.cat); return def?.nature === 'wants'; });
        const _dnaTopIsFnb = _dnaTop1 && ['Makanan', 'Food', 'F&B', 'Makan', 'Kopi', 'Coffee', 'Resto'].some(w => _dnaTop1.cat.toLowerCase().includes(w.toLowerCase()));
        let _dnaType, _dnaEmoji, _dnaColor, _dnaBg, _dnaDesc1, _dnaDesc2;
        if (trackedDays < 5) {
            _dnaType = 'Ghost Tracker'; _dnaEmoji = '👻'; _dnaColor = '#64748B'; _dnaBg = 'rgba(100,116,139,0.1)';
            _dnaDesc1 = 'Data transaksi bulan ini masih dikit.';
            _dnaDesc2 = 'Rajin catat dulu biar DNA-nya keliatan jelas!';
        } else if (savingRate >= 25) {
            _dnaType = 'Cuan Collector'; _dnaEmoji = '🏆'; _dnaColor = '#10B981'; _dnaBg = 'rgba(16,185,129,0.1)';
            _dnaDesc1 = `Saving rate lo ${savingRate.toFixed(1)}% — lo adalah anomali Gen-Z yang beneran nabung.`;
            _dnaDesc2 = 'Rare banget, pertahanin ya!';
        } else if (_dnaWantsPct >= 50) {
            _dnaType = 'Hedonist'; _dnaEmoji = '🎉'; _dnaColor = '#EC4899'; _dnaBg = 'rgba(236,72,153,0.1)';
            _dnaDesc1 = `${Math.round(_dnaWantsPct)}% pengeluaran lo itu Wants. YOLO spending detected.`;
            _dnaDesc2 = 'Boleh senang, tapi jangan lupa masa depan lo juga perlu dana!';
        } else if (_dnaTopIsFnb && savingRate >= 15) {
            _dnaType = 'Urban Foodie'; _dnaEmoji = '🍜'; _dnaColor = '#F97316'; _dnaBg = 'rgba(249,115,22,0.1)';
            _dnaDesc1 = `Kategori terbesar lo ${_dnaTop1.cat}, tapi saving rate tetap ${savingRate.toFixed(1)}%.`;
            _dnaDesc2 = 'Rare combo — doyan makan tapi tetep nabung. Respect!';
        } else if (_dnaWantsPct >= 35 && _dnaTopInWants) {
            _dnaType = 'Shopping Addict'; _dnaEmoji = '🛒'; _dnaColor = '#8B5CF6'; _dnaBg = 'rgba(139,92,246,0.1)';
            _dnaDesc1 = `${Math.round(_dnaWantsPct)}% dari spending lo masuk kategori Wants.`;
            _dnaDesc2 = 'Cart lo bahaya bro, coba wishlist dulu sebelum checkout!';
        } else if (_dnaMustPct >= 55) {
            _dnaType = 'Bill Warrior'; _dnaEmoji = '⚔️'; _dnaColor = '#3B82F6'; _dnaBg = 'rgba(59,130,246,0.1)';
            _dnaDesc1 = `Fixed & must cost nyedot ${Math.round(_dnaMustPct)}% dari pengeluaran lo.`;
            _dnaDesc2 = 'Beban fixed cost berat — butuh income boost atau negosiasi tagihan.';
        } else if (savingRate >= 10 && savingRate < 25 && _dnaWantsPct < 35 && _dnaMustPct < 55) {
            _dnaType = 'Balanced Planner'; _dnaEmoji = '⚖️'; _dnaColor = '#1CBDB3'; _dnaBg = 'rgba(28,189,179,0.1)';
            _dnaDesc1 = `Alokasi lo cukup balanced — saving ${savingRate.toFixed(1)}%, Wants ${Math.round(_dnaWantsPct)}%.`;
            _dnaDesc2 = '50/30/20 gang. Lo udah paham cara main keuangannya!';
        } else {
            _dnaType = 'Struggling Saver'; _dnaEmoji = '😤'; _dnaColor = '#F59E0B'; _dnaBg = 'rgba(245,158,11,0.1)';
            _dnaDesc1 = `Saving rate lo baru ${savingRate.toFixed(1)}% — masih bisa ditingkatin.`;
            _dnaDesc2 = 'Mulai dari potong satu kebiasaan boros aja dulu, step by step!';
        }

        container.innerHTML = `
            <!-- Summary Cards - 2x2 vertical layout -->
            <div class="grid grid-cols-2 gap-2">
                <div class="bg-white rounded-2xl px-3 py-2.5 border border-gray-100 shadow-sm">
                    <div class="flex items-center gap-1.5 mb-1.5">
                        <div class="w-5 h-5 rounded-lg bg-success/10 text-success flex items-center justify-center shrink-0"><i class="ph-bold ph-arrow-down-left text-[10px]"></i></div>
                        <p class="text-[9px] font-bold text-gray-400 uppercase leading-none">Income</p>
                    </div>
                    <p class="text-[13px] font-heading font-bold text-primary leading-none">Rp ${this.format(inc)}</p>
                    ${compInc}
                </div>
                <div class="bg-white rounded-2xl px-3 py-2.5 border border-gray-100 shadow-sm">
                    <div class="flex items-center gap-1.5 mb-1.5">
                        <div class="w-5 h-5 rounded-lg bg-danger/10 text-danger flex items-center justify-center shrink-0"><i class="ph-bold ph-arrow-up-right text-[10px]"></i></div>
                        <p class="text-[9px] font-bold text-gray-400 uppercase leading-none">Expenses</p>
                    </div>
                    <p class="text-[13px] font-heading font-bold text-primary leading-none">Rp ${this.format(exp)}</p>
                    ${compExp}
                </div>
                <div class="bg-white rounded-2xl px-3 py-2.5 border border-gray-100 shadow-sm">
                    <div class="flex items-center gap-1.5 mb-1.5">
                        <div class="w-5 h-5 rounded-lg flex items-center justify-center shrink-0" style="background:${surplus >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'};color:${surplus >= 0 ? '#10B981' : '#EF4444'}"><i class="ph-bold ph-piggy-bank text-[10px]"></i></div>
                        <p class="text-[9px] font-bold text-gray-400 uppercase leading-none">Surplus</p>
                    </div>
                    <p class="text-[13px] font-heading font-bold leading-none ${surplus >= 0 ? 'text-success' : 'text-danger'}">Rp ${this.format(surplus)}</p>
                    ${compSurplus}
                </div>
                <div class="bg-white rounded-2xl px-3 py-2.5 border border-gray-100 shadow-sm">
                    <div class="flex items-center gap-1.5 mb-1.5">
                        <div class="w-5 h-5 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center shrink-0"><i class="ph-bold ph-calendar text-[10px]"></i></div>
                        <p class="text-[9px] font-bold text-gray-400 uppercase leading-none">Avg/Hari</p>
                    </div>
                    <p class="text-[13px] font-heading font-bold text-primary leading-none">Rp ${this.format(avgDaily)}</p>
                    ${compAvgDaily}
                </div>
            </div>

            <!-- Spending 6 Months -->
            <div class="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm mt-4">
                <div class="flex items-center justify-between mb-2">
                    <h3 class="font-bold text-primary text-sm flex items-center gap-2"><i class="ph-fill ph-chart-bar text-secondary"></i>${this._reportSixMoMode === 'Expense' ? 'Spending' : this._reportSixMoMode} 6 Bulan</h3>
                    <div class="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
                        <button onclick="app.setReportSixMoMode('Expense')" title="Expense" class="w-7 h-7 rounded-md flex items-center justify-center transition-all ${this._reportSixMoMode === 'Expense' ? 'bg-white shadow text-danger' : 'text-gray-400'}">
                            <i class="ph-bold ph-arrow-up-right text-xs"></i>
                        </button>
                        <button onclick="app.setReportSixMoMode('Income')" title="Income" class="w-7 h-7 rounded-md flex items-center justify-center transition-all ${this._reportSixMoMode === 'Income' ? 'bg-white shadow text-success' : 'text-gray-400'}">
                            <i class="ph-bold ph-arrow-down-left text-xs"></i>
                        </button>
                        <button onclick="app.setReportSixMoMode('Surplus')" title="Surplus" class="w-7 h-7 rounded-md flex items-center justify-center transition-all ${this._reportSixMoMode === 'Surplus' ? 'bg-white shadow text-secondary' : 'text-gray-400'}">
                            <i class="ph-bold ph-piggy-bank text-xs"></i>
                        </button>
                    </div>
                </div>
                <div class="flex items-center justify-end gap-3 text-[9px] font-bold mb-4">
                        <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full inline-block" style="background:#3B82F6"></span>Bulan Lalu</span>
                        <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full inline-block" style="background:#F97316"></span>Bulan Ini</span>
                </div>
                <div class="flex gap-1 items-end w-full">${sixMoBarsHtml}</div>
                ${activeMonths.length > 0 ? `
                <div class="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <div class="flex items-center gap-1.5">
                        <div class="w-4 h-0.5 rounded-full" style="background:${avgColor};opacity:0.7"></div>
                        <p class="text-[10px] text-gray-400 font-semibold">Rata-rata ${activeMonths.length} bulan</p>
                    </div>
                    <p class="text-xs font-bold font-heading" style="color:${avgColor}">Rp ${this.format(Math.abs(Math.round(avgVal)))}</p>
                </div>` : ''}
            </div>

            <!-- Spending DNA Card -->
            <div class="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm mt-4" style="border-left:4px solid ${_dnaColor}">
                <div class="flex items-center gap-3 mb-3">
                    <div class="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0" style="background:${_dnaBg}">${_dnaEmoji}</div>
                    <div class="flex-1 min-w-0">
                        <p class="text-[9px] uppercase tracking-[0.15em] text-gray-400 font-bold">Spending DNA</p>
                        <p class="text-sm font-bold font-heading leading-tight" style="color:${_dnaColor}">${_dnaType}</p>
                    </div>
                </div>
                <div class="rounded-2xl p-3" style="background:${_dnaBg}">
                    <p class="text-xs font-bold text-primary leading-snug">${_dnaDesc1}</p>
                    <p class="text-[11px] text-gray-500 mt-1 leading-snug">${_dnaDesc2}</p>
                </div>
                <div class="grid grid-cols-3 gap-2 mt-3">
                    <div class="text-center rounded-xl p-2" style="background:rgba(16,185,129,0.08)">
                        <p class="text-[10px] font-bold text-success">${savingRate.toFixed(0)}%</p>
                        <p class="text-[9px] text-gray-400">Saving</p>
                    </div>
                    <div class="text-center rounded-xl p-2" style="background:rgba(139,92,246,0.08)">
                        <p class="text-[10px] font-bold text-purple-500">${Math.round(_dnaWantsPct)}%</p>
                        <p class="text-[9px] text-gray-400">Wants</p>
                    </div>
                    <div class="text-center rounded-xl p-2" style="background:rgba(59,130,246,0.08)">
                        <p class="text-[10px] font-bold text-blue-500">${Math.round(_dnaMustPct)}%</p>
                        <p class="text-[9px] text-gray-400">Must</p>
                    </div>
                </div>
            </div>

            <!-- Skor Keuangan -->
            <div class="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm overflow-hidden mt-4">
                <!-- 1. Header & Score -->
                <div class="flex items-start justify-between mb-4">
                    <div>
                        <p class="text-[9px] uppercase tracking-[0.2em] text-gray-400 font-bold mb-1">SUMMARY</p>
                        <h3 class="font-bold text-primary text-base font-heading leading-tight">Skor Keuangan Kamu</h3>
                        <span class="inline-block mt-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full" style="background:${scoreColor}15;color:${scoreColor}">${scoreLabel}</span>
                    </div>
                    <div class="relative w-20 h-20 shrink-0"><canvas id="reportScoreGauge"></canvas>
                        <div class="absolute inset-0 flex flex-col items-center justify-center">
                            <span class="text-xl font-heading font-bold leading-none" style="color:${scoreColor}">${score}</span>
                            <span class="text-[8px] font-bold text-gray-400 mt-0.5">/100</span>
                        </div>
                    </div>
                </div>

                <!-- 2. Net Surplus Highlight -->
                <div class="flex items-center gap-3 rounded-2xl p-3.5 mb-4" style="background:${surplus >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)'};border:1px solid ${surplus >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style="background:${surplus >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'};color:${surplus >= 0 ? '#10B981' : '#EF4444'}">
                        <i class="ph-fill ${surplus >= 0 ? 'ph-trend-up' : 'ph-trend-down'} text-lg"></i>
                    </div>
                    <div>
                        <p class="text-[10px] text-gray-400 font-bold uppercase">Net Surplus</p>
                        <p class="text-lg font-heading font-bold leading-none ${surplus >= 0 ? 'text-success' : 'text-danger'}">Rp ${this.format(surplus)}</p>
                    </div>
                </div>

                <!-- 3. Metrics Breakdown -->
                <div class="space-y-0">
                    ${healthMetrics.map(m => {
                        const filledSegs = Math.round((m.pts / m.max) * 4);
                        const segBar = Array.from({length: 4}, (_, i) => 
                            `<div class="h-2 flex-1 rounded-sm" style="background:${i < filledSegs ? m.color : '#E5E7EB'}"></div>`
                        ).join('');
                        return `<div class="flex items-center gap-2.5 py-3 border-b border-gray-50 last:border-0">
                            <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style="background:${m.color}12;color:${m.color}"><i class="ph-fill ${m.icon} text-sm"></i></div>
                            <div class="flex-1 min-w-0">
                                <p class="text-xs font-bold text-primary leading-tight">${m.label}</p>
                                <p class="text-[10px] text-gray-400 leading-tight mt-0.5">${m.value || m.detail}</p>
                            </div>
                            <div class="flex gap-0.5 w-16 shrink-0">${segBar}</div>
                            <span class="text-xs font-heading font-bold text-primary w-7 text-right shrink-0">${m.pts}</span>
                        </div>`;
                    }).join('')}
                </div>

                <!-- 4. Insight Banner -->
                <div class="flex items-start gap-3 mt-4 rounded-2xl p-3.5 bg-gray-50 border border-gray-100">
                    <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style="background:${scoreColor}15;color:${scoreColor}"><i class="ph-fill ${healthInsightIcon} text-sm"></i></div>
                    <p class="text-[11px] text-gray-500 leading-relaxed flex-1">${healthInsight}</p>
                </div>
            </div>

            <!-- Emergency Fund Progress Bar -->
            <div class="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm mt-4">
                <div class="flex items-center gap-2.5 mb-4">
                    <div class="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0" style="background:${reportEfScore.color}15;color:${reportEfScore.color}">
                        <i class="ph-fill ph-shield-check text-lg"></i>
                    </div>
                    <div class="flex-1">
                        <p class="text-[9px] font-bold uppercase tracking-widest text-gray-400">Dana Darurat</p>
                        <p class="text-sm font-bold text-primary font-heading leading-none">${reportEfScore.label}</p>
                    </div>
                    <span class="text-xl font-heading font-bold shrink-0" style="color:${reportEfScore.color}">${reportEfScore.score}%</span>
                </div>
                <div class="mb-3">
                    <div class="relative h-4 bg-gray-100 rounded-full overflow-hidden">
                        <div class="h-full rounded-full transition-all" style="width:${reportEfScore.score}%;background:${reportEfScore.color}"></div>
                    </div>
                    <div class="flex justify-between text-[9px] font-bold text-gray-400 mt-1.5">
                        <span>0 bln</span>
                        <span>3 bln ✓</span>
                        <span>6 bln 🎯</span>
                    </div>
                    <div class="relative mt-1">
                        <div class="absolute h-3 w-px bg-amber-400" style="left:50%;top:0"></div>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-2 mb-3">
                    <div class="bg-gray-50 rounded-2xl p-2.5 text-center">
                        <p class="text-[9px] text-gray-400 font-bold uppercase">Coverage</p>
                        <p class="text-sm font-heading font-bold" style="color:${reportEfScore.color}">${reportEfScore.months} bulan</p>
                    </div>
                    <div class="bg-gray-50 rounded-2xl p-2.5 text-center">
                        <p class="text-[9px] text-gray-400 font-bold uppercase">Dana Tersimpan</p>
                        <p class="text-sm font-heading font-bold text-primary">${reportEfScore.totalEmergency > 0 ? 'Rp ' + this.format(Math.round(reportEfScore.totalEmergency)) : '—'}</p>
                    </div>
                </div>
                <p class="text-[11px] text-gray-500 leading-relaxed">${reportEfScore.totalEmergency > 0 ? (reportEfScore.score >= 100 ? '🎉 Target 6 bulan tercapai! Dana daruratmu udah solid, mantap!' : `Butuh tambahan <b>Rp ${this.format(Math.max(0, Math.round(avgMonthlyExp * 6 - reportEfScore.totalEmergency)))}</b> lagi buat capai target 6 bulan.`) : '⚠️ Tandai akun sebagai <b>Emergency Fund</b> di Settings untuk mulai tracking.'}</p>
            </div>

            <!-- Cash Flow Waterfall -->
            <div class="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
                <h3 class="font-bold text-primary text-sm flex items-center gap-2 mb-0.5"><i class="ph-fill ph-arrows-down-up text-tertiary"></i>Cash Flow</h3>
                <p class="text-[11px] text-gray-400 mb-3">💬 Berapa sisa uangku?</p>
                <div style="height:220px"><canvas id="reportCashFlow"></canvas></div>
                <div id="cfWaterfallSummary" class="mt-3"></div>
            </div>

            <!-- Expense Breakdown -->
            <div class="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
                <h3 class="font-bold text-primary text-sm mb-3 flex items-center gap-2"><i class="ph-fill ph-chart-pie text-danger"></i>Expense Breakdown</h3>
                <div>${expTableHtml}</div>
            </div>

            <!-- Income Breakdown -->
            <div class="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
                <h3 class="font-bold text-primary text-sm mb-3 flex items-center gap-2"><i class="ph-fill ph-coins text-success"></i>Income Breakdown</h3>
                <div>${incTableHtml}</div>
            </div>

            <!-- Spending by Day of Week (CSS bars, no chart.js) -->
            <div class="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="font-bold text-primary text-sm flex items-center gap-2"><i class="ph-fill ph-calendar-dots text-secondary"></i>Spending by Day</h3>
                    <div class="flex items-center gap-3 text-[9px] font-bold">
                        <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full inline-block" style="background:#3B82F6"></span>Weekday</span>
                        <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full inline-block" style="background:#F97316"></span>Weekend</span>
                    </div>
                </div>
                <div class="flex gap-1 items-end w-full">${dowBarsHtml}</div>
                <div class="grid grid-cols-2 gap-2 mt-4">
                    <div class="rounded-2xl p-3" style="background:rgba(59,130,246,0.07);border:1px solid rgba(59,130,246,0.12)">
                        <p class="text-[9px] font-bold uppercase mb-0.5" style="color:#3B82F6">Weekdays</p>
                        <p class="text-sm font-heading font-bold text-primary">Rp ${this.format(weekdayTotalAmt)}</p>
                        <p class="text-[10px] text-gray-400 mt-0.5">avg Rp ${this.format(weekdayAvgDay)}/hari</p>
                    </div>
                    <div class="rounded-2xl p-3" style="background:rgba(249,115,22,0.07);border:1px solid rgba(249,115,22,0.12)">
                        <p class="text-[9px] font-bold uppercase mb-0.5" style="color:#F97316">Weekends</p>
                        <p class="text-sm font-heading font-bold text-primary">Rp ${this.format(weekendTotalAmt)}</p>
                        <p class="text-[10px] text-gray-400 mt-0.5">avg Rp ${this.format(weekendAvgDay)}/hari</p>
                    </div>
                </div>
            </div>

            <!-- Daily Activity Heatmap -->
            <div class="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
                <h3 class="font-bold text-primary text-sm mb-1 flex items-center gap-2"><i class="ph-fill ph-calendar-blank text-orange-500"></i>Daily Activity</h3>
                <p class="text-[10px] text-gray-400 mb-3">${monthName} — Calendar view dari daily activity kamu</p>
                ${calendarHtml}
                <div class="flex items-center gap-3 mt-3 flex-wrap justify-center">
                    <div class="flex items-center gap-1"><div class="w-1.5 h-1.5 rounded-full bg-gray-900"></div><span class="text-[9px] text-gray-400">Ada Income</span></div>
                    <div class="flex items-center gap-1.5"><span class="text-[9px] text-gray-400">Pengeluaran:</span><div class="flex gap-0.5">${[0.12, 0.25, 0.45, 0.7, 1].map(o => `<div class="w-3 h-3 rounded" style="background:rgba(249,115,22,${o})"></div>`).join('')}</div><span class="text-[9px] text-gray-400">Tinggi</span></div>
                </div>
            </div>

            <!-- Insights -->
            <div class="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
                <h3 class="font-bold text-primary text-sm mb-3 flex items-center gap-2"><i class="ph-fill ph-lightbulb text-secondary"></i>Insights</h3>
                <div class="space-y-2.5">${outlierCardHtml}${insightsHtml}</div>
            </div>

            <div class="h-4"></div>
        `;

        // Render Score Gauge
        const scoreCtx = document.getElementById('reportScoreGauge')?.getContext('2d');
        if (scoreCtx) {
            const c = new Chart(scoreCtx, {
                type: 'doughnut',
                data: { datasets: [{ data: [score, 100 - score], backgroundColor: [scoreColor, '#E5E7EB'], borderWidth: 0, cutout: '78%' }] },
                options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false }, tooltip: { enabled: false } } }
            });
            this._reportCharts.push(c);
        }

        // Waterfall chart
        const cfCtx = document.getElementById('reportCashFlow')?.getContext('2d');
        if (cfCtx) {
            const lvl0 = inc;
            const lvl1 = inc - eNeeds;
            const lvl2 = lvl1 - eWants;
            const lvl3 = lvl2 - eMust;
            const labels = ['Pemasukan', 'Needs', 'Wants', 'Must', 'Sisa'];
            const floatData = [
                [0, lvl0],
                [lvl1, lvl0],
                [lvl2, lvl1],
                [lvl3, lvl2],
                [0, Math.max(0, lvl3)]
            ];
            const bgColors = ['#10B981','#EF4444','#F97316','#8B5CF6', lvl3 >= 0 ? '#1CBDB3' : '#EF4444'];
            const amounts = [inc, eNeeds, eWants, eMust, Math.abs(lvl3)];
            const c = new Chart(cfCtx, {
                type: 'bar',
                data: { labels, datasets: [{ data: floatData, backgroundColor: bgColors, borderRadius: 6, barPercentage: 0.55 }] },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { label: (item) => `Rp ${this.format(amounts[item.dataIndex])}` } }
                    },
                    scales: {
                        x: { grid: { display: false }, ticks: { font: { size: 10, weight: '600' } } },
                        y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { callback: v => v >= 1e6 ? (v/1e6).toFixed(1)+'jt' : v >= 1e3 ? (v/1e3).toFixed(0)+'rb' : v, font: { size: 9 } } }
                    }
                }
            });
            this._reportCharts.push(c);
            const sisaColor = lvl3 >= 0 ? '#10B981' : '#EF4444';
            const sisaLabel = lvl3 >= 0 ? `Sisa Rp ${this.format(Math.round(lvl3))} 🎉` : `Minus Rp ${this.format(Math.round(Math.abs(lvl3)))} ⚠️`;
            const legendHtml = [
                { color: '#10B981', label: 'Pemasukan' }, { color: '#EF4444', label: 'Needs' },
                { color: '#F97316', label: 'Wants' }, { color: '#8B5CF6', label: 'Must' }, { color: sisaColor, label: 'Sisa' }
            ].map(l => `<span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full inline-block" style="background:${l.color}"></span><span class="text-[9px] text-gray-500">${l.label}</span></span>`).join('');
            const summaryEl = document.getElementById('cfWaterfallSummary');
            if (summaryEl) summaryEl.innerHTML = `
                <div class="flex flex-wrap gap-2 justify-center mb-2">${legendHtml}</div>
                <div class="text-center"><span class="inline-block px-3 py-1 rounded-full text-[11px] font-bold" style="background:${sisaColor}18;color:${sisaColor}">${sisaLabel}</span></div>`;
        }

    },

    setCashflowChartMode: function() {},

    // UI Tab & Modes
    switchTab: function(tab) {
        if (tab === 'home' && this.getHomeMode() === 'day') tab = 'today';
        SFX.page();
        this.setActiveTabDisplay(tab);
        this._mountChat(tab === 'today' ? 'today' : 'input');
        document.querySelectorAll('.nav-btn').forEach(el => {
            el.classList.remove('text-primary');
            el.querySelector('i').classList.remove('scale-110');
        });
        const btn = document.querySelector(`.nav-btn[data-tab="${tab === 'today' ? 'home' : tab}"]`);
        if(btn) { btn.classList.add('text-primary'); btn.querySelector('i')?.classList.add('scale-110'); }
        
        const mainContainer = document.getElementById('mainContainer');
        if (tab === 'input' || tab === 'transactions' || tab === 'today') {
            mainContainer.classList.remove('p-5', 'pb-32', 'overflow-y-auto');
            mainContainer.classList.add('overflow-hidden', 'flex', 'flex-col', 'min-h-0');
            if (tab === 'input') setTimeout(() => {
                document.getElementById('chatInput')?.focus();
                this.scrollChatToBottom();
            }, 100);
        } else {
            mainContainer.classList.add('p-5', 'pb-32', 'overflow-y-auto');
            mainContainer.classList.remove('overflow-hidden', 'flex', 'flex-col', 'min-h-0');
        }

        if (tab === 'home') this.renderHome();
        if (tab === 'today') this.showToday();
        else this._stopTodayTagline();
        if (tab === 'transactions') this.renderTransactions();
        if (tab === 'report') this.renderReport();
        if (tab === 'settings') {
            this.renderAccountsList();
            const key = currentProfile?.geminiApiKey || localStorage.getItem('geminiApiKey') || '';
            document.getElementById('geminiApiKey').value = key;
            const budgetEl = document.getElementById('settingsBudgetInput');
            if (budgetEl) budgetEl.value = currentProfile?.monthlyBudget || DEFAULT_MONTHLY_BUDGET;
            const paydayEl = document.getElementById('settingsPaydayInput');
            if (paydayEl) paydayEl.value = currentProfile?.paydayDate || 25;
            this._updateSfxToggleUI(SFX.isEnabled());
        }
    },

    setInputMode: function(mode) {
        if(mode === 'chat') {
            document.getElementById('inputChatMode').classList.remove('hidden');
            document.getElementById('inputChatMode').classList.add('flex');
            document.getElementById('inputFormMode').classList.add('hidden');
            document.getElementById('btnModeChat').className = "px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-white shadow-sm text-primary";
            document.getElementById('btnModeForm').className = "px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-gray-400";
            setTimeout(() => this.scrollChatToBottom(), 50);
        } else {
            document.getElementById('inputFormMode').classList.remove('hidden');
            document.getElementById('inputChatMode').classList.add('hidden');
            document.getElementById('inputChatMode').classList.remove('flex');
            document.getElementById('btnModeForm').className = "px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-white shadow-sm text-primary";
            document.getElementById('btnModeChat').className = "px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-gray-400";
        }
    },

    // ============================================================
    // IMPROVED PARSER (v2)
    // ============================================================
    parseChat: function(text) {
        // 0. Detect Transfer pattern: "transfer 1800000 dari X ke Y" or "1800000 dari X ke Y"
        const transferPattern = /(?:transfer\s+)?(?:rp\.?\s*)?(\d[\d.,kKjJrRbB]*(?:\s*(?:jt|rb|k))?)\s+(?:dari|from)\s+(.+?)\s+(?:ke|to)\s+(.+)/i;
        const transferMatch = text.match(transferPattern);
        if (transferMatch || /^transfer\b/i.test(text.trim())) {
            if (transferMatch) {
                let rawAmt = transferMatch[1].trim();
                rawAmt = rawAmt.replace(/\brp\.?\s*/gi, '');
                rawAmt = rawAmt.replace(/(\d+(?:[.,]\d+)?)\s*jt\b/gi, (_, n) => parseFloat(n.replace(',', '.')) * 1000000);
                rawAmt = rawAmt.replace(/(\d+(?:[.,]\d+)?)\s*rb\b/gi, (_, n) => parseFloat(n.replace(',', '.')) * 1000);
                rawAmt = rawAmt.replace(/(\d+)[kK]\b/g, (_, n) => parseInt(n) * 1000);
                const amount = parseFloat(rawAmt.replace(/\./g, '').replace(',', '.')) || 0;
                const fromName = transferMatch[2].trim();
                const toName = transferMatch[3].trim();
                const fromAcc = this.fuzzyFindAccount(fromName);
                const toAcc = this.fuzzyFindAccount(toName);
                const today = new Date();
                return {
                    date: today,
                    dateKey: this.toLocalDateString(today),
                    type: 'Transfer',
                    amount,
                    note: `Transfer ke ${toName}`,
                    fromAccountId: fromAcc?.id || accounts[0]?.id || null,
                    toAccountId: toAcc?.id || (accounts[1]?.id || null),
                    fromAccountName: fromName,
                    toAccountName: toName,
                };
            }
        }

        let clean = text;

        // 1. Expand date keywords
        clean = clean.replace(/\bhari\s*ini\b/gi, this.toLocalDateString(new Date()));
        clean = clean.replace(/\btoday\b/gi, this.toLocalDateString(new Date()));
        clean = clean.replace(/\bkemarin\b/gi, this.toLocalDateString(new Date(Date.now() - 864e5)));
        clean = clean.replace(/\byesterday\b/gi, this.toLocalDateString(new Date(Date.now() - 864e5)));
        clean = clean.replace(/~/g, '');

        // 2. Handle explicit @category shortcut
        const atMatch = clean.match(/@([\w-]+)/);
        let explicitCategory = null;
        if (atMatch && atMatch[1]) {
            const mapped = CATEGORY_MAP_CLIENT[atMatch[1].toLowerCase()];
            if (mapped) { explicitCategory = mapped; clean = clean.replace(atMatch[0], ''); }
        }

        // 3. Extract date (YYYY-MM-DD format at any position)
        let date = new Date();
        const dateMatch = clean.match(/(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
            date = this.createLocalNoonDate(dateMatch[1]);
            clean = clean.replace(dateMatch[0], '');
        }
        clean = clean.replace(/^[\s,]+/, '').replace(/[\s,]+$/, '').trim();

        // 4. Determine Type (+/-)
        let type = 'Expense';
        const incomeRegex = buildIncomeRegex();
        const expenseRegex = buildExpenseRegex();
        if (incomeRegex.test(clean)) {
            type = 'Income'; clean = clean.replace(/^\+\s*/, '').replace(incomeRegex, '');
        } else if (expenseRegex.test(clean)) {
            type = 'Expense'; clean = clean.replace(/^-\s*/, '').replace(expenseRegex, '');
        } else {
            // No explicit sign: check if any word maps to an income category
            const words = clean.split(/[\s,]+/);
            for (const w of words) {
                if (INCOME_CATEGORIES.includes(w.toLowerCase()) || 
                    (CATEGORY_MAP_CLIENT[w.toLowerCase()] && ['Salary', 'Bonus'].includes(CATEGORY_MAP_CLIENT[w.toLowerCase()]))) {
                    type = 'Income'; break;
                }
            }
        }

        // 5. Normalize amount patterns BEFORE splitting
        // Remove "Rp" / "Rp." prefix
        clean = clean.replace(/\brp\.?\s*/gi, '');
        // Handle shorthand: 50k -> 50000
        clean = clean.replace(/(\d+)[kK]\b/g, (_, n) => parseInt(n) * 1000);
        // Handle shorthand: 5jt / 5 jt -> 5000000
        clean = clean.replace(/(\d+(?:[.,]\d+)?)\s*jt\b/gi, (_, n) => parseFloat(n.replace(',', '.')) * 1000000);
        // Handle shorthand: 50rb / 50 rb -> 50000
        clean = clean.replace(/(\d+(?:[.,]\d+)?)\s*rb\b/gi, (_, n) => parseFloat(n.replace(',', '.')) * 1000000 / 1000);
        // Handle shorthand: 1.5jt already handled above

        // 6. Split and extract amount + note words
        const parts = clean.split(/[\s,]+/).filter(p => p.length > 0);
        let amount = 0;
        let noteWords = [];

        for (const p of parts) {
            if (amount === 0) {
                // Try to parse as number: remove dots as thousand sep, keep comma as decimal
                // "50.000" -> "50000", "1.500.000" -> "1500000"
                const numStr = p.replace(/\./g, '').replace(',', '.');
                const parsed = parseFloat(numStr);
                if (!isNaN(parsed) && parsed > 0) {
                    amount = parsed;
                    continue;
                }
            }
            if (p.length > 0) noteWords.push(p);
        }

        if (amount === 0) return null;

        // 7. Determine category from note words
        let category = explicitCategory || null;
        let finalNote = [];
        for (const w of noteWords) {
            const lower = w.toLowerCase();
            // Skip noise words
            if (['di', 'ke', 'dan', 'untuk', 'buat', 'sama', 'the', 'a', 'an'].includes(lower)) {
                finalNote.push(w); continue;
            }
            const mapped = CATEGORY_MAP_CLIENT[lower];
            if (mapped && !category) {
                category = mapped;
            }
            finalNote.push(w);
        }
        let isUnmapped = false;
        if (!category) {
            category = 'Others';
            isUnmapped = true;
        }

        // 8. If type is Expense but category is an income type, flag it
        const isIncCat = INCOME_CATEGORIES.some(inc => {
            const lower = category.toLowerCase();
            return lower.includes(inc) || (CATEGORY_MAP_CLIENT[inc] && CATEGORY_MAP_CLIENT[inc].toLowerCase() === lower);
        });
        if (isIncCat && type === 'Expense') type = 'Income';

        const noteStr = finalNote.join(' ').trim() || category;

        return { date, dateKey: this.toLocalDateString(date), type, amount, category, note: noteStr, isUnmapped };
    },

    // Parse multiple transactions from a single local input string
    // e.g. "bakso 15000 parkir 3000 bensin 300000"
    parseMultiChat: function(text) {
        // First try single parse — if the whole text is one transaction, return it
        const single = this.parseChat(text);

        // Strategy: scan the text for (word(s) + number) or (number + word(s)) pairs
        // We use a greedy token scan: collect word tokens, when we hit a number emit a candidate pair

        // Normalize shorthand in the full text first
        let norm = text;
        norm = norm.replace(/\brp\.?\s*/gi, '');
        norm = norm.replace(/(\d+(?:[.,]\d+)?)\s*jt\b/gi, (_, n) => parseFloat(n.replace(',', '.')) * 1000000);
        norm = norm.replace(/(\d+(?:[.,]\d+)?)\s*rb\b/gi, (_, n) => parseFloat(n.replace(',', '.')) * 1000);
        norm = norm.replace(/(\d+)[kK]\b/g, (_, n) => parseInt(n) * 1000);

        // Split on spaces, commas, semicolons
        const tokens = norm.split(/[\s,;]+/).filter(t => t.length > 0);

        // Determine if a token is purely numeric
        const isNum = t => {
            const n = parseFloat(t.replace(/\./g, '').replace(',', '.'));
            return !isNaN(n) && n > 0 && /^[\d.,]+$/.test(t);
        };
        const toNum = t => parseFloat(t.replace(/\./g, '').replace(',', '.'));

        // Try to find pairs: look for runs of [word…, number] or [number, word…]
        // Build segments: each segment is one (label, amount) pair
        // Date keywords that can appear after an amount (trailing date)
        const DATE_KW = /^(kemarin|yesterday|today|hari|ini|januari|jan|februari|feb|maret|mar|april|apr|mei|may|juni|jun|juli|jul|agustus|agu|aug|september|sep|oktober|okt|oct|november|nov|desember|des|dec)$/i;
        // Consume trailing date tokens (kemarin / hari ini / DD bulan) right after an amount
        const consumeTrailingDate = (arr, idx) => {
            const trailing = [];
            let j = idx;
            // "hari ini"
            if (j < arr.length && /^hari$/i.test(arr[j]) && j + 1 < arr.length && /^ini$/i.test(arr[j + 1])) {
                trailing.push(arr[j], arr[j + 1]); j += 2;
            // single date keyword: kemarin, yesterday, today
            } else if (j < arr.length && /^(kemarin|yesterday|today)$/i.test(arr[j])) {
                trailing.push(arr[j]); j++;
            // DD + bulan: a 1-2 digit token followed by a month name
            } else if (j < arr.length && /^\d{1,2}$/.test(arr[j]) && j + 1 < arr.length && DATE_KW.test(arr[j + 1]) && !/^\d/.test(arr[j + 1])) {
                trailing.push(arr[j], arr[j + 1]); j += 2;
            }
            return { trailing, nextIdx: j };
        };

        const segments = [];
        let i = 0;
        while (i < tokens.length) {
            if (isNum(tokens[i])) {
                // Number first: collect following word tokens until next number
                const amt = toNum(tokens[i]); i++;
                const { trailing, nextIdx } = consumeTrailingDate(tokens, i);
                i = nextIdx;
                let words = [...trailing];
                while (i < tokens.length && !isNum(tokens[i])) {
                    words.push(tokens[i]); i++;
                }
                segments.push({ amount: amt, label: words.join(' ') });
            } else {
                // Word(s) first: collect until we hit a number
                let words = [];
                while (i < tokens.length && !isNum(tokens[i])) {
                    words.push(tokens[i]); i++;
                }
                if (i < tokens.length && isNum(tokens[i])) {
                    const amt = toNum(tokens[i]); i++;
                    // Also consume trailing date tokens right after the amount
                    const { trailing, nextIdx } = consumeTrailingDate(tokens, i);
                    i = nextIdx;
                    segments.push({ amount: amt, label: [...words, ...trailing].join(' ') });
                } else {
                    // Leftover words with no number — skip
                    i++;
                }
            }
        }

        // If we only got one segment, just use single parse (preserves type detection etc)
        if (segments.length <= 1) return single ? [single] : null;

        const today = new Date();
        const todayKey = this.toLocalDateString(today);

        // Helper: extract date from label words, returns { date, dateKey, cleanWords }
        const ID_MONTHS = {
            januari:0, jan:0, february:1, februari:1, feb:1,
            maret:2, mar:2, april:3, apr:3,
            mei:4, may:4, juni:5, jun:5,
            juli:6, jul:6, agustus:7, agu:7, aug:7,
            september:8, sep:8, oktober:9, okt:9, oct:9,
            november:10, nov:10, desember:11, des:11, dec:11
        };
        const extractDateFromWords = (words) => {
            let d = new Date(today);
            let cleanWords = [...words];
            // Check for "kemarin" / "yesterday"
            const kemIdx = cleanWords.findIndex(w => /^(kemarin|yesterday)$/i.test(w));
            if (kemIdx !== -1) {
                d = new Date(today); d.setDate(d.getDate() - 1);
                cleanWords.splice(kemIdx, 1);
                return { date: d, dateKey: this.toLocalDateString(d), cleanWords };
            }
            // Check for "hari ini" / "today" — "hari" followed by "ini"
            const hariIdx = cleanWords.findIndex(w => /^(hari)$/i.test(w));
            if (hariIdx !== -1 && hariIdx + 1 < cleanWords.length && /^ini$/i.test(cleanWords[hariIdx + 1])) {
                cleanWords.splice(hariIdx, 2);
                return { date: today, dateKey: todayKey, cleanWords };
            }
            const todayIdx = cleanWords.findIndex(w => /^today$/i.test(w));
            if (todayIdx !== -1) {
                cleanWords.splice(todayIdx, 1);
                return { date: today, dateKey: todayKey, cleanWords };
            }
            // Check for DD + bulan pattern (e.g. "1 mei", "15 januari")
            for (let j = 0; j < cleanWords.length - 1; j++) {
                const dayNum = parseInt(cleanWords[j]);
                const monName = cleanWords[j + 1].toLowerCase();
                if (!isNaN(dayNum) && dayNum >= 1 && dayNum <= 31 && ID_MONTHS[monName] !== undefined) {
                    d = new Date(today.getFullYear(), ID_MONTHS[monName], dayNum);
                    // If date is in future, assume previous year
                    if (d > today) d.setFullYear(d.getFullYear() - 1);
                    cleanWords.splice(j, 2);
                    return { date: d, dateKey: this.toLocalDateString(d), cleanWords };
                }
            }
            // Check for YYYY-MM-DD within a word token
            for (let j = 0; j < cleanWords.length; j++) {
                const m = cleanWords[j].match(/^(\d{4})-(\d{2})-(\d{2})$/);
                if (m) {
                    d = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
                    cleanWords.splice(j, 1);
                    return { date: d, dateKey: this.toLocalDateString(d), cleanWords };
                }
            }
            return { date: today, dateKey: todayKey, cleanWords };
        };

        // Detect global type prefix from original text
        let globalType = null;
        const incomeRegex = buildIncomeRegex();
        const expenseRegex = buildExpenseRegex();
        if (incomeRegex.test(text)) globalType = 'Income';
        else if (expenseRegex.test(text)) globalType = 'Expense';

        const results = segments.map(seg => {
            // Extract per-segment date from label words
            const labelWords = seg.label.split(/\s+/).filter(w => w.length > 0);
            const { date: segDate, dateKey: segDateKey, cleanWords } = extractDateFromWords(labelWords);
            const cleanLabel = cleanWords.join(' ').trim();

            // Map clean label to category
            const cleanLower = cleanLabel.toLowerCase().split(/\s+/);
            let category = null;
            let isUnmapped = false;
            for (const w of cleanLower) {
                if (CATEGORY_MAP_CLIENT[w]) { category = CATEGORY_MAP_CLIENT[w]; break; }
            }
            if (!category) {
                category = 'Others';
                isUnmapped = true;
            }

            // Determine type
            let type = globalType || 'Expense';
            const isIncCat = INCOME_CATEGORIES.some(inc => {
                const l = category.toLowerCase();
                return l.includes(inc) || (CATEGORY_MAP_CLIENT[inc] && CATEGORY_MAP_CLIENT[inc].toLowerCase() === l);
            });
            if (isIncCat) type = 'Income';

            return {
                date: segDate,
                dateKey: segDateKey,
                type,
                amount: seg.amount,
                category,
                note: cleanLabel || category,
                accountId: sessionAccountId || (accounts.length > 0 ? accounts[0].id : null),
                isUnmapped
            };
        });

        return results;
    },

    toggleChatAiMode: function() {
        chatAiMode = !chatAiMode;
        const btn = document.getElementById('chatAiToggle');
        const input = document.getElementById('chatInput');
        if (chatAiMode) {
            btn.className = 'w-10 h-10 rounded-full shrink-0 flex items-center justify-center transition active:scale-95 bg-indigo-500 text-white shadow-md shadow-indigo-300';
            if (input) input.placeholder = 'Tanya apa saja ke AI...';
        } else {
            btn.className = 'w-10 h-10 rounded-full shrink-0 flex items-center justify-center transition active:scale-95 bg-indigo-100 text-indigo-500';
            if (input) input.placeholder = 'Transaksi hari ini...';
        }
    },

    // Check if AI responds with action
    submitChat: async function() {
        const el = document.getElementById('chatInput');
        const text = el.value.trim();
        if(!text) return;
        el.value = '';

        this.addChatBubble(text, 'user');

        // Build command patterns from defaults + custom
        const allHelpKws = [...(DEFAULT_COMMANDS.help || []), ...(userCustomCommands.help || [])];
        const helpPattern = new RegExp('^(' + allHelpKws.join('|') + ')$', 'i');

        // Help command
        if (helpPattern.test(text.trim())) {
            this.addChatBubble(
                `<b>📖 Panduan Chat Asa</b><br><br>` +

                `<b>💸 Catat Pengeluaran:</b><br>` +
                `<code>50000 bakso</code> → Expense otomatis<br>` +
                `<code>- 30rb kopi</code> → Expense eksplisit<br>` +
                `<code>- 25k nasi padang @jago</code> → pilih akun Jago<br><br>` +

                `<b>💚 Catat Pemasukan:</b><br>` +
                `<code>+ 5jt gaji</code> atau <code>5000000 salary</code><br><br>` +

                `<b>🔄 Transfer Antar Akun:</b><br>` +
                `<code>transfer 1jt dari main ke jago</code><br><br>` +

                `<b>🏦 Pilih Akun Tertentu:</b><br>` +
                `<code>50rb makan bank jago</code> → pakai akun Jago<br><br>` +

                `<b>📦 Multi-transaksi sekaligus:</b><br>` +
                `<code>bakso 15rb parkir 3rb bensin 300rb</code><br>` +
                `<code>grab 30rb, kopi 15k, makan 25000</code><br><br>` +

                `<b>🔢 Format nominal:</b> <code>50k</code> · <code>50rb</code> · <code>1.5jt</code> · <code>50000</code><br><br>` +

                `<b>📊 Tanya Laporan Keuangan (jawab instan, tanpa AI):</b><br>` +
                `<code>berapa health score ku?</code><br>` +
                `<code>bagaimana spending DNA ku?</code><br>` +
                `<code>spending nature bulan ini?</code><br>` +
                `<code>weekday vs weekend mana lebih boros?</code><br>` +
                `<code>bagaimana latte faktor ku?</code><br>` +
                `<code>berapa saldo semua akun?</code><br>` +
                `<code>bagaimana dana darurat ku?</code><br>` +
                `<code>bagaimana budget pacing bulan ini?</code><br>` +
                `<code>ringkasan keuangan bulan ini</code><br>` +
                `<code>kategori terbesar bulan ini?</code><br>` +
                `<code>cara improve health score?</code><br>` +
                `<code>tips hemat bulan ini?</code><br>` +
                `<code>cara hemat sisa bulan ini?</code><br><br>` +

                `<b>🤖 Tanya Tips ke AI:</b><br>` +
                `<code>gimana cara nabung 10jt?</code><br>` +
                `<code>alokasi gaji 5jt yang ideal gimana?</code><br>` +
                `<code>investasi apa yang cocok buat pemula?</code><br><br>` +

                `Ketik <code>help</code> kapan saja untuk lihat panduan ini lagi! 🙌`,
                'bot', true
            );
            return;
        }

        // ── GREETING HANDLER ─────────────────────────────────────────────────
        const allGreetingKws = ['halo', 'hai', 'hi', 'hey', 'hello', 'test', 'ping', 'asa', 'hei', 'yo', 'woi', 'woy', 'p+', 'h+', ...(userCustomCommands.help || [])];
        const greetingPattern = new RegExp('^(' + allGreetingKws.join('|') + ')\\b', 'i');
        if (greetingPattern.test(text.trim())) {
            const userName = (currentProfile?.name || '').split(' ')[0] || 'bro';
            this.addChatBubble(
                `Halo ${userName}! 👋 Gue <b>Asa</b>, financial bestie lo di Dirhamku! 🤖💚<br><br>` +
                `Gue bisa bantu lo:<br>` +
                `• <b>Catat transaksi</b> — tinggal ketik kayak <code>30rb kopi</code><br>` +
                `• <b>Cek laporan</b> — tanya langsung kayak <code>health score gw?</code><br>` +
                `• <b>Tips finansial</b> — minta saran nabung, investasi, dll<br><br>` +
                `Ketik <code>help</code> buat lihat semua yang bisa gue jawab ya! 📖`,
                'bot', true
            );
            return;
        }

        // ── TODAY'S BUDGET (Day Mode) ────────────────────────────────────────
        if (/^(budget|sisa( budget)?|jatah)( hari ini| harian| today)$|^today('?s)? budget$/i.test(text.trim())) {
            this.addChatBubble(this.todaySummaryText(), 'bot', true);
            return;
        }

        // ── LOCAL TRANSFER PARSE (no token used) ─────────────────────────────
        const localTransfer = !chatAiMode && this._tryLocalTransfer(text);
        if (localTransfer) {
            pendingChatTxs = [localTransfer];
            this.renderTransactionCarousel();
            return;
        }

        // ── LOCAL ANSWER (no token used) ──────────────────────────────────────
        // First, check if input exactly matches a keyword from DEFAULT_COMMANDS
        // and remap it to a canonical phrase _tryLocalAnswer can understand
        const cmdAliasMap = {
            // cek_saldo
            'saldo': 'berapa saldo semua akun', 'cek saldo': 'berapa saldo semua akun',
            'semua saldo': 'berapa saldo semua akun', 'berapa saldo': 'berapa saldo semua akun',
            // ringkasan
            'summary': 'ringkasan keuangan bulan ini', 'ringkasan': 'ringkasan keuangan bulan ini',
            'rekap': 'ringkasan keuangan bulan ini', 'laporan bulan ini': 'laporan ringkasan bulan ini',
            'rekap keuangan': 'rekap keuangan bulan ini', 'pemasukan': 'total pemasukan bulan ini',
            'pengeluaran bulan ini': 'total pengeluaran bulan ini',
            // health_score
            'health score': 'health score ku', 'skor keuangan': 'skor keuangan ku',
            'financial score': 'financial score ku', 'skor finansial': 'skor keuangan ku',
            'berapa skor': 'skor keuangan ku', 'cara improve score': 'cara improve health score',
            'ningkatin score': 'ningkatin score ku',
            // spending_dna
            'spending dna': 'spending dna ku', 'tipe belanja': 'tipe belanja gw',
            'dna belanja': 'dna belanja gw', 'spending type': 'spending dna ku',
            // spending_nature
            'spending nature': 'spending nature gw', 'komposisi belanja': 'komposisi belanja bulan ini',
            'needs wants must': 'spending nature gw',
            // weekday_weekend
            'weekday vs weekend': 'weekday vs weekend mana lebih boros',
            'weekend vs weekday': 'weekday vs weekend mana lebih boros',
            'lebih boros kapan': 'weekday vs weekend lebih boros kapan',
            'boros weekday': 'boros weekday vs weekend', 'boros weekend': 'boros weekend vs weekday',
            // latte_factor
            'latte factor': 'latte factor ku', 'pengeluaran receh': 'latte pengeluaran receh',
            'kebiasaan belanja': 'kebiasaan belanja latte factor',
            // dana_darurat
            'dana darurat': 'dana darurat ku sekarang', 'emergency fund': 'emergency fund ku',
            'tabungan darurat': 'tabungan darurat ku', 'cukup dana darurat': 'dana darurat cukup gw',
            // budget_pacing
            'budget pacing': 'budget pacing bulan ini', 'sisa budget': 'sisa budget bulan ini',
            'pacing budget': 'budget pacing bulan ini', 'budget sisa': 'sisa budget bulan ini',
            // kategori
            'kategori terbesar': 'kategori terbesar bulan ini', 'paling boros': 'kategori paling boros',
            'top kategori': 'kategori terbesar bulan ini', 'pengeluaran terbesar': 'kategori pengeluaran terbesar',
            // tips_hemat
            'tips hemat': 'tips hemat bulan ini', 'cara hemat': 'cara hemat bulan ini',
            'hemat bulan ini': 'tips hemat bulan ini', 'gimana hemat': 'gimana hemat bulan ini',
        };
        // Also check userCustomCommands aliases
        const lowerText = text.trim().toLowerCase();
        let resolvedText = text;
        if (cmdAliasMap[lowerText]) {
            resolvedText = cmdAliasMap[lowerText];
        } else {
            // Check user custom command keywords → map to a canonical phrase
            const commandCanonical = {
                'cek_saldo': 'berapa saldo semua akun',
                'ringkasan': 'ringkasan keuangan bulan ini',
                'health_score': 'skor keuangan ku',
                'spending_dna': 'spending dna ku',
                'spending_nature': 'spending nature gw',
                'weekday_weekend': 'weekday vs weekend mana lebih boros',
                'latte_factor': 'latte factor ku',
                'dana_darurat': 'dana darurat ku sekarang',
                'budget_pacing': 'budget pacing bulan ini',
                'kategori': 'kategori terbesar bulan ini',
                'tips_hemat': 'tips hemat bulan ini',
            };
            for (const [cmdId, canonical] of Object.entries(commandCanonical)) {
                const customKws = userCustomCommands[cmdId] || [];
                if (customKws.map(k => k.toLowerCase()).includes(lowerText)) {
                    resolvedText = canonical;
                    break;
                }
            }
        }

        const localAnswer = !chatAiMode && this._tryLocalAnswer(resolvedText);
        if (localAnswer) {
            chatMemory.push({ role: "user", parts: [{ text: text }] });
            chatMemory.push({ role: "model", parts: [{ text: localAnswer }] });
            if (chatMemory.length > 20) chatMemory = chatMemory.slice(-20);
            this.addChatBubble(localAnswer, 'bot', true);
            document.querySelectorAll('#chatHistory button').forEach(b => b.disabled = false);
            return;
        }

        // Disable buttons temporarily
        document.querySelectorAll('#chatHistory button').forEach(b => b.disabled = true);

        // ── LOCAL MULTI-CHAT PARSE (PRIORITIZED) ─────────────────────────────
        let localParsedList = null;
        let needsAIFallback = false;

        if (chatAiMode) {
            needsAIFallback = true;
        } else {
            localParsedList = this.parseMultiChat(text);
            if (!localParsedList || localParsedList.length === 0) {
                needsAIFallback = true; // No numbers found, probably a question
            } else {
                const hasUnmapped = localParsedList.some(p => p.isUnmapped);
                if (hasUnmapped) {
                    needsAIFallback = true; // Category not found locally, let AI guess
                }
            }
        }

        // If local parser succeeded and no unmapped categories, process immediately!
        if (!needsAIFallback && localParsedList && localParsedList.length > 0) {
            if (localParsedList.length === 1 && localParsedList[0].type === 'Transfer') {
                const parsed = localParsedList[0];
                pendingChatTxs = [{
                    date: parsed.date,
                    dateKey: parsed.dateKey,
                    type: 'Transfer',
                    amount: parsed.amount,
                    note: parsed.note,
                    fromAccountId: parsed.fromAccountId,
                    toAccountId: parsed.toAccountId,
                }];
            } else {
                pendingChatTxs = localParsedList.map(parsed => ({
                    date: parsed.date,
                    dateKey: parsed.dateKey,
                    type: parsed.type,
                    amount: parsed.amount,
                    category: parsed.category,
                    note: parsed.note,
                    accountId: sessionAccountId || (accounts.length > 0 ? accounts[0].id : null)
                }));
            }
            this.renderTransactionCarousel();
            return;
        }

        // ── AI CALL (Fallback or chatAiMode) ─────────────────────────────
        const apiKey = currentProfile?.geminiApiKey || localStorage.getItem('geminiApiKey');
        if (apiKey && needsAIFallback) {
            // Loading bubble
            const loadingId = 'loading-' + Date.now();
            this.addChatBubble('<div id="'+loadingId+'" class="flex gap-1 items-center"><div class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div><div class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay:0.1s"></div><div class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay:0.2s"></div></div>', 'bot', true);

            try {
                // Race: AI call with 8 second timeout, then fallback to local parser
                const aiResult = await Promise.race([
                    this.askGemini(text, apiKey, chatAiMode),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('AI_TIMEOUT')), 8000))
                ]);
                const loadingBubble = document.getElementById(loadingId);
                if(loadingBubble) loadingBubble.parentElement.parentElement.remove();

                if (!aiResult) throw new Error("Gagal parsing JSON dari AI");

                // Push to chat memory for multi-turn context
                chatMemory.push({ role: "user", parts: [{ text: text }] });
                chatMemory.push({ role: "model", parts: [{ text: JSON.stringify(aiResult) }] });
                // Trim to max 10 pairs (20 entries)
                if (chatMemory.length > 20) chatMemory = chatMemory.slice(-20);

                const aiData = Array.isArray(aiResult.data) ? aiResult.data : (aiResult.data ? [aiResult.data] : []);
                // Treat as transaction if flagged OR if data has items
                const hasTransactions = aiData.length > 0;
                const isTransactionResponse = aiResult.isTransaction || hasTransactions;
                const isQuestionResponse = aiResult.isQuestion || (!isTransactionResponse && aiResult.response);

                if (isTransactionResponse && hasTransactions) {
                    // Update session account if AI detected a top-level account hint
                    if (aiResult.sessionAccountHint) {
                        const hintAcc = this.fuzzyFindAccount(aiResult.sessionAccountHint);
                        if (hintAcc) sessionAccountId = hintAcc.id;
                    }
                    pendingChatTxs = aiData.map(d => {
                        const dDate = d.date || this.toLocalDateString(new Date());
                        if (d.type === 'Transfer') {
                            const fromAcc = this.fuzzyFindAccount(d.fromAccount);
                            const toAcc = this.fuzzyFindAccount(d.toAccount);
                            return {
                                date: this.createLocalNoonDate(dDate),
                                dateKey: dDate,
                                type: 'Transfer',
                                amount: Number(d.amount) || 0,
                                note: d.note || 'Transfer Antar Akun',
                                fromAccountId: fromAcc?.id || accounts[0]?.id || null,
                                toAccountId: toAcc?.id || (accounts[1]?.id || null),
                            };
                        }
                        // Determine account: per-tx hint > session > first account
                        let accId = sessionAccountId || accounts[0]?.id || null;
                        if (d.accountHint) {
                            const hintAcc = this.fuzzyFindAccount(d.accountHint);
                            if (hintAcc) { accId = hintAcc.id; sessionAccountId = hintAcc.id; }
                        }
                        return {
                            date: this.createLocalNoonDate(dDate),
                            dateKey: dDate,
                            type: d.type === 'Income' ? 'Income' : 'Expense',
                            amount: Number(d.amount) || 0,
                            category: d.category || 'Others',
                            note: d.note || '',
                            accountId: accId,
                        };
                    });
                    this.renderTransactionCarousel();
                    // If AI flags that account is unknown, show account picker buttons
                    if (aiResult.askAccount && accounts.length > 0) {
                        const accButtons = accounts.map(a =>
                            `<button data-account-btn data-account-id="${a.id}" class="px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-100 text-primary border border-gray-200 active:scale-95 transition-all hover:bg-yellow-50">${a.name}</button>`
                        ).join('');
                        this.addChatBubble(`🤔 Eh btw bro, transaksi ini pakai akun yang mana?<br><div class="flex flex-wrap gap-2 mt-2">${accButtons}</div>`, 'bot', true);
                    }
                } else if (isQuestionResponse && aiResult.response) {
                    // Gen-Z reply
                    this.addChatBubble(aiResult.response.replace(/\n/g, '<br>'), 'bot', true);
                } else if (isTransactionResponse && !hasTransactions) {
                    // AI said isTransaction true but data empty — fallback to local parser silently
                    throw new Error("Data transaksi kosong dari AI, fallback ke parser lokal");
                } else {
                    // Unknown format — try to extract any useful response text
                    if (aiResult.response) {
                        this.addChatBubble(aiResult.response.replace(/\n/g, '<br>'), 'bot', true);
                    } else {
                        throw new Error("Format AI tidak sesuai");
                    }
                }
                return;
            } catch(err) {
                console.error("AI Error:", err);
                const loadingBubble = document.getElementById(loadingId);
                if(loadingBubble) loadingBubble.parentElement.parentElement.remove();

                // AI timeout - fall through to local parser silently
                if (err.message === 'AI_TIMEOUT') {
                    // Fall through to local parser
                } else {
                    // Friendly error messages
                    const errMsg = err.message || "";
                    let friendlyMsg;
                    const retryMatch = errMsg.match(/retry in ([\d.]+)s/i);
                    const retrySec = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : null;
                    if (/quota|rate.?limit|exceeded|resource_exhausted/i.test(errMsg)) {
                        friendlyMsg = `⏳ <b>Token AI kamu lagi habis nih!</b><br>` +
                            (retrySec
                                ? `Tenang, coba lagi dalam <b>${retrySec} detik</b> ya 😊<br>`
                                : `Coba lagi beberapa saat lagi ya 😊<br>`) +
                            `<small>Parser lokal tetap aktif.</small>`;
                    } else if (/api.?key|invalid.?key|api_key/i.test(errMsg)) {
                        friendlyMsg = `🔑 <b>API Key tidak valid.</b><br>Cek kembali API Key kamu di Settings ya!<br><small>Parser lokal tetap aktif.</small>`;
                    } else if (/network|fetch|failed/i.test(errMsg)) {
                        friendlyMsg = `📡 <b>Koneksi ke AI bermasalah.</b><br>Cek internet kamu, lalu coba lagi 😊<br><small>Parser lokal tetap aktif.</small>`;
                    } else if (/semua model/i.test(errMsg)) {
                        friendlyMsg = `😓 <b>Semua model AI sedang sibuk.</b><br>Coba lagi sebentar lagi ya!<br><small>Parser lokal tetap aktif.</small>`;
                    } else {
                        friendlyMsg = `⚠️ <b>AI lagi gangguan nih.</b><br><small>${errMsg}</small><br><small>Parser lokal tetap aktif.</small>`;
                    }
                    this.addChatBubble(friendlyMsg, 'bot', true);
                }
            }
        }

        // ── FINAL FALLBACK TO LOCAL PARSER ─────────────────────────────
        // If AI failed or there is no API key, fallback to localParsedList (if available)
        if (localParsedList && localParsedList.length > 0) {
            if (localParsedList.length === 1 && localParsedList[0].type === 'Transfer') {
                const parsed = localParsedList[0];
                pendingChatTxs = [{
                    date: parsed.date,
                    dateKey: parsed.dateKey,
                    type: 'Transfer',
                    amount: parsed.amount,
                    note: parsed.note,
                    fromAccountId: parsed.fromAccountId,
                    toAccountId: parsed.toAccountId,
                }];
            } else {
                pendingChatTxs = localParsedList.map(parsed => ({
                    date: parsed.date,
                    dateKey: parsed.dateKey,
                    type: parsed.type,
                    amount: parsed.amount,
                    category: parsed.category,
                    note: parsed.note,
                    accountId: sessionAccountId || (accounts.length > 0 ? accounts[0].id : null)
                }));
            }
            this.renderTransactionCarousel();
        } else {
            this.addChatBubble('❓ Maaf, format tidak dikenali. Input API Key di Settings agar aku lebih pintar! Atau ketik: <b>bakso 15rb parkir 3rb bensin 50rb</b>', 'bot', true);
            document.querySelectorAll('#chatHistory button').forEach(b => b.disabled = false);
        }
    },

    renderTransactionCarousel: function() {
        if (!pendingChatTxs || pendingChatTxs.length === 0) return;

        const panel = document.getElementById('chatPendingPanel');
        const content = document.getElementById('chatPendingContent');
        const title = document.getElementById('chatPendingTitle');
        const saveBtn = document.getElementById('chatPendingSaveBtn');
        if (!panel || !content || !title || !saveBtn) return;

        const selCls = `text-[10px] bg-white border border-gray-200 rounded-lg px-1.5 py-1 font-bold text-primary cursor-pointer max-w-[140px]`;
        let cardsHtml = '';
        pendingChatTxs.forEach((parsed, idx) => {
            const dateLabel = parsed.date.toLocaleDateString('id-ID', {day:'numeric', month:'short'});
            const accOptions = accounts.map(a => `<option value="${a.id}" ${a.id === parsed.accountId ? 'selected' : ''}>${a.name}</option>`).join('');
            const catOptions = customCategories.map(c => `<option value="${c.name}" ${c.name === parsed.category ? 'selected' : ''}>${c.name}</option>`).join('');
            if (parsed.type === 'Transfer') {
                const fromAccOptions = accounts.map(a => `<option value="${a.id}" ${a.id === parsed.fromAccountId ? 'selected' : ''}>${a.name}</option>`).join('');
                const toAccOptions = accounts.map(a => `<option value="${a.id}" ${a.id === parsed.toAccountId ? 'selected' : ''}>${a.name}</option>`).join('');
                cardsHtml += `
                    <div class="bg-indigo-50 border border-indigo-100 rounded-2xl px-3 py-2.5">
                        <div class="flex items-start gap-2.5 min-w-0">
                            <div class="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0" style="background:rgba(99,102,241,0.15);color:#6366F1">
                                <i class="ph-bold ph-arrows-left-right text-sm"></i>
                            </div>
                            <div class="min-w-0 flex-1">
                                <div class="flex items-center justify-between gap-2">
                                    <div class="min-w-0">
                                        <p class="text-[10px] uppercase tracking-[0.16em] font-bold text-indigo-400">Transfer</p>
                                        <p class="text-sm font-bold text-primary truncate leading-tight">${parsed.note || 'Transfer Antar Akun'}</p>
                                    </div>
                                    <div class="text-right shrink-0">
                                        <p class="text-[10px] font-bold text-gray-400 whitespace-nowrap">${dateLabel}</p>
                                        <p class="text-sm font-heading font-bold text-indigo-500 whitespace-nowrap">Rp ${this.format(parsed.amount)}</p>
                                    </div>
                                </div>
                                <div class="mt-2 flex flex-col gap-1.5">
                                    <div class="flex items-center gap-2">
                                        <span class="text-[10px] font-bold text-gray-400 w-7 shrink-0">Dari</span>
                                        <select onchange="app.updatePendingChatTx(${idx},'fromAccountId',this.value)" class="${selCls}">${fromAccOptions}</select>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <span class="text-[10px] font-bold text-gray-400 w-7 shrink-0">Ke</span>
                                        <select onchange="app.updatePendingChatTx(${idx},'toAccountId',this.value)" class="${selCls}">${toAccOptions}</select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>`;
            } else {
                const def = this.getCategoryDef(parsed.category);
                const isInc = parsed.type === 'Income';
                const primaryText = parsed.note && parsed.note.toLowerCase() !== parsed.category.toLowerCase() ? parsed.note : parsed.category;
                cardsHtml += `
                    <div class="bg-gray-50 border border-gray-100 rounded-2xl px-3 py-2.5">
                        <div class="flex items-start gap-2.5 min-w-0">
                            <div class="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0" style="background:${def.color}20;color:${def.color}">
                                <i class="ph-fill ${def.icon} text-sm"></i>
                            </div>
                            <div class="min-w-0 flex-1">
                                <div class="flex items-center justify-between gap-2">
                                    <div class="min-w-0">
                                        <p class="text-[10px] uppercase tracking-[0.16em] font-bold text-gray-400">${isInc ? 'Masuk' : 'Keluar'}</p>
                                        <p class="text-sm font-bold text-primary truncate leading-tight">${primaryText}</p>
                                    </div>
                                    <div class="text-right shrink-0">
                                        <p class="text-[10px] font-bold text-gray-400 whitespace-nowrap">${dateLabel}</p>
                                        <p class="text-sm font-heading font-bold ${isInc ? 'text-success' : 'text-primary'} whitespace-nowrap">${isInc ? '+' : '-'}Rp ${this.format(parsed.amount)}</p>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2 flex-wrap mt-2">
                                    <select onchange="app.updatePendingChatTx(${idx},'category',this.value)" class="${selCls}">${catOptions}</select>
                                    <select onchange="app.updatePendingChatTx(${idx},'accountId',this.value)" class="${selCls}">${accOptions}</select>
                                </div>
                            </div>
                        </div>
                    </div>`;
            }
        });

        title.textContent = pendingChatTxs.length > 1 ? `${pendingChatTxs.length} transaksi siap dicek` : '1 transaksi siap dicek';
        saveBtn.textContent = pendingChatTxs.length > 1 ? `✓ Simpan Semua (${pendingChatTxs.length})` : '✓ Simpan Transaksi';
        content.innerHTML = cardsHtml;
        panel.classList.remove('hidden');
    },

    clearPendingTransactionPanel: function() {
        const panel = document.getElementById('chatPendingPanel');
        const content = document.getElementById('chatPendingContent');
        if (content) content.innerHTML = '';
        if (panel) panel.classList.add('hidden');
    },

    confirmChatTx: async function() {
        if (!pendingChatTxs || pendingChatTxs.length === 0) return;
        
        document.querySelectorAll('#chatHistory button').forEach(b => b.disabled = true);
        const beforeMatched = new Set(this._billMatched ? this._billMatched.keys() : []);
        try {
            const batchPromises = pendingChatTxs.map(pTx => {
                let tx = {
                    date: firebase.firestore.Timestamp.fromDate(pTx.date),
                    dateKey: pTx.dateKey || this.toLocalDateString(pTx.date),
                    type: pTx.type,
                    amount: pTx.amount,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                if (pTx.type === 'Transfer') {
                    tx.fromAccountId = pTx.fromAccountId;
                    tx.toAccountId = pTx.toAccountId;
                    tx.note = pTx.note || 'Transfer';
                } else {
                    tx.category = pTx.category;
                    tx.note = pTx.note;
                    tx.accountId = pTx.accountId;
                    if (pTx.type === 'Expense') {
                        const catDef = customCategories.find(c => c.name === pTx.category);
                        tx.exclude_from_budget = pTx.exclude_from_budget !== undefined
                            ? pTx.exclude_from_budget
                            : (catDef?.exclude_from_budget === true);
                    }
                }
                return db.collection('users').doc(currentUser.uid).collection('transactions').add(tx);
            });
            await Promise.all(batchPromises);
            SFX.coin();
            this.addChatBubble(`✅ ${pendingChatTxs.length} Transaksi berhasil disimpan!`, 'bot', false);
            pendingChatTxs = [];
            this.clearPendingTransactionPanel();
            await this.loadData();
            this.revokeNoSpendIfNeeded();
            if (this._isTodayActive()) {
                const newBills = [...(this._billMatched || new Map())].filter(([id]) => !beforeMatched.has(id));
                this.addChatBubble(this.todaySummaryText(newBills), 'bot', true);
            }
        } catch(e) {
            this.addChatBubble('❌ Gagal menyimpan: ' + e.message, 'bot');
        }
    },

    fuzzyFindAccount: function(name) {
        if (!name || !accounts.length) return null;
        const n = name.toLowerCase().replace(/[\s\-_]+/g, '');
        return accounts.find(a => {
            const an = a.name.toLowerCase().replace(/[\s\-_]+/g, '');
            return an.includes(n) || n.includes(an);
        }) || null;
    },

    setChatSessionAccount: function(accountId) {
        sessionAccountId = accountId;
        pendingChatTxs.forEach(tx => { if (tx.type !== 'Transfer') tx.accountId = accountId; });
        const acc = accounts.find(a => a.id === accountId);
        this.addChatBubble(`✅ Oke! Sesi ini pakai <b>${acc ? acc.name : 'akun ini'}</b> ya. Kalau mau ganti, sebut nama akunnya aja pas input.`, 'bot', true);
        this.renderTransactionCarousel();
    },

    updatePendingChatTx: function(idx, field, value) {
        if (!pendingChatTxs[idx]) return;
        pendingChatTxs[idx][field] = value;
        // If user manually changes accountId, update session too
        if (field === 'accountId') sessionAccountId = value;
        // Re-render to update category icon etc
        if (field === 'category') this.renderTransactionCarousel();
    },

    cancelChatTx: function() {
        pendingChatTxs = [];
        document.querySelectorAll('#chatHistory button').forEach(b => b.disabled = true);
        this.clearPendingTransactionPanel();
        this.addChatBubble('🚫 Dibatalkan.', 'bot');
    },

    addChatBubble: function(content, sender, isHTML) {
        const hist = document.getElementById('chatHistory');
        const isLoading = content && content.includes('animate-bounce');
        const isShortConfirm = !isLoading && sender === 'bot' && typeof content === 'string' && content.replace(/<[^>]+>/g, '').trim().length < 55 && /^[\u2705\u274c\ud83d\udeab\u23f3\u2753]/.test(content.trim());

        // Timestamp helper
        const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

        const div = document.createElement('div');
        div.className = sender === 'user'
            ? 'flex justify-end animate-fade-in'
            : 'flex justify-start items-start gap-2 animate-fade-in w-full';

        if (sender === 'bot') {
            SFX.bubble();
            const avatar = document.createElement('div');
            avatar.className = 'w-7 h-7 rounded-full bg-gradient-to-br from-secondary to-tertiary flex items-center justify-center shrink-0 mt-0.5 shadow-sm';
            avatar.innerHTML = '<i class="ph-fill ph-robot text-primary text-sm"></i>';
            div.appendChild(avatar);
        }

        const inner = document.createElement('div');
        if (sender === 'user') {
            inner.className = 'bg-secondary text-primary rounded-2xl rounded-tr-sm shadow-sm max-w-[85%] text-sm font-medium overflow-hidden';
            const msgDiv = document.createElement('div');
            msgDiv.className = 'px-3 pt-3 pb-1';
            msgDiv.innerHTML = content;
            inner.appendChild(msgDiv);
            // WA-style timestamp + double check
            const metaDiv = document.createElement('div');
            metaDiv.className = 'flex items-center justify-end gap-1 px-3 pb-2';
            metaDiv.innerHTML = `<span class="text-[10px] text-primary/50 font-medium">${nowTime}</span><i class="ph-fill ph-checks text-primary/50 text-xs"></i>`;
            inner.appendChild(metaDiv);
        } else if (isLoading) {
            inner.className = 'bg-white text-gray-600 rounded-2xl rounded-tl-sm p-3 shadow-sm max-w-[90%] text-sm font-medium';
            inner.innerHTML = content;
        } else if (isShortConfirm) {
            inner.className = 'bg-white text-gray-600 rounded-2xl rounded-tl-sm shadow-sm max-w-[90%] text-sm font-medium overflow-hidden';
            const msgDiv = document.createElement('div');
            msgDiv.className = 'px-3 pt-3 pb-1';
            msgDiv.innerHTML = content;
            inner.appendChild(msgDiv);
            const metaDiv = document.createElement('div');
            metaDiv.className = 'flex items-center justify-end gap-1 px-3 pb-2';
            metaDiv.innerHTML = `<span class="text-[10px] text-gray-400 font-medium">${nowTime}</span>`;
            inner.appendChild(metaDiv);
        } else {
            // Rich bot bubble
            inner.className = 'chat-bot-inner';

            // Apply highlights to content
            let processed = content;
            processed = processed.replace(/(Rp\s?\d(?:[\d.,]*\d)?(?:\s?(?:juta|ribu|rb|k)\b)?)/gi, '<span class="chat-money">$1</span>');
            processed = processed.replace(/([\d.,]+\s?%)/g, '<span class="chat-pct">$1</span>');

            const contentDiv = document.createElement('div');
            contentDiv.className = 'chat-bot-content';
            contentDiv.innerHTML = processed;
            inner.appendChild(contentDiv);

            // Toolbar: timestamp + copy button
            const toolbar = document.createElement('div');
            toolbar.className = 'chat-bot-toolbar';
            const timeSpan = document.createElement('span');
            timeSpan.className = 'text-[10px] text-gray-400 font-medium mr-auto pl-1';
            timeSpan.textContent = nowTime;
            toolbar.appendChild(timeSpan);
            const plainText = content.replace(/<[^>]+>/g, '');
            const copyBtn = document.createElement('button');
            copyBtn.className = 'chat-copy-btn';
            copyBtn.innerHTML = '<i class="ph ph-copy"></i>Salin';
            copyBtn.addEventListener('click', () => this._copyChatText(copyBtn, plainText));
            toolbar.appendChild(copyBtn);
            inner.appendChild(toolbar);
        }

        div.appendChild(inner);
        hist.appendChild(div);

        // Prompt chips — for all non-loading, non-short bot bubbles
        if (sender === 'bot' && !isLoading && !isShortConfirm) {
            const chips = this._getPromptChips(content);
            if (chips.length > 0) {
                const chipRow = document.createElement('div');
                chipRow.className = 'flex justify-start pl-9 gap-2 flex-wrap animate-fade-in mt-1';
                chips.forEach(chip => {
                    const btn = document.createElement('button');
                    btn.className = 'prompt-chip';
                    btn.innerHTML = '<i class="ph ph-arrow-bend-right-down text-[10px] opacity-50"></i>' + chip;
                    btn.addEventListener('click', () => {
                        // Mark this chip as used so it won't appear again this session
                        if (!this._usedChips) this._usedChips = new Set();
                        this._usedChips.add(chip);
                        chipRow.remove();
                        const input = document.getElementById('chatInput');
                        if (input) { input.value = chip; input.focus(); }
                        this.submitChat();
                    });
                    chipRow.appendChild(btn);
                });
                hist.appendChild(chipRow);
            }
        }

        this.scrollChatToBottom();
    },

    _copyChatText: function(btn, text) {
        navigator.clipboard.writeText(text).then(() => {
            btn.className = 'chat-copy-btn copied';
            btn.innerHTML = '<i class="ph ph-check"></i>Tersalin!';
            setTimeout(() => {
                btn.className = 'chat-copy-btn';
                btn.innerHTML = '<i class="ph ph-copy"></i>Salin';
            }, 2000);
        }).catch(() => {
            // Fallback for older browsers
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            btn.className = 'chat-copy-btn copied';
            btn.innerHTML = '<i class="ph ph-check"></i>Tersalin!';
            setTimeout(() => {
                btn.className = 'chat-copy-btn';
                btn.innerHTML = '<i class="ph ph-copy"></i>Salin';
            }, 2000);
        });
    },

    _getPromptChips: function(content) {
        // Full pool of all local-answerable questions
        const ALL_CHIPS = [
            'berapa health score ku?',
            'bagaimana spending DNA ku?',
            'spending nature bulan ini?',
            'weekday vs weekend mana lebih boros?',
            'bagaimana latte faktor ku?',
            'berapa saldo semua akun?',
            'bagaimana dana darurat ku?',
            'bagaimana budget pacing bulan ini?',
            'ringkasan keuangan bulan ini',
            'kategori terbesar bulan ini?',
            'cara improve health score?',
            'tips hemat bulan ini?',
            'cara hemat sisa bulan ini?',
        ];

        if (!this._usedChips) this._usedChips = new Set();
        const t = (content || '').toLowerCase();

        // Build context-relevant priority chips (excluding already used)
        const priority = [];
        if (/health.?score|skor/.test(t))           priority.push('cara improve health score?', 'tips hemat bulan ini?', 'spending nature bulan ini?');
        if (/latte|pengeluaran.?receh/.test(t))      priority.push('tips hemat bulan ini?', 'cara hemat sisa bulan ini?', 'kategori terbesar bulan ini?');
        if (/spending.?dna|tipe.?belanj/.test(t))    priority.push('weekday vs weekend mana lebih boros?', 'bagaimana latte faktor ku?', 'cara improve health score?');
        if (/spending.?nature|komposisi/.test(t))    priority.push('berapa health score ku?', 'cara improve health score?', 'tips hemat bulan ini?');
        if (/weekday|weekend/.test(t))               priority.push('bagaimana latte faktor ku?', 'tips hemat bulan ini?', 'kategori terbesar bulan ini?');
        if (/saldo.?akun|total.?saldo/.test(t))      priority.push('bagaimana dana darurat ku?', 'bagaimana budget pacing bulan ini?', 'berapa health score ku?');
        if (/dana.?darurat|emergency/.test(t))       priority.push('cara improve health score?', 'tips hemat bulan ini?', 'bagaimana budget pacing bulan ini?');
        if (/budget.?pacing|sisa.?budget/.test(t))   priority.push('kategori terbesar bulan ini?', 'cara hemat sisa bulan ini?', 'bagaimana latte faktor ku?');
        if (/ringkasan|rekap|surplus|defisit/.test(t)) priority.push('berapa health score ku?', 'bagaimana spending DNA ku?', 'cara improve health score?');
        if (/kategori|terbesar/.test(t))             priority.push('bagaimana latte faktor ku?', 'cara hemat sisa bulan ini?', 'tips hemat bulan ini?');
        if (/improve.?score|ningkatin/.test(t))      priority.push('tips hemat bulan ini?', 'bagaimana dana darurat ku?', 'spending nature bulan ini?');
        if (/tips.?hemat|cara.?hemat/.test(t))       priority.push('kategori terbesar bulan ini?', 'bagaimana latte faktor ku?', 'berapa health score ku?');
        if (/nabung|investasi|alokasi/.test(t))      priority.push('ringkasan keuangan bulan ini', 'berapa health score ku?', 'tips hemat bulan ini?');

        // Filter priority: not used, deduplicated
        const seen = new Set();
        const filtered = priority.filter(c => {
            if (this._usedChips.has(c) || seen.has(c)) return false;
            seen.add(c); return true;
        });

        // Fill remaining slots from pool (shuffled), excluding used
        const remaining = ALL_CHIPS
            .filter(c => !this._usedChips.has(c) && !seen.has(c))
            .sort(() => Math.random() - 0.5);

        const candidates = [...filtered, ...remaining];

        // If pool nearly exhausted (< 4 unused), reset used set
        const unused = ALL_CHIPS.filter(c => !this._usedChips.has(c));
        if (unused.length < 4) this._usedChips.clear();

        // Pick 3, mark as shown (so same chip won't appear again next bubble)
        const picked = candidates.slice(0, 3);
        picked.forEach(c => this._usedChips.add(c));
        return picked;
    },

    scrollChatToBottom: function() {
        const hist = document.getElementById('chatHistory');
        if (!hist) return;
        requestAnimationFrame(() => {
            hist.scrollTop = hist.scrollHeight;
        });
    },

    // ── Budget ──────────────────────────────────────────────────────────────
    saveBudget: async function() {
        const val = parseInt(document.getElementById('settingsBudgetInput').value);
        if (!val || val < 0) return this.toast('Nominal budget tidak valid', true);
        try {
            await db.collection('users').doc(currentUser.uid).update({ monthlyBudget: val });
            currentProfile.monthlyBudget = val;
            this.toast('Budget disimpan!');
        } catch(e) { this.toast(e.message, true); }
    },

    // ── Account Overview (Level 2) ──────────────────────────────────────────
    _overviewPeriod: '7D',
    _overviewChart: null,

    openAccountOverview: function() {
        const el = document.getElementById('viewAccountOverview');
        el.classList.remove('hidden');
        el.classList.add('flex');
        this._overviewPeriod = '7D';
        this.renderAccountOverview();
    },

    closeAccountOverview: function() {
        const el = document.getElementById('viewAccountOverview');
        el.classList.add('hidden');
        el.classList.remove('flex');
    },

    setOverviewPeriod: function(period) {
        this._overviewPeriod = period;
        document.querySelectorAll('.overview-period-btn').forEach(btn => {
            const active = btn.dataset.period === period;
            btn.className = `overview-period-btn px-3 py-1 rounded-full text-[11px] font-bold transition ${active ? 'bg-white text-primary' : 'bg-white/10 text-white/70'}`;
        });
        this.renderAccountOverviewCharts();
    },

    renderAccountOverview: function() {
        // Populate account cards
        const container = document.getElementById('overviewAccountCards');
        const totalBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);
        container.innerHTML = accounts.map(a => {
            const ic = a.icon || 'ph-wallet';
            const col = a.color || '#2E6CF6';
            const pct = totalBalance !== 0 ? Math.abs((a.balance || 0) / totalBalance * 100) : 0;
            return `
            <div onclick="app.openAccountDetail('${a.id}')"
                 class="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3 cursor-pointer active:scale-[0.98] transition">
                <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-base" style="background:${col}18;color:${col}">
                    <i class="ph-fill ${ic}"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-bold text-primary truncate">${a.name}</p>
                    <p class="text-[10px] text-gray-400">${a.type}</p>
                    <div class="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden w-full">
                        <div class="h-full rounded-full" style="width:${Math.min(pct,100)}%;background:${col}"></div>
                    </div>
                </div>
                <div class="text-right shrink-0">
                    <p class="text-sm font-bold text-primary">Rp ${this.format(a.balance || 0)}</p>
                    <p class="text-[10px] text-gray-400">${pct.toFixed(1)}%</p>
                </div>
                <i class="ph-bold ph-caret-right text-gray-300 text-xs shrink-0"></i>
            </div>`;
        }).join('');
        this.renderAccountOverviewCharts();
    },

    calculateHistoricalBalanceSeries: function(accountId, period) {
        const now = new Date();
        let startDate;
        if (period === '7D') startDate = new Date(now - 7 * 86400000);
        else if (period === '1M') startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        else if (period === '3M') startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        else if (period === 'YTD') startDate = new Date(now.getFullYear(), 0, 1);
        else startDate = null; // ALL

        // Get relevant txs for this account, sorted ascending
        const relevant = (accountId === 'all' ? [...allTransactions] :
            allTransactions.filter(tx => {
                if (tx.type === 'Transfer') return tx.fromAccountId === accountId || tx.toAccountId === accountId;
                return tx.accountId === accountId;
            })
        ).filter(tx => tx.dateStr).sort((a, b) => a.dateStr.localeCompare(b.dateStr));

        // Current balance is the endpoint — work backwards
        const currentBalance = accountId === 'all'
            ? accounts.reduce((s, a) => s + (a.balance || 0), 0)
            : (accounts.find(a => a.id === accountId)?.balance || 0);

        // Build day-by-day map of net change
        const dayMap = {};
        relevant.forEach(tx => {
            const d = tx.dateStr;
            if (!dayMap[d]) dayMap[d] = 0;
            if (accountId === 'all') {
                if (tx.type === 'Income') dayMap[d] += tx.amount;
                else if (tx.type === 'Expense') dayMap[d] -= tx.amount;
                // transfers cancel out for portfolio
            } else {
                if (tx.type === 'Transfer') {
                    if (tx.toAccountId === accountId) dayMap[d] += tx.amount;
                    if (tx.fromAccountId === accountId) dayMap[d] -= tx.amount;
                } else if (tx.accountId === accountId) {
                    if (tx.type === 'Income') dayMap[d] += tx.amount;
                    else if (tx.type === 'Expense') dayMap[d] -= tx.amount;
                }
            }
        });

        // Enumerate all dates in range
        const todayStr = this.toLocalDateString(now);
        const allDates = Object.keys(dayMap).sort();
        const firstDate = startDate
            ? this.toLocalDateString(startDate)
            : (allDates[0] || todayStr);

        const labels = [], values = [];
        let balance = currentBalance;

        // Build date list
        const dateList = [];
        let d = new Date(now);
        while (this.toLocalDateString(d) >= firstDate) {
            dateList.unshift(this.toLocalDateString(d));
            d = new Date(d - 86400000);
        }

        // Walk backwards from today
        let runningBal = currentBalance;
        const balanceByDate = { [todayStr]: currentBalance };
        const sortedDates = [...dateList].reverse();
        for (let i = 0; i < sortedDates.length - 1; i++) {
            const date = sortedDates[i];
            runningBal -= (dayMap[date] || 0);
            balanceByDate[sortedDates[i + 1]] = runningBal; // balance before this day's transactions
        }

        dateList.forEach(dt => {
            labels.push(dt.slice(5)); // MM-DD
            values.push(balanceByDate[dt] ?? null);
        });

        return { labels, values };
    },

    renderAccountOverviewCharts: function() {
        const { labels, values } = this.calculateHistoricalBalanceSeries('all', this._overviewPeriod);
        const ctx = document.getElementById('overviewBalanceChart')?.getContext('2d');
        if (!ctx) return;
        if (this._overviewChart) this._overviewChart.destroy();
        const grad = ctx.createLinearGradient(0, 0, 0, 176);
        grad.addColorStop(0, 'rgba(28,189,179,0.35)');
        grad.addColorStop(1, 'rgba(28,189,179,0)');
        this._overviewChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    data: values,
                    borderColor: '#1CBDB3', backgroundColor: grad,
                    fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2.5, spanGaps: true
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: {
                    backgroundColor: 'rgba(4,7,32,0.9)', padding: 10,
                    callbacks: { label: (i) => `Rp ${this.format(i.parsed.y)}` }
                }},
                scales: {
                    x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 9 }, maxTicksLimit: 6 } },
                    y: { grid: { color: 'rgba(255,255,255,0.08)', drawBorder: false }, ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 9 }, callback: v => `${v >= 1e6 ? (v/1e6).toFixed(1)+'M' : (v/1e3).toFixed(0)+'K'}` } }
                }
            }
        });
    },

    // ── Account Detail (Level 3) ─────────────────────────────────────────────
    _detailAccountId: null,
    _detailCatFilter: null,
    _detailTrendChart: null,
    _detailCatChart: null,

    openAccountDetail: function(accountId) {
        this._detailAccountId = accountId;
        this._detailCatFilter = null;
        const acc = accounts.find(a => a.id === accountId);
        if (!acc) return;
        const ic = acc.icon || 'ph-wallet';
        const col = acc.color || '#2E6CF6';
        // Header
        document.getElementById('detailAccName').textContent = acc.name;
        document.getElementById('detailAccType').textContent = acc.type;
        document.getElementById('detailAccBalance').textContent = `Rp ${this.format(acc.balance || 0)}`;
        const iconEl = document.getElementById('detailAccIcon');
        iconEl.innerHTML = `<i class="ph-fill ${ic}"></i>`;
        iconEl.style.background = col + '22'; iconEl.style.color = col;
        // Stats row
        const monthKey = this.getCurrentMonthKey(activeMonthDate);
        const accTxs = allTransactions.filter(tx => {
            if (tx.type === 'Transfer') return tx.fromAccountId === accountId || tx.toAccountId === accountId;
            return tx.accountId === accountId;
        });
        const monthTxs = accTxs.filter(tx => (tx.dateStr || '').startsWith(monthKey));
        let incM = 0, expM = 0;
        monthTxs.forEach(tx => {
            if (tx.type === 'Income') incM += tx.amount;
            else if (tx.type === 'Expense') expM += tx.amount;
            else if (tx.type === 'Transfer') {
                if (tx.toAccountId === accountId) incM += tx.amount;
                if (tx.fromAccountId === accountId) expM += tx.amount;
            }
        });
        document.getElementById('detailStatRow').innerHTML = `
            <div class="text-center p-2">
                <p class="text-[9px] text-gray-400 font-bold uppercase mb-0.5">Income</p>
                <p class="text-sm font-bold text-green-500">Rp ${this.format(incM)}</p>
            </div>
            <div class="text-center p-2 border-x border-gray-100">
                <p class="text-[9px] text-gray-400 font-bold uppercase mb-0.5">Expense</p>
                <p class="text-sm font-bold text-danger">Rp ${this.format(expM)}</p>
            </div>
            <div class="text-center p-2">
                <p class="text-[9px] text-gray-400 font-bold uppercase mb-0.5">Transaksi</p>
                <p class="text-sm font-bold text-primary">${monthTxs.length}x</p>
            </div>`;

        const el = document.getElementById('viewAccountDetail');
        el.classList.remove('hidden'); el.classList.add('flex');
        this.renderAccountDetailCharts(accountId, col);
        this.renderDetailTxList();
    },

    closeAccountDetail: function() {
        const el = document.getElementById('viewAccountDetail');
        el.classList.add('hidden'); el.classList.remove('flex');
        if (this._detailTrendChart) { this._detailTrendChart.destroy(); this._detailTrendChart = null; }
        if (this._detailCatChart) { this._detailCatChart.destroy(); this._detailCatChart = null; }
    },

    renderAccountDetailCharts: function(accountId, accentColor) {
        const col = accentColor || '#2E6CF6';
        // Build 6-month spending trend
        const now = new Date();
        const trendLabels = [], trendData = [];
        for (let m = 5; m >= 0; m--) {
            const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
            const mk = this.getCurrentMonthKey(d);
            const label = d.toLocaleString('id-ID', { month: 'short' });
            trendLabels.push(label);
            const exp = allTransactions
                .filter(tx => (tx.dateStr || '').startsWith(mk) && tx.type === 'Expense' && tx.accountId === accountId)
                .reduce((s, t) => s + t.amount, 0);
            trendData.push(exp);
        }
        if (this._detailTrendChart) this._detailTrendChart.destroy();
        const tCtx = document.getElementById('detailTrendChart')?.getContext('2d');
        if (tCtx) {
            this._detailTrendChart = new Chart(tCtx, {
                type: 'bar',
                data: {
                    labels: trendLabels,
                    datasets: [{ data: trendData, backgroundColor: trendData.map((_, i) => i === 5 ? col : col + '55'), borderRadius: 8, borderSkipped: false }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { callbacks: { label: i => `Rp ${this.format(i.parsed.y)}` } } },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: '#94A3B8', font: { size: 10 } } },
                        y: { grid: { color: 'rgba(148,163,184,0.15)' }, ticks: { color: '#94A3B8', font: { size: 9 }, callback: v => v >= 1e6 ? (v/1e6).toFixed(1)+'M' : (v/1e3).toFixed(0)+'K' } }
                    }
                }
            });
        }

        // Category pie for current month
        const monthKey = this.getCurrentMonthKey(activeMonthDate);
        const catMap = {};
        allTransactions
            .filter(tx => tx.accountId === accountId && tx.type === 'Expense' && (tx.dateStr || '').startsWith(monthKey))
            .forEach(tx => { catMap[tx.category] = (catMap[tx.category] || 0) + tx.amount; });
        const catEntries = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
        const total = catEntries.reduce((s, [, v]) => s + v, 0);
        const catColors = catEntries.map(([k]) => this.getCategoryDef(k).color);

        if (this._detailCatChart) this._detailCatChart.destroy();
        const cCtx = document.getElementById('detailCatChart')?.getContext('2d');
        if (cCtx) {
            this._detailCatChart = new Chart(cCtx, {
                type: 'doughnut',
                data: {
                    labels: catEntries.map(([k]) => k),
                    datasets: [{ data: catEntries.map(([, v]) => v), backgroundColor: catColors, borderWidth: 2, borderColor: '#fff', hoverOffset: 6 }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false, cutout: '60%',
                    plugins: { legend: { display: false }, tooltip: { callbacks: { label: i => `Rp ${this.format(i.parsed)}` } } },
                    onClick: (_, els) => {
                        if (els.length) {
                            const cat = catEntries[els[0].index][0];
                            this._detailCatFilter = this._detailCatFilter === cat ? null : cat;
                            this.renderDetailTxList();
                        }
                    }
                }
            });
        }

        // Legend
        const legend = document.getElementById('detailCatLegend');
        legend.innerHTML = catEntries.length ? catEntries.map(([k, v], i) => {
            const pct = total > 0 ? Math.round(v / total * 100) : 0;
            const def = this.getCategoryDef(k);
            return `<div onclick="app._detailCatFilter='${k}';app.renderDetailTxList()" class="flex items-center gap-1.5 cursor-pointer active:opacity-70 transition" data-cat="${k}">
                <div class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${def.color}"></div>
                <span class="text-[10px] font-bold text-primary truncate flex-1">${k}</span>
                <span class="text-[10px] text-gray-400 shrink-0">${pct}%</span>
            </div>`;
        }).join('') : '<p class="text-xs text-gray-400">Belum ada data bulan ini</p>';
    },

    renderDetailTxList: function() {
        const accountId = this._detailAccountId;
        const monthKey = this.getCurrentMonthKey(activeMonthDate);
        let txs = allTransactions.filter(tx => {
            const inMonth = (tx.dateStr || '').startsWith(monthKey);
            const inAcc = tx.type === 'Transfer'
                ? (tx.fromAccountId === accountId || tx.toAccountId === accountId)
                : tx.accountId === accountId;
            return inMonth && inAcc;
        });
        if (this._detailCatFilter) txs = txs.filter(tx => tx.category === this._detailCatFilter);
        txs.sort((a, b) => (b.dateStr || '').localeCompare(a.dateStr || ''));

        const title = document.getElementById('detailTxTitle');
        const clearBtn = document.getElementById('detailClearFilter');
        title.textContent = this._detailCatFilter ? `Kategori: ${this._detailCatFilter}` : 'Semua Transaksi';
        clearBtn.classList.toggle('hidden', !this._detailCatFilter);

        const container = document.getElementById('detailTxContainer');
        if (!txs.length) { container.innerHTML = '<p class="text-xs text-gray-400 text-center py-4">Tidak ada transaksi</p>'; return; }
        container.innerHTML = txs.map(t => {
            const def = this.getCategoryDef(t.category);
            const sign = t.type === 'Income' ? '+' : t.type === 'Expense' ? '-' : '⇄';
            const color = t.type === 'Income' ? 'text-green-500' : t.type === 'Expense' ? 'text-danger' : 'text-blue-500';
            return `<div class="flex items-center gap-2.5 py-2 border-b border-gray-50 last:border-0">
                <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style="background:${def.color}18;color:${def.color}">
                    <i class="ph-fill ${def.icon} text-sm"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-xs font-bold text-primary truncate">${t.note || t.category}</p>
                    <p class="text-[9px] text-gray-400">${t.dateStr} · ${t.category}</p>
                </div>
                <span class="text-xs font-bold ${color} shrink-0">${sign} Rp ${this.format(t.amount)}</span>
            </div>`;
        }).join('');
    },

    clearDetailCatFilter: function() {
        this._detailCatFilter = null;
        this.renderDetailTxList();
    },

    saveApiKey: async function() {        try {
            await db.collection('users').doc(currentUser.uid).update({ geminiApiKey: val });
            currentProfile.geminiApiKey = val;
            if(val) {
                localStorage.setItem('geminiApiKey', val);
                this.toast('API Key Disimpan ke akun!');
            } else {
                localStorage.removeItem('geminiApiKey');
                this.toast('API Key Dihapus dari akun!');
            }
        } catch (error) {
            this.toast('Gagal simpan API Key', true);
        }
    },

    // ── COMPUTE FINANCIAL METRICS (shared by local answerer & AI prompt) ────────
    _computeFinancialMetrics: function() {
        const now = new Date();
        const curMonthStr = this.getCurrentMonthKey(now);
        const todayLocal = this.toLocalDateString(now);
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const daysPassed = now.getDate();

        let totalExp = 0, totalInc = 0;
        let catsExp = {}, incomeSources = new Set();
        const curMonthTxs = allTransactions.filter(tx => tx.dateStr && tx.dateStr.startsWith(curMonthStr));
        curMonthTxs.forEach(tx => {
            if (tx.type === 'Expense') { totalExp += tx.amount; catsExp[tx.category] = (catsExp[tx.category] || 0) + tx.amount; }
            else if (tx.type === 'Income') { totalInc += tx.amount; incomeSources.add(tx.category || tx.note || 'Lainnya'); }
        });

        const budget = currentProfile.monthlyBudget || DEFAULT_MONTHLY_BUDGET;
        const remainingBudget = budget - totalExp;
        const surplus = totalInc - totalExp;
        const savingRateNum = totalInc > 0 ? ((totalInc - totalExp) / totalInc) * 100 : 0;
        const trackedDays = new Set(curMonthTxs.map(t => t.dateStr)).size;
        const incomeSourceCount = incomeSources.size;

        // Spending nature
        const curExpTxs = curMonthTxs.filter(t => t.type === 'Expense');
        const nature = this.evaluateNatureBreakdown(curExpTxs, customCategories);

        // Health score
        let pEffScore = 0, pEffDetail = '';
        if (totalExp > totalInc && totalInc > 0) { pEffScore = 0; pEffDetail = 'Overbudget'; }
        else {
            const useInc = totalInc > 0 ? totalInc : (totalExp > 0 ? totalExp : 1);
            const np = Math.round((nature.needs / useInc) * 100), wp = Math.round((nature.wants / useInc) * 100);
            if (np > 60 || wp > 40) { pEffScore = 5; pEffDetail = 'Bocor'; }
            else if (np > 50 || wp > 30) { pEffScore = 15; pEffDetail = 'Warning'; }
            else { pEffScore = 25; pEffDetail = 'Sangat Efisien'; }
        }
        const useIncFixed = totalInc > 0 ? totalInc : (totalExp > 0 ? totalExp : 1);
        const mp = Math.round((nature.must / useIncFixed) * 100);
        let pFixedScore = 0, pFixedDetail = '';
        if (mp > 40) { pFixedScore = 0; pFixedDetail = 'Gali Lubang'; }
        else if (mp >= 30) { pFixedScore = 10; pFixedDetail = 'Hati-hati'; }
        else { pFixedScore = 20; pFixedDetail = 'Sehat'; }
        const aiAvgMonthlyExp = totalExp > 0 ? totalExp : 1000000;
        const aiEfScoreDict = this.calculateEmergencyFundScore(accounts, aiAvgMonthlyExp);
        let pEfScore = 0, pEfDetail = '';
        if (aiEfScoreDict.months >= 3) { pEfScore = 20; pEfDetail = 'Aman Sentosa'; }
        else if (aiEfScoreDict.months >= 1) { pEfScore = 10; pEfDetail = 'Lumayan'; }
        else if (aiEfScoreDict.totalEmergency > 0) { pEfScore = 5; pEfDetail = 'Baru Mulai'; }
        else { pEfScore = 0; pEfDetail = 'Kosong'; }
        let pSrScore = 0, pSrDetail = '';
        if (savingRateNum >= 20) { pSrScore = 20; pSrDetail = 'Top Tier'; }
        else if (savingRateNum >= 10) { pSrScore = 15; pSrDetail = 'Cukup'; }
        else if (savingRateNum > 0) { pSrScore = 5; pSrDetail = 'Tipis'; }
        else { pSrScore = 0; pSrDetail = 'Boncos'; }
        const _trackPct = daysPassed > 0 ? trackedDays / daysPassed : 0;
        let pTrScore = 0, pTrDetail = '';
        if (_trackPct >= 0.8) { pTrScore = 15; pTrDetail = `Rajin Banget (${Math.round(_trackPct*100)}%)`; }
        else if (_trackPct >= 0.5) { pTrScore = 10; pTrDetail = `Bolong Dikit (${Math.round(_trackPct*100)}%)`; }
        else if (_trackPct >= 0.2) { pTrScore = 5; pTrDetail = `Males-malesan (${Math.round(_trackPct*100)}%)`; }
        else { pTrScore = 0; pTrDetail = `Ghosting (${Math.round(_trackPct*100)}%)`; }
        const healthScore = Math.max(0, Math.min(100, pEffScore + pFixedScore + pEfScore + pSrScore + pTrScore));
        const healthLabel = healthScore >= 80 ? 'Excellent' : healthScore >= 60 ? 'Good' : healthScore >= 40 ? 'Fair' : 'Needs Attention';

        // Spending DNA
        const _catsSorted = Object.entries(catsExp).map(([k,v]) => ({ cat: k, amt: v })).sort((a,b) => b.amt - a.amt);
        const _top1 = _catsSorted[0];
        const _topIsFnb = _top1 && ['makanan','food','f&b','makan','kopi','coffee','resto'].some(w => _top1.cat.toLowerCase().includes(w));
        const _topInWants = _catsSorted.slice(0,3).some(c => customCategories?.find(x => x.name === c.cat)?.nature === 'wants');
        let dnaType, dnaDesc;
        if (trackedDays < 5) {
            dnaType = 'Ghost Tracker 👻'; dnaDesc = 'Data masih dikit, rajin catat dulu biar DNA-nya keliatan.';
        } else if (savingRateNum >= 25) {
            dnaType = 'Cuan Collector 🏆'; dnaDesc = `Saving rate ${savingRateNum.toFixed(1)}% — anomali Gen-Z yang beneran nabung. Rare!`;
        } else if (nature.wantsPct >= 50) {
            dnaType = 'Hedonist 🎉'; dnaDesc = `${Math.round(nature.wantsPct)}% pengeluaran = Wants. YOLO spending detected.`;
        } else if (_topIsFnb && savingRateNum >= 15) {
            dnaType = 'Urban Foodie 🍜'; dnaDesc = `Top kategori ${_top1?.cat}, tapi saving rate tetap ${savingRateNum.toFixed(1)}%. Respect!`;
        } else if (nature.wantsPct >= 35 && _topInWants) {
            dnaType = 'Shopping Addict 🛒'; dnaDesc = `${Math.round(nature.wantsPct)}% spending masuk Wants — cart lu bahaya bro.`;
        } else if (nature.mustPct >= 55) {
            dnaType = 'Bill Warrior ⚔️'; dnaDesc = `Fixed cost nyedot ${Math.round(nature.mustPct)}% — beban berat, butuh income boost.`;
        } else if (savingRateNum >= 10 && savingRateNum < 25 && nature.wantsPct < 35 && nature.mustPct < 55) {
            dnaType = 'Balanced Planner ⚖️'; dnaDesc = `Saving ${savingRateNum.toFixed(1)}%, Wants ${Math.round(nature.wantsPct)}% — balanced, 50/30/20 gang.`;
        } else {
            dnaType = 'Struggling Saver 😤'; dnaDesc = `Saving rate ${savingRateNum.toFixed(1)}% — masih bisa ditingkatin, step by step.`;
        }

        // Weekday vs Weekend
        const _dowTotals = [0,0,0,0,0,0,0], _dowCounts = [0,0,0,0,0,0,0];
        curExpTxs.forEach(tx => {
            if (!tx.dateStr) return;
            const dow = new Date(tx.dateStr + 'T12:00:00').getDay();
            _dowTotals[dow] += tx.amount;
        });
        for (let d = 1; d <= daysPassed; d++) {
            _dowCounts[new Date(now.getFullYear(), now.getMonth(), d).getDay()]++;
        }
        const _wdTotal = [1,2,3,4,5].reduce((s,i) => s + _dowTotals[i], 0);
        const _weTotal = [0,6].reduce((s,i) => s + _dowTotals[i], 0);
        const _wdDays  = [1,2,3,4,5].reduce((s,i) => s + _dowCounts[i], 0);
        const _weDays  = [0,6].reduce((s,i) => s + _dowCounts[i], 0);
        const _wdAvg   = _wdDays > 0 ? Math.round(_wdTotal / _wdDays) : 0;
        const _weAvg   = _weDays > 0 ? Math.round(_weTotal / _weDays) : 0;
        const _wdWeStatus = _weAvg > _wdAvg * 1.5 ? 'LEBIH BOROS WEEKEND' : _wdAvg > _weAvg * 1.5 ? 'LEBIH BOROS WEEKDAY' : 'RELATIF SEIMBANG';

        // Latte factor
        const latteMap = {};
        curExpTxs.forEach(tx => {
            const tokens = ((tx.note || '') + ' ' + (tx.category || '')).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length >= 3);
            const seen = new Set();
            tokens.forEach(token => {
                if (seen.has(token)) return; seen.add(token);
                if (!latteMap[token]) latteMap[token] = { count: 0, total: 0, label: token };
                latteMap[token].count++; latteMap[token].total += tx.amount;
            });
        });
        const latteCandidates = Object.values(latteMap).filter(k => k.count >= 3 && k.total < budget * 1.5 && k.total > 0).sort((a,b) => b.count - a.count).slice(0, 3);

        // Budget pacing
        const pacing = this.evaluateBudgetPacing(totalExp, budget, daysInMonth, daysPassed);
        const pacingStatus = pacing.pacingPct > 120 ? 'OVERSPEND' : pacing.pacingPct > 100 ? 'SEDIKIT OVER' : 'ON TRACK';

        // Account balances
        const totalBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);
        const topCats = Object.entries(catsExp).sort((a,b) => b[1]-a[1]).slice(0,5).map(([k,v]) => `${k}: Rp${this.format(v)}`).join(', ');

        return {
            now, totalExp, totalInc, surplus, savingRateNum, remainingBudget, budget, trackedDays, daysPassed, daysInMonth,
            incomeSourceCount, curMonthTxs, catsExp, topCats, nature, _top1, _catsSorted,
            healthScore, healthLabel, pEffScore, pEffDetail, pFixedScore, pFixedDetail,
            pEfScore, pEfDetail, aiEfScoreDict, pSrScore, pSrDetail, pTrScore, pTrDetail,
            dnaType, dnaDesc,
            _wdAvg, _weAvg, _wdTotal, _weTotal, _wdDays, _weDays, _wdWeStatus,
            latteCandidates, pacing, pacingStatus,
            totalBalance,
        };
    },

    // ── LOCAL ANSWER ENGINE (no AI token used) ───────────────────────────────
    _tryLocalAnswer: function(text) {
        const t = text.toLowerCase();
        const isReport = /health.?score|financial.?score|skor.?keuangan|skor.?financial|skor.*(gw|ku|saya)/.test(t) ||
            /spending.?dna|tipe.?belanj|spending.?type|dna.?(gw|saya|aku|ku)|dna.*bulan/.test(t) ||
            /spending.?nature|nature.?(gw|saya|aku|ku)|komposisi.?belanj/.test(t) ||
            /weekday.?vs.?weekend|weekend.?vs.?weekday|boros.*(weekday|weekend)|lebih.?boros.?kapan/.test(t) ||
            /latte|pengeluaran.?receh|kebiasaan.?belanj/.test(t) ||
            /saldo.?(akun|gw|saya|aku|ku|semua)|berapa.?saldo|semua.?akun/.test(t) ||
            /budget.?pacing|pacing.?budget|pace.?budget|sisa.?budget|budget.?sisa/.test(t) ||
            /dana.?darurat.*(gw|ku|saya|aku|sekarang|bulan|status|berapa|cukup|total)|emergency.?fund.*(status|total|berapa|ku|gw)|tabungan.?darurat.*(ku|gw|saya|berapa|status)/.test(t) ||
            /laporan|ringkasan|summary|rekap.?bulan|rekap.?keuangan/.test(t) ||
            /pemasukan|pengeluaran.*(bulan|total|ku|gw)|total.*(keluar|masuk)|surplus|defisit|saving.?rate/.test(t) ||
            /kategori.*(terbesar|terbanyak|paling)|paling.*(banyak|boros)/.test(t) ||
            /improve.?score|ningkatin.?score|cara.?naik.?score|score.?naik|tingkat.?skor|cara.?improve/.test(t) ||
            /tips.?hemat|cara.?hemat|hemat.?bulan|gimana.?hemat|bagaimana.?hemat|strategi.?hemat/.test(t) ||
            /bulan.?lalu|bulan.?kemarin|bulan.?sebelum|last.?month|previous.?month/.test(t) ||
            /bulan.*(terburuk|terparah|terboros|paling.?boros|paling.?buruk)|skor.*(terendah|terburuk)/.test(t) ||
            /bulan.*(terbaik|tersurplus|paling.?hemat|paling.?bagus)|skor.*(tertinggi|terbaik)/.test(t) ||
            /tren.?keuangan|trend.?keuangan|perbandingan.?bulan|histori.?keuangan|riwayat.?keuangan|semua.?bulan/.test(t);
        if (!isReport) return null;

        const m = this._computeFinancialMetrics();
        const f = v => this.format(v);
        const monthName = m.now.toLocaleString('id-ID', { month: 'long', year: 'numeric' });

        // Health Score
        if (/health.?score|financial.?score|skor/.test(t)) {
            return `Financial Health Score lu bulan ${monthName}: <b>${m.healthScore}/100</b> — status <b>${m.healthLabel}</b> 🎯<br><br>` +
                `📊 Rincian:<br>` +
                `• Needs vs Wants: <b>${m.pEffScore}/25</b> (${m.pEffDetail})<br>` +
                `• Fixed Cost Burden: <b>${m.pFixedScore}/20</b> (${m.pFixedDetail})<br>` +
                `• Emergency Fund: <b>${m.pEfScore}/20</b> (${m.pEfDetail}, ${m.aiEfScoreDict.months} bln)<br>` +
                `• Savings Rate: <b>${m.pSrScore}/20</b> (${m.pSrDetail}, ${m.savingRateNum.toFixed(1)}%)<br>` +
                `• Tracking: <b>${m.pTrScore}/15</b> (${m.pTrDetail}, ${m.trackedDays} hr)<br><br>` +
                `Cek detail lengkap di tab <b>Report</b> ya! 🚀`;
        }
        // Spending DNA
        if (/spending.?dna|tipe.?belanj|dna.?gw|dna.?saya/.test(t)) {
            return `Spending DNA lu bulan ini: <b>${m.dnaType}</b><br>${m.dnaDesc}<br><br>` +
                `Top kategori: <b>${m._top1 ? m._top1.cat + ' (Rp ' + f(m._top1.amt) + ')' : 'belum ada data'}</b><br>` +
                `Saving Rate: <b>${m.savingRateNum.toFixed(1)}%</b><br><br>` +
                `Cek detail di tab Report → Deep Insights ya! 📊`;
        }
        // Spending Nature
        if (/spending.?nature|nature.?gw|komposisi.?belanj/.test(t)) {
            return `Ini breakdown <b>Spending Nature</b> lu bulan ${monthName}:<br><br>` +
                `⚙️ <b>Must (Wajib/Fixed)</b>: Rp ${f(m.nature.must)} (${m.nature.mustPct}%)<br>` +
                `🛒 <b>Needs (Kebutuhan)</b>: Rp ${f(m.nature.needs)} (${m.nature.needsPct}%)<br>` +
                `🎉 <b>Wants (Keinginan)</b>: Rp ${f(m.nature.wants)} (${m.nature.wantsPct}%)<br><br>` +
                `Idealnya rasio <b>50% Needs / 30% Wants / 20% Saving</b> ya bro! ` +
                (m.nature.wantsOverload ? '⚠️ Wants lu terlalu tinggi nih, kurangin dikit!' : m.nature.mustOverload ? '⚠️ Fixed cost lu berat banget!' : '✅ Lumayan seimbang!');
        }
        // Weekday vs Weekend
        if (/weekday.?vs.?weekend|weekend.?vs.?weekday|boros.*week|lebih.?boros.?kapan/.test(t)) {
            return `Perbandingan belanja lu bro:<br><br>` +
                `📅 <b>Weekday (Sen-Jum)</b>: Rp ${f(m._wdAvg)}/hari (total Rp ${f(m._wdTotal)} / ${m._wdDays} hari)<br>` +
                `🎉 <b>Weekend (Sab-Min)</b>: Rp ${f(m._weAvg)}/hari (total Rp ${f(m._weTotal)} / ${m._weDays} hari)<br><br>` +
                `Status: <b>${m._wdWeStatus}</b> ${m._wdWeStatus === 'LEBIH BOROS WEEKEND' ? '😬 FOMO weekend detected!' : m._wdWeStatus === 'LEBIH BOROS WEEKDAY' ? '😅 Weekday lu padat banget.' : '✅ Cukup konsisten!'}`;
        }
        // Latte Factor
        if (/latte|pengeluaran.?receh|kebiasaan.?belanj/.test(t)) {
            if (m.latteCandidates.length === 0) return `Belum terdeteksi pengeluaran receh berulang signifikan bulan ini bro! 🎉 Pertahankan!`;
            const list = m.latteCandidates.map(k => `• <b>${k.label}</b>: ${k.count}x pembelian, total Rp ${f(k.total)}`).join('<br>');
            return `Latte Factor lu bulan ini (pengeluaran receh yang sering):<br><br>${list}<br><br>Kelihatan kecil tapi lumayan kan? Kurangin 50% aja udah hemat jutaan setahun! 💰`;
        }
        // Saldo akun
        if (/saldo.?akun|saldo.?gw|saldo.?saya|berapa.?saldo|semua.?akun/.test(t)) {
            if (!accounts || accounts.length === 0) return `Lu belum punya akun bro. Tambah dulu di Settings → Akun! 😊`;
            const list = accounts.map(a => {
                const tags = (a.purpose === 'emergency_fund' || a.is_excluded_from_budget) ? ' [Emergency Fund]' : '';
                return `• <b>${a.name}</b>: Rp ${f(a.balance || 0)} (${a.type || 'Cash'})${tags}`;
            }).join('<br>');
            return `Ini saldo semua akun lu bro:<br><br>${list}<br><br>💰 <b>Total semua: Rp ${f(m.totalBalance)}</b>`;
        }
        // Dana Darurat / Emergency Fund
        if (/dana.?darurat.*(gw|ku|saya|aku|sekarang|bulan|status|berapa|cukup|total)|emergency.?fund.*(status|total|berapa|ku|gw)|tabungan.?darurat.*(ku|gw|saya|berapa|status)/.test(t)) {
            const ef = m.aiEfScoreDict;
            const efAccounts = accounts.filter(a => a.purpose === 'emergency_fund' || a.is_excluded_from_budget);
            const avgExp = m.totalExp > 0 ? m.totalExp : 1000000;
            if (efAccounts.length === 0) {
                return `Dana darurat belum diset nih! 😬<br><br>` +
                    `Caranya: Settings → Akun → pilih akun tabungan darurat → set Purpose ke <b>Emergency Fund</b>.<br><br>` +
                    `Idealnya dana darurat = <b>3–6x pengeluaran bulanan</b> (Rp ${this.format(avgExp * 3)} – Rp ${this.format(avgExp * 6)}).`;
            }
            const efList = efAccounts.map(a => `• <b>${a.name}</b>: Rp ${this.format(a.balance || 0)}`).join('<br>');
            const statusEmoji = ef.months >= 6 ? '🏆 Aman banget!' : ef.months >= 3 ? '✅ Cukup aman!' : ef.months >= 1 ? '⚠️ Lumayan, tambahin lagi!' : '🚨 Belum cukup!';
            const targetGap = Math.max(0, Math.round(avgExp * 6 - ef.totalEmergency));
            return `Dana Darurat bulan ini:<br><br>${efList}<br><br>` +
                `💰 Total: <b>Rp ${this.format(ef.totalEmergency)}</b><br>` +
                `📅 Cukup untuk: <b>${ef.months} bulan</b> (berdasar pengeluaran Rp ${this.format(Math.round(avgExp))}/bln)<br>` +
                `Status: <b>${statusEmoji}</b><br><br>` +
                (targetGap > 0 ? `Butuh tambahan <b>Rp ${this.format(targetGap)}</b> lagi buat capai target 6 bulan.` : `🎉 Target 6 bulan tercapai! Solid banget!`);
        }
        // Budget pacing
        if (/budget.?pacing|pacing.?budget|pace.?budget|sisa.?budget|budget.?sisa/.test(t)) {
            return `Budget Pacing lu hari ke-<b>${m.daysPassed}</b> dari ${m.daysInMonth} hari:<br><br>` +
                `💸 Terpakai: <b>Rp ${f(m.totalExp)}</b> dari budget Rp ${f(m.budget)}<br>` +
                `📈 Pace: <b>${m.pacing.pacingPct}%</b> → <b>${m.pacingStatus}</b><br>` +
                `🔮 Proyeksi akhir bulan: <b>Rp ${f(Math.round(m.pacing.projectedMonthEnd))}</b><br>` +
                `✅ Sisa budget: <b>Rp ${f(m.remainingBudget)}</b><br><br>` +
                (m.pacingStatus === 'OVERSPEND' ? '🚨 Wah overbudget nih bro, rem gas lu!' : m.pacingStatus === 'SEDIKIT OVER' ? '⚠️ Sedikit over pace, hati-hati akhir bulan!' : '✅ On track! Tetap jaga ya bro.');
        }
        // General summary / laporan
        if (/laporan|ringkasan|summary|rekap|pemasukan|pengeluaran|total|surplus|defisit|saving.?rate/.test(t)) {
            const m2 = m;
            return `📊 <b>Ringkasan Keuangan ${monthName}:</b><br><br>` +
                `💚 Pemasukan: <b>Rp ${f(m2.totalInc)}</b><br>` +
                `🔴 Pengeluaran: <b>Rp ${f(m2.totalExp)}</b><br>` +
                `${m2.surplus >= 0 ? '💰 Surplus' : '📉 Defisit'}: <b>Rp ${f(Math.abs(m2.surplus))}</b><br>` +
                `📈 Saving Rate: <b>${m2.savingRateNum.toFixed(1)}%</b><br>` +
                `🎯 Budget: Rp ${f(m2.budget)} (sisa Rp ${f(m2.remainingBudget)})<br><br>` +
                (m2.topCats ? `Top kategori: ${m2.topCats}<br><br>` : '') +
                `Health Score: <b>${m2.healthScore}/100 (${m2.healthLabel})</b> | Tracking: ${m2.trackedDays}/${m2.daysPassed} hari`;
        }
        // Kategori terbesar
        if (/kategori.*(terbesar|terbanyak|paling)|paling.*(banyak|boros)/.test(t)) {
            if (!m.topCats) return `Belum ada data pengeluaran bulan ini bro!`;
            return `Top 5 kategori pengeluaran lu bulan ${monthName}:<br><br>` +
                Object.entries(m.catsExp).sort((a,b) => b[1]-a[1]).slice(0,5)
                    .map(([k,v], i) => `${i+1}. <b>${k}</b>: Rp ${f(v)}`).join('<br>') +
                `<br><br>Total pengeluaran: Rp ${f(m.totalExp)}`;
        }
        // Cara improve score
        if (/improve.?score|ningkatin.?score|cara.?naik.?score|score.?naik|tingkat.?skor|cara.?improve/.test(t)) {
            const tips = [];
            if (m.pSrScore < 20) tips.push(`💰 <b>Naikin Saving Rate</b> — sekarang ${m.savingRateNum.toFixed(1)}%, target minimal 20%. Sisihkan dulu sebelum belanja (pay yourself first).`);
            if (m.pEfScore < 20) tips.push(`🛡️ <b>Tambahin Dana Darurat</b> — sekarang ${m.aiEfScoreDict.months} bulan, target 3–6 bulan. Rutin transfer minimal Rp ${this.format(Math.round((m.totalExp || 1000000) * 0.1))}/bln ke akun darurat.`);
            if (m.pEffScore < 25) tips.push(`🛒 <b>Kurangi Wants</b> — komposisi wants lu ${m.nature.wantsPct}%, coba tekan ke bawah 30%. Identifikasi pengeluaran yang bisa dipotong dulu.`);
            if (m.pFixedScore < 20) tips.push(`⚙️ <b>Kurangi Fixed Cost</b> — fixed cost lu tinggi. Review langganan/cicilan, cancel yang jarang dipake.`);
            if (m.pTrScore < 15) tips.push(`📝 <b>Rajin Catat Transaksi</b> — tracking lu ${m.trackedDays}/${m.daysPassed} hari. Coba catat setiap hari biar score tracking naik ke 15/15.`);
            if (m.latteCandidates.length > 0) tips.push(`☕ <b>Potong Latte Factor</b> — ada <b>${m.latteCandidates[0].label}</b> ${m.latteCandidates[0].count}x (Rp ${this.format(m.latteCandidates[0].total)}). Kurangin 50% lumayan buat nabung!`);
            if (tips.length === 0) tips.push('🏆 Score lu udah bagus banget! Pertahankan konsistensi tracking dan saving rate ya bro!');
            return `🎯 <b>Cara Naik Health Score</b> (sekarang ${m.healthScore}/100 — ${m.healthLabel}):<br><br>` +
                tips.join('<br><br>') +
                `<br><br>Fokus 1–2 poin dulu ya, jangan semua sekaligus! 💪`;
        }
        // Tips hemat / cara hemat sisa bulan ini
        if (/tips.?hemat|cara.?hemat|hemat.?bulan|gimana.?hemat|bagaimana.?hemat|strategi.?hemat/.test(t)) {
            const daysLeft = m.daysInMonth - m.daysPassed;
            const dailyBudgetLeft = daysLeft > 0 ? Math.round(m.remainingBudget / daysLeft) : 0;
            const tips = [];
            // Context-aware tips based on actual data
            if (m.latteCandidates.length > 0) {
                const top = m.latteCandidates[0];
                tips.push(`☕ <b>Stop Latte Factor</b> — jajan '<b>${top.label}</b>' udah ${top.count}x (Rp ${this.format(top.total)}). Kurangin frekuensinya bisa hemat ratusan ribu!`);
            }
            if (m.nature.wantsPct > 30) tips.push(`🎉 <b>Tahan Wants</b> — ${m.nature.wantsPct}% pengeluaran lu masuk kategori Wants (keinginan). Sisa bulan ini, tahan dulu beli yang nggak urgent.`);
            if (m._weAvg > m._wdAvg * 1.3) tips.push(`📅 <b>Waspada Weekend</b> — rata-rata weekend lu Rp ${this.format(m._weAvg)}/hari vs weekday Rp ${this.format(m._wdAvg)}/hari. Rencanain budget weekend sebelum keluar rumah.`);
            const topWants = m._catsSorted ? m._catsSorted.slice(0, 3) : [];
            if (topWants.length > 0) tips.push(`🔍 <b>Review Kategori Terbesar</b> — ${topWants.map(c => `<b>${c.cat}</b> (Rp ${this.format(c.amt)})`).join(', ')}. Cek apakah ada yang bisa ditunda akhir bulan.`);
            tips.push(`📱 <b>Audit Langganan</b> — cek semua auto-debit & subscription. Cancel yang jarang kepake, lumayan bisa hemat puluhan–ratusan ribu.`);
            tips.push(`🍱 <b>Masak/Bawa Bekal</b> — kurangi makan di luar 2–3x seminggu bisa hemat signifikan di akhir bulan.`);
            const budgetMsg = m.remainingBudget > 0
                ? `Sisa budget: <b>Rp ${this.format(m.remainingBudget)}</b> untuk <b>${daysLeft} hari</b> lagi → budget harian ideal <b>Rp ${this.format(dailyBudgetLeft)}/hari</b>.`
                : `⚠️ Budget udah habis! Mode survival: keluarkan hanya untuk kebutuhan mutlak aja.`;
            return `💡 <b>Tips Hemat Sisa Bulan ${m.now.toLocaleString('id-ID', { month: 'long' })}:</b><br><br>` +
                `${budgetMsg}<br><br>` +
                tips.map((t, i) => `${i+1}. ${t}`).join('<br><br>');
        }
        return null;
    },

    // ── Compute compact summary for all available months ─────────────────────
    _computeMonthSummaries: function() {
        if (!allTransactions || allTransactions.length === 0) return [];
        // Collect all unique month keys from transactions
        const monthKeys = [...new Set(allTransactions.map(tx => (tx.dateStr || '').slice(0, 7)))]
            .filter(k => k.length === 7)
            .sort();
        const budget = currentProfile.monthlyBudget || DEFAULT_MONTHLY_BUDGET;

        return monthKeys.map(mk => {
            const txs = allTransactions.filter(tx => (tx.dateStr || '').startsWith(mk));
            const inc = txs.filter(t => t.type === 'Income').reduce((s, t) => s + t.amount, 0);
            const exp = txs.filter(t => t.type === 'Expense').reduce((s, t) => s + t.amount, 0);
            const surplus = inc - exp;
            const savingRate = inc > 0 ? ((inc - exp) / inc * 100) : 0;
            const trackedDays = new Set(txs.map(t => t.dateStr)).size;
            const topCat = Object.entries(
                txs.filter(t => t.type === 'Expense').reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + t.amount; return acc; }, {})
            ).sort((a, b) => b[1] - a[1])[0];

            // Simple health score estimate
            let score = 0;
            if (inc > 0) {
                const sr = savingRate;
                score += sr >= 20 ? 20 : sr >= 10 ? 12 : sr >= 0 ? 5 : 0;
                const expRatio = exp / (inc || 1);
                score += expRatio <= 0.5 ? 25 : expRatio <= 0.7 ? 15 : expRatio <= 0.9 ? 8 : 0;
                score += trackedDays >= 20 ? 15 : trackedDays >= 10 ? 8 : trackedDays >= 3 ? 4 : 0;
                score = Math.min(100, score + 20); // base points for having income
            }

            const [year, month] = mk.split('-');
            const monthName = new Date(parseInt(year), parseInt(month) - 1, 1)
                .toLocaleString('id-ID', { month: 'long', year: 'numeric' });

            return { mk, monthName, inc, exp, surplus, savingRate, score, trackedDays, topCat: topCat ? topCat[0] : null, topCatAmt: topCat ? topCat[1] : 0 };
        });
    },

    // ── Local transfer detection — no AI needed ──────────────────────────────
    _tryLocalTransfer: function(text) {
        const t = text.trim();
        // Pattern: "transfer [amount] dari [from] ke [to]"
        //          "transfer [amount] ke [to] dari [from]"
        //          "[amount] dari [from] ke [to]"  (with 'transfer' prefix optional)
        const patterns = [
            /(?:transfer\s+)?(?:rp\.?\s*)?(\d[\d.,]*(?:\s*(?:jt|rb|k))?)\s+(?:dari|from)\s+(.+?)\s+(?:ke|to)\s+(.+)/i,
            /(?:transfer\s+)?(?:rp\.?\s*)?(\d[\d.,]*(?:\s*(?:jt|rb|k))?)\s+(?:ke|to)\s+(.+?)\s+(?:dari|from)\s+(.+)/i,
            /^transfer\s+(?:ke\s+)?(.+?)\s+(?:rp\.?\s*)?(\d[\d.,]*(?:\s*(?:jt|rb|k))?)\s+(?:dari|from)\s+(.+)/i,
        ];

        let fromName = null, toName = null, rawAmt = null;

        const m1 = t.match(patterns[0]);
        if (m1) { rawAmt = m1[1]; fromName = m1[2].trim(); toName = m1[3].trim(); }

        if (!m1) {
            const m2 = t.match(patterns[1]);
            if (m2) { rawAmt = m2[1]; toName = m2[2].trim(); fromName = m2[3].trim(); }
        }

        // Plain "transfer ke [to]" without from — use session or first account as from
        if (!fromName && !toName) {
            const m3 = t.match(/^transfer\s+(?:ke\s+)?(.+?)\s+(?:rp\.?\s*)?(\d[\d.,]*(?:\s*(?:jt|rb|k))?)/i);
            if (m3) { toName = m3[1].trim(); rawAmt = m3[2]; }
            const m4 = t.match(/^transfer\s+(?:rp\.?\s*)?(\d[\d.,]*(?:\s*(?:jt|rb|k))?)\s+(?:ke\s+)?(.+)/i);
            if (!m3 && m4) { rawAmt = m4[1]; toName = m4[2].trim(); }
        }

        if (!rawAmt && !/^transfer\b/i.test(t)) return null;
        if (!rawAmt) return null;

        // Parse amount
        let amt = rawAmt.replace(/\brp\.?\s*/gi, '').trim();
        amt = amt.replace(/(\d+(?:[.,]\d+)?)\s*jt\b/gi, (_, n) => parseFloat(n.replace(',', '.')) * 1000000);
        amt = amt.replace(/(\d+(?:[.,]\d+)?)\s*rb\b/gi, (_, n) => parseFloat(n.replace(',', '.')) * 1000);
        amt = amt.replace(/(\d+)[kK]\b/g, (_, n) => parseInt(n) * 1000);
        const amount = parseFloat(String(amt).replace(/\./g, '').replace(',', '.')) || 0;
        if (amount <= 0) return null;

        const fromAcc = fromName ? this.fuzzyFindAccount(fromName) : (accounts.find(a => a.id === sessionAccountId) || accounts[0]);
        const toAcc   = toName   ? this.fuzzyFindAccount(toName)   : null;

        // Must resolve at least toAccount
        if (!toAcc && !toName) return null;

        const today = new Date();
        return {
            date: today,
            dateKey: this.toLocalDateString(today),
            type: 'Transfer',
            amount,
            note: `Transfer${toName ? ' ke ' + (toAcc?.name || toName) : ''}`,
            fromAccountId: fromAcc?.id || accounts[0]?.id || null,
            toAccountId:   toAcc?.id   || null,
            fromAccountName: fromAcc?.name || fromName || accounts[0]?.name || '',
            toAccountName:   toAcc?.name   || toName   || '',
        };
    },

    getGeminiModelCandidates: async function(apiKey) {
        // Preferred static list — all v1beta, trimmed to known-working models
        const staticList = [
            { version: 'v1beta', name: 'models/gemini-3.1-flash-lite-preview' },
            { version: 'v1beta', name: 'models/gemini-2.5-flash-preview-04-17' },
            { version: 'v1beta', name: 'models/gemini-2.5-flash' },
            { version: 'v1beta', name: 'models/gemini-2.5-flash-lite-preview-06-17' },
            { version: 'v1beta', name: 'models/gemini-2.0-flash' },
            { version: 'v1beta', name: 'models/gemini-2.0-flash-lite' },
            { version: 'v1beta', name: 'models/gemini-1.5-flash' },
        ];
        try {
            // Dynamically fetch available models so we never hit a "not found" error
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
            if (!res.ok) return staticList;
            const json = await res.json();
            const available = new Set((json.models || [])
                .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
                .map(m => m.name));
            // Return static list filtered to only those actually available, preserving preference order
            const filtered = staticList.filter(m => available.has(m.name));
            return filtered.length > 0 ? filtered : staticList;
        } catch(e) {
            return staticList;
        }
    },

    extractGeminiText: function(payload) {
        const parts = payload?.candidates?.[0]?.content?.parts || [];
        return parts.map(part => part.text || '').join('').trim();
    },

    parseGeminiJson: function(rawText) {
        if (!rawText) return null;
        let cleaned = rawText.trim();
        if (cleaned.includes('```')) {
            cleaned = cleaned.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, '$1').trim();
        }

        try {
            return JSON.parse(cleaned);
        } catch (error) {
            // Try to extract first valid JSON object
            const firstBrace = cleaned.indexOf('{');
            const lastBrace = cleaned.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                try {
                    return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
                } catch(e2) { /* fall through */ }
            }
            // Try to extract first JSON array
            const firstBracket = cleaned.indexOf('[');
            const lastBracket = cleaned.lastIndexOf(']');
            if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
                try {
                    const arr = JSON.parse(cleaned.slice(firstBracket, lastBracket + 1));
                    return { isTransaction: true, isQuestion: false, askAccount: false, sessionAccountHint: null, data: arr };
                } catch(e3) { /* fall through */ }
            }
            throw error;
        }
    },

    askGemini: async function(promptText, apiKey, aiMode = false) {
        // Minimal context — laporan/report questions are answered locally (no token cost)
        // AI is only used for: transaction recording, transfers, financial advisor tips
        const now = new Date();
        const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const todayLocal = this.toLocalDateString(now);
        const prevLocal = this.toLocalDateString(prevDate);

        // Only send the last 5 transactions for minimal spending context
        const last5 = allTransactions.slice(0,5).map(t => `${t.dateStr}: ${t.type==='Expense'?'-':'+'}Rp${t.amount} (${t.note||t.category})`).join(' | ');
        const budget = currentProfile.monthlyBudget || DEFAULT_MONTHLY_BUDGET;

        // Compact monthly summaries (only sent in AI mode, ~60 chars/month)
        const monthlySummaryStr = aiMode ? (() => {
            const sums = this._computeMonthSummaries();
            if (sums.length === 0) return 'Belum ada data';
            return sums.slice(-12).map(s =>
                `${s.mk}: Inc=${s.inc} Exp=${s.exp} SR=${s.savingRate.toFixed(0)}% Score=${s.score} TopCat=${s.topCat||'-'}`
            ).join(' | ');
        })() : null;

        const sysPrompt = `Nama kamu adalah "Asa", financial bestie ala Gen-Z Jakarta untuk aplikasi Dirhamku.
Karakter: Asik, pakai bahasa lu/gw/bro/ngab, jujur, pujian alay kalo user jago nabung, sarcasm tipis kalo boros.

BATASAN: Kamu HANYA merespons soal:
1. Mencatat transaksi baru (Expense/Income/Transfer)
2. Tips finansial umum (nabung, investasi, alokasi gaji, budgeting)${aiMode ? `
3. Laporan & statistik keuangan — jawab langsung dengan data konteks yang tersedia` : `
Jika user nanya laporan/statistik keuangan (health score, DNA, nature, saldo, dsb) → balas: {"isTransaction":false,"isQuestion":true,"askAccount":false,"sessionAccountHint":null,"data":[],"response":"Cek di tab Report ya bro, atau tanya ulang dengan kata yang lebih spesifik! 😊"}`}
Jika di luar keuangan → tolak halus.

KONTEKS PERCAKAPAN: Kamu punya memori chat. Gunakan konteks pesan sebelumnya jika relevan.

Kamu menjawab TIGA jenis input:
1. TRANSAKSI BARU: catat Expense atau Income
2. TRANSFER ANTAR AKUN: type Transfer dengan fromAccount + toAccount
3. TIPS FINANSIAL: saran umum tentang keuangan

INFO MINIMAL USER:
Budget Bulanan: Rp ${this.format(budget)}
5 Transaksi Terakhir: ${last5 || 'belum ada'}
Daftar Kategori Valid: ${customCategories.map(c => c.name).join(', ')}
Daftar Akun: ${accounts.map(a => a.name).join(', ') || 'tidak ada akun'}
Akun Aktif Sesi: ${sessionAccountId ? (accounts.find(a => a.id === sessionAccountId)?.name || 'Belum diset') : 'BELUM DISET'}
Tanggal Hari Ini: ${todayLocal}${aiMode && monthlySummaryStr ? `
Ringkasan Bulanan (format: YYYY-MM: Inc=pemasukan Exp=pengeluaran SR=saving_rate% Score=skor TopCat=kategori_terbesar):
${monthlySummaryStr}` : ''}

ATURAN AKUN:
- Jika user sebut nama akun → set sessionAccountHint, askAccount: false
- Jika akun sesi BELUM DISET & user tidak sebut akun → askAccount: true
- Jika akun sesi sudah diset → pakai itu, askAccount: false
- Transfer: type "Transfer" dengan fromAccount & toAccount

PENTING: User bisa input BANYAK transaksi sekaligus, ekstrak semua ke array 'data'.

CONTOH:
User: "grab 30rb, indomie 10k kmarin"
Response: {"isTransaction":true,"isQuestion":false,"askAccount":false,"sessionAccountHint":null,"data":[{"amount":30000,"category":"Transport","note":"grab","type":"Expense","date":"${todayLocal}","accountHint":null},{"amount":10000,"category":"Food","note":"indomie","type":"Expense","date":"${prevLocal}","accountHint":null}]}

User: "30000 bakso" (akun BELUM DISET)
Response: {"isTransaction":true,"isQuestion":false,"askAccount":true,"sessionAccountHint":null,"data":[{"amount":30000,"category":"Food","note":"bakso","type":"Expense","date":"${todayLocal}","accountHint":null}]}

User: "transfer 1.8jt dari main ke jago"
Response: {"isTransaction":true,"isQuestion":false,"askAccount":false,"sessionAccountHint":null,"data":[{"amount":1800000,"type":"Transfer","fromAccount":"main","toAccount":"jago","note":"transfer","date":"${todayLocal}"}]}

User: "cara nabung 10 juta setahun?"
Response: {"isTransaction":false,"isQuestion":true,"askAccount":false,"sessionAccountHint":null,"data":[],"response":"Target 10 juta setahun = Rp 833.000/bulan bro! Tips: <b>Pay Yourself First</b> — transfer ke tabungan pas gajian, jangan tunggu sisa. Buka rekening terpisah tanpa kartu debet biar gak kegoda! 💪"}

Output STRICTLY JSON murni (tanpa markdown block). Format:
{"isTransaction":boolean,"isQuestion":boolean,"askAccount":boolean,"sessionAccountHint":string|null,"data":[{"amount":number,"type":"Expense"|"Income"|"Transfer","category":string,"note":string,"date":"YYYY-MM-DD","accountHint":string|null,"fromAccount":string|null,"toAccount":string|null}],"response":string}`;

        const modelCandidates = await this.getGeminiModelCandidates(apiKey);
        let lastError = null;

        for (const model of modelCandidates) {
            try {
                // v1beta supports systemInstruction + responseMimeType; v1 does not
                const supportsAdvanced = model.version === 'v1beta';
                // Build multi-turn contents with chat memory
                const historyContents = chatMemory.slice(-20); // Max 10 pairs (20 entries)
                const currentUserMsg = { role: "user", parts: [{ text: promptText }] };
                const allContents = [...historyContents, currentUserMsg];

                const requestBody = supportsAdvanced
                    ? {
                        systemInstruction: { parts: [{ text: sysPrompt }] },
                        contents: allContents,
                        generationConfig: { responseMimeType: "application/json", temperature: 0.4 }
                    }
                    : {
                        contents: [{ parts: [{ text: `${sysPrompt}\n\nUser: ${promptText}` }] }],
                        generationConfig: { temperature: 0.4 }
                    };
                const response = await fetch(`https://generativelanguage.googleapis.com/${model.version}/${model.name}:generateContent?key=${apiKey.trim()}`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(requestBody)
                });

                if (!response.ok) {
                    const err = await response.json();
                    const msg = err.error?.message || "";
                    if (response.status === 404 || response.status === 503 || msg.toLowerCase().includes('high demand') || msg.toLowerCase().includes('overloaded') || msg.toLowerCase().includes('not found')) {
                        console.warn(`Model ${model.name} unavailable/busy (Status: ${response.status}), falling back...`);
                        lastError = new Error(msg);
                        continue;
                    }
                    // 429 quota/rate-limit: throw immediately with full message for friendly UI
                    if (response.status === 429 || /quota|resource_exhausted/i.test(msg)) {
                        throw new Error(msg || "Quota exceeded");
                    }
                    throw new Error(msg || "Timeout API");
                }

                const json = await response.json();
                if (!json.candidates || !json.candidates[0]) throw new Error("AI tidak memberikan jawaban");
                const aiText = this.extractGeminiText(json);
                return this.parseGeminiJson(aiText);
            } catch (e) {
                lastError = e;
                if (e.message.toLowerCase().includes('high demand') || e.message.toLowerCase().includes('overloaded') || e.message.toLowerCase().includes('not found')) continue;
                if (e.message.toLowerCase().includes('unexpected token')) continue;
                throw e;
            }
        }
        throw lastError || new Error("Semua model AI sedang sibuk.");
    },

    submitForm: async function() {
        // If in recurring mode, redirect to saveRecurringTransaction
        if (this._recurringMode) {
            return this.saveRecurringTransaction();
        }
        const type = this._formType || 'Expense';
        const amount = parseFloat(document.getElementById('formAmount').value);
        if(!amount || amount <= 0) return this.toast('Nominal tidak valid', true);
        const dateStr = document.getElementById('formDate').value;
        const timeStr = document.getElementById('formTime')?.value || '12:00';
        const dateTimeStr = `${dateStr}T${timeStr}:00`;
        const dateObj = new Date(dateTimeStr);

        let tx = {
            date: firebase.firestore.Timestamp.fromDate(dateObj),
            dateKey: dateStr,
            dateStr: dateStr,
            type: type, amount, createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if(type === 'Transfer') {
            tx.fromAccountId = document.getElementById('formFromAccount').value;
            tx.toAccountId = document.getElementById('formToAccount').value;
            if(tx.fromAccountId === tx.toAccountId) return this.toast('Pilih akun berbeda', true);
        } else {
            tx.accountId = document.getElementById('formAccount').value;
            tx.category = document.getElementById('formCategory').value;
            tx.note = document.getElementById('formNote').value;
            if (type === 'Expense') {
                const inclInBudget = document.getElementById('formExcludeBudget')?.checked !== false;
                tx.exclude_from_budget = !inclInBudget;
            }
        }

        try {
            if (this._editModeTxId) {
                // Update existing transaction
                const updateData = { ...tx };
                if (type === 'Transfer') {
                    updateData.accountId = firebase.firestore.FieldValue.delete();
                    updateData.category = firebase.firestore.FieldValue.delete();
                    updateData.note = firebase.firestore.FieldValue.delete();
                } else {
                    updateData.fromAccountId = firebase.firestore.FieldValue.delete();
                    updateData.toAccountId = firebase.firestore.FieldValue.delete();
                }
                const txRef = db.collection('users').doc(currentUser.uid).collection('transactions').doc(this._editModeTxId);
                await txRef.update(updateData);
                this.toast('Transaksi diperbarui ✓');
            } else {
                // Add new transaction
                await db.collection('users').doc(currentUser.uid).collection('transactions').add(tx);
                SFX.coin();
                this.toast('Transaksi disimpan ✓');
            }
            this.closeFormMode();
            this.loadData();
            this.revokeNoSpendIfNeeded();
        } catch(e) { this.toast(e.message, true); }
    },

    // ─── Recurring Transactions ──────────────────────────────────────────────
    openAddRecurringSheet: function() {
        // Close the recurring list sheet first
        this.closeRecurringSheet();
        
        // Set recurring mode flag
        this._recurringMode = true;
        this._editModeTxId = null;
        
        // Switch to input tab and show the form
        this.switchTab('input');
        const chatMode = document.getElementById('inputChatMode');
        const formMode = document.getElementById('inputFormMode');
        if (chatMode) { chatMode.classList.add('hidden'); chatMode.classList.remove('flex'); }
        if (formMode) { formMode.classList.remove('hidden'); formMode.classList.add('flex'); }
        
        // Force Expense type
        this.setFormType('Expense');
        
        // Reset calculator
        this._calcDisplay = '0';
        this._calcPendingOp = null;
        this._calcPendingVal = null;
        this._calcJustEvaled = false;
        this._updateCalcDisplay();
        document.getElementById('formNote').value = '';
        
        // Hide date/time pills (not relevant for recurring template)
        const datePills = document.querySelector('#inputFormMode .flex.gap-2.justify-center');
        if (datePills) datePills.style.display = 'none';
        
        // Hide type switcher (only Expense for recurring)
        const typeSwitcher = document.querySelector('#inputFormMode .flex.bg-gray-100.rounded-2xl');
        if (typeSwitcher) typeSwitcher.style.display = 'none';
        
        // Show recurring fields
        const recFields = document.getElementById('formRecurringFields');
        if (recFields) recFields.style.display = 'block';
        
        // Hide budget toggle
        const budgetToggleRow = document.getElementById('formBudgetToggleRow');
        if (budgetToggleRow) budgetToggleRow.style.display = 'none';
        
        // Set default start date to today
        document.getElementById('formRecStartDate').value = this.toLocalDateString(new Date());
        document.getElementById('formRecEndDate').value = '';
        document.getElementById('formRecFrequency').value = 'monthly';
    },

    closeAddRecurringSheet: function() {
        this.closeFormMode();
    },

    saveRecurringTransaction: async function() {
        if(!currentUser) return;
        const amount = parseFloat(document.getElementById('formAmount').value);
        const category = document.getElementById('formCategory').value;
        const accountId = document.getElementById('formAccount').value;
        const frequency = document.getElementById('formRecFrequency').value;
        const startDateStr = document.getElementById('formRecStartDate').value;
        const endDateStr = document.getElementById('formRecEndDate').value;
        const note = document.getElementById('formNote').value;

        if (!amount || amount <= 0) return this.toast('Nominal tidak valid', true);
        if (!category) return this.toast('Pilih kategori dulu', true);
        if (!accountId) return this.toast('Pilih akun dulu', true);
        if (!startDateStr) return this.toast('Pilih start date', true);

        const payload = {
            amount, category, accountId, frequency, note,
            startDate: startDateStr,
            endDate: endDateStr || null,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            if (this._editModeTxId) {
                await db.collection('users').doc(currentUser.uid).collection('recurring_transactions').doc(this._editModeTxId).update(payload);
                this.toast('Recurring diupdate ✓');
            } else {
                payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                await db.collection('users').doc(currentUser.uid).collection('recurring_transactions').add(payload);
                this.toast('Recurring ditambahkan ✓');
            }
            this.closeFormMode();
            this.loadSubscriptionCard();
        } catch(e) { this.toast(e.message, true); }
    },

    /**
     * Check if a recurring transaction has been paid in the current billing period.
     * Uses lastPaidDate from the Firestore doc — reliable regardless of allTransactions cache.
     */
    isPaidForPeriod: function(frequency, lastPaidDate, todayStr) {
        if (!lastPaidDate) return false;
        if (frequency === 'monthly') {
            return lastPaidDate.substring(0, 7) === todayStr.substring(0, 7);
        } else if (frequency === 'weekly') {
            const msDay = 1000 * 60 * 60 * 24;
            const diff = Math.floor((new Date(todayStr) - new Date(lastPaidDate)) / msDay);
            return diff >= 0 && diff < 7;
        } else if (frequency === 'yearly') {
            return lastPaidDate.substring(0, 4) === todayStr.substring(0, 4);
        } else if (frequency === 'daily') {
            return lastPaidDate === todayStr;
        }
        return false;
    },

    /**
     * Compute the correct next due date based on lastPaidDate.
     * Preserves the original day-of-month from startDate.
     * E.g. lastPaidDate=2026-05-02, startDate=2026-10-01 (corrupted) → returns 2026-06-01
     */
    computeCorrectNextDue: function(frequency, lastPaidDate, startDate) {
        if (!lastPaidDate) return startDate;
        const pad = n => String(n).padStart(2, '0');
        const paid = new Date(lastPaidDate);
        // Original day-of-month from startDate (even if corrupted, day is still correct)
        const originalDay = startDate ? parseInt(startDate.split('-')[2], 10) : paid.getDate();
        if (frequency === 'monthly') {
            let y = paid.getFullYear(), m = paid.getMonth() + 2; // +1 for 0-index, +1 for next month
            if (m > 12) { m = 1; y++; }
            // Clamp day to max days in target month
            const maxDay = new Date(y, m, 0).getDate();
            const day = Math.min(originalDay, maxDay);
            return `${y}-${pad(m)}-${pad(day)}`;
        } else if (frequency === 'weekly') {
            const d = new Date(lastPaidDate);
            d.setDate(d.getDate() + 7);
            return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
        } else if (frequency === 'yearly') {
            const y = paid.getFullYear() + 1;
            const origMonth = startDate ? parseInt(startDate.split('-')[1], 10) : paid.getMonth() + 1;
            const maxDay = new Date(y, origMonth, 0).getDate();
            const day = Math.min(originalDay, maxDay);
            return `${y}-${pad(origMonth)}-${pad(day)}`;
        } else if (frequency === 'daily') {
            const d = new Date(lastPaidDate);
            d.setDate(d.getDate() + 1);
            return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
        }
        return startDate;
    },

    loadRecurringTransactions: async function() {
        if(!currentUser) return;
        const listEl = document.getElementById('recurringListContent');
        if(!listEl) return;
        
        try {
            const snapshot = await db.collection('users').doc(currentUser.uid).collection('recurring_transactions').orderBy('createdAt', 'desc').get();
            this._recurringCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            this.renderToday();
            if (snapshot.empty) {
                listEl.innerHTML = `
                    <div class="flex flex-col items-center justify-center text-center mt-20 opacity-60">
                        <i class="ph-fill ph-ghost text-6xl text-gray-300 mb-4"></i>
                        <h3 class="font-bold text-gray-400 font-heading">Belum ada recurring transactions nih</h3>
                        <p class="text-xs text-gray-400 mt-2">Daftarin langganan atau cicilan lo di sini<br>biar nggak lupa bestie ✨</p>
                    </div>`;
                return;
            }

            // Build a map of most-recent payment transaction per recurringId (used for undo txId lookup)
            const todayStr = this.toLocalDateString(new Date());
            const paidTxMap = {};
            allTransactions.forEach(tx => {
                if (tx.recurringId) {
                    const existing = paidTxMap[tx.recurringId];
                    if (!existing || tx.dateStr > existing.dateStr) {
                        paidTxMap[tx.recurringId] = { id: tx.id || tx._id, dateStr: tx.dateStr };
                    }
                }
            });

            let html = '';
            snapshot.forEach(doc => {
                const data = doc.data();
                const def = this.getCategoryDef(data.category);

                // PRIMARY: use lastPaidDate field on the recurring doc (always reliable)
                //   - set by payRecurring, cleared by undoPayRecurring
                let isPaid = this.isPaidForPeriod(data.frequency, data.lastPaidDate, todayStr);

                // FALLBACK: legacy data without lastPaidDate — check allTransactions cache
                if (!isPaid && !data.lastPaidDate) {
                    const prevDueDate = this.revertDate(data.startDate, data.frequency);
                    const lastPaidTx = paidTxMap[doc.id];
                    isPaid = !!(
                        data.startDate > todayStr &&
                        lastPaidTx && prevDueDate &&
                        lastPaidTx.dateStr >= prevDueDate
                    );
                }

                // paidTxId for undo button (from allTransactions map)
                const lastPaidTxFallback = paidTxMap[doc.id];
                const paidTxId = lastPaidTxFallback ? lastPaidTxFallback.id : '';

                // Compute correct next-due date.
                // If isPaid, derive it from lastPaidDate (avoids showing corrupted startDate from multi-clicks).
                // If the stored startDate is wrong, silently repair it in Firestore.
                let correctNextDue = data.startDate;
                if (isPaid && data.lastPaidDate) {
                    correctNextDue = this.computeCorrectNextDue(data.frequency, data.lastPaidDate, data.startDate);
                    if (correctNextDue !== data.startDate) {
                        // Auto-repair: startDate was advanced too many times, reset to correct value
                        db.collection('users').doc(currentUser.uid).collection('recurring_transactions').doc(doc.id).update({
                            startDate: correctNextDue,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        }).catch(() => {});
                    }
                }

                // Human-readable frequency & next-due label
                const freqLabel = { monthly: 'Bulanan', weekly: 'Mingguan', yearly: 'Tahunan', daily: 'Harian' }[data.frequency] || data.frequency;
                const nextDueLabel = correctNextDue ? `Bayar berikutnya: ${correctNextDue}` : '';

                html += `
                <div class="bg-white rounded-2xl p-4 shadow-sm border ${isPaid ? 'border-success/30 bg-success/5' : 'border-gray-100'} flex items-center justify-between gap-3">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style="background:${def.color}15;color:${def.color}">
                        <i class="ph-fill ${def.icon} text-lg"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-bold text-primary truncate">${data.note || data.category}</p>
                        <p class="text-[10px] mt-0.5 truncate uppercase tracking-widest font-bold ${isPaid ? 'text-success' : 'text-amber-500'}">${freqLabel}${isPaid ? ' • LUNAS ✓' : ` • ${nextDueLabel}`}</p>
                    </div>
                    <div class="flex flex-col items-end shrink-0 gap-1.5">
                        <span class="text-sm font-bold text-danger">-Rp ${this.format(data.amount)}</span>
                        <div class="flex gap-2">${isPaid ? `
                            <button onclick="app.undoPayRecurring('${paidTxId}', '${doc.id}')" class="w-7 h-7 flex items-center justify-center bg-blue-500/10 text-blue-500 rounded-lg active:scale-95 transition" title="Undo Pembayaran"><i class="ph-bold ph-arrow-counter-clockwise"></i></button>` : `
                            <button onclick="app.payRecurring('${doc.id}', ${data.amount}, '${(data.category||'').replace(/'/g,"\\'")}', '${(data.accountId||'').replace(/'/g,"\\'")}', '${(data.note||'').replace(/'/g,"\\'")}', '${data.frequency}', '${data.startDate}')" class="w-7 h-7 flex items-center justify-center bg-success/10 text-success rounded-lg active:scale-95 transition" title="Bayar"><i class="ph-bold ph-check"></i></button>
                            <button onclick="app.skipRecurring('${doc.id}', '${data.frequency}', '${data.startDate}')" class="w-7 h-7 flex items-center justify-center bg-amber-500/10 text-amber-500 rounded-lg active:scale-95 transition" title="Lewati"><i class="ph-bold ph-fast-forward"></i></button>`}
                            <button onclick="app.editRecurring('${doc.id}', ${data.amount}, '${(data.category||'').replace(/'/g,"\\'")}', '${(data.accountId||'').replace(/'/g,"\\'")}', '${(data.note||'').replace(/'/g,"\\'")}', '${data.frequency}', '${data.startDate}', '${data.endDate||''}')" class="w-7 h-7 flex items-center justify-center bg-gray-100 text-gray-500 rounded-lg active:scale-95 transition" title="Edit"><i class="ph-bold ph-pencil-simple"></i></button>
                            <button onclick="app.deleteRecurring('${doc.id}')" class="w-7 h-7 flex items-center justify-center bg-danger/10 text-danger rounded-lg active:scale-95 transition" title="Hapus"><i class="ph-bold ph-trash"></i></button>
                        </div>
                    </div>
                </div>`;
            });
            listEl.innerHTML = html;
        } catch(e) { console.error('Error loading recurring:', e); }
    },

    openRecurringConfirm: function(title, desc, iconClass, iconColorClass, btnColorClass, onConfirm) {
        document.getElementById('rcModalTitle').textContent = title;
        document.getElementById('rcModalDesc').textContent = desc;
        
        const wrapper = document.getElementById('rcModalIconWrapper');
        wrapper.className = `w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 ${iconColorClass}`;
        
        const icon = document.getElementById('rcModalIcon');
        icon.className = `ph-bold ${iconClass} text-2xl`;
        
        const btn = document.getElementById('rcModalConfirmBtn');
        btn.className = `flex-1 py-3 rounded-2xl text-white text-sm font-bold active:scale-95 transition ${btnColorClass}`;
        
        btn.onclick = () => {
            app.closeRecurringConfirm();
            onConfirm();
        };
        
        const modal = document.getElementById('recurringConfirmModal');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    },

    closeRecurringConfirm: function() {
        const modal = document.getElementById('recurringConfirmModal');
        modal.classList.remove('flex');
        modal.classList.add('hidden');
    },

    editRecurring: function(id, amount, category, accountId, note, frequency, startDate, endDate) {
        this.openAddRecurringSheet();
        this._editModeTxId = id;
        this._calcDisplay = amount.toString();
        this._updateCalcDisplay();
        
        document.getElementById('formCategory').value = category;
        document.getElementById('formAccount').value = accountId;
        document.getElementById('formNote').value = note || '';
        document.getElementById('formRecFrequency').value = frequency;
        document.getElementById('formRecStartDate').value = startDate;
        document.getElementById('formRecEndDate').value = endDate || '';
        
        this._formCategory = category;
        const catBtn = document.getElementById('formCategoryBtn');
        const catDef = customCategories.find(c => c.name === category);
        if (catBtn && catDef) {
            catBtn.innerHTML = `<div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style="background:${catDef.color}20;color:${catDef.color}"><i class="ph-fill ${catDef.icon} text-lg"></i></div><div class="flex-1 text-left truncate"><p class="text-[10px] uppercase font-bold text-gray-400">Kategori</p><p class="text-sm font-bold text-primary truncate leading-tight">${catDef.name}</p></div>`;
        }
        
        this._formAccount = accountId;
        const accBtn = document.getElementById('formAccountBtn');
        const accDef = accounts.find(a => a.id === accountId);
        if (accBtn && accDef) {
            accBtn.innerHTML = `<div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style="background:${accDef.color}20;color:${accDef.color}"><i class="ph-fill ${accDef.icon} text-lg"></i></div><div class="flex-1 text-left truncate"><p class="text-[10px] uppercase font-bold text-gray-400">Akun</p><p class="text-sm font-bold text-primary truncate leading-tight">${accDef.name}</p></div>`;
        }
    },

    deleteRecurring: function(id) {
        this.openRecurringConfirm(
            'Hapus Recurring?',
            'Data transaksi rutin ini akan dihapus secara permanen.',
            'ph-trash',
            'bg-danger/10 text-danger',
            'bg-danger',
            async () => {
                try {
                    await db.collection('users').doc(currentUser.uid).collection('recurring_transactions').doc(id).delete();
                    this.toast('Dihapus');
                    this.loadRecurringTransactions();
                } catch(e) { this.toast(e.message, true); }
            }
        );
    },

    advanceDate: function(dateStr, frequency) {
        if (!dateStr) return null;
        const d = new Date(dateStr);
        if (frequency === 'monthly') d.setMonth(d.getMonth() + 1);
        else if (frequency === 'weekly') d.setDate(d.getDate() + 7);
        else if (frequency === 'yearly') d.setFullYear(d.getFullYear() + 1);
        else if (frequency === 'daily') d.setDate(d.getDate() + 1);
        const pad = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    },

    revertDate: function(dateStr, frequency) {
        if (!dateStr) return null;
        const d = new Date(dateStr);
        if (frequency === 'monthly') d.setMonth(d.getMonth() - 1);
        else if (frequency === 'weekly') d.setDate(d.getDate() - 7);
        else if (frequency === 'yearly') d.setFullYear(d.getFullYear() - 1);
        else if (frequency === 'daily') d.setDate(d.getDate() - 1);
        const pad = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    },

    skipRecurring: function(id, frequency, startDate) {
        this.openRecurringConfirm(
            'Skip Tagihan?',
            'Tagihan ini akan dilompati ke siklus berikutnya.',
            'ph-fast-forward',
            'bg-amber-500/10 text-amber-500',
            'bg-amber-500',
            async () => {
                const nextDate = this.advanceDate(startDate, frequency);
                if (!nextDate) return;
                try {
                    await db.collection('users').doc(currentUser.uid).collection('recurring_transactions').doc(id).update({
                        startDate: nextDate,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    this.toast('Tagihan di-skip ✓');
                    this.loadRecurringTransactions();
                } catch(e) { this.toast(e.message, true); }
            }
        );
    },

    undoPayRecurring: function(txId, recurringId) {
        this.openRecurringConfirm(
            'Batalkan Pembayaran?',
            'Transaksi yang sudah tercatat akan dihapus dan tagihan dikembalikan ke siklus sebelumnya.',
            'ph-arrow-counter-clockwise',
            'bg-blue-500/10 text-blue-500',
            'bg-blue-500',
            async () => {
                try {
                    // Delete the payment transaction
                    if (txId) {
                        await db.collection('users').doc(currentUser.uid).collection('transactions').doc(txId).delete();
                    }
                    // Roll back startDate and clear lastPaidDate on the recurring document
                    if (recurringId) {
                        const recDoc = await db.collection('users').doc(currentUser.uid).collection('recurring_transactions').doc(recurringId).get();
                        if (recDoc.exists) {
                            const recData = recDoc.data();
                            // Roll back startDate by one cycle (reverse of advanceDate)
                            const prevDate = this.revertDate(recData.startDate, recData.frequency);
                            const updateData = { lastPaidDate: firebase.firestore.FieldValue.delete(), updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
                            if (prevDate) updateData.startDate = prevDate;
                            await db.collection('users').doc(currentUser.uid).collection('recurring_transactions').doc(recurringId).update(updateData);
                        }
                    }
                    this.toast('Pembayaran dibatalkan');
                    await this.loadData();
                    this.loadRecurringTransactions();
                } catch(e) { this.toast(e.message, true); }
            }
        );
    },

    payRecurring: function(id, amount, category, accountId, note, frequency, startDate) {
        this.openRecurringConfirm(
            'Bayar Tagihan?',
            `Catat transaksi Rp ${this.format(amount)} untuk ${note||category} hari ini?`,
            'ph-check',
            'bg-success/10 text-success',
            'bg-success',
            async () => {
                const now = new Date();
                const dateStr = this.toLocalDateString(now);
                const tx = {
                    type: 'Expense', amount, category, accountId,
                    note: note || category,
                    date: firebase.firestore.Timestamp.fromDate(now),
                    dateKey: dateStr,
                    dateStr: dateStr,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    recurringId: id
                };

                const catDef = customCategories.find(c => c.name === category);
                if (catDef && catDef.exclude_from_budget) tx.exclude_from_budget = true;

                try {
                    await db.collection('users').doc(currentUser.uid).collection('transactions').add(tx);
                    
                    // Advance next cycle: always compute from today's period to avoid double-advancing
                    // e.g. if startDate was somehow ahead, still produce the correct "next" cycle
                    const correctNext = this.computeCorrectNextDue(frequency, dateStr, startDate);
                    if (correctNext) {
                        await db.collection('users').doc(currentUser.uid).collection('recurring_transactions').doc(id).update({
                            startDate: correctNext,
                            lastPaidDate: dateStr,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    }
                    
                    this.toast('Pembayaran tercatat! ✓');
                    await this.loadData();
                    this.loadRecurringTransactions();
                    this.loadSubscriptionCard();
                    this.revokeNoSpendIfNeeded();
                } catch(e) { this.toast(e.message, true); }
            }
        );
    },

    loadSubscriptionCard: async function() {
        if(!currentUser) return;
        const card = document.getElementById('cardSubscriptions');
        if(!card) return;
        
        try {
            const snapshot = await db.collection('users').doc(currentUser.uid).collection('recurring_transactions').get();
            this._recurringCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            this.renderToday();
            if (snapshot.empty) {
                card.classList.add('hidden');
                return;
            }
            
            let totalMonthly = 0;
            const items = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                let monthlyAmount = data.amount;
                if (data.frequency === 'weekly') monthlyAmount *= 4;
                else if (data.frequency === 'yearly') monthlyAmount /= 12;
                else if (data.frequency === 'daily') monthlyAmount *= 30;
                totalMonthly += monthlyAmount;
                items.push({ name: data.note || data.category, amount: data.amount, category: data.category, frequency: data.frequency, nextDue: data.startDate, lastPaidDate: data.lastPaidDate || null });
            });
            
            card.classList.remove('hidden');
            
            // Count & total
            document.getElementById('subsCount').textContent = `${items.length} langganan`;
            document.getElementById('subsTotalBadge').textContent = `Rp ${this.format(Math.round(totalMonthly))}/bln`;
            
            const todayStr = this.toLocalDateString(new Date());
            const preview = document.getElementById('subsListPreview');
            const top3 = items.sort((a, b) => b.amount - a.amount).slice(0, 3);
            preview.innerHTML = top3.map(item => {
                const def = this.getCategoryDef(item.category);
                const paid = this.isPaidForPeriod(item.frequency, item.lastPaidDate, todayStr);
                const nextDueLabel = item.nextDue ? `Bayar: ${item.nextDue}` : '';
                return `<div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2 min-w-0">
                        <div class="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style="background:${def.color}15;color:${def.color}"><i class="ph-fill ${def.icon} text-[10px]"></i></div>
                        <div class="min-w-0">
                            <p class="text-xs font-bold text-primary truncate">${item.name}</p>
                            <p class="text-[9px] font-bold ${paid ? 'text-success' : 'text-amber-500'} truncate">${paid ? 'LUNAS ✓' : nextDueLabel}</p>
                        </div>
                    </div>
                    <span class="text-xs font-bold text-gray-400 shrink-0">Rp ${this.format(item.amount)}</span>
                </div>`;
            }).join('');
            
            // Opportunity cost insight
            const yearlyTotal = Math.round(totalMonthly * 12);
            const dailyCoffee = Math.round(totalMonthly / 30);
            
            let opportunityCost = '';
            if (yearlyTotal >= 5000000) {
                opportunityCost = `setara ${Math.floor(yearlyTotal / 5000000)} tiket pesawat PP dalam negeri ✈️`;
            } else if (yearlyTotal >= 2000000) {
                opportunityCost = `setara ${Math.floor(yearlyTotal / 200000)} kali makan sushi all-you-can-eat 🍣`;
            } else if (yearlyTotal >= 500000) {
                opportunityCost = `setara investasi reksadana yang bisa jadi Rp ${this.format(Math.round(yearlyTotal * 1.08))} dalam setahun 📈`;
            } else {
                opportunityCost = `setara ${Math.floor(yearlyTotal / 25000)} cup kopi ☕`;
            }
            
            document.getElementById('subsInsight').innerHTML = `💸 Spend subscription kamu <b>Rp ${this.format(Math.round(totalMonthly))}/bulan</b> (Rp ${this.format(yearlyTotal)}/tahun) — ${opportunityCost}. Coba pertimbangkan lagi, ada nggak langganan yang bisa di-cut?`;
            
        } catch(e) { console.error('Error loading subscription card:', e); }
    },

    // ── STATISTICS UTILITIES ──────────────────────────────────────
    calcMedian: function(arr) {
        if (!arr || arr.length === 0) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    },

    // Returns array of transaction objects that are outliers by IQR method
    calcIQROutliers: function(txs) {
        if (!txs || txs.length < 4) return [];
        const amounts = txs.map(t => t.amount).sort((a, b) => a - b);
        const q1 = this.calcMedian(amounts.slice(0, Math.floor(amounts.length / 2)));
        const q3 = this.calcMedian(amounts.slice(Math.ceil(amounts.length / 2)));
        const iqr = q3 - q1;
        if (iqr === 0) return [];
        const upperFence = q3 + 1.5 * iqr;
        return txs.filter(t => t.amount > upperFence);
    },
    // ─────────────────────────────────────────────────────────────────

    format: function(num) {
        const normalized = Number(num || 0);
        const sign = normalized < 0 ? '-' : '';
        const abs = Math.abs(Math.round(normalized));
        return `${sign}${abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
    },

    toast: function(msg, err=false) {
        const el = document.getElementById('toast');
        document.getElementById('toastMsg').innerText = msg;
        el.className = `absolute top-4 left-1/2 transform -translate-x-1/2 px-5 py-2.5 rounded-full shadow-2xl z-[100] text-xs font-bold transition-all duration-300 flex items-center gap-2 whitespace-nowrap border ${err ? 'bg-danger/90 border-danger' : 'bg-primary border-white/10'}`;
        el.classList.remove('-translate-y-10', 'opacity-0');
        setTimeout(() => el.classList.add('-translate-y-10', 'opacity-0'), 3000);
    },

    // ============================================================
    // VOCABULARY SETTINGS FUNCTIONS
    // ============================================================

    toggleVocabularySection: function(sectionId) {
        const content = document.getElementById(sectionId + 'Content');
        const arrow = document.getElementById(sectionId + 'Arrow');
        if (!content) return;

        if (content.classList.contains('hidden')) {
            content.classList.remove('hidden');
            if (arrow) arrow.style.transform = 'rotate(90deg)';
        } else {
            content.classList.add('hidden');
            if (arrow) arrow.style.transform = '';
        }
    },

    renderVocabularySheet: function() {
        // Expense keywords
        const expenseList = document.getElementById('expenseKeywordsList');
        const expenseCount = document.getElementById('expenseKeywordsCount');
        if (expenseList) {
            expenseList.innerHTML = '';
            DEFAULT_EXPENSE_KEYWORDS.forEach(kw => {
                expenseList.innerHTML += `<span class="px-3 py-1.5 bg-gray-100 rounded-full text-xs text-gray-600">${kw}</span>`;
            });
            (userCustomVocabulary.expense || []).forEach(kw => {
                expenseList.innerHTML += `<span class="px-3 py-1.5 bg-amber-100 rounded-full text-xs text-amber-700 flex items-center gap-1">${kw}<button onclick="app.removeCustomKeyword('expense', '${kw}')" class="hover:text-amber-900">×</button></span>`;
            });
        }
        if (expenseCount) {
            expenseCount.textContent = (DEFAULT_EXPENSE_KEYWORDS.length + (userCustomVocabulary.expense?.length || 0)) + ' kata';
        }

        // Income keywords
        const incomeList = document.getElementById('incomeKeywordsList');
        const incomeCount = document.getElementById('incomeKeywordsCount');
        if (incomeList) {
            incomeList.innerHTML = '';
            DEFAULT_INCOME_KEYWORDS.forEach(kw => {
                incomeList.innerHTML += `<span class="px-3 py-1.5 bg-gray-100 rounded-full text-xs text-gray-600">${kw}</span>`;
            });
            (userCustomVocabulary.income || []).forEach(kw => {
                incomeList.innerHTML += `<span class="px-3 py-1.5 bg-green-100 rounded-full text-xs text-green-700 flex items-center gap-1">${kw}<button onclick="app.removeCustomKeyword('income', '${kw}')" class="hover:text-green-900">×</button></span>`;
            });
        }
        if (incomeCount) {
            incomeCount.textContent = (DEFAULT_INCOME_KEYWORDS.length + (userCustomVocabulary.income?.length || 0)) + ' kata';
        }

        // Category keywords
        const categoryList = document.getElementById('categoryKeywordsList');
        const categoryCount = document.getElementById('categoryKeywordsCount');
        if (categoryList) {
            let htmlStr = '';
            const grouped = {};
            for (const [kw, cat] of Object.entries(DEFAULT_CATEGORY_MAP)) {
                if (!grouped[cat]) grouped[cat] = [];
                grouped[cat].push(kw);
            }
            for (const [cat, kws] of Object.entries(grouped)) {
                htmlStr += `<div class="bg-gray-50 rounded-xl p-3"><p class="text-[10px] font-bold text-gray-500 uppercase mb-2">${cat}</p><div class="flex flex-wrap gap-1">`;
                kws.forEach(kw => {
                    htmlStr += `<span class="px-2 py-1 bg-white rounded-lg text-xs text-gray-600 border border-gray-200">${kw}</span>`;
                });
                htmlStr += '</div></div>';
            }
            // Custom category keywords
            const groupedCustom = {};
            for (const [kw, cat] of Object.entries(userCustomVocabulary.categories || {})) {
                if (!groupedCustom[cat]) groupedCustom[cat] = [];
                groupedCustom[cat].push(kw);
            }
            for (const [cat, kws] of Object.entries(groupedCustom)) {
                htmlStr += `<div class="bg-amber-50 rounded-xl p-3"><p class="text-[10px] font-bold text-amber-600 uppercase mb-2">${cat} (kustom)</p><div class="flex flex-wrap gap-1">`;
                kws.forEach(kw => {
                    htmlStr += `<span class="px-2 py-1 bg-amber-100 rounded-lg text-xs text-amber-700 border border-amber-200 flex items-center gap-1">${kw}<button onclick="app.removeCustomCategoryKeyword('${kw}')" class="hover:text-amber-900">×</button></span>`;
                });
                htmlStr += '</div></div>';
            }
            categoryList.innerHTML = htmlStr;
        }
        if (categoryCount) {
            const customCatCount = Object.keys(userCustomVocabulary.categories || {}).length;
            categoryCount.textContent = (Object.keys(DEFAULT_CATEGORY_MAP).length + customCatCount) + ' kata';
        }

        // Standard categories — use user's actual customCategories (includes user-added ones)
        const stdCatList = document.getElementById('standardCategoriesList');
        const stdCatCount = document.getElementById('standardCategoriesCount');
        const activeCats = (customCategories && customCategories.length > 0) ? customCategories : DEFAULT_CATEGORIES;
        if (stdCatList) {
            stdCatList.innerHTML = '';
            activeCats.forEach(cat => {
                const icon = cat.icon || 'ph-tag';
                const color = cat.color || '#6B7280';
                const badge = cat.type === 'Income' ? `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-600 ml-auto">Pemasukan</span>` : '';
                stdCatList.innerHTML += `<div class="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                    <span class="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style="background:${color}22"><i class="ph-fill ${icon} text-sm" style="color:${color}"></i></span>
                    <span class="text-sm font-semibold text-primary flex-1">${cat.name}</span>
                    ${badge}
                </div>`;
            });
        }
        if (stdCatCount) {
            stdCatCount.textContent = activeCats.length;
        }

        // Category select dropdown — use user's actual categories
        const catSelect = document.getElementById('addCategorySelect');
        if (catSelect) {
            const dropdownCats = (customCategories && customCategories.length > 0) ? customCategories : DEFAULT_CATEGORIES;
            catSelect.innerHTML = dropdownCats
                .filter(c => c.type === 'Expense' || !c.type)
                .map(c => `<option value="${c.name}">${c.name}</option>`).join('');
        }
    },

    addCustomKeyword: function(type) {
        const input = document.getElementById(type === 'expense' ? 'addExpenseKeywordInput' : 'addIncomeKeywordInput');
        if (!input) return;
        const rawKw = input.value.trim().toLowerCase();
        if (!rawKw) return;

        const defaultList = type === 'expense' ? DEFAULT_EXPENSE_KEYWORDS : DEFAULT_INCOME_KEYWORDS;
        const keywords = rawKw.split(',').map(k => k.trim()).filter(k => k);

        let addedCount = 0;
        let duplicateCount = 0;

        if (type === 'expense') {
            if (!userCustomVocabulary.expense) userCustomVocabulary.expense = [];
            keywords.forEach(kw => {
                if (defaultList.includes(kw)) {
                    duplicateCount++;
                } else if (!userCustomVocabulary.expense.includes(kw)) {
                    userCustomVocabulary.expense.push(kw);
                    addedCount++;
                }
            });
        } else {
            if (!userCustomVocabulary.income) userCustomVocabulary.income = [];
            keywords.forEach(kw => {
                if (defaultList.includes(kw)) {
                    duplicateCount++;
                } else if (!userCustomVocabulary.income.includes(kw)) {
                    userCustomVocabulary.income.push(kw);
                    addedCount++;
                }
            });
        }

        input.value = '';
        this.renderVocabularySheet();

        // Feedback & save
        if (duplicateCount > 0 && addedCount === 0) {
            this.toast(`${duplicateCount} kata sudah ada di default`, true);
        } else if (addedCount > 0) {
            if (duplicateCount > 0) {
                this.toast(`${addedCount} kata ditambahkan, ${duplicateCount} kata duplikat dilewati`);
            } else {
                this.toast(`${addedCount} kata ditambahkan`);
            }
            saveUserVocabulary();
            mergeVocabulary();
        }
    },

    removeCustomKeyword: function(type, kw) {
        if (type === 'expense') {
            userCustomVocabulary.expense = (userCustomVocabulary.expense || []).filter(k => k !== kw);
        } else {
            userCustomVocabulary.income = (userCustomVocabulary.income || []).filter(k => k !== kw);
        }
        this.renderVocabularySheet();
        saveUserVocabulary();
        mergeVocabulary();
    },

    addCustomCategoryKeyword: function() {
        const input = document.getElementById('addCategoryKeywordInput');
        const select = document.getElementById('addCategorySelect');
        if (!input || !select) return;
        const rawKw = input.value.trim().toLowerCase();
        const cat = select.value;
        if (!rawKw || !cat) return;

        if (!userCustomVocabulary.categories) userCustomVocabulary.categories = {};

        const keywords = rawKw.split(',').map(k => k.trim()).filter(k => k);
        let addedCount = 0;
        let duplicateCount = 0;

        keywords.forEach(kw => {
            if (DEFAULT_CATEGORY_MAP[kw]) {
                duplicateCount++;
            } else if (!userCustomVocabulary.categories[kw]) {
                userCustomVocabulary.categories[kw] = cat;
                addedCount++;
            }
        });

        input.value = '';
        this.renderVocabularySheet();

        // Feedback & save
        if (duplicateCount > 0 && addedCount === 0) {
            this.toast(`${duplicateCount} kata sudah ada di default`, true);
        } else if (addedCount > 0) {
            if (duplicateCount > 0) {
                this.toast(`${addedCount} kata ditambahkan, ${duplicateCount} kata duplikat dilewati`);
            } else {
                this.toast(`${addedCount} kata ditambahkan`);
            }
            saveUserVocabulary();
            mergeVocabulary();
        }
    },

    removeCustomCategoryKeyword: function(kw) {
        if (userCustomVocabulary.categories) {
            delete userCustomVocabulary.categories[kw];
        }
        this.renderVocabularySheet();
        saveUserVocabulary();
        mergeVocabulary();
    },

    saveVocabularyChanges: async function() {
        if (!currentUser) return;
        try {
            await saveUserVocabulary();
            mergeVocabulary();
            this.toast('Kosakata berhasil disimpan!');
        } catch (e) {
            console.error(e);
            this.toast('Gagal menyimpan kosakata', true);
        }
    },

    // ============================================================
    // COMMANDS SETTINGS FUNCTIONS
    // ============================================================

    renderCommandsSheet: function() {
        const list = document.getElementById('commandsList');
        if (!list) return;

        list.innerHTML = '';
        const commandDefs = [
            { id: 'cek_saldo',       name: 'Cek Saldo',            desc: 'Lihat saldo semua akun',                    icon: 'ph-wallet',           color: 'blue',   badge: 'Instan' },
            { id: 'ringkasan',       name: 'Ringkasan Keuangan',    desc: 'Rekap & laporan bulan ini',                 icon: 'ph-chart-bar',        color: 'indigo', badge: 'Instan' },
            { id: 'health_score',    name: 'Skor Finansial',        desc: 'Financial health score & cara meningkatkan',icon: 'ph-heartbeat',        color: 'teal',   badge: 'Instan' },
            { id: 'spending_dna',    name: 'Spending DNA',          desc: 'Tipe pola belanja berdasarkan data',        icon: 'ph-dna',              color: 'pink',   badge: 'Instan' },
            { id: 'spending_nature', name: 'Spending Nature',       desc: 'Komposisi Needs / Wants / Must',            icon: 'ph-scales',           color: 'purple', badge: 'Instan' },
            { id: 'weekday_weekend', name: 'Weekday vs Weekend',    desc: 'Bandingkan pola belanja hari kerja & libur', icon: 'ph-calendar-dots',   color: 'cyan',   badge: 'Instan' },
            { id: 'latte_factor',    name: 'Latte Factor',          desc: 'Deteksi pengeluaran kecil yang sering berulang', icon: 'ph-coffee',    color: 'amber',  badge: 'Instan' },
            { id: 'dana_darurat',    name: 'Dana Darurat',          desc: 'Cek status & kecukupan emergency fund',     icon: 'ph-shield-check',     color: 'green',  badge: 'Instan' },
            { id: 'budget_pacing',   name: 'Budget Pacing',         desc: 'Sisa budget & pace pengeluaran bulan ini',  icon: 'ph-gauge',            color: 'orange', badge: 'Instan' },
            { id: 'kategori',        name: 'Top Kategori',          desc: 'Kategori pengeluaran terbesar bulan ini',   icon: 'ph-chart-pie',        color: 'rose',   badge: 'Instan' },
            { id: 'tips_hemat',      name: 'Tips Hemat',            desc: 'Saran berhemat berdasarkan data transaksi',  icon: 'ph-lightbulb',       color: 'yellow', badge: 'Instan' },
            { id: 'transfer',        name: 'Transfer',              desc: 'Transfer saldo antar akun',                 icon: 'ph-arrows-left-right',color: 'green',  badge: '' },
            { id: 'help',            name: 'Bantuan / Panduan',     desc: 'Tampilkan panduan lengkap penggunaan chat',  icon: 'ph-question',        color: 'purple', badge: '' },
            { id: 'tanya',           name: 'Tanya AI',              desc: 'Bertanya tips & saran ke AI Asa',           icon: 'ph-robot',            color: 'violet', badge: 'AI' },
        ];

        commandDefs.forEach(cmd => {
            const defaults = DEFAULT_COMMANDS[cmd.id] || [];
            const custom = userCustomCommands[cmd.id] || [];

            list.innerHTML += `
                <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="w-10 h-10 rounded-xl bg-${cmd.color}-100 flex items-center justify-center shrink-0">
                            <i class="ph-fill ${cmd.icon} text-${cmd.color}-500 text-lg"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2">
                                <p class="text-sm font-bold text-primary">${cmd.name}</p>
                                ${cmd.badge ? `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full ${cmd.badge === 'AI' ? 'bg-violet-100 text-violet-600' : cmd.badge === 'Instan' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}">${cmd.badge}</span>` : ''}
                            </div>
                            <p class="text-[10px] text-gray-400 mt-0.5 leading-tight">${cmd.desc}</p>
                        </div>
                    </div>
                    <div class="bg-gray-50 rounded-xl p-3 mb-3">
                        <p class="text-[10px] font-bold text-gray-400 uppercase mb-2">KATA KUNCI BAWAAN</p>
                        <div class="flex flex-wrap gap-1">
                            ${defaults.map(kw => `<span class="px-2 py-1 bg-white rounded-lg text-xs text-gray-600 border border-gray-200 font-mono">${kw}</span>`).join('')}
                        </div>
                    </div>
                    <div class="bg-amber-50 rounded-xl p-3 mb-3">
                        <p class="text-[10px] font-bold text-amber-600 uppercase mb-2 flex justify-between">
                            <span>KATA KUNCI KUSTOM</span>
                            <span>${custom.length}/3</span>
                        </p>
                        <div id="customKeywords_${cmd.id}" class="flex flex-wrap gap-1 mb-2">
                            ${custom.map(kw => `<span class="px-2 py-1 bg-amber-100 rounded-lg text-xs text-amber-700 flex items-center gap-1">${kw}<button onclick="app.removeCustomCommandKeyword('${cmd.id}', '${kw}')" class="hover:text-amber-900 font-bold">×</button></span>`).join('')}
                            ${custom.length === 0 ? '<span class="text-xs text-amber-400 italic">Belum ada kata kunci kustom</span>' : ''}
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <input type="text" id="addCmdKw_${cmd.id}" placeholder="Tambah kata kunci..." class="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-amber-400 transition">
                        <button onclick="app.addCustomCommandKeyword('${cmd.id}')" class="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center active:scale-95 transition ${custom.length >= 3 ? 'opacity-50 cursor-not-allowed' : ''}" ${custom.length >= 3 ? 'disabled' : ''}><i class="ph-bold ph-plus text-sm"></i></button>
                    </div>
                </div>
            `;
        });
    },

    addCustomCommandKeyword: function(cmdId) {
        const input = document.getElementById('addCmdKw_' + cmdId);
        if (!input) return;
        const kw = input.value.trim().toLowerCase();
        if (!kw) return;

        // Check duplicate against DEFAULT_COMMANDS
        const defaultKeywords = DEFAULT_COMMANDS[cmdId] || [];
        if (defaultKeywords.includes(kw)) {
            this.toast('Kata sudah ada di default', true);
            return;
        }

        if (!userCustomCommands[cmdId]) userCustomCommands[cmdId] = [];
        if (userCustomCommands[cmdId].length >= 3) {
            this.toast('Maksimal 3 kata per perintah', true);
            return;
        }
        if (!userCustomCommands[cmdId].includes(kw)) {
            userCustomCommands[cmdId].push(kw);
        }
        input.value = '';
        this.renderCommandsSheet();
        saveUserVocabulary();
    },

    removeCustomCommandKeyword: function(cmdId, kw) {
        if (userCustomCommands[cmdId]) {
            userCustomCommands[cmdId] = userCustomCommands[cmdId].filter(k => k !== kw);
        }
        this.renderCommandsSheet();
        saveUserVocabulary();
    },

    saveCommandChanges: async function() {
        if (!currentUser) return;
        try {
            saveUserVocabulary();
            this.toast('Perintah kustom berhasil disimpan!');
        } catch (e) {
            console.error(e);
            this.toast('Gagal menyimpan perintah', true);
        }
    },

    // ============================================================
    // IMPORT/EXPORT VOCABULARY
    // ============================================================

    exportVocabulary: function() {
        const data = {
            version: 1,
            exportedAt: new Date().toISOString(),
            customVocabulary: userCustomVocabulary,
            customCommands: userCustomCommands
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dirhamku-vocabulary-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.toast('Vocabulary berhasil di-export!');
    },

    triggerVocabularyImport: function() {
        document.getElementById('vocabularyImportInput').click();
    },

    handleVocabularyImport: async function(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (!data.customVocabulary && !data.customCommands) {
                this.toast('Format file tidak valid', true);
                return;
            }

            // Merge with existing
            if (data.customVocabulary) {
                userCustomVocabulary.expense = [...new Set([...(userCustomVocabulary.expense || []), ...(data.customVocabulary.expense || [])])];
                userCustomVocabulary.income = [...new Set([...(userCustomVocabulary.income || []), ...(data.customVocabulary.income || [])])];
                userCustomVocabulary.categories = { ...(userCustomVocabulary.categories || {}), ...(data.customVocabulary.categories || {}) };
            }
            if (data.customCommands) {
                for (const [cmdId, kws] of Object.entries(data.customCommands)) {
                    if (!userCustomCommands[cmdId]) userCustomCommands[cmdId] = [];
                    userCustomCommands[cmdId] = [...new Set([...userCustomCommands[cmdId], ...(kws || [])])];
                }
            }

            mergeVocabulary();
            this.renderVocabularySheet();
            this.renderCommandsSheet();
            this.toast('Vocabulary berhasil di-import!');
        } catch (e) {
            console.error(e);
            this.toast('Gagal import vocabulary', true);
        }
        event.target.value = '';
    },

    // Open language sheet with proper initialization
    openLanguageSheet: function() {
        this.renderVocabularySheet();
        this.renderCommandsSheet();
        this.openSettingsSheet('settingsLanguageSheet');
    }
};

// Event delegation for dynamic chat elements
document.addEventListener('click', function(e) {
    // Wallet/account selection buttons in chat
    const accBtn = e.target.closest('[data-account-btn]');
    if (accBtn && accBtn.dataset.accountId) {
        e.preventDefault();
        e.stopPropagation();
        app.setChatSessionAccount(accBtn.dataset.accountId);
        return;
    }

    // Prompt chips in chat
    const chipBtn = e.target.closest('.prompt-chip');
    if (chipBtn) {
        e.preventDefault();
        e.stopPropagation();
        const chipText = chipBtn.textContent.trim().replace(/^→/, '').trim();
        if (chipText && window.app) {
            window.app._usedChips = window.app._usedChips || new Set();
            window.app._usedChips.add(chipText);
            const chipRow = chipBtn.closest('.flex.flex-wrap');
            if (chipRow) chipRow.remove();
            const input = document.getElementById('chatInput');
            if (input) { input.value = chipText; input.focus(); }
            window.app.submitChat();
        }
        return;
    }
}, true); // Use capture phase to ensure it fires first

document.getElementById('chatInput')?.addEventListener('keydown', e => { if(e.key === 'Enter') app.submitChat(); });
// Day Mode: shrink the budget hero while typing so the chat keeps room above the keyboard
document.getElementById('chatInput')?.addEventListener('focus', () => {
    if (app._isTodayActive()) document.getElementById('todayHero')?.classList.add('is-compact');
});
document.getElementById('chatInput')?.addEventListener('blur', () => {
    setTimeout(() => document.getElementById('todayHero')?.classList.remove('is-compact'), 150);
});

app.init();

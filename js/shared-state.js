/**
 * shared-state.js
 * Central Data Hub for ICHA SIM Rumah Sakit
 * Uses localStorage to simulate a database for prototype integration.
 */

const DB_KEYS = {
    PATIENTS: 'icha_patients',
    QUEUES: 'icha_queues',
    TRANSACTIONS: 'icha_transactions',
    STATS: 'icha_stats',
    BEDS: 'icha_beds'
};

// Initial Data
const INITIAL_DATA = {
    [DB_KEYS.PATIENTS]: [
        { id: '009001461', name: 'Rumiah Ny', age: '64th', poli: 'Jantung', penjamin: 'Umum', status: 'Selesai', date: '2026-06-09', tipe_daftar: 'Loket' },
        { id: '009002317', name: 'Ahmad Fauzi', age: '45th', poli: 'P. Dalam', penjamin: 'BPJS', status: 'Menunggu', date: '2026-06-09', tipe_daftar: 'Loket' },
        { id: '009003882', name: 'Siti Rahayu', age: '32th', poli: 'Kandungan', penjamin: 'BPJS', status: 'Proses', date: '2026-06-09', tipe_daftar: 'Loket' }
    ],
    [DB_KEYS.QUEUES]: {
        'qa1': { current: 'A-47', type: 'Umum', status: 'Dilayani' },
        'qa2': { current: 'B-23', type: 'BPJS', status: 'Dilayani' },
        'qa3': { current: 'C-11', type: 'JKN', status: 'Dilayani' },
        'far': { current: 'F-38', status: 'Dilayani' },
        'kasir': { current: 'K-15', status: 'Dilayani' }
    },
    [DB_KEYS.STATS]: {
        rawatJalan: 127,
        rawatInap: 84,
        ugd: 18,
        pendapatan: 89400000,
        mandiriCount: 15
    },
    [DB_KEYS.BEDS]: {
        tersedia: 38,
        terpakai: 84,
        reservasi: 6
    }
};

const SharedState = {
    init() {
        Object.keys(INITIAL_DATA).forEach(key => {
            if (!localStorage.getItem(key)) {
                localStorage.setItem(key, JSON.stringify(INITIAL_DATA[key]));
            }
        });
    },

    getData(key) {
        return JSON.parse(localStorage.getItem(key)) || [];
    },

    saveData(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
        // Trigger custom event for real-time updates on the same page
        window.dispatchEvent(new CustomEvent('stateUpdated', { detail: { key, data } }));
    },

    // Patients
    getPatients() { return this.getData(DB_KEYS.PATIENTS); },
    addPatient(patient) {
        const patients = this.getPatients();
        patients.unshift(patient); // Add to beginning
        this.saveData(DB_KEYS.PATIENTS, patients);
        
        // Update stats
        const stats = this.getStats();
        if (patient.tipe_daftar === 'Mandiri') {
            stats.mandiriCount = (stats.mandiriCount || 0) + 1;
        } else {
            stats.rawatJalan++;
        }
        this.saveStats(stats);
    },

    // Queues
    getQueues() { return this.getData(DB_KEYS.QUEUES); },
    updateQueue(id, data) {
        const queues = this.getQueues();
        queues[id] = { ...queues[id], ...data };
        this.saveData(DB_KEYS.QUEUES, queues);
    },

    // Stats
    getStats() { return this.getData(DB_KEYS.STATS); },
    saveStats(stats) { this.saveData(DB_KEYS.STATS, stats); },

    // Listen for updates (for cross-tab integration)
    onUpdate(callback) {
        window.addEventListener('storage', (e) => {
            if (Object.values(DB_KEYS).includes(e.key)) {
                callback(e.key, JSON.parse(e.newValue));
            }
        });
        window.addEventListener('stateUpdated', (e) => {
            callback(e.detail.key, e.detail.data);
        });
    },

    // Export & Import
    exportData() {
        const data = {};
        Object.values(DB_KEYS).forEach(key => {
            data[key] = this.getData(key);
        });
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `icha_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    importData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    // Validate keys
                    const keys = Object.values(DB_KEYS);
                    Object.keys(data).forEach(key => {
                        if (keys.includes(key)) {
                            localStorage.setItem(key, JSON.stringify(data[key]));
                        }
                    });
                    // Trigger refresh
                    window.dispatchEvent(new CustomEvent('stateUpdated', { detail: { key: 'all', data } }));
                    resolve(true);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }
};

// Initialize on load
SharedState.init();

/**
 * shared-state.js
 * Central Data Hub for MediCore SIM Rumah Sakit
 * Integrated with Supabase
 */

// Ganti dengan konfigurasi dari Supabase Project Settings
const SUPABASE_URL = 'https://yuwklxzigergofrrerwi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1d2tseHppZ2VyZ29mcnJlcndpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1MTk0MjMsImV4cCI6MjA5NzA5NTQyM30.BU5oW4tDLzdFuprc77R4qLBbWfL8wIx2HIa2-s81EZY';
// Load Supabase Client — simpan di window biar accessible dari script lain
window.__sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const SharedState = {
    cache: {
        patients: [],
        poli: [],
        doctors: [],
        queues: {
            qa1: { current: 'A-00' },
            qa2: { current: 'B-00' },
            qa3: { current: 'C-00' },
            far: { current: 'F-00' },
            kasir: { current: 'K-00' }
        }
    },
    updateCallbacks: [],

    async init() {
        console.log('🔄 Syncing with Supabase...');
        try {
            // Fetch initial data
            await this.fetchData();
            
            // Subscribe to realtime updates
            window.__sb
                .channel('registrations')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, payload => {
                    console.log('🔄 Realtime Update:', payload);
                    this.fetchData();
                    this.notify();
                })
                .subscribe();

            console.log('✅ Sync Complete');
        } catch (err) {
            console.error('❌ Supabase Sync Error:', err);
        }
    },

    async fetchData() {
        const [pRes, poliRes, docRes, regRes] = await Promise.all([
            window.__sb.from('patients').select('*'),
            window.__sb.from('poli').select('*'),
            window.__sb.from('doctors').select('*, poli(nama_poli)'),
            window.__sb.from('registrations').select('*').eq('status', 'calling')
        ]);
        
        this.cache.patients = pRes.data || [];
        this.cache.poli = poliRes.data || [];
        this.cache.doctors = docRes.data || [];
        
        // Build dokterByPoli & jadwalByPoli maps
        this.cache.dokterByPoli = {};
        this.cache.jadwalByPoli = {};
        (this.cache.doctors || []).forEach(d => {
            if (d.poli_id) {
                if (!this.cache.dokterByPoli[d.poli_id]) this.cache.dokterByPoli[d.poli_id] = [];
                this.cache.dokterByPoli[d.poli_id].push(d.nama_dokter);
                this.cache.jadwalByPoli[d.poli_id] = d.jadwal_praktik;
            }
        });
        
        // Map regs to queues
        if (regRes.data) {
            regRes.data.forEach(r => {
                if (this.cache.queues[r.loket_id]) {
                    this.cache.queues[r.loket_id].current = r.no_antrian;
                }
            });
        }
    },

    // --- GETTERS ---
    getPoli() { return this.cache.poli; },
    getDoctorsByPoli(poliId) { 
        return this.cache.doctors.filter(d => d.poli_id === poliId); 
    },
    getPatients() { return this.cache.patients; },
    getQueues() { return this.cache.queues; },
    
    async findPatient(tipe, val) {
        let query = window.__sb.from('patients').select('*');
        if (tipe === 'NIK') query = query.eq('nik', val);
        else if (tipe === 'No. RM') query = query.eq('no_rm', val);
        
        const { data, error } = await query.maybeSingle(); 
        if (error) {
            console.error('Supabase Error:', error);
            return null;
        }
        return data;
    },
    
    async getDashboardData() {
        try {
            const [regRes, bedRes] = await Promise.all([
                window.__sb.from('registrations').select('*, patients(no_rm, nama), poli(nama_poli)'),
                window.__sb.from('beds').select('*')
            ]);

            const regs = regRes.data || [];
            const beds = bedRes.data || [];

            return {
                stats: {
                    rawatJalan: regs.filter(r => r.poli_id && r.status !== 'Selesai' && r.status !== 'Opname').length,
                    rawatInap: regs.filter(r => r.status === 'Opname').length,
                    ugd: regs.filter(r => r.poli_id === null && r.status !== 'Selesai' && r.status !== 'Opname' && r.status !== 'calling').length,
                    income: regs.length * 150000,
                    beds: {
                        tersedia: beds.filter(b => b.status === 'Tersedia').length,
                        terpakai: beds.filter(b => b.status === 'Terpakai').length,
                        reservasi: beds.filter(b => b.status === 'Reservasi').length
                    }
                },
                beds: beds.map(b => ({
                    status: b.status.toLowerCase(),
                    nomor: b.nomor,
                    kelas: b.kelas
                })),
                latestPatients: regs.slice(-5).reverse().map(r => ({
                    no_rm: r.patients?.no_rm || '---',
                    nama: r.patients?.nama || 'Unknown',
                    poli: r.poli?.nama_poli || 'Umum',
                    penjamin: r.penjamin || 'Umum',
                    status: r.status || 'Menunggu'
                })),
                queues: this.cache.queues
            };
        } catch (err) {
            console.error(err);
            return null;
        }
    },
    
    onUpdate(cb) { this.updateCallbacks.push(cb); },
    notify() { this.updateCallbacks.forEach(cb => cb()); },
    
    getDokterByPoli(poliId) {
        const docs = this.cache.dokterByPoli && this.cache.dokterByPoli[poliId];
        return docs ? docs.join(', ') : null;
    },
    getJadwalByPoli(poliId) {
        return this.cache.jadwalByPoli && this.cache.jadwalByPoli[poliId] || null;
    }
};

// Ready promise — resolves after init completes
SharedState._ready = SharedState.init().then(() => {
    SharedState._isReady = true;
}).catch(err => {
    console.error('❌ Init failed:', err);
});

// Helper to wait until ready
SharedState.waitReady = async function() {
    if (this._isReady) return;
    await this._ready;
};

// Global Helper untuk Antrian (perbaikan error nextQ)
window.nextQ = function(queueId, prefix, currentNum) {
    console.log('Memproses antrian:', queueId, prefix, currentNum);
    alert('Fungsi Antrian: Memproses antrian ' + queueId + ' nomor ' + prefix + (currentNum + 1));
    // Integrasikan ke Supabase nanti di sini
};

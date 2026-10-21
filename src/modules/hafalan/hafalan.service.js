const db = require('../../config/database');
const {
  toGlobal,
  fromGlobal,
  isValidAyat,
  nextPosition,
  surahName,
  getJuzFromAyat,
  getJuzListForRange,
  getJuzGlobalRange,
} = require('../../utils/quran.util');

const NILAI_AYAT = ['LANCAR', 'TIDAK_LANCAR', 'BELUM_DINILAI'];
const JENIS_POSISI = ['ziyadah', 'murojaah'];
const KOREKSI_WINDOW_HOURS = Number(process.env.KOREKSI_WINDOW_HOURS || 24);

const httpError = (message, statusCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

// created_at dari SQLite berupa 'YYYY-MM-DD HH:MM:SS' (UTC) tanpa zona; Postgres mengembalikan Date.
const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(str) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(str)) {
    return new Date(str.replace(' ', 'T') + 'Z');
  }
  return new Date(str);
};

const statusFromGrade = (grade) => {
  const n = Number(grade);
  if (grade === null || grade === undefined || grade === '' || Number.isNaN(n)) return grade;
  if (n >= 80) return 'lulus';
  if (n >= 65) return 'belum_lancar';
  return 'mengulang';
};

const isDuplicateError = (err) =>
  err &&
  (err.code === '23505' || // PostgreSQL
    err.code === 'ER_DUP_ENTRY' || // MySQL
    (err.code === 'SQLITE_CONSTRAINT' && /UNIQUE/i.test(err.message || '')));

class HafalanService {
  // ---------------------------------------------------------------------
  // Hak akses: wali hanya boleh melihat anaknya sendiri (PRD §8)
  // ---------------------------------------------------------------------
  async assertSantriAccess(user, tenantId, santriId) {
    const parsedId = Number(santriId);
    if (!santriId || Number.isNaN(parsedId)) {
      throw httpError('ID santri tidak valid atau belum ditentukan.', 400);
    }
    const query = db('santri').where({ id: parsedId });
    if (tenantId) query.andWhere({ tenant_id: tenantId });
    const santri = await query.first();
    if (!santri) throw httpError('Santri tidak ditemukan.', 404);

    if (user && user.role === 'wali_santri' && Number(santri.wali_id) !== Number(user.id)) {
      throw httpError('Akses ditolak: Anda hanya dapat melihat data hafalan anak Anda sendiri.', 403);
    }
    return santri;
  }

  async getHistories(tenantId, filters = {}, user = null) {
    const {
      santri_id,
      class_id,
      type,
      jenis,
      limit,
      per_page,
      page = 1,
      search = '',
      paginated = false,
    } = filters;
    const filterType = type || jenis;
    const pageNum = Math.max(1, Number(page) || 1);
    const pageSize = paginated
      ? Math.min(100, Math.max(1, Number(per_page) || 10))
      : Math.max(1, Number(limit || per_page || 50));

    let query = db('hafalan_histories')
      .leftJoin('santri', 'hafalan_histories.santri_id', 'santri.id')
      .leftJoin('users as guru', 'hafalan_histories.guru_id', 'guru.id')
      .leftJoin('classes', 'santri.class_id', 'classes.id')
      .where('hafalan_histories.tenant_id', tenantId)
      .select(
        'hafalan_histories.*',
        'santri.full_name as santri_name',
        'classes.name as class_name',
        'guru.name as guru_name'
      );

    // Wali santri hanya boleh melihat setoran anaknya sendiri
    if (user && user.role === 'wali_santri') {
      const children = await db('santri').where({ wali_id: user.id, tenant_id: tenantId }).select('id');
      const childIds = children.map((c) => c.id);
      if (santri_id && !childIds.includes(Number(santri_id))) {
        throw httpError('Akses ditolak: Anda hanya dapat melihat data hafalan anak Anda sendiri.', 403);
      }
      if (!santri_id) {
        query = query.whereIn('hafalan_histories.santri_id', childIds.length ? childIds : [0]);
      }
    }

    if (santri_id) {
      query = query.where('hafalan_histories.santri_id', santri_id);
    }
    if (class_id) {
      query = query.where('santri.class_id', class_id);
    }
    if (filterType && filterType !== 'semua') {
      query = query.where('hafalan_histories.type', filterType);
    }

    const cleanSearch = String(search || '').trim().toLowerCase();
    if (cleanSearch) {
      query = query.where((builder) => {
        builder
          .whereRaw('LOWER(santri.full_name) LIKE ?', [`%${cleanSearch}%`])
          .orWhereRaw('LOWER(hafalan_histories.surah_name) LIKE ?', [`%${cleanSearch}%`]);
      });
    }

    let total = null;
    if (paginated) {
      const totalRow = await query.clone().clearSelect().clearOrder().count({ count: 'hafalan_histories.id' }).first();
      total = Number(totalRow?.count || 0);
      query = query.limit(pageSize).offset((pageNum - 1) * pageSize);
    } else {
      query = query.limit(pageSize);
    }

    const histories = await query
      .orderBy('hafalan_histories.date_recorded', 'desc')
      .orderBy('hafalan_histories.id', 'desc');

    const items = histories.map((h) => this._formatHistory(h));
    return paginated ? { items, total, page: pageNum, per_page: pageSize } : items;
  }

  _formatHistory(h) {
    return {
      ...h,
      jenis: h.jenis || h.type,
      surah: h.surah || h.surah_name,
      ayat_mulai: h.ayat_mulai || h.verse_start,
      ayat_selesai: h.ayat_selesai || h.verse_end,
      tanggal: h.tanggal || h.date_recorded,
      nilai: h.nilai || h.grade,
      status: h.status || statusFromGrade(h.grade),
      santri: {
        id: h.santri_id,
        name: h.santri_name || 'Santri',
        full_name: h.santri_name || 'Santri',
        kelas: { name: h.class_name || 'Halaqah' },
      },
    };
  }

  async recordHafalan(tenantId, guruId, data) {
    const santri_id = data.santri_id;
    const type = data.type || data.jenis || 'ziyadah';
    const surah_name = data.surah_name || data.surah || 'An-Naba';
    const surah_number = Number(data.surah_number || (data.juz === 30 ? 78 : 1));
    const verse_start = Number(data.verse_start || data.ayat_mulai || 1);
    const verse_end = Number(data.verse_end || data.ayat_selesai || verse_start);

    // Hitung nomor juz otomatis secara presisi dari surah & ayat awal setoran (jika bukan tasmi)
    const calculatedJuz = getJuzFromAyat(surah_number, verse_start);
    const juz = type === 'tasmi' && data.juz ? Number(data.juz) : Number(calculatedJuz || data.juz || 30);

    const grade = data.grade || data.nilai || 'Mumtaz';
    const notes = data.notes || data.catatan || null;
    const date_recorded = data.date_recorded || data.tanggal || db.fn.now();

    if (!santri_id || !type || !juz) {
      const err = new Error('Field santri_id, type, dan juz wajib diisi.');
      err.statusCode = 400;
      throw err;
    }

    // ---- Penilaian Hafalan Cepat (Tap): data per ayat + idempotensi antrean offline ----
    const clientId = data.client_id ? String(data.client_id).slice(0, 100) : null;
    const penilaianInput = Array.isArray(data.penilaian_ayat) ? data.penilaian_ayat : [];
    const isTap = data.metode === 'tap' || data.method === 'tap' || penilaianInput.length > 0;

    if (clientId) {
      const existing = await db('hafalan_histories').where({ tenant_id: tenantId, client_id: clientId }).first();
      if (existing) return { ...existing, deduplicated: true };
    }

    if (isTap && tenantId) {
      const santri = await db('santri').where({ id: santri_id, tenant_id: tenantId }).first();
      if (!santri) throw httpError('Santri tidak ditemukan pada institusi ini.', 404);
    }

    // Normalisasi baris penilaian per ayat (nomor global dihitung di server, bukan dipercaya dari klien)
    const penilaianRows = [];
    const seen = new Set();
    penilaianInput.forEach((p) => {
      const ayat = Number(p.ayat);
      const nilai = String(p.nilai || '').toUpperCase();
      if (!isValidAyat(surah_number, ayat) || !NILAI_AYAT.includes(nilai)) return;
      if (ayat < verse_start || ayat > verse_end || seen.has(ayat)) return;
      seen.add(ayat);
      penilaianRows.push({
        tenant_id: tenantId,
        santri_id,
        surah_number,
        ayat,
        ayat_global: toGlobal(surah_number, ayat),
        nilai,
        catatan: p.catatan ? String(p.catatan) : null,
      });
    });

    // Jika metode manual dan belum ada rincian per ayat, bentuk otomatis agar posisi & daftar remedial sinkron 100%
    if (penilaianRows.length === 0 && JENIS_POSISI.includes(type) && isValidAyat(surah_number, verse_start) && isValidAyat(surah_number, verse_end)) {
      const isMengulang = data.status === 'mengulang' || String(data.kelancaran || '').toLowerCase() === 'mengulang';
      const defaultNilai = isMengulang ? 'TIDAK_LANCAR' : 'LANCAR';
      for (let a = verse_start; a <= verse_end; a++) {
        penilaianRows.push({
          tenant_id: tenantId,
          santri_id,
          surah_number,
          ayat: a,
          ayat_global: toGlobal(surah_number, a),
          nilai: defaultNilai,
          catatan: notes ? String(notes).slice(0, 500) : null,
        });
      }
    }

    const insertData = {
      tenant_id: tenantId,
      santri_id,
      guru_id: guruId || null,
      type, // ziyadah, tasmi, murojaah
      juz,
      surah_number,
      surah_name,
      verse_start,
      verse_end,
      grade,
      notes,
      date_recorded,
    };
    if (clientId) insertData.client_id = clientId;
    insertData.method = isTap ? 'tap' : 'manual';
    insertData.lancar_count = penilaianRows.filter((r) => r.nilai === 'LANCAR').length;
    insertData.tidak_lancar_count = penilaianRows.filter((r) => r.nilai === 'TIDAK_LANCAR').length;
    insertData.belum_dinilai_count = penilaianRows.filter((r) => r.nilai === 'BELUM_DINILAI').length;

    let recorded;
    try {
      recorded = await db.transaction(async (trx) => {
        const [id] = await trx('hafalan_histories').insert(insertData);

        if (penilaianRows.length > 0) {
          const rows = penilaianRows.map((r) => ({ ...r, setoran_id: id }));
          // dipotong per 50 baris agar aman dari batas variabel SQLite
          for (let i = 0; i < rows.length; i += 50) {
            await trx('penilaian_ayat').insert(rows.slice(i, i + 50));
          }
        }

        // Posisi hafalan maju ke ayat setelah akhir setoran (PRD FR-07, FR-08) — berlaku untuk metode tap maupun manual
        if (JENIS_POSISI.includes(type) && isValidAyat(surah_number, verse_end)) {
          const arah = String(data.arah || '').toUpperCase() === 'MUNDUR' ? 'MUNDUR' : 'MAJU';
          const next = nextPosition(surah_number, verse_end, arah);
          const posisiRow = {
            ayat_berikutnya: next.khatam ? toGlobal(surah_number, verse_end) : toGlobal(next.surah_number, next.ayat),
            arah,
            khatam: Boolean(next.khatam),
            updated_by: guruId || null,
            updated_at: db.fn.now(),
          };
          const existingPos = await trx('posisi_hafalan').where({ santri_id, jenis: type }).first();
          if (existingPos) {
            await trx('posisi_hafalan').where({ id: existingPos.id }).update(posisiRow);
          } else {
            await trx('posisi_hafalan').insert({ tenant_id: tenantId, santri_id, jenis: type, ...posisiRow });
          }
        }

        return trx('hafalan_histories').where({ id }).first();
      });
    } catch (err) {
      // Dua permintaan dengan client_id sama bersamaan: kembalikan yang sudah tersimpan
      if (clientId && isDuplicateError(err)) {
        const existing = await db('hafalan_histories').where({ tenant_id: tenantId, client_id: clientId }).first();
        if (existing) return { ...existing, deduplicated: true };
      }
      throw err;
    }

    // Check if Tasmi' completion updates santri total_juz_hafalan
    if (type === 'tasmi') {
      const currentSantri = await db('santri').where({ id: santri_id }).first();
      if (currentSantri) {
        // Recount unique Juz completed with Tasmi'
        const completedJuzList = await db('hafalan_histories')
          .where({ santri_id, type: 'tasmi' })
          .distinct('juz');

        const newTotal = completedJuzList.length;
        if (newTotal > currentSantri.total_juz_hafalan) {
          await db('santri').where({ id: santri_id }).update({
            total_juz_hafalan: newTotal,
            updated_at: db.fn.now(),
          });
        }
      }
    }

    return recorded;
  }

  // ---------------------------------------------------------------------
  // Detail setoran beserta penilaian per ayat (untuk wali, santri, ustad)
  // ---------------------------------------------------------------------
  async getDetail(tenantId, user, id) {
    const row = await db('hafalan_histories')
      .leftJoin('santri', 'hafalan_histories.santri_id', 'santri.id')
      .leftJoin('users as guru', 'hafalan_histories.guru_id', 'guru.id')
      .leftJoin('classes', 'santri.class_id', 'classes.id')
      .where({ 'hafalan_histories.id': id, 'hafalan_histories.tenant_id': tenantId })
      .select(
        'hafalan_histories.*',
        'santri.full_name as santri_name',
        'santri.wali_id as santri_wali_id',
        'classes.name as class_name',
        'classes.guru_id as class_guru_id',
        'guru.name as guru_name'
      )
      .first();
    if (!row) throw httpError('Setoran tidak ditemukan.', 404);

    if (user && user.role === 'wali_santri' && Number(row.santri_wali_id) !== Number(user.id)) {
      throw httpError('Akses ditolak: Anda hanya dapat melihat data hafalan anak Anda sendiri.', 403);
    }

    const penilaian = await db('penilaian_ayat')
      .where({ setoran_id: id })
      .orderBy('ayat_global', 'asc')
      .select('surah_number', 'ayat', 'ayat_global', 'nilai', 'catatan');

    const base = this._formatHistory(row);
    delete base.santri_wali_id;
    delete base.class_guru_id;

    const correction = this._correctionPermission(user, row);

    let koreksi = [];
    if (user && user.role !== 'wali_santri') {
      const logs = await db('log_koreksi')
        .leftJoin('users', 'log_koreksi.diubah_oleh', 'users.id')
        .where({ 'log_koreksi.setoran_id': id })
        .orderBy('log_koreksi.id', 'desc')
        .select('log_koreksi.id', 'log_koreksi.waktu', 'log_koreksi.sebelum', 'log_koreksi.sesudah', 'users.name as diubah_oleh_nama');
      koreksi = logs;
    }

    return {
      ...base,
      surah_name: row.surah_name,
      penilaian_ayat: penilaian,
      ringkasan_tap:
        row.method === 'tap'
          ? {
              lancar: row.lancar_count || 0,
              tidak_lancar: row.tidak_lancar_count || 0,
              belum_dinilai: row.belum_dinilai_count || 0,
            }
          : null,
      can_correct: correction.allowed,
      correction_deadline: correction.deadline,
      corrected_at: row.corrected_at || null,
      koreksi,
    };
  }

  // ---------------------------------------------------------------------
  // Koreksi setoran (PRD FR-09, §8): hanya ustad pembimbing/admin, dalam batas waktu, tercatat di log
  // ---------------------------------------------------------------------
  _correctionPermission(user, row) {
    const created = toDate(row.created_at) || toDate(row.date_recorded) || new Date();
    const deadline = new Date(created.getTime() + KOREKSI_WINDOW_HOURS * 3600 * 1000);
    if (!user) return { allowed: false, deadline, reason: 'Autentikasi diperlukan.' };

    if (user.role === 'super_admin' || user.role === 'admin_tenant') {
      return { allowed: true, deadline, reason: null };
    }
    if (user.role === 'guru') {
      const isOwner =
        Number(row.guru_id) === Number(user.id) || Number(row.class_guru_id) === Number(user.id);
      if (!isOwner) {
        return { allowed: false, deadline, reason: 'Hanya ustad pembimbing santri ini yang dapat mengoreksi setoran.' };
      }
      if (Date.now() > deadline.getTime()) {
        return {
          allowed: false,
          deadline,
          reason: `Batas waktu koreksi (${KOREKSI_WINDOW_HOURS} jam setelah disimpan) telah lewat.`,
        };
      }
      return { allowed: true, deadline, reason: null };
    }
    return { allowed: false, deadline, reason: 'Peran Anda tidak memiliki izin untuk mengoreksi setoran.' };
  }

  async koreksiSetoran(tenantId, user, id, body = {}) {
    const row = await db('hafalan_histories')
      .leftJoin('santri', 'hafalan_histories.santri_id', 'santri.id')
      .leftJoin('classes', 'santri.class_id', 'classes.id')
      .where({ 'hafalan_histories.id': id, 'hafalan_histories.tenant_id': tenantId })
      .select('hafalan_histories.*', 'classes.guru_id as class_guru_id')
      .first();
    if (!row) throw httpError('Setoran tidak ditemukan.', 404);

    const permission = this._correctionPermission(user, row);
    if (!permission.allowed) throw httpError(permission.reason, 403);

    const changes = Array.isArray(body.penilaian_ayat) ? body.penilaian_ayat : [];
    const newNotes = body.catatan !== undefined ? body.catatan : body.notes;
    const newGrade = body.nilai !== undefined ? body.nilai : body.grade;
    if (changes.length === 0 && newNotes === undefined && newGrade === undefined) {
      throw httpError('Tidak ada perubahan yang dikirim.', 400);
    }

    const beforePen = await db('penilaian_ayat').where({ setoran_id: id }).select('ayat_global', 'nilai', 'catatan');
    const before = {
      notes: row.notes,
      grade: row.grade,
      penilaian: beforePen.map((p) => ({ ayat_global: p.ayat_global, nilai: p.nilai })),
    };

    await db.transaction(async (trx) => {
      const update = { corrected_at: db.fn.now(), corrected_by: user.id, updated_at: db.fn.now() };
      if (newNotes !== undefined) update.notes = newNotes === null ? null : String(newNotes);
      if (newGrade !== undefined) update.grade = String(newGrade).slice(0, 20);

      let penilaianChanged = false;
      for (const change of changes) {
        const nilai = String(change.nilai || '').toUpperCase();
        if (!NILAI_AYAT.includes(nilai)) throw httpError(`Nilai ayat tidak valid: ${change.nilai}`, 400);

        let global = Number(change.ayat_global);
        if (!global && change.ayat) global = toGlobal(row.surah_number, Number(change.ayat));
        if (!global || global < toGlobal(row.surah_number, row.verse_start) || global > toGlobal(row.surah_number, row.verse_end)) {
          throw httpError('Ayat di luar rentang setoran ini.', 400);
        }

        const existing = await trx('penilaian_ayat').where({ setoran_id: id, ayat_global: global }).first();
        if (existing) {
          await trx('penilaian_ayat')
            .where({ id: existing.id })
            .update({ nilai, catatan: change.catatan !== undefined ? change.catatan : existing.catatan, updated_at: db.fn.now() });
        } else {
          const pos = fromGlobal(global);
          await trx('penilaian_ayat').insert({
            tenant_id: tenantId,
            setoran_id: id,
            santri_id: row.santri_id,
            surah_number: pos.surah_number,
            ayat: pos.ayat,
            ayat_global: global,
            nilai,
            catatan: change.catatan || null,
          });
        }
        penilaianChanged = true;
      }

      if (penilaianChanged) {
        const all = await trx('penilaian_ayat').where({ setoran_id: id }).select('nilai');
        const lancar = all.filter((p) => p.nilai === 'LANCAR').length;
        const tidak = all.filter((p) => p.nilai === 'TIDAK_LANCAR').length;
        update.method = row.method || 'tap';
        update.lancar_count = lancar;
        update.tidak_lancar_count = tidak;
        update.belum_dinilai_count = all.filter((p) => p.nilai === 'BELUM_DINILAI').length;
        // nilai dihitung ulang kecuali ustad menetapkannya manual
        if (newGrade === undefined && lancar + tidak > 0) {
          update.grade = String(Math.round((lancar / (lancar + tidak)) * 100));
        }
      }

      await trx('hafalan_histories').where({ id }).update(update);

      const afterPen = await trx('penilaian_ayat').where({ setoran_id: id }).select('ayat_global', 'nilai');
      await trx('log_koreksi').insert({
        tenant_id: tenantId,
        setoran_id: id,
        diubah_oleh: user.id,
        sebelum: JSON.stringify(before),
        sesudah: JSON.stringify({
          notes: update.notes !== undefined ? update.notes : row.notes,
          grade: update.grade !== undefined ? update.grade : row.grade,
          penilaian: afterPen,
        }),
      });
    });

    return this.getDetail(tenantId, user, id);
  }

  // ---------------------------------------------------------------------
  // Posisi hafalan berikutnya (FR-02) & daftar ulang (FR-14)
  // ---------------------------------------------------------------------
  _formatPosisi(santriId, jenis, row, derived = false) {
    const g = row.ayat_berikutnya;
    const pos = fromGlobal(g);
    return {
      santri_id: Number(santriId),
      jenis,
      ayat_berikutnya: g,
      surah_number: pos.surah_number,
      surah_name: surahName(pos.surah_number),
      ayat: pos.ayat,
      arah: row.arah || 'MAJU',
      khatam: Boolean(row.khatam),
      derived,
      updated_at: row.updated_at || null,
    };
  }

  async getPosisi(tenantId, user, santriId, jenis) {
    await this.assertSantriAccess(user, tenantId, santriId);

    const resolveOne = async (j) => {
      const row = await db('posisi_hafalan').where({ santri_id: santriId, jenis: j }).first();
      if (row) return this._formatPosisi(santriId, j, row, false);

      // Belum ada posisi tersimpan: turunkan dari setoran terakhir (ayat setelah akhir)
      const last = await db('hafalan_histories')
        .where({ santri_id: santriId, type: j })
        .orderBy('date_recorded', 'desc')
        .orderBy('id', 'desc')
        .first();
      if (!last || !isValidAyat(Number(last.surah_number), Number(last.verse_end))) return null;
      const next = nextPosition(Number(last.surah_number), Number(last.verse_end), 'MAJU');
      const g = next.khatam
        ? toGlobal(Number(last.surah_number), Number(last.verse_end))
        : toGlobal(next.surah_number, next.ayat);
      return this._formatPosisi(santriId, j, { ayat_berikutnya: g, arah: 'MAJU', khatam: Boolean(next.khatam), updated_at: last.created_at }, true);
    };

    if (jenis) {
      if (!JENIS_POSISI.includes(jenis)) throw httpError("Jenis harus 'ziyadah' atau 'murojaah'.", 400);
      return resolveOne(jenis);
    }
    return { ziyadah: await resolveOne('ziyadah'), murojaah: await resolveOne('murojaah') };
  }

  /** Ayat yang penilaian terakhirnya TIDAK_LANCAR — daftar ulang untuk setoran berikutnya. */
  async getDaftarUlang(tenantId, user, santriId) {
    await this.assertSantriAccess(user, tenantId, santriId);

    const rows = await db('penilaian_ayat as p')
      .join('hafalan_histories as h', 'p.setoran_id', 'h.id')
      .where({ 'p.santri_id': santriId, 'p.tenant_id': tenantId })
      .whereIn('p.nilai', ['LANCAR', 'TIDAK_LANCAR'])
      .orderBy('h.date_recorded', 'desc')
      .orderBy('h.id', 'desc')
      .select('p.ayat_global', 'p.surah_number', 'p.ayat', 'p.nilai', 'p.catatan', 'h.id as setoran_id', 'h.date_recorded', 'h.type');

    const latest = new Map();
    rows.forEach((r) => {
      if (!latest.has(r.ayat_global)) latest.set(r.ayat_global, r);
    });

    const list = Array.from(latest.values())
      .filter((r) => r.nilai === 'TIDAK_LANCAR')
      .sort((a, b) => a.ayat_global - b.ayat_global)
      .map((r) => ({
        surah_number: r.surah_number,
        surah_name: surahName(r.surah_number),
        ayat: r.ayat,
        ayat_global: r.ayat_global,
        setoran_id: r.setoran_id,
        jenis: r.type,
        catatan: r.catatan || null,
        tanggal: r.date_recorded ? String(r.date_recorded).split('T')[0] : null,
      }));

    return { total: list.length, ayat: list };
  }

  async getSantriHafalanSummary(tenantId, santriId) {
    const parsedId = Number(santriId);
    if (!santriId || isNaN(parsedId)) {
      const err = new Error('ID santri tidak valid atau belum ditentukan.');
      err.statusCode = 400;
      throw err;
    }

    const santri = await db('santri')
      .leftJoin('classes', 'santri.class_id', 'classes.id')
      .leftJoin('users as wali', 'santri.wali_id', 'wali.id')
      .where({ 'santri.id': parsedId, 'santri.tenant_id': tenantId })
      .select(
        'santri.*',
        'classes.name as class_name',
        'classes.name as kelas',
        'wali.name as wali_name',
        'wali.name as wali_santri'
      )
      .first();

    if (!santri) {
      const err = new Error('Santri tidak ditemukan.');
      err.statusCode = 404;
      throw err;
    }

    const histories = await db('hafalan_histories')
      .where({ santri_id: parsedId })
      .orderBy('date_recorded', 'desc');

    const totalZiyadah = histories.filter((h) => h.type === 'ziyadah').length;
    const totalTasmi = histories.filter((h) => h.type === 'tasmi').length;
    const totalMurojaah = histories.filter((h) => h.type === 'murojaah').length;
    const totalLulus = histories.filter(
      (h) => !h.grade || !['dhoif', 'ulang', 'mengulang'].some((bad) => String(h.grade).toLowerCase().includes(bad))
    ).length;

    // Juz progress mapping (1 to 30) dengan kalkulasi presisi per rentang ayat
    const juzMap = {};
    for (let j = 1; j <= 30; j++) {
      const gRange = getJuzGlobalRange(j);
      juzMap[j] = {
        juz: j,
        completed: false,
        countZiyadah: 0,
        countMurojaah: 0,
        totalAyat: gRange.totalAyat,
        ayatHafal: 0,
        percent: 0,
        status: 'belum_dimulai',
      };
    }

    // Lacak ayat unik global yang sudah disetorkan dalam Ziyadah (yang lulus / tidak mengulang)
    const ziyadahAyatGlobalSet = new Set();

    histories.forEach((h) => {
      const hType = h.type || h.jenis;
      const isLulus = !h.grade || !['dhoif', 'ulang', 'mengulang'].some((bad) => String(h.grade).toLowerCase().includes(bad));

      if (hType === 'tasmi') {
        const tasmiJuz = Number(h.juz || getJuzFromAyat(h.surah_number, h.verse_start) || 30);
        if (juzMap[tasmiJuz]) {
          juzMap[tasmiJuz].completed = true;
          juzMap[tasmiJuz].status = 'tuntas_tasmi';
          juzMap[tasmiJuz].percent = 100;
        }
      } else {
        // Ziyadah atau Muraja'ah: tentukan seluruh Juz yang disentuh oleh setoran ini
        let touchedJuzList = [];
        if (h.surah_number && h.verse_start) {
          const vStart = Number(h.verse_start);
          const vEnd = Number(h.verse_end || vStart);
          touchedJuzList = getJuzListForRange(h.surah_number, vStart, vEnd);

          if (hType === 'ziyadah' && isLulus) {
            for (let a = Math.min(vStart, vEnd); a <= Math.max(vStart, vEnd); a++) {
              ziyadahAyatGlobalSet.add(toGlobal(h.surah_number, a));
            }
          }
        }
        if (touchedJuzList.length === 0 && h.juz) {
          touchedJuzList = [Number(h.juz)];
        }

        touchedJuzList.forEach((j) => {
          if (juzMap[j]) {
            if (hType === 'ziyadah') {
              juzMap[j].countZiyadah += 1;
            } else if (hType === 'murojaah') {
              juzMap[j].countMurojaah += 1;
            }
          }
        });
      }
    });

    // Tentukan status dan persentase setiap Juz
    for (let j = 1; j <= 30; j++) {
      const gRange = getJuzGlobalRange(j);
      let covered = 0;
      for (let g = gRange.startGlobal; g <= gRange.endGlobal; g++) {
        if (ziyadahAyatGlobalSet.has(g)) covered++;
      }
      juzMap[j].ayatHafal = covered;

      if (juzMap[j].completed || juzMap[j].status === 'tuntas_tasmi') {
        juzMap[j].status = 'tuntas_tasmi';
        juzMap[j].completed = true;
        juzMap[j].percent = 100;
      } else if (covered >= gRange.totalAyat) {
        juzMap[j].status = 'tuntas_ziyadah';
        juzMap[j].percent = 100;
      } else if (covered > 0 || juzMap[j].countZiyadah > 0) {
        juzMap[j].status = 'sedang_berjalan';
        juzMap[j].percent = covered > 0
          ? Math.round((covered / gRange.totalAyat) * 100)
          : Math.min(95, Math.max(15, juzMap[j].countZiyadah * 20));
      }
    }

    const totalJuzSantri = Math.floor(Number(santri.total_juz_hafalan || 0));
    const tasmiCount = Object.values(juzMap).filter((x) => x.status === 'tuntas_tasmi').length;

    // Jika santri memiliki akumulasi juz hafalan yang lebih besar dari catatan riwayat tasmi
    if (totalJuzSantri > tasmiCount) {
      let deficit = totalJuzSantri - tasmiCount;
      // Santri umumnya menghafal dari Juz 30 mundur (30, 29, 28...)
      for (let j = 30; j >= 1 && deficit > 0; j--) {
        if (juzMap[j].status === 'belum_dimulai') {
          juzMap[j].status = 'tuntas_tasmi';
          juzMap[j].completed = true;
          juzMap[j].percent = 100;
          deficit--;
        }
      }
    }

    const progressArray = Object.values(juzMap);
    const totalJuzTuntas = progressArray.filter(
      (j) => j.completed || j.status === 'tuntas_tasmi' || j.status === 'tuntas_ziyadah' || j.status === 'hafal'
    ).length;
    const totalJuzBerjalan = progressArray.filter(
      (j) => j.status === 'sedang_berjalan' || j.status === 'proses'
    ).length;

    const statsObj = {
      total_setoran: histories.length,
      total_ziyadah: totalZiyadah,
      total_tasmi: totalTasmi,
      total_murojaah: totalMurojaah,
      total_lulus: totalLulus,
      total_juz_tuntas: totalJuzTuntas,
      total_juz_berjalan: totalJuzBerjalan,
      total_juz_hafalan: totalJuzSantri,
    };

    const recentList = histories.slice(0, 10).map((h) => ({
      ...h,
      surah: h.surah_name,
      ayat_mulai: h.verse_start,
      ayat_selesai: h.verse_end,
      nilai: h.grade,
      tanggal: h.date_recorded ? String(h.date_recorded).split('T')[0] : null,
    }));

    return {
      santri,
      stats: statsObj,
      summary: statsObj,
      juz_progress: progressArray,
      juz_matrix: progressArray,
      recent_histories: recentList,
      recent_history: recentList,
    };
  }
}

module.exports = new HafalanService();

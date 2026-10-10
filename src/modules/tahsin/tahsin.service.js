const db = require('../../config/database');
const { uploadFile, deleteFile } = require('../../config/storage');

class TahsinService {
  async getSubmissions(tenantId, filters = {}) {
    const { santri_id, status, wali_id } = filters;
    let query = db('tahsin_submissions')
      .leftJoin('santri', 'tahsin_submissions.santri_id', 'santri.id')
      .leftJoin('users as wali', 'tahsin_submissions.wali_id', 'wali.id')
      .leftJoin('users as guru', 'tahsin_submissions.guru_id', 'guru.id')
      .where('tahsin_submissions.tenant_id', tenantId)
      .select(
        'tahsin_submissions.*',
        'santri.full_name as santri_name',
        'wali.name as wali_name',
        'guru.name as guru_name'
      );

    if (santri_id) {
      query = query.where('tahsin_submissions.santri_id', santri_id);
    }
    if (wali_id) {
      query = query.where(function() {
        this.where('tahsin_submissions.wali_id', wali_id)
          .orWhere('santri.wali_id', wali_id);
      });
    }
    if (status) {
      query = query.where('tahsin_submissions.status', status);
    }

    const list = await query.orderBy('tahsin_submissions.created_at', 'desc');
    return list.map((item) => {
      const isReviewed = item.status === 'reviewed';
      const isAudioDeleted = item.audio_url === 'DELETED' || !item.audio_url || isReviewed;
      return {
        ...item,
        audio_url: isReviewed ? 'DELETED' : item.audio_url,
        is_audio_deleted: isAudioDeleted,
      };
    });
  }

  async getSubmissionById(id, tenantId) {
    const submission = await db('tahsin_submissions')
      .leftJoin('santri', 'tahsin_submissions.santri_id', 'santri.id')
      .leftJoin('users as wali', 'tahsin_submissions.wali_id', 'wali.id')
      .leftJoin('users as guru', 'tahsin_submissions.guru_id', 'guru.id')
      .where({ 'tahsin_submissions.id': id, 'tahsin_submissions.tenant_id': tenantId })
      .select(
        'tahsin_submissions.*',
        'santri.full_name as santri_name',
        'wali.name as wali_name',
        'guru.name as guru_name'
      )
      .first();

    if (!submission) {
      const err = new Error('Rekaman setoran tahsin tidak ditemukan.');
      err.statusCode = 404;
      throw err;
    }
    const isReviewed = submission.status === 'reviewed';
    return {
      ...submission,
      audio_url: isReviewed ? 'DELETED' : submission.audio_url,
      is_audio_deleted: submission.audio_url === 'DELETED' || !submission.audio_url || isReviewed,
    };
  }

  async createSubmission(tenantId, waliId, data, file) {
    const { santri_id, title, surah_number, verse_start, verse_end } = data;

    if (!santri_id || !title || !surah_number || !verse_start || !verse_end) {
      const err = new Error('Data santri, judul, surah, dan ayat wajib diisi.');
      err.statusCode = 400;
      throw err;
    }

    let audioUrl = data.audio_url || '';
    if (file) {
      const filename = `tahsin/audio_${Date.now()}_${file.originalname}`;
      audioUrl = await uploadFile(filename, file.buffer, file.mimetype);
    }

    if (!audioUrl) {
      const err = new Error('File audio atau audio_url setoran tahsin diperlukan.');
      err.statusCode = 400;
      throw err;
    }

    const [id] = await db('tahsin_submissions').insert({
      tenant_id: tenantId,
      santri_id: Number(santri_id),
      wali_id: waliId || null,
      title,
      audio_url: audioUrl,
      surah_number: Number(surah_number),
      verse_start: Number(verse_start),
      verse_end: Number(verse_end),
      status: 'pending',
    });

    return this.getSubmissionById(id, tenantId);
  }

  async reviewSubmission(id, tenantId, guruId, reviewData, feedbackAudioFile = null) {
    const { tajwid_score, fluent_score, feedback_note, delete_audio } = reviewData;

    let feedbackAudioUrl = reviewData.feedback_audio_url || null;
    if (feedbackAudioFile) {
      const filename = `tahsin/feedback_${Date.now()}_${feedbackAudioFile.originalname}`;
      feedbackAudioUrl = await uploadFile(filename, feedbackAudioFile.buffer, feedbackAudioFile.mimetype);
    }

    const currentSubmission = await db('tahsin_submissions')
      .where({ id, tenant_id: tenantId })
      .first();

    if (!currentSubmission) {
      const err = new Error('Rekaman setoran tahsin tidak ditemukan.');
      err.statusCode = 404;
      throw err;
    }

    let finalAudioUrl = currentSubmission.audio_url;
    // Default hapus file rekaman audio otomatis saat setoran dikoreksi untuk menghemat memori
    const shouldDeleteAudio = delete_audio !== false;
    if (shouldDeleteAudio && currentSubmission.audio_url && currentSubmission.audio_url !== 'DELETED') {
      await deleteFile(currentSubmission.audio_url);
      finalAudioUrl = 'DELETED';
    }

    await db('tahsin_submissions')
      .where({ id, tenant_id: tenantId })
      .update({
        guru_id: guruId,
        status: 'reviewed',
        tajwid_score: tajwid_score ? Number(tajwid_score) : null,
        fluent_score: fluent_score ? Number(fluent_score) : null,
        feedback_note: feedback_note || null,
        feedback_audio_url: feedbackAudioUrl,
        audio_url: finalAudioUrl,
        updated_at: db.fn.now(),
      });

    return this.getSubmissionById(id, tenantId);
  }

  async cleanAudioFile(id, tenantId) {
    const submission = await db('tahsin_submissions')
      .where({ id, tenant_id: tenantId })
      .first();

    if (!submission) {
      const err = new Error('Rekaman setoran tahsin tidak ditemukan.');
      err.statusCode = 404;
      throw err;
    }

    if (submission.audio_url && submission.audio_url !== 'DELETED') {
      await deleteFile(submission.audio_url);
    }
    if (submission.feedback_audio_url) {
      await deleteFile(submission.feedback_audio_url);
    }

    await db('tahsin_submissions')
      .where({ id, tenant_id: tenantId })
      .update({
        audio_url: 'DELETED',
        feedback_audio_url: null,
        updated_at: db.fn.now(),
      });

    return this.getSubmissionById(id, tenantId);
  }

  async deleteSubmission(id, tenantId, mode = 'audio') {
    const submission = await db('tahsin_submissions')
      .where({ id, tenant_id: tenantId })
      .first();

    if (!submission) {
      const err = new Error('Rekaman setoran tahsin tidak ditemukan.');
      err.statusCode = 404;
      throw err;
    }

    // Jika mode adalah 'audio' (default untuk menghemat memori):
    // Bersihkan file audio fisik tetapi pertahankan catatan koreksi & nilai untuk santri!
    if (mode === 'audio') {
      return this.cleanAudioFile(id, tenantId);
    }

    // Jika mode adalah 'all': hapus seluruh baris data dari database
    if (submission.audio_url && submission.audio_url !== 'DELETED') {
      await deleteFile(submission.audio_url);
    }
    if (submission.feedback_audio_url) {
      await deleteFile(submission.feedback_audio_url);
    }

    await db('tahsin_submissions')
      .where({ id, tenant_id: tenantId })
      .del();

    return { id, message: 'Data setoran tahsin berhasil dihapus sepenuhnya.' };
  }
}

module.exports = new TahsinService();

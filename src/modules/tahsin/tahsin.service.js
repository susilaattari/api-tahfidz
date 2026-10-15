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
    const now = new Date();
    const result = [];

    for (const item of list) {
      let isAudioDeleted = item.audio_url === 'DELETED' || !item.audio_url;
      let audioDaysRemaining = null;

      if (!isAudioDeleted && item.created_at) {
        const createdTime = new Date(item.created_at).getTime();
        const diffMs = now.getTime() - createdTime;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (diffDays >= 7) {
          // Otomatis hapus karena sudah lebih dari 7 hari / 1 minggu
          this.cleanAudioFile(item.id, item.tenant_id).catch(() => {});
          isAudioDeleted = true;
          audioDaysRemaining = 0;
        } else {
          audioDaysRemaining = Math.max(1, Math.ceil(7 - diffDays));
        }
      }

      result.push({
        ...item,
        audio_url: isAudioDeleted ? 'DELETED' : item.audio_url,
        feedback_audio_url: isAudioDeleted ? null : item.feedback_audio_url,
        is_audio_deleted: isAudioDeleted,
        audio_days_remaining: audioDaysRemaining,
      });
    }

    return result;
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

    const now = new Date();
    let isAudioDeleted = submission.audio_url === 'DELETED' || !submission.audio_url;
    let audioDaysRemaining = null;

    if (!isAudioDeleted && submission.created_at) {
      const createdTime = new Date(submission.created_at).getTime();
      const diffMs = now.getTime() - createdTime;
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (diffDays >= 7) {
        await this.cleanAudioFile(submission.id, submission.tenant_id);
        isAudioDeleted = true;
        audioDaysRemaining = 0;
      } else {
        audioDaysRemaining = Math.max(1, Math.ceil(7 - diffDays));
      }
    }

    return {
      ...submission,
      audio_url: isAudioDeleted ? 'DELETED' : submission.audio_url,
      feedback_audio_url: isAudioDeleted ? null : submission.feedback_audio_url,
      is_audio_deleted: isAudioDeleted,
      audio_days_remaining: audioDaysRemaining,
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
      const cleanName = (file.originalname || 'recording.m4a').replace(/[^a-zA-Z0-9._-]/g, '_');
      const filename = `tahsin/audio_${Date.now()}_${cleanName}`;
      audioUrl = await uploadFile(filename, file.buffer, file.mimetype || 'audio/m4a');
    }

    if (!audioUrl) {
      const err = new Error('File audio atau audio_url setoran tahsin diperlukan.');
      err.statusCode = 400;
      throw err;
    }

    const insertResult = await db('tahsin_submissions').insert({
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

    const id = Array.isArray(insertResult)
      ? (typeof insertResult[0] === 'object' ? insertResult[0]?.id : insertResult[0])
      : insertResult;

    return this.getSubmissionById(id, tenantId);
  }

  async reviewSubmission(id, tenantId, guruId, reviewData, feedbackAudioFile = null) {
    const { tajwid_score, fluent_score, feedback_note, delete_audio } = reviewData;

    let feedbackAudioUrl = reviewData.feedback_audio_url || null;
    if (feedbackAudioFile) {
      const cleanName = (feedbackAudioFile.originalname || 'feedback.m4a').replace(/[^a-zA-Z0-9._-]/g, '_');
      const filename = `tahsin/feedback_${Date.now()}_${cleanName}`;
      feedbackAudioUrl = await uploadFile(filename, feedbackAudioFile.buffer, feedbackAudioFile.mimetype || 'audio/m4a');
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
    // Hapus file rekaman audio otomatis jika guru mengaktifkan opsi hapus rekaman
    const shouldDeleteAudio = delete_audio === true || delete_audio === 'true';
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

  /**
   * Pembersihan otomatis file rekaman audio tahsin yang berumur lebih dari threshold (default 7 hari / 1 minggu)
   * Hanya menghapus file audio fisik untuk menghemat kapasitas server, catatan dan nilai tetap ada.
   */
  async autoCleanOldAudios(daysThreshold = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysThreshold);

    const candidates = await db('tahsin_submissions')
      .where(function () {
        this.where(function () {
          this.whereNotNull('audio_url')
            .andWhere('audio_url', '!=', 'DELETED')
            .andWhere('audio_url', '!=', '');
        }).orWhere(function () {
          this.whereNotNull('feedback_audio_url')
            .andWhere('feedback_audio_url', '!=', 'DELETED')
            .andWhere('feedback_audio_url', '!=', '');
        });
      })
      .where('created_at', '<', cutoffDate);

    let cleanedCount = 0;
    const cleanedIds = [];

    for (const item of candidates) {
      if (item.audio_url && item.audio_url !== 'DELETED') {
        await deleteFile(item.audio_url);
      }
      if (item.feedback_audio_url && item.feedback_audio_url !== 'DELETED') {
        await deleteFile(item.feedback_audio_url);
      }

      await db('tahsin_submissions')
        .where({ id: item.id })
        .update({
          audio_url: 'DELETED',
          feedback_audio_url: null,
          updated_at: db.fn.now(),
        });

      cleanedCount++;
      cleanedIds.push(item.id);
    }

    return {
      cleanedCount,
      cleanedIds,
      daysThreshold,
      cutoffDate: cutoffDate.toISOString(),
    };
  }
}

module.exports = new TahsinService();

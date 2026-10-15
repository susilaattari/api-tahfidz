const db = require('../../config/database');

class PackagesService {
  async getAllPackages() {
    const packages = await db('packages').select('*').orderBy('price', 'asc');
    return packages.map(pkg => ({
      ...pkg,
      features: typeof pkg.features === 'string' ? JSON.parse(pkg.features || '{}') : pkg.features,
    }));
  }

  async getPackageById(id) {
    const pkg = await db('packages').where({ id }).first();
    if (!pkg) {
      const err = new Error('Paket tidak ditemukan.');
      err.statusCode = 404;
      throw err;
    }
    return {
      ...pkg,
      features: typeof pkg.features === 'string' ? JSON.parse(pkg.features || '{}') : pkg.features,
    };
  }

  async createPackage(data) {
    const { name, code, price, max_santri, features } = data;

    if (!name || !String(name).trim()) {
      const err = new Error('Nama paket wajib diisi.');
      err.statusCode = 400;
      throw err;
    }

    if (!code || !String(code).trim()) {
      const err = new Error('Kode unik paket wajib diisi.');
      err.statusCode = 400;
      throw err;
    }

    const cleanCode = String(code).trim().toLowerCase();

    // Check unique code
    const existing = await db('packages').where({ code: cleanCode }).first();
    if (existing) {
      const err = new Error(`Kode paket '${cleanCode}' sudah digunakan oleh paket "${existing.name}". Silakan gunakan kode unik yang lain.`);
      err.statusCode = 409;
      throw err;
    }

    try {
      const [id] = await db('packages').insert({
        name: String(name).trim(),
        code: cleanCode,
        price: price !== undefined ? Number(price) : 0,
        max_santri: max_santri !== undefined ? Number(max_santri) : 100,
        features: typeof features === 'object' ? JSON.stringify(features) : (features || '{}'),
      });
      return this.getPackageById(id);
    } catch (dbErr) {
      if (dbErr.code === '23505' || dbErr.message?.includes('packages_code_unique')) {
        const err = new Error(`Kode paket '${cleanCode}' sudah digunakan. Silakan gunakan kode unik yang lain.`);
        err.statusCode = 409;
        throw err;
      }
      throw dbErr;
    }
  }

  async updatePackage(id, data) {
    const { name, code, price, max_santri, features } = data;
    const updatePayload = {};

    if (name !== undefined) {
      if (!String(name).trim()) {
        const err = new Error('Nama paket tidak boleh kosong.');
        err.statusCode = 400;
        throw err;
      }
      updatePayload.name = String(name).trim();
    }

    let cleanCode = null;
    if (code !== undefined) {
      if (!String(code).trim()) {
        const err = new Error('Kode unik paket tidak boleh kosong.');
        err.statusCode = 400;
        throw err;
      }
      cleanCode = String(code).trim().toLowerCase();
      const existing = await db('packages').where({ code: cleanCode }).whereNot({ id }).first();
      if (existing) {
        const err = new Error(`Kode paket '${cleanCode}' sudah digunakan oleh paket "${existing.name}". Silakan gunakan kode unik yang lain.`);
        err.statusCode = 409;
        throw err;
      }
      updatePayload.code = cleanCode;
    }

    if (price !== undefined) updatePayload.price = Number(price);
    if (max_santri !== undefined) updatePayload.max_santri = Number(max_santri);
    if (features !== undefined) {
      updatePayload.features = typeof features === 'object' ? JSON.stringify(features) : features;
    }
    updatePayload.updated_at = db.fn.now();

    try {
      await db('packages').where({ id }).update(updatePayload);
      return this.getPackageById(id);
    } catch (dbErr) {
      if (dbErr.code === '23505' || dbErr.message?.includes('packages_code_unique')) {
        const err = new Error(`Kode paket '${cleanCode || code}' sudah digunakan. Silakan gunakan kode unik yang lain.`);
        err.statusCode = 409;
        throw err;
      }
      throw dbErr;
    }
  }

  async deletePackage(id) {
    const tenantInUse = await db('tenants').where({ plan_id: id }).first();
    if (tenantInUse) {
      const err = new Error(`Paket ini sedang digunakan oleh tenant '${tenantInUse.name}' dan tidak dapat dihapus.`);
      err.statusCode = 400;
      throw err;
    }

    await db('packages').where({ id }).del();
    return true;
  }
}

module.exports = new PackagesService();

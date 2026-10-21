const db = require('../../config/database');

class PackagesService {
  async getAllPackages() {
    const packages = await db('packages').select('*').orderBy('price', 'asc');
    return packages.map(pkg => {
      const features = typeof pkg.features === 'string' ? JSON.parse(pkg.features || '{}') : (pkg.features || {});
      const duration_months = pkg.duration_months !== undefined && pkg.duration_months !== null ? Number(pkg.duration_months) : (features.duration_months || 1);
      const extra_price_per_user = pkg.extra_price_per_user !== undefined && pkg.extra_price_per_user !== null ? Number(pkg.extra_price_per_user) : (features.extra_price_per_user || 0);
      return {
        ...pkg,
        price: Number(pkg.price || 0),
        max_santri: Number(pkg.max_santri || 0),
        duration_months,
        extra_price_per_user,
        features: {
          ...features,
          duration_months,
          extra_price_per_user,
          base_capacity: Number(pkg.max_santri || 0),
        },
      };
    });
  }

  async getPackageById(id) {
    const pkg = await db('packages').where({ id }).first();
    if (!pkg) {
      const err = new Error('Paket tidak ditemukan.');
      err.statusCode = 404;
      throw err;
    }
    const features = typeof pkg.features === 'string' ? JSON.parse(pkg.features || '{}') : (pkg.features || {});
    const duration_months = pkg.duration_months !== undefined && pkg.duration_months !== null ? Number(pkg.duration_months) : (features.duration_months || 1);
    const extra_price_per_user = pkg.extra_price_per_user !== undefined && pkg.extra_price_per_user !== null ? Number(pkg.extra_price_per_user) : (features.extra_price_per_user || 0);
    return {
      ...pkg,
      price: Number(pkg.price || 0),
      max_santri: Number(pkg.max_santri || 0),
      duration_months,
      extra_price_per_user,
      features: {
        ...features,
        duration_months,
        extra_price_per_user,
        base_capacity: Number(pkg.max_santri || 0),
      },
    };
  }

  async createPackage(data) {
    const { name, code, price, max_santri, duration_months, extra_price_per_user, features } = data;

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

    const finalDuration = duration_months !== undefined ? Number(duration_months) : 1;
    const finalExtraPrice = extra_price_per_user !== undefined ? Number(extra_price_per_user) : 0;
    const parsedFeatures = typeof features === 'object' ? { ...features } : JSON.parse(features || '{}');
    parsedFeatures.duration_months = finalDuration;
    parsedFeatures.extra_price_per_user = finalExtraPrice;
    parsedFeatures.base_capacity = max_santri !== undefined ? Number(max_santri) : 10;

    try {
      const [id] = await db('packages').insert({
        name: String(name).trim(),
        code: cleanCode,
        price: price !== undefined ? Number(price) : 0,
        max_santri: max_santri !== undefined ? Number(max_santri) : 10,
        duration_months: finalDuration,
        extra_price_per_user: finalExtraPrice,
        features: JSON.stringify(parsedFeatures),
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
    const { name, code, price, max_santri, duration_months, extra_price_per_user, features } = data;
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
    if (duration_months !== undefined) updatePayload.duration_months = Number(duration_months);
    if (extra_price_per_user !== undefined) updatePayload.extra_price_per_user = Number(extra_price_per_user);

    if (features !== undefined || duration_months !== undefined || extra_price_per_user !== undefined || max_santri !== undefined) {
      const currentPkg = await db('packages').where({ id }).first();
      const currentFeatures = typeof currentPkg?.features === 'string' ? JSON.parse(currentPkg.features || '{}') : (currentPkg?.features || {});
      const inputFeatures = features !== undefined ? (typeof features === 'object' ? features : JSON.parse(features || '{}')) : currentFeatures;
      const mergedFeatures = {
        ...inputFeatures,
        duration_months: duration_months !== undefined ? Number(duration_months) : (inputFeatures.duration_months || currentPkg?.duration_months || 1),
        extra_price_per_user: extra_price_per_user !== undefined ? Number(extra_price_per_user) : (inputFeatures.extra_price_per_user || currentPkg?.extra_price_per_user || 0),
        base_capacity: max_santri !== undefined ? Number(max_santri) : (inputFeatures.base_capacity || currentPkg?.max_santri || 10),
      };
      updatePayload.features = JSON.stringify(mergedFeatures);
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

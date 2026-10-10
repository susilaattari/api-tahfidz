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
    const [id] = await db('packages').insert({
      name,
      code,
      price: price || 0,
      max_santri: max_santri || 100,
      features: typeof features === 'object' ? JSON.stringify(features) : (features || '{}'),
    });
    return this.getPackageById(id);
  }

  async updatePackage(id, data) {
    const { name, code, price, max_santri, features } = data;
    const updatePayload = {};
    if (name) updatePayload.name = name;
    if (code) updatePayload.code = code;
    if (price !== undefined) updatePayload.price = Number(price);
    if (max_santri !== undefined) updatePayload.max_santri = Number(max_santri);
    if (features !== undefined) {
      updatePayload.features = typeof features === 'object' ? JSON.stringify(features) : features;
    }
    updatePayload.updated_at = db.fn.now();

    await db('packages').where({ id }).update(updatePayload);
    return this.getPackageById(id);
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

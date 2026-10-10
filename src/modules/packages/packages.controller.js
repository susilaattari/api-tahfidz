const packagesService = require('./packages.service');
const { successResponse } = require('../../utils/response.util');

class PackagesController {
  async getAll(req, res, next) {
    try {
      const packages = await packagesService.getAllPackages();
      return successResponse(res, 'Daftar paket berhasil diambil.', packages);
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const pkg = await packagesService.getPackageById(req.params.id);
      return successResponse(res, 'Detail paket berhasil diambil.', pkg);
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const created = await packagesService.createPackage(req.body);
      return successResponse(res, 'Paket berhasil ditambahkan.', created, 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const updated = await packagesService.updatePackage(req.params.id, req.body);
      return successResponse(res, 'Paket berhasil diperbarui.', updated);
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      await packagesService.deletePackage(req.params.id);
      return successResponse(res, 'Paket berhasil dihapus.');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PackagesController();

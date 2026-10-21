function normalizeWhatsApp(value) {
  const phone = String(value || '').replace(/[^0-9]/g, '');
  return phone.startsWith('0') ? `62${phone.slice(1)}` : phone;
}

const brand = {
  name: process.env.BRAND_NAME || 'Quriva',
  companyName: process.env.COMPANY_NAME || 'PT Quriva Indonesia',
  rootDomain: process.env.ROOT_DOMAIN || 'quriva.tech',
  supportWhatsApp: normalizeWhatsApp(process.env.SUPPORT_WHATSAPP || process.env.SUPERADMIN_WA || '6289614072349'),
  supportEmail: process.env.SUPPORT_EMAIL || 'support@quriva.com',
  bank: {
    bank: process.env.BANK_NAME || 'Bank Syariah Indonesia (BSI)',
    accountNumber: process.env.BANK_ACCOUNT_NUMBER || '7123456789',
    accountName: process.env.BANK_ACCOUNT_NAME || 'PT Quriva Indonesia',
  },
};

brand.bankAccounts = [
  {
    bank: brand.bank.bank,
    account_number: brand.bank.accountNumber,
    account_name: brand.bank.accountName,
  },
];

if (process.env.BANK_ALT_NAME && process.env.BANK_ALT_ACCOUNT_NUMBER) {
  brand.bankAccounts.push({
    bank: process.env.BANK_ALT_NAME,
    account_number: process.env.BANK_ALT_ACCOUNT_NUMBER,
    account_name: process.env.BANK_ALT_ACCOUNT_NAME || brand.bank.accountName,
  });
}

brand.bankTransferInfo = `${brand.bank.bank}\nNo. Rekening: ${brand.bank.accountNumber}\na.n. ${brand.bank.accountName}`;

module.exports = brand;

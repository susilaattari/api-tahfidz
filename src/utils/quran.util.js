/**
 * Utilitas penomoran ayat Al-Qur'an (PRD Penilaian Hafalan Cepat §8 & §10).
 * Nomor ayat global 1–6236 memudahkan menentukan ayat berikutnya cukup dengan +1.
 */
const SURAH_NAMES = [
  'Al-Fatihah', 'Al-Baqarah', "Ali 'Imran", "An-Nisa'", "Al-Ma'idah", "Al-An'am", "Al-A'raf", 'Al-Anfal', 'At-Taubah',
  'Yunus', 'Hud', 'Yusuf', "Ar-Ra'd", 'Ibrahim', 'Al-Hijr', 'An-Nahl', "Al-Isra'", 'Al-Kahf', 'Maryam', 'Taha',
  "Al-Anbiya'", 'Al-Hajj', "Al-Mu'minun", 'An-Nur', 'Al-Furqan', "Asy-Syu'ara'", 'An-Naml', 'Al-Qasas', "Al-'Ankabut",
  'Ar-Rum', 'Luqman', 'As-Sajdah', 'Al-Ahzab', "Saba'", 'Fatir', 'Yasin', 'As-Saffat', 'Sad', 'Az-Zumar', 'Ghafir',
  'Fussilat', 'Asy-Syura', 'Az-Zukhruf', 'Ad-Dukhan', 'Al-Jasiyah', 'Al-Ahqaf', 'Muhammad', 'Al-Fath', 'Al-Hujurat',
  'Qaf', 'Az-Zariyat', 'At-Tur', 'An-Najm', 'Al-Qamar', 'Ar-Rahman', "Al-Waqi'ah", 'Al-Hadid', 'Al-Mujadilah',
  'Al-Hasyr', 'Al-Mumtahanah', 'As-Saff', "Al-Jumu'ah", 'Al-Munafiqun', 'At-Taghabun', 'At-Talaq', 'At-Tahrim',
  'Al-Mulk', 'Al-Qalam', 'Al-Haqqah', "Al-Ma'arij", 'Nuh', 'Al-Jinn', 'Al-Muzzammil', 'Al-Muddassir', 'Al-Qiyamah',
  'Al-Insan', 'Al-Mursalat', "An-Naba'", "An-Nazi'at", "'Abasa", 'At-Takwir', 'Al-Infitar', 'Al-Mutaffifin',
  'Al-Insyiqaq', 'Al-Buruj', 'At-Tariq', "Al-A'la", 'Al-Ghasyiyah', 'Al-Fajr', 'Al-Balad', 'Asy-Syams', 'Al-Lail',
  'Ad-Duha', 'Asy-Syarh', 'At-Tin', "Al-'Alaq", 'Al-Qadr', 'Al-Bayyinah', 'Az-Zalzalah', "Al-'Adiyat", "Al-Qari'ah",
  'At-Takasur', "Al-'Asr", 'Al-Humazah', 'Al-Fil', 'Quraisy', "Al-Ma'un", 'Al-Kausar', 'Al-Kafirun', 'An-Nasr',
  'Al-Lahab', 'Al-Ikhlas', 'Al-Falaq', 'An-Nas',
];

const AYAT_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
  112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85,
  54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13,
  14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42,
  29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11,
  11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
];

const TOTAL_AYAT = AYAT_COUNTS.reduce((a, b) => a + b, 0); // 6236

const OFFSETS = (() => {
  const offsets = [0];
  let acc = 0;
  AYAT_COUNTS.forEach((count) => {
    offsets.push(acc);
    acc += count;
  });
  return offsets; // OFFSETS[no] = jumlah ayat sebelum surah ke-no
})();

const ayatCount = (surahNo) => AYAT_COUNTS[surahNo - 1] || 0;
const surahName = (surahNo) => SURAH_NAMES[surahNo - 1] || `Surah ${surahNo}`;

const toGlobal = (surahNo, ayat) => OFFSETS[surahNo] + ayat;

const fromGlobal = (g) => {
  for (let no = AYAT_COUNTS.length; no >= 1; no--) {
    if (g > OFFSETS[no]) return { surah_number: no, ayat: g - OFFSETS[no] };
  }
  return { surah_number: 1, ayat: 1 };
};

const isValidAyat = (surahNo, ayat) =>
  Number.isInteger(surahNo) && Number.isInteger(ayat) && surahNo >= 1 && surahNo <= 114 && ayat >= 1 && ayat <= ayatCount(surahNo);

/**
 * Posisi setelah (surahNo, ayat).
 *  - MAJU   : urutan mushaf
 *  - MUNDUR : ayat maju di dalam surah, surah berikutnya adalah surah sebelumnya
 * Mengembalikan { khatam: true } bila melewati batas mushaf.
 */
const nextPosition = (surahNo, ayat, arah = 'MAJU') => {
  if (ayat < ayatCount(surahNo)) return { surah_number: surahNo, ayat: ayat + 1 };
  const nextSurah = String(arah).toUpperCase() === 'MUNDUR' ? surahNo - 1 : surahNo + 1;
  if (nextSurah < 1 || nextSurah > 114) return { khatam: true };
  return { surah_number: nextSurah, ayat: 1 };
};

const JUZ_STARTS = [
  [1, 1],    // Juz 1: Al-Fatihah 1
  [2, 142],  // Juz 2: Al-Baqarah 142
  [2, 253],  // Juz 3: Al-Baqarah 253
  [3, 93],   // Juz 4: Ali 'Imran 93
  [4, 24],   // Juz 5: An-Nisa' 24
  [4, 148],  // Juz 6: An-Nisa' 148
  [5, 82],   // Juz 7: Al-Ma'idah 82
  [6, 111],  // Juz 8: Al-An'am 111
  [7, 88],   // Juz 9: Al-A'raf 88
  [8, 41],   // Juz 10: Al-Anfal 41
  [9, 93],   // Juz 11: At-Taubah 93
  [11, 6],   // Juz 12: Hud 6
  [12, 53],  // Juz 13: Yusuf 53
  [15, 1],   // Juz 14: Al-Hijr 1
  [17, 1],   // Juz 15: Al-Isra' 1
  [18, 75],  // Juz 16: Al-Kahf 75
  [21, 1],   // Juz 17: Al-Anbiya' 1
  [23, 1],   // Juz 18: Al-Mu'minun 1
  [25, 21],  // Juz 19: Al-Furqan 21
  [27, 56],  // Juz 20: An-Naml 56
  [29, 46],  // Juz 21: Al-'Ankabut 46
  [33, 31],  // Juz 22: Al-Ahzab 31
  [36, 28],  // Juz 23: Ya-Sin 28
  [39, 32],  // Juz 24: Az-Zumar 32
  [41, 47],  // Juz 25: Fussilat 47
  [46, 1],   // Juz 26: Al-Ahqaf 1
  [51, 31],  // Juz 27: Adh-Dhariyat 31
  [58, 1],   // Juz 28: Al-Mujadilah 1
  [67, 1],   // Juz 29: Al-Mulk 1
  [78, 1],   // Juz 30: An-Naba' 1
];

const JUZ_GLOBAL_STARTS = JUZ_STARTS.map(([s, a]) => toGlobal(s, a));

/**
 * Mendapatkan nomor Juz (1 s.d. 30) dari sebuah ayat di surah tertentu.
 */
const getJuzFromAyat = (surahNo, ayat = 1) => {
  const g = toGlobal(Number(surahNo) || 1, Number(ayat) || 1);
  for (let j = 29; j >= 0; j--) {
    if (g >= JUZ_GLOBAL_STARTS[j]) return j + 1;
  }
  return 1;
};

/**
 * Mendapatkan daftar nomor Juz yang disentuh/dicakup oleh rentang ayat (ayatMulai s.d. ayatSelesai).
 */
const getJuzListForRange = (surahNo, verseStart, verseEnd) => {
  const s = Number(surahNo) || 1;
  const startAyat = Number(verseStart) || 1;
  const endAyat = Number(verseEnd) || startAyat;
  const jStart = getJuzFromAyat(s, Math.min(startAyat, endAyat));
  const jEnd = getJuzFromAyat(s, Math.max(startAyat, endAyat));
  const list = [];
  for (let j = jStart; j <= jEnd; j++) {
    list.push(j);
  }
  return list.length ? list : [jStart];
};

/**
 * Mendapatkan rentang global ayat dan total ayat dalam sebuah Juz (1 s.d. 30).
 */
const getJuzGlobalRange = (juzNo) => {
  const j = Math.max(1, Math.min(30, Number(juzNo) || 1));
  const startGlobal = JUZ_GLOBAL_STARTS[j - 1];
  const endGlobal = j < 30 ? JUZ_GLOBAL_STARTS[j] - 1 : TOTAL_AYAT;
  return {
    juz: j,
    startGlobal,
    endGlobal,
    totalAyat: endGlobal - startGlobal + 1,
  };
};

module.exports = {
  AYAT_COUNTS,
  TOTAL_AYAT,
  JUZ_STARTS,
  JUZ_GLOBAL_STARTS,
  ayatCount,
  surahName,
  toGlobal,
  fromGlobal,
  isValidAyat,
  nextPosition,
  getJuzFromAyat,
  getJuzListForRange,
  getJuzGlobalRange,
};


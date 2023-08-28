const { Telegraf, Markup, session   } = require("telegraf");
const crypto = require('crypto');
const express = require("express");
const mongoose = require("mongoose");

// Mengaktifkan session

require('dotenv').config();

// Fungsi enkripsi dan dekripsi
function encryptData(data) {
  const cipher = crypto.createCipher('aes-256-cbc', 'secret-key');
  let encryptedData = cipher.update(data, 'utf-8', 'base64');
  encryptedData += cipher.final('base64');
  return encryptedData;
}

function decryptData(data) {
  const decipher = crypto.createDecipher('aes-256-cbc', 'secret-key');
  let decryptedData = decipher.update(data, 'base64', 'utf-8');
  decryptedData += decipher.final('utf-8');
  return decryptedData;
}

const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
const mongodbAtlasURL = process.env.MONGODB_ATLAS_URL;

const bot = new Telegraf(telegramBotToken);

// Koneksi ke MongoDB Atlas
mongoose
  .connect(mongodbAtlasURL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Terhubung ke MongoDB Atlas");
  })
  .catch((error) => {
    console.error("Kesalahan saat terhubung ke MongoDB Atlas:", error);
  });

// Definisikan skema dan model profil
const profileSchema = new mongoose.Schema({
  name: String,
  gender: String,
  faceClaim: String,
  interestTo: String,
  personality: String,
  userId: Number,
  blockedUsers: [Number], // Menyimpan daftar ID pengguna yang diblokir
});

const Profile = mongoose.model("Profile", profileSchema);

// Definisikan skema dan model preferensi pasangan
const preferensiPasanganSchema = new mongoose.Schema({
  userId: Number,
  gender: String,
  interestTo: String,
});

const PreferensiPasangan = mongoose.model(
  "PreferensiPasangan",
  preferensiPasanganSchema
);

// Definisikan aplikasi Express
const app = express();
const port = 3000;

// Menjalankan server
app.listen(port, () => {
  console.log(`Server berjalan di http://localhost:${port}`);
});

// Menentukan webhook path
const webhookPath = "/YOUR_WEBHOOK_PATH"; // Ganti dengan webhook path yang sesuai

// Menghubungkan bot dengan API Telegram menggunakan webhook
app.use(bot.webhookCallback(webhookPath));

// Mengatur endpoint webhook
bot.telegram.setWebhook(`https://example.com${webhookPath}`); // Ganti dengan URL yang valid sesuai dengan konfigurasi server Anda
bot.use(session()); // Aktifkan penggunaan sesi di bot Anda

// Mendengarkan perintah '/start'
bot.command("start", (ctx) => {
  const chatId = ctx.chat.id;

  // Membangun keyboard inline
  const keyboard = {
    reply_markup: {
      keyboard: [
        [{ text: "/help" }],

      ],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  };

  // Mengirim pesan dengan tombol
  ctx.reply(
    "Selamat Datang di Tinder Roleplay!\n\nGunakan /help untuk melihat list perintah!",
    keyboard
  );
});

// Mendengarkan perintah '/help'
bot.command("help", (ctx) => {
  const chatId = ctx.chat.id;

  // Membangun keyboard inline
  const keyboard = {
    reply_markup: {
      keyboard: [
        [{ text: "/setProfile" }, { text: "/help" }],
        [{ text: "/cari" }, { text: "/update" }], [{ text: "/profile" }],
      ],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  };

  // Mengirim pesan dengan tombol
  ctx.reply(
    `
      Selamat datang di Tinder Roleplay Bot! Berikut adalah daftar perintah yang dapat Anda gunakan:\n/help - Menampilkan daftar perintah yang tersedia.\n/setProfile - Membuat profil baru.\n/profile - Menampilkan profil Anda.\n/update - Memperbarui profil.\n/cari - Mencari pasangan.\n/updatePreferensi - Mengupdate preferensi pasangan Anda.
      `,
    keyboard
  );
});



// Mendengarkan perintah '/setProfile'
bot.command('setProfile', async (ctx) => {
  const userId = ctx.from.id;
  try {
    const profile = await Profile.findOne({ userId });
    if (profile) {
      ctx.reply('Profil sudah dibuat. Gunakan perintah /update untuk mengubah profil kamu.');
      return;
    }
    // Menyimpan langkah-langkah yang harus diikuti dalam membuat profil
    const steps = ['name', 'gender (laki-laki / perempuan)', 'face Claim', 'Tertarik Mencari (teman/pacar/fwb)', 'personality'];
    let currentStep = 0;
    let profileData = { userId, blockedUsers: [] };
    // Mengirim pertanyaan untuk membuat profil
    ctx.reply(`Silakan jawab pertanyaan berikut untuk membuat profil:\n\n${steps[currentStep]}:`);
    // Mendefinisikan fungsi middleware
    const profileMiddleware = async (ctx) => {
      if (ctx.message.from.id === userId) {
        const message = ctx.message.text;
        if (currentStep < steps.length) {
          // Mengecek apakah currentStep adalah gender
          if (steps[currentStep] === 'gender (laki-laki / perempuan)') {
            // Memastikan bahwa gender yang dimasukkan adalah "laki-laki" atau "perempuan"
            if (!["laki-laki", "perempuan"].includes(message.toLowerCase())) {
              ctx.reply('Mohon masukkan jenis kelamin yang valid (laki-laki/perempuan).');
              return;
            }
            // Simpan gender ke dalam profil dan lanjut ke langkah berikutnya
            profileData.gender = message.toLowerCase();
            currentStep++;
          } else if (steps[currentStep] === 'face Claim') {
            // Simpan faceClaim ke dalam profil dan lanjut ke langkah berikutnya
            profileData.faceClaim = message;
            currentStep++;
          } else {
            // Memperbarui data profil dengan jawaban terbaru
            profileData[steps[currentStep]] = message;
            currentStep++;
          }
          if (currentStep < steps.length) {
            if (steps[currentStep] === 'personality') {
              // Mengirim inline keyboard untuk memilih personality
              ctx.reply(
                'Pilih personality kamu:',
                // Inline keyboard dengan dua tombol
              );
            } else {
              // Mengirim pertanyaan berikutnya
              ctx.reply(`${steps[currentStep]}:`);
            }
          } else {
            // Membuat profil dan menyimpan ke database
            const newProfile = new Profile(profileData);
            await newProfile.save();
            ctx.reply('Profil berhasil dibuat.');

            // Setelah profil berhasil dibuat, hapus middleware dari event listener

          }
        }
      }
    };
    // Menambahkan middleware ke perintah '/setProfile'
    bot.on('text', profileMiddleware);
  } catch (error) {
    console.error('Kesalahan saat membuat profil:', error);
    ctx.reply('Terjadi kesalahan saat membuat profil.');
  }
});

// Definisikan perintah '/profile' untuk menampilkan profil pengguna
bot.command("profile", async (ctx) => {
  const userId = ctx.from.id;
  try {
    const profile = await Profile.findOne({ userId });
    if (!profile) {
      ctx.reply("Profil belum dibuat. Gunakan perintah /setProfile untuk membuat profil kamu.");
      return;
    }
    ctx.reply(`Profile :\nNama: ${profile.name}\nJenis Kelamin: ${profile.gender}\nFace Claim: ${profile.faceClaim}\nKepribadian: ${profile.personality} \nInterest: ${profile.interestTo}`);
  } catch (error) {
    console.error("Kesalahan saat mengambil profil:", error);
    ctx.reply("Terjadi kesalahan saat mengambil profil.");
  }
});


// Tangani perintah /up untuk memperbarui profil
bot.command('up', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const commandArguments = ctx.message.text.split(' ');

    if (commandArguments.length !== 6) {
      ctx.reply('Format perintah salah. Gunakan: /up (Nama Baru) (Jenis Kelamin Baru) (Face Claim Baru) (Minat Baru) (Kepribadian Baru)');
      return;
    }

    const [, name, gender, faceClaim, interestTo, personality] = commandArguments;

    // Cari profil berdasarkan userId Telegram
    let profile = await Profile.findOne({ userId });

    if (!profile) {
      // Jika profil tidak ada, buat profil baru
      profile = new Profile({ userId, name, gender, faceClaim, interestTo, personality });
      await profile.save();
    } else {
      // Jika profil sudah ada, perbarui datanya
      profile.name = name;
      profile.gender = gender;
      profile.faceClaim = faceClaim;
      profile.interestTo = interestTo;
      profile.personality = personality;
      await profile.save();
    }

    ctx.reply('Profile berhasil diperbarui!');
  } catch (error) {
    console.error('Kesalahan saat memperbarui profil:', error);
    ctx.reply('Terjadi kesalahan saat memperbarui profil.');
  }
});

// Definisikan perintah '/update' untuk memberikan informasi tentang cara menggunakan '/up'
bot.command("update", (ctx) => {
  const helpMessage = "Cara mengupdate profil:\n\n /up [Nama] [Jenis Kelamin] [Face Claim] [Minat] [Kepribadian]\n\nContoh: /up Rena perempuan mikasa pacar ramah";
  ctx.reply(helpMessage);
});


const activeChats = {}; // Objek untuk melacak obrolan yang sedang berlangsung
const userCurrentIndexes = {}; // Objek untuk melacak currentIndex pengguna

// Command /cari
bot.command('cari', async (ctx) => {
  const userId = ctx.message.from.id;

  if (!userCurrentIndexes[userId]) {
    userCurrentIndexes[userId] = 0; // Inisialisasi currentIndex jika belum ada
  }

  const currentIndex = userCurrentIndexes[userId];
  

  // Cari PreferensiPasangan dengan userId yang sesuai
  const preferensi = await PreferensiPasangan.findOne({ userId: userId });

  if (!preferensi) {
    ctx.reply('Anda belum memiliki preferensi pasangan. Silakan gunakan /updatePreferensi untuk membuatnya.');
    return;
  }

  // Dapatkan gender dan interestTo dari preferensi
  const gender = preferensi.gender;
  const interestTo = preferensi.interestTo;

  // Cari profile yang cocok
  const matchingProfiles = await Profile.find({ gender: gender, interestTo: interestTo });


  if (matchingProfiles.length === 0) {
    ctx.reply('Tidak ditemukan pasangan yang cocok.');
    return;
  }


  const showProfile = (index) => {
    userCurrentIndexes[userId] = index; // Simpan currentIndex pengguna

    const profile = matchingProfiles[index];

    if (!profile) {
      ctx.reply('Tidak ada pasangan yang cocok dengan Anda lagi.');
      return;
    }

    const message = `
Name: ${profile.name}
Gender: ${profile.gender}
Face Claim: ${profile.faceClaim}
Personality: ${profile.personality}
    `;



    const inlineKeyboard = [
      [
        { text: 'Previous', callback_data: 'prev' },
        { text: 'Next', callback_data: 'next' },
      ],
    ];

    // Tambahkan tombol "Mulai Obrolan" jika obrolan belum dimulai
    if (!activeChats[userId] || activeChats[userId].endTime < new Date()) {
      inlineKeyboard.push([{ text: 'Mulai Obrolan', callback_data: 'start_chat' }]);
    }

    ctx.reply(message, {
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    });
  };

  showProfile(currentIndex);

   // ...

bot.action('prev', (ctx) => {
  const currentIndex = userCurrentIndexes[userId];
  const newIndex = Math.max(0, currentIndex - 1);
  showProfile(newIndex);
});

bot.action('next', (ctx) => {
  const currentIndex = userCurrentIndexes[userId];
  const newIndex = Math.min(currentIndex + 1, matchingProfiles.length - 1); // Perbaikan indeks array
  showProfile(newIndex);
});

// Fungsi untuk menangani pesan dari inisiator dan receiver
bot.on('text', async (ctx) => {
  const userId = ctx.message.from.id;

  if (activeChats[userId]) {
    const chat = activeChats[userId];
    const receiverUserId = chat.receiverUserId;
    const initiatorUserId = chat.initiatorUserId;

    // Kirim pesan yang diterima dari inisiator ke receiver dan sebaliknya
    try {
      if (userId === initiatorUserId) {
        // Kirim pesan hanya jika pengirim adalah inisiator
        await ctx.telegram.sendMessage(receiverUserId, ctx.message.text);
      } else if (userId === receiverUserId) {
        // Kirim pesan hanya jika pengirim adalah receiver
        await ctx.telegram.sendMessage(initiatorUserId, ctx.message.text);
      }
    } catch (error) {
      console.error('Kesalahan saat mengirim pesan:', error);
      ctx.reply('Terjadi kesalahan saat mengirim pesan.');
    }
  }
});

// Fungsi untuk memulai obrolan
bot.action('start_chat', async (ctx) => {
  const initiatorUserId = ctx.from.id;
  const currentIndex = userCurrentIndexes[initiatorUserId];
  
  // Dapatkan profil yang sesuai berdasarkan currentIndex
  const selectedProfile = matchingProfiles[currentIndex];
  
  if (!selectedProfile) {
    ctx.reply('Profil tidak ditemukan.');
    return;
  }
  
  const receiverUserId = selectedProfile.userId;
  
  const currentTime = new Date();
  const endTime = new Date(currentTime.getTime() + 30 * 60 * 1000); // Waktu berakhir 30 menit dari sekarang
  
  activeChats[initiatorUserId] = {
    receiverUserId: receiverUserId,
    initiatorUserId: initiatorUserId,
    startTime: currentTime,
    endTime: endTime,
  };
  
  // Kirim pesan ke penerima (receiver)
  try {
    await ctx.telegram.sendMessage(receiverUserId, 'Obrolan dimulai! Anda memiliki 30 menit untuk berbicara.');
  } catch (error) {
    console.error('Kesalahan saat mengirim pesan ke penerima:', error);
    ctx.reply('Terjadi kesalahan saat memulai obrolan.');
  }
  
  // Kirim pesan ke inisiator
  try {
    await ctx.telegram.sendMessage(initiatorUserId, 'Obrolan dimulai! Anda memiliki 30 menit untuk berbicara.');
  } catch (error) {
    console.error('Kesalahan saat mengirim pesan ke inisiator:', error);
    ctx.reply('Obrolan dimulai! Anda memiliki 30 menit untuk berbicara.');
  }
});




    
});

setInterval(() => {
  const currentTime = new Date();
  for (const userId in activeChats) {
    if (activeChats[userId].endTime < currentTime) {
      delete activeChats[userId]; // Hapus obrolan yang sudah berakhir dari daftar obrolan aktif
    }
  }
}, 60 * 1000); // Interval setiap 1 menit



bot.command("updatePreferensi", async (ctx) => {
  const userId = ctx.from.id;
  try {
    // Menemukan atau membuat preferensi pasangan berdasarkan userId
    let preferensi = await PreferensiPasangan.findOne({ userId });

    if (!preferensi) {
      // Jika preferensi pasangan belum ada, buat profil baru
      const commandArguments = ctx.message.text.split(" ");
      if (commandArguments.length < 4) {
        ctx.reply('Cara mengupdate prefensi pasangan:\n\n /updatePreferensi [Jenis Kelamin] [Tertarik Mencari]');
        return;
      }

      const [, gender, ...interestTo] = commandArguments;
      const newPreferensi = new PreferensiPasangan({ userId, gender, interestTo: interestTo.join(" ") });
      await newPreferensi.save();

      ctx.reply('Profil preferensi pasangan berhasil dibuat!');
    } else {
      // Jika preferensi pasangan sudah ada, perbarui profil
      const commandArguments = ctx.message.text.split(" ");
      if (commandArguments.length < 3) {
        ctx.reply('Cara mengupdate prefensi pasangan:\n\n /updatePreferensi [Jenis Kelamin] [Tertarik Mencari]');
        return;
      }

      const [, gender, ...interestTo] = commandArguments;
      preferensi.gender = gender;
      preferensi.interestTo = interestTo.join(" ");
      await preferensi.save();

      ctx.reply('Profil preferensi pasangan berhasil diperbarui!');
    }
  } catch (error) {
    console.error('Kesalahan saat memperbarui preferensi pasangan:', error);
    ctx.reply('Terjadi kesalahan saat memperbarui preferensi pasangan.');
  }
});



// Jalankan bot
bot.launch().then(() => {
  console.log('Bot berjalan!');
});
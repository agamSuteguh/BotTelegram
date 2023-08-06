const { Telegraf, Markup } = require("telegraf");
const crypto = require('crypto');
const express = require("express");
const mongoose = require("mongoose");


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
  faceClaim: String,
  interestTo: String,
  personality: String,
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
    "\nGunakan /setProfile untuk mengatur profil kamu!\nGunakan /profile untuk melihat profile kamu! \n Gunaka /update untuk mengubah kamu!\nGunakan /help untuk melihat list perintah!\nGunakan /cari untuk mencari pasangan!",
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

    ctx.reply(`Profile :\nNama: ${profile.name}\nJenis Kelamin: ${profile.gender}\nFace Claim: ${profile.faceClaim}\nKepribadian: ${profile.personality}`);
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

    ctx.reply('Profil berhasil diperbarui!');
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

// Mendengarkan perintah '/chat {userid}'
bot.command("chat", (ctx) => {
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;
  const targetUserId = ctx.message.text.split(" ")[1];

  const DecryptTarget = decryptData(targetUserId)

  if (DecryptTarget === userId.toString()) {
    ctx.reply("Anda tidak dapat mengirim pesan kepada diri sendiri.");
    return;
  }

  // Membangun keyboard inline untuk membalas pesan
  const keyboard = Markup.inlineKeyboard([
    Markup.button.callback("Balas", `/reply${userId}`),
  ]);

  ctx.reply(
    "Anda sedang dalam mode chat. Kirimkan pesan untuk diteruskan ke pengguna yang dipilih.",
    keyboard
  );

  // Menangkap pesan dari pengguna dan meneruskannya ke pengguna target
  bot.on("text", async (ctx) => {
    if (ctx.message.from.id === userId) {
      const message = ctx.message.text;

      try {
        // Cek apakah pengguna yang dituju ada dalam daftar pengguna yang diblokir
        const profile = await Profile.findOne({ userId: DecryptTarget });

        if (!profile || profile.blockedUsers.includes(userId)) {
          ctx.reply("Pengguna yang dituju tidak dapat menerima pesan.");
          return;
        }

        // Kirim pesan ke pengguna target
        ctx.telegram.sendMessage(DecryptTarget, "Chat Dari : " + profile.name + "\n\n" + message);
        ctx.reply("Pesan berhasil dikirim.");
        console.log(profile)
      } catch (error) {
        console.error("Kesalahan saat meneruskan pesan:", error);
        ctx.reply("Terjadi kesalahan saat meneruskan pesan.");
      }
    }
  });
});

//cari command

// Fungsi untuk membuat markup inline keyboard untuk navigasi halaman
function getPaginationButtons(page) {
  return {
    reply_markup: {
      inline_keyboard: [
        /* Inline buttons. 2 side-by-side */
        [{ text: "Sebelumnya", callback_data: `prev_${page - 1}` }, { text: "Berikutnya", callback_data: `next_${page + 1}` }],

        /* Jika Anda ingin menambahkan tombol lain di sini, Anda bisa melakukannya */
      ],
    },
  };
}


// Fungsi untuk mencari pasangan berdasarkan preferensi dengan sistem paging
async function cariPasangan(userId, page, pageSize, skip) {
  try {
    // Ambil profil pengguna
    const userProfile = await Profile.findOne({ userId });

    if (!userProfile) {
      return "Profil Anda belum dibuat. Gunakan perintah /setProfile untuk membuat profil Anda terlebih dahulu.";
    }

    const userGender = userProfile.gender;

    // Mencari profil dengan gender yang berbeda dari pengguna saat ini dengan sistem paging
    const matchingProfiles = await Profile.find({
      gender: { $ne: userGender },
      userId: { $ne: userId }, // Exclude current user from the results
    })
      .skip(skip)
      .limit(pageSize);

    if (matchingProfiles.length === 0) {
      return "Tidak ada pasangan yang cocok dengan preferensi Anda saat ini.";
    }

    // Tampilkan profil yang cocok dengan preferensi pasangan
    let resultMessage = `Halaman ${page}:\n\n`;
    matchingProfiles.forEach((profile) => {
      resultMessage += `Nama: ${profile.name}\nJenis Kelamin: ${profile.gender}\nFace Claim: ${profile.faceClaim}\nKepribadian: ${profile.personality}\n\n`;
    });

    // Cek apakah ada halaman sebelumnya
    if (skip >= pageSize) {
      resultMessage += "Ketik /cari " + (page - 1) + " untuk melihat halaman sebelumnya.\n";
    }

    // Cek apakah ada halaman berikutnya
    const totalMatchingProfiles = await Profile.countDocuments({
      gender: { $ne: userGender },
      userId: { $ne: userId },
    });
    if (skip + pageSize < totalMatchingProfiles) {
      resultMessage += "Ketik /cari " + (page + 1) + " untuk melihat halaman berikutnya.\n";
    }

    return resultMessage;
  } catch (error) {
    console.error("Kesalahan saat mencari pasangan:", error);
    return "Terjadi kesalahan saat mencari pasangan.";
  }
}


// Perintah '/cari' dengan menggunakan tombol inline untuk navigasi halaman
bot.command("cari", async (ctx) => {
  const userId = ctx.from.id;
  const page = Number(ctx.message.text.split(" ")[1]) || 1; // Jika tidak ada nomor halaman, default ke halaman 1

  try {
    const pageSize = 5; // Jumlah profil yang ditampilkan dalam satu halaman
    const skip = (page - 1) * pageSize;

    const resultMessage = await cariPasangan(userId, page, pageSize, skip);

    // Kirim pesan hasil pencarian dengan tombol inline untuk navigasi halaman
    ctx.reply(resultMessage, getPaginationButtons(page));
  } catch (error) {
    console.error("Kesalahan saat mencari pasangan:", error);
    ctx.reply("Terjadi kesalahan saat mencari pasangan.");
  }
});

// Tangani callback dari tombol inline untuk navigasi halaman
bot.action(/(prev|next)_\d+/, async (ctx) => {
  const userId = ctx.from.id;
  const action = ctx.match[1];
  const page = Number(ctx.match[0].split("_")[1]);

  const pageSize = 5;
  const skip = (page - 1) * pageSize;

  try {
    const resultMessage = await cariPasangan(userId, page, pageSize, skip);

    // Update pesan asli dengan hasil pencarian baru dan tombol inline yang diperbarui
    ctx.editMessageText(resultMessage, getPaginationButtons(page));
  } catch (error) {
    console.error("Kesalahan saat mencari pasangan:", error);
    ctx.reply("Terjadi kesalahan saat mencari pasangan.");
  }
});

// Jalankan bot
bot.launch().then(() => {
  console.log('Bot berjalan!');
});
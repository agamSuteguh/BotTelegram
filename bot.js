const { Telegraf, Markup, session } = require("telegraf");;
const base64url = require('base64url');
const CryptoJS = require('crypto-js');
const express = require("express");
const mongoose = require("mongoose");

// Mengaktifkan session

require('dotenv').config();


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

 // Mendefinisikan model Chat
const roomSchema = new mongoose.Schema({
  roomId: String,
  users: [Number],
  messages: [String],
});

const RoomModel = mongoose.model('Room', roomSchema);

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

const userCurrentIndexes = {};

bot.command('cari', async (ctx) => {
  const userId = ctx.message.from.id;

  try {
    if (!userCurrentIndexes[userId]) {
      userCurrentIndexes[userId] = 0;
    }

    const currentIndex = userCurrentIndexes[userId];
    const preferensi = await PreferensiPasangan.findOne({ userId });

    if (!preferensi) {
      return ctx.reply('Anda belum memiliki preferensi pasangan. Silakan gunakan /updatePreferensi untuk membuatnya.');
    }

    const { gender, interestTo } = preferensi;
    const matchingProfiles = await Profile.find({ gender, interestTo });

    if (matchingProfiles.length === 0) {
      return ctx.reply('Tidak ditemukan pasangan yang cocok.');
    }

    const showProfile = (index) => {
      userCurrentIndexes[userId] = index;
      const profile = matchingProfiles[index];

      if (!profile) {
        return ctx.reply('Tidak ada pasangan yang cocok dengan Anda lagi.');
      }

      const message = `
        Name: ${profile.name}
        Gender: ${profile.gender}
        Face Claim: ${profile.faceClaim}
        Personality: ${profile.personality}
      `;

      const inlineKeyboard = [
        [{ text: 'Previous', callback_data: 'prev' }, { text: 'Next', callback_data: 'next' }],
        [{ text: 'Mulai Obrolan', callback_data: `start_chat_${profile.userId}` }],
      ];

      ctx.reply(message, {
        reply_markup: {
          inline_keyboard: inlineKeyboard,
        },
      });
    };

    showProfile(currentIndex);

    bot.action('prev', (ctx) => {
      const currentIndex = userCurrentIndexes[userId];
      const newIndex = Math.max(0, currentIndex - 1);
      showProfile(newIndex);
    });

    bot.action('next', (ctx) => {
      const currentIndex = userCurrentIndexes[userId];
      const newIndex = Math.min(currentIndex + 1, matchingProfiles.length - 1);
      showProfile(newIndex);
    });
    bot.action(/^start_chat_(\d+)$/, async (ctx) => {
      const [, targetUserId] = ctx.match;
    
      try {
        // Di sini, Anda dapat membuat ruangan baru dan mendapatkan kode ruangan
        const chatId = ctx.chat.id;
        const roomKey = chatId.toString();
    
        if (!(await RoomModel.exists({ roomId: roomKey }))) {
          const room = new RoomModel({ roomId: roomKey, users: [ctx.from.id], messages: [] });
          await room.save();
        }
    
        // Kirim undangan ke pengguna dengan perintah /join dan kode ruangan
        ctx.telegram.sendMessage(targetUserId, `Anda telah diajak untuk bergabung ke ruangan. Ketik /join ${roomKey} untuk bergabung ke ruangan.`);
    
        ctx.reply('Undangan Telah Dikirim!');
    
      } catch (error) {
        console.error('Terjadi kesalahan saat membuat ruangan:', error);
        ctx.reply('Terjadi kesalahan dalam memproses permintaan Anda.');
      }
    });
    
    

  } catch (error) {
    console.error('Terjadi kesalahan:', error);
    ctx.reply('Terjadi kesalahan dalam memproses permintaan Anda.');
  }
});





bot.command('end_room', async (ctx) => {
  const chatId = ctx.chat.id;
  const roomKey = chatId.toString();

  if (await RoomModel.exists({ roomId: roomKey })) {
    await RoomModel.deleteOne({ roomId: roomKey });
    ctx.reply('Ruangan telah diakhiri.');
  } else {
    ctx.reply('Anda tidak memiliki ruangan aktif.');
  }
});

bot.command('join', async (ctx) => {
  const chatId = ctx.chat.id;
  const roomKey = ctx.message.text.split(' ')[1];

  if (await RoomModel.exists({ roomId: roomKey })) {
    const room = await RoomModel.findOne({ roomId: roomKey });

    if (room.users.includes(ctx.from.id)) {
      ctx.reply('Anda sudah bergabung ke ruangan ini.');
    } else {
      room.users.push(ctx.from.id);
      await room.save();
      ctx.reply('Anda telah bergabung ke ruangan. Pesan yang Anda kirim akan diteruskan ke semua anggota ruangan.');
    }
  } else {
    ctx.reply('Ruangan tidak ditemukan. Pastikan Anda menggunakan kode ruangan yang benar.');
  }
});

bot.on('text', async (ctx) => {
  const chatId = ctx.chat.id;
  const roomKey = chatId.toString();

  if (await RoomModel.exists({ roomId: roomKey })) {
    // Ubah pesan ke dalam format yang diinginkan
    const userProfile = await Profile.findOne({ userId: ctx.from.id });
    const username = userProfile ? userProfile.name : ctx.from.username;
    const message = `${username}: ${ctx.message.text}`;
    
    const room = await RoomModel.findOne({ roomId: roomKey });
    room.messages.push(message);
    await room.save();

    // Meneruskan pesan ke semua anggota ruangan
    room.users.forEach((userId) => {
      bot.telegram.sendMessage(userId, message);
    });
  }
});

// Fungsi untuk menghapus ruangan setelah 5 menit
setInterval(async () => {
  const now = Date.now();
  const roomsToDelete = await RoomModel.find({ createdAt: { $lt: new Date(now - 5 * 60 * 1000) } });
  roomsToDelete.forEach(async (room) => {
    await room.remove();
  });
}, 60000);


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


function decodeAndDecrypt(encodedData, key) {
  const encryptedBase64 = base64URLToBase64(encodedData);
  const decryptedData = CryptoJS.AES.decrypt(encryptedBase64, key);
  return decryptedData.toString(CryptoJS.enc.Utf8);
}

// Fungsi untuk mengubah Base64URL kembali menjadi Base64 biasa
function base64URLToBase64(base64URL) {
  return base64URL.replace(/-/g, '+').replace(/_/g, '/');
}


// Jalankan bot
bot.launch().then(() => {
  console.log('Bot berjalan!');
});
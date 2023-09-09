const { Telegraf, Markup, session } = require("telegraf");;
const base64url = require('base64url');
const CryptoJS = require('crypto-js');
const express = require("express");
const mongoose = require("mongoose");
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

// Buat adapter dan database Lowdb
const adapter = new FileSync('lowdb.json'); // Nama file database Lowdb
const lowdb = low(adapter);




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

  const roomSchema = new mongoose.Schema({
    roomId: String,
    messages: [String],
    memberCreate: Number, // ID pengguna yang membuat ruangan
    memberJoin: Number,   // ID pengguna yang bergabung ke ruangan
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
        [{ text: "/cari" }, { text: "/update" }], [{ text: "/profile" },{text:"/updatePrefrensi"}],
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

    // Validasi kata kunci untuk jenis kelamin
    const validGenders = ["cowo", "cewe", "biseksual"];
    if (!validGenders.includes(gender.toLowerCase())) {
      ctx.reply('Jenis kelamin harus "Cowo", "Cewe", atau "Biseksual" Serta periksa apakah ada spasi ganda.');
      return;
    }

    // Validasi kata kunci untuk jenis mencari
    const validInterests = ["teman", "pacar", "fwb", "fwa"];
    if (!validInterests.includes(interestTo.toLowerCase())) {
      ctx.reply('Jenis mencari harus "Teman", "Pacar", "Fwb", atau "Fwa" Serta periksa apakah ada spasi ganda.');
      return;
    }

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
  const helpMessage = "Cara mengupdate profil:\n\n /up Nama Jenis_Kelamin Face_Claim Minat_Mencari Kepribadian\n\nlist gender (Cowo, Cewe, atau Biseksual)\n\n list minat (Teman, Pacar, Fwb, atau Fwa)\n\nContoh: /up Rena Cewe mikasa pacar ramah";
  ctx.reply(helpMessage);
});



// Definisikan showProfile di luar tindakan "Cari"
const showProfile = (ctx, currentIndex, matchingProfiles, userId) => {
  const profile = matchingProfiles[currentIndex];

  if (!profile) {
    return ctx.reply('Tidak ada pasangan yang cocok dengan Anda lagi.');
  }

  const message = `
Pengguna ke ${currentIndex + 1}
Name: ${profile.name}
Gender: ${profile.gender}
Face Claim: ${profile.faceClaim}
Personality: ${profile.personality}
  `;

  const inlineKeyboard = [
    [{ text: 'Previous', callback_data: 'prev' }, { text: 'Next', callback_data: 'next' }],
    [{ text: 'Mulai Obrolan', callback_data: `start_chat_${profile.userId}_${userId}` }],
  ];

  ctx.reply(message, {
    reply_markup: {
      inline_keyboard: inlineKeyboard,
    },
  });
};

bot.command('cari', async (ctx) => {
  const userId = ctx.message.from.id;

  try {
    // Ambil preferensi pasangan dari database berdasarkan ID pengguna
    const preferensi = await PreferensiPasangan.findOne({ userId });

    if (!preferensi) {
      return ctx.reply('Anda belum memiliki preferensi pasangan. Silakan gunakan /updatePreferensi untuk membuatnya.');
    }

    // Ambil indeks saat ini dari Lowdb berdasarkan ID pengguna
    let currentIndex = lowdb.get(`userCurrentIndex:${userId}`, 0).value();

    if (!currentIndex) {
      currentIndex = 0;
    }

    const { gender, interestTo } = preferensi;
    const matchingProfiles = await Profile.find({ gender, interestTo });

    if (matchingProfiles.length === 0) {
      return ctx.reply('Tidak ditemukan pasangan yang cocok.');
    }

    // Memeriksa apakah ini pencarian pertama atau terakhir
    const isFirstProfile = currentIndex === 0;
    const isLastProfile = currentIndex === matchingProfiles.length - 1;

    // Panggil showProfile di sini dengan menggunakan ctx, currentIndex, matchingProfiles, dan userId
    showProfile(ctx, currentIndex, matchingProfiles, userId, isFirstProfile, isLastProfile);

    // Simpan userId dari matchingProfile ke dalam LowDB
    lowdb.set(`userCurrentMatchingUserId:${userId}`, matchingProfiles[currentIndex].userId).write();

    // Update indeks saat ini ke Lowdb
    lowdb.set(`userCurrentIndex:${userId}`, currentIndex).write();

  } catch (error) {
    console.error('Terjadi kesalahan:', error);
    ctx.reply('Terjadi kesalahan dalam memproses permintaan Anda.');
  }
});

bot.action('next', async (ctx) => {
  const userId = ctx.callbackQuery.from.id;

  // Ambil preferensi pasangan dari database berdasarkan ID pengguna
  const preferensi = await PreferensiPasangan.findOne({ userId });

  if (!preferensi) {
    return ctx.reply('Anda belum memiliki preferensi pasangan. Silakan gunakan /updatePreferensi untuk membuatnya.');
  }

  const { gender, interestTo } = preferensi;

  // Ambil indeks saat ini dari Lowdb berdasarkan ID pengguna
  let currentIndex = lowdb.get(`userCurrentIndex:${userId}`, 0).value();

  if (!currentIndex) {
    currentIndex = 0;
  }

  // Cari profil yang cocok berdasarkan preferensi
  const matchingProfiles = await Profile.find({ gender, interestTo });

  if (matchingProfiles.length === 0) {
    return ctx.reply('Tidak ditemukan pasangan yang cocok.');
  }

  const newIndex = Math.min(currentIndex + 1, matchingProfiles.length - 1);

  // Memeriksa apakah ini adalah profil terakhir
  const isLastProfile = newIndex === matchingProfiles.length - 1;
  if (isLastProfile) {
    return ctx.reply('Semua pengguna yang cocok dengan prefensi anda telah ditampilkan');
  }

  showProfile(ctx, newIndex, matchingProfiles, userId);

  // Simpan userId dari matchingProfile ke dalam LowDB
  lowdb.set(`userCurrentMatchingUserId:${userId}`, matchingProfiles[newIndex].userId).write();

  // Update indeks saat ini ke Lowdb
  lowdb.set(`userCurrentIndex:${userId}`, newIndex).write();
});

bot.action('prev', async (ctx) => {
  const userId = ctx.callbackQuery.from.id;

  // Ambil preferensi pasangan dari database berdasarkan ID pengguna
  const preferensi = await PreferensiPasangan.findOne({ userId });

  if (!preferensi) {
    return ctx.reply('Anda belum memiliki preferensi pasangan. Silakan gunakan /updatePreferensi untuk membuatnya.');
  }

  const { gender, interestTo } = preferensi;

  // Ambil indeks saat ini dari Lowdb berdasarkan ID pengguna
  let currentIndex = lowdb.get(`userCurrentIndex:${userId}`, 0).value();

  if (!currentIndex) {
    currentIndex = 0;
  }

  // Cari profil yang cocok berdasarkan preferensi
  const matchingProfiles = await Profile.find({ gender, interestTo });

  if (matchingProfiles.length === 0) {
    return ctx.reply('Tidak ditemukan pasangan yang cocok.');
  }

  const newIndex = Math.max(currentIndex - 1, 0);

  // Memeriksa apakah ini adalah profil pertama
  const isFirstProfile = newIndex === 0;
  if (isFirstProfile) {
    return ctx.reply('Ini adalah pengguna pertama');
  }

  showProfile(ctx, newIndex, matchingProfiles, userId);

  // Simpan userId dari matchingProfile ke dalam LowDB
  lowdb.set(`userCurrentMatchingUserId:${userId}`, matchingProfiles[newIndex].userId).write();

  // Update indeks saat ini ke Lowdb
  lowdb.set(`userCurrentIndex:${userId}`, newIndex).write();
});

// Tindakan untuk "Mulai Obrolan"
bot.action(/^start_chat_(\d+)_(\d+)$/, async (ctx) => {
  const chatId = ctx.chat.id;
  const roomKey = chatId.toString();
  const userId = ctx.callbackQuery.from.id; // Definisikan userId di sini
  // Mengambil nilai userCurrentMatchingUserId dari LowDB
const userCurrentMatchingUserId = lowdb.get(`userCurrentMatchingUserId:${userId}`).value();


  if (!(await RoomModel.exists({ roomId: roomKey }))) {
    const room = new RoomModel({
      roomId: roomKey,
      messages: [],
      memberCreate: ctx.from.id,
      memberJoin: 0,
    });
    await room.save();

    // Fetch the matching profile's information
    const matchingProfile = await Profile.findOne({ userId: chatId });

    // Check if a matching profile is found
    if (matchingProfile) {
      // Customize the message to include matchingProfileUserId
      const message = `
        Anda telah diundang untuk berbicara dengan ${matchingProfile.name} . Ketik /join ${roomKey} jika Anda ingin menerima undangan.
      `;

      // Send the customized message
      bot.telegram.sendMessage(userCurrentMatchingUserId, message);
      ctx.reply('Undangan telah dikirim!');
    } else {
      ctx.reply('Profil pasangan tidak ditemukan.');
    }
  } else {
    ctx.reply('Anda sudah memiliki percakapan aktif. Gunakan perintah /end_room untuk mengakhiri obrolan sebelum membuat yang baru.');
  }
});








bot.command('end_room', async (ctx) => {
  const chatId = ctx.chat.id;
  const roomKey = chatId.toString();

  if (await RoomModel.exists({ roomId: roomKey })) {
    await RoomModel.deleteOne({ roomId: roomKey });
    ctx.reply('obrolan telah diakhiri.');
  } else {
    ctx.reply('Anda tidak memiliki obrolan aktif.');
  }
});


// Fungsi untuk menghapus ruangan setelah 5 menit
const deleteRoomAfterFiveMinutes = async (roomKey) => {
  // Tunggu 5 menit sebelum menghapus ruangan
  await new Promise((resolve) => setTimeout(resolve, 5 * 60 * 1000));

  // Setelah 5 menit, hapus ruangan
  await RoomModel.deleteOne({ roomId: roomKey });
};

// Fungsi untuk mengirim pesan "test" setelah 4 menit
const sendTestMessageAfterFourMinutes = async (ctx) => {
  // Tunggu 4 menit sebelum mengirim pesan "test"
  await new Promise((resolve) => setTimeout(resolve, 4 * 60 * 1000));

  // Setelah 4 menit, kirim pesan "test"
  ctx.reply("test");
};

bot.command('join', async (ctx) => {
  const chatId = ctx.chat.id;
  const roomKey = ctx.message.text.split(' ')[1];

  if (await RoomModel.exists({ roomId: roomKey })) {
    const room = await RoomModel.findOne({ roomId: roomKey });

    if (room) {
      if (room.memberJoin === ctx.from.id) {
        ctx.reply('Anda sudah bergabung ke obrolan ini.');
      } else {
        if (room.memberJoin !== 0) {
          // Pengguna yang mengundang sudah bergabung ke obrolan lain
          ctx.reply('Orang yang mengundang Anda sudah bergabung ke obrolan lain.');
        } else {
          room.memberJoin = ctx.from.id; // Update ID pengguna yang bergabung ke obrolan
          await room.save();
          ctx.reply('Anda telah bergabung ke obrolan. Pesan yang Anda kirim akan diteruskan ke semua anggota obrolan.');

          // Setelah bergabung ke obrolan, mulai penghitungan waktu 5 menit untuk menghapus ruangan
          deleteRoomAfterFiveMinutes(roomKey);

          // Setelah bergabung ke obrolan, mulai penghitungan waktu 4 menit untuk mengirim pesan "test"
          sendTestMessageAfterFourMinutes(ctx);
        }
      }
    } else {
      ctx.reply('Obrolan tidak ditemukan. Pastikan Anda menggunakan kode obrolan yang benar.');
    }
  } else {
    ctx.reply('Obrolan tidak ditemukan. Pastikan Anda menggunakan kode obrolan yang benar.');
  }
});



// Definisikan perintah /updatePreferensi untuk memberikan informasi tentang cara menggunakan '/upPre'
bot.command("updatePreferensi", (ctx) => {
  const helpMessage = "Cara mengupdate Prefensi Pasangan:\n\n /upPre Tertarik_Mencari Tertarik_Mencari\n\nlist gender (Cowo, Cewe, atau Biseksual)\n\nlist minat (Teman, Pacar, Fwb, atau Fwa) \n\nContoh: /upPre cewe fwb";
  ctx.reply(helpMessage);
});


bot.command("upPre", async (ctx) => {
  const userId = ctx.from.id;
  try {
    const commandArguments = ctx.message.text.split(" ");
    if (commandArguments.length < 3) {
      ctx.reply('Cara mengupdate prefensi pasangan:\n\n /upPre [Jenis Kelamin] [Jenis Mencari]');
      return;
    }

    const [, gender, interestTo] = commandArguments;

    // Validasi kata kunci untuk jenis kelamin
    const validGenders = ["cowo", "cewe", "biseksual"];
    const lowerCaseGender = gender.toLowerCase();
   // Validasi kata kunci untuk jenis kelamin
if (!validGenders.includes(gender.toLowerCase())) {
  ctx.reply('Jenis kelamin harus "Cowo," "Cewe," atau "Biseksual", Serta periksa apakah ada spasi ganda.');
  return;
}

    // Validasi kata kunci untuk jenis mencari
    const validInterests = ["teman", "pacar", "fwb", "fwa"];
    const lowerCaseInterestTo = interestTo.toLowerCase();
  // Validasi kata kunci untuk jenis mencari
if (!validInterests.includes(interestTo.toLowerCase())) {
  ctx.reply('Jenis mencari harus "Teman", "Pacar", "Fwb", atau "Fwa", Serta periksa apakah ada spasi ganda.');
  return;
}

    // Menemukan atau membuat preferensi pasangan berdasarkan userId
    let preferensi = await PreferensiPasangan.findOne({ userId });

    if (!preferensi) {
      // Jika preferensi pasangan belum ada, buat profil baru
      const newPreferensi = new PreferensiPasangan({ userId, gender: lowerCaseGender, interestTo: lowerCaseInterestTo });
      await newPreferensi.save();

      ctx.reply('Profil preferensi pasangan berhasil dibuat!');
    } else {
      // Jika preferensi pasangan sudah ada, perbarui profil
      preferensi.gender = lowerCaseGender;
      preferensi.interestTo = lowerCaseInterestTo;
      await preferensi.save();

      ctx.reply('Profil preferensi pasangan berhasil diperbarui!');
    }
  } catch (error) {
    console.error('Kesalahan saat memperbarui preferensi pasangan:', error);
    ctx.reply('Terjadi kesalahan saat memperbarui preferensi pasangan.');
  }
});



// Mendengarkan pesan dari bot
bot.on('text', async (ctx) => {
  const userId = ctx.from.id; // Mendapatkan ID pengguna yang mengirim pesan
  const text = ctx.message.text; // Mendapatkan teks pesan

  // Cari ruangan yang memiliki memberCreate atau memberJoin sama dengan userId
  const room = await RoomModel.findOne({
    $or: [{ memberCreate: userId }, { memberJoin: userId }],
  });

  if (room) {
    // Tambahkan pesan ke dalam daftar pesan di ruangan
    room.messages.push(text);
    await room.save(); // Simpan perubahan ke dalam database

    // Balas pesan pengguna
    const profile = await Profile.findOne({ userId });
    const message = `${profile.name}: ${ctx.message.text}`;
    
    if (userId === room.memberCreate) {
      // Jika pengguna adalah memberCreate, kirim pesan hanya ke memberJoin
      bot.telegram.sendMessage(room.memberJoin, message);
      ctx.reply('pesan berhasil terkirim!');
    } else if (userId === room.memberJoin) {
      // Jika pengguna adalah memberJoin, kirim pesan hanya ke memberCreate
      bot.telegram.sendMessage(room.memberCreate, message);
      ctx.reply('pesan berhasil terkirim!');
    }
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
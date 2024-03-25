const { Telegraf, session } = require("telegraf");
const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");



// Mengaktifkan session
dotenv.config();
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
  memberJoin: Number, // ID pengguna yang bergabung ke ruangan
});

const RoomModel = mongoose.model("Room", roomSchema);

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
const webhookPath = "/BotLara"; // Ganti dengan webhook path yang sesuai

// Menghubungkan bot dengan API Telegram menggunakan webhook
app.use(bot.webhookCallback(webhookPath));

// Mengatur endpoint webhook
bot.telegram.setWebhook(`bot-telegram-mu-seven.vercel.app${webhookPath}`); bot.use(session()); // Aktifkan penggunaan sesi di bot Anda

// Middleware untuk memeriksa keanggotaan pengguna dalam saluran
const checkMembership = (ctx, next) => {
  const userId = ctx.from.id;
  const channelId = '@satumalamCH'; // Ganti dengan nama pengguna saluran Anda

  ctx.telegram.getChatMember(channelId, userId)
    .then((chatMember) => {
      if (chatMember.status === 'member' || chatMember.status === 'creator' || chatMember.status === 'administrator') 
        { 
        next();
      } else {
        ctx.reply(`Anda belum menjadi anggota saluran kami. Silakan bergabung ${channelId} terlebih dahulu.`)
        console.log(chatMember);
      }
    })
    .catch((error) => {
      console.error(error);
      ctx.reply(`masukin bot nya ke ${channelId} `);
    });
};

// Mendengarkan perintah '/help'
bot.command("start",checkMembership, (ctx) => {
  const chatId = ctx.chat.id;

  // Membangun keyboard inline
  const keyboard = {
    reply_markup: {
      keyboard: [

        [{ text: "/search" }, { text: "/updateProfile" }],
        [{ text: "/profile" }, { text: "/updatePreferensi" }],
      ],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  };

  // Mengirim pesan dengan tombol
  ctx.reply("Selamat datang di Satu Malam Bot! Berikut adalah daftar perintah yang dapat Anda gunakan:\n\n🧍‍♂️ /profile - Tampilkan profil Anda.\n\n✏️ /updateProfile - Perbarui atau buat profil dengan gaya yang sesuai dengan Anda.\n\n🔧 /updatePreferensi - Pilih preferensi pasangan Anda dengan elegan.\n\n🔎 /search muse [Nama FaceClaim] - Temukan karakter impian Anda. ✨\n\n🔎 /search random - Temukan karakter secara acak dan menemukan kejutan di setiap sudut. 🎲\n\n🔎 /search - Temukan pasangan yang cocok dengan sentuhan keajaiban. 💖\n\n",
    keyboard
  );
});

// Definisikan perintah '/profile' untuk menampilkan profil pengguna
bot.command("profile",checkMembership, async (ctx) => {
  const userId = ctx.from.id;
  try {
    const profile = await Profile.findOne({ userId });
    if (!profile) {
      ctx.reply(
        "Profil belum dibuat. Gunakan perintah /updateProfile untuk membuat profil kamu."
      );
      return;
    }
    // Ketika menampilkan profil
ctx.reply(`
🧔🏻 Profile:
📛 Nama: ${profile.name}
👤 Jenis Kelamin: ${profile.gender}
🖼️ Face Claim: ${profile.faceClaim}
💆‍♀️ Kepribadian: ${profile.personality}
❤️ Interest: ${profile.interestTo}
`);

  } catch (error) {
    console.error("Kesalahan saat mengambil profil:", error);
    ctx.reply("Terjadi kesalahan saat mengambil profil.");
  }
});

// Inisialisasi objek untuk menyimpan data gender dan interest berdasarkan userId
const userPreferences = {};

// Objek untuk menyimpan data indeks pengguna saat ini
const userCurrentIndex = {};
// Fungsi untuk mengupdate data gender berdasarkan userId
function updateGender(userId, gender) {
  // Membuat objek user jika belum ada
  if (!userPreferences[userId]) {
    userPreferences[userId] = {};
  }

  // Mengupdate data gender untuk userId tertentu
  userPreferences[userId].gender = gender;
}
// Fungsi untuk mengupdate data interestTo berdasarkan userId
function updateInterestTo(userId, interestTo) {
  // Membuat objek user jika belum ada
  if (!userPreferences[userId]) {
    userPreferences[userId] = {};
  }

  // Mengupdate data gender untuk userId tertentu
  userPreferences[userId].interestTo = interestTo;
}
function updatePersonality(userId, personality) {
  // Membuat objek user jika belum ada
  if (!userPreferences[userId]) {
    userPreferences[userId] = {};
  }

  // Mengupdate data gender untuk userId tertentu
  userPreferences[userId].personality = personality;
}
// Shared function to handle profile or preference update
async function handleProfileUpdate(ctx, userId, name, faceClaim) {
  // Send gender selection buttons
  ctx.reply("Jenis kelamin kamu apa? ✨", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "👦", callback_data: "cowo" }],
        [{ text: "👩", callback_data: "cewe" }],
        [{ text: "👦👩", callback_data: "non_biner" }],
      ],
    },
  });

  // Set up a listener for gender selection
  bot.action(["cowo", "cewe", "non_biner"], async (ctx) => {
    const gender = ctx.match[0];
    // Mengupdate data gender untuk userId1
    updateGender(userId, gender);


    // Send interest selection buttons
    ctx.reply(" Apa yang kamu cari? ✨", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "👥 Teman", callback_data: "teman" }],
          [{ text: "💑 Pacar", callback_data: "pacar" }],
          [{ text: "👫 Fwa", callback_data: "fwa" }],
        ],
      },
    });

    // Set up a listener for interest selection
    bot.action(["teman", "pacar", "fwa"], async (ctx) => {
      const interestTo = ctx.match[0];
      updateInterestTo(userId, interestTo)
      // Send personality selection buttons
      ctx.reply("Pilih kepribadian kamu: ✨", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "❤️", callback_data: "lovely" }],
            [{ text: "👻", callback_data: "humoris" }],
            [{ text: "👠", callback_data: "classy" }],
            [{ text: "👑", callback_data: "dominant" }],
            [{ text: "🎮", callback_data: "gamer" }],
          ],
        },
      });

      // Set up a listener for personality selection
      bot.action(["lovely", "humoris", "classy", "dominant", "gamer"], async (ctx) => {
        const selectedPersonality = ctx.match[0];
        updatePersonality(userId, selectedPersonality)
        // Sekarang Anda memiliki semua informasi yang diperlukan
        // Anda dapat melanjutkan untuk menyimpannya ke profil atau melakukan tindakan lainnya
        console.log(userPreferences)
        // search profil berdasarkan userId Telegram
        let profile = await Profile.findOne({ userId });

        if (!profile) {
          // Jika profil tidak ada, buat profil baru
          profile = new Profile({
            userId,
            name,
            gender: userPreferences[userId].gender,
            faceClaim,
            interestTo: userPreferences[userId].interestTo,
            personality: userPreferences[userId].personality,
          });
          await profile.save();
          ctx.reply("Profile berhasil dibuat");
          delete userPreferences[userId]
          console.log(userPreferences)

        } else {
          // Jika profil sudah ada, perbarui datanya
          profile.name = name;
          profile.gender = userPreferences[userId].gender;
          profile.faceClaim = faceClaim;
          profile.interestTo = userPreferences[userId].interestTo;
          profile.personality = userPreferences[userId].personality;
          await profile.save();

          ctx.reply("Profile berhasil diupdate!");
          delete userPreferences[userId]
          console.log(userPreferences)
        }
      });
    });
  });
}



// Fungsi untuk mengupdate data gender berdasarkan userId
function updatePrefGender(userId, gender) {
  // Membuat objek user jika belum ada
  if (!userPreferences[userId]) {
    userPreferences[userId] = {};
  }

  // Mengupdate data gender untuk userId tertentu
  userPreferences[userId].genderPref = gender;
}
// Fungsi untuk mengupdate data gender berdasarkan userId
function updatePrefInterestTo(userId, interestTo) {
  // Membuat objek user jika belum ada
  if (!userPreferences[userId]) {
    userPreferences[userId] = {};
  }

  // Mengupdate data gender untuk userId tertentu
  userPreferences[userId].InterestToPref = interestTo;
}

// Command 1  
bot.command("updateProfile",checkMembership, async (ctx) => {
  try {
    const userId = ctx.from.id;
    const commandArguments = ctx.message.text.split(" ");

    if (commandArguments.length !== 3) {
      ctx.reply(
        "Format perintah salah. Gunakan: /updateProfile (Nama Baru) (Face Claim Baru) "
      );
      return;
    } 

 ;

    const [, name, faceClaim] = commandArguments;

    // Call the shared function to handle the rest
    handleProfileUpdate(ctx, userId, name, faceClaim);

  } catch (error) {
    console.error("Kesalahan saat memperbarui profil:", error);
    ctx.reply("Terjadi kesalahan saat memperbarui profil.");
  }
});


// Command 2
bot.command("updatePreferensi",checkMembership, async (ctx) => {
  try {
    const userId = ctx.from.id;

    // Call the shared function to handle the rest
    handlePreferenceUpdate(ctx, userId);
  } catch (error) {
    console.error("Kesalahan saat memperbarui preferensi pasangan:", error);
    ctx.reply("Terjadi kesalahan saat memperbarui preferensi pasangan.");
  }
});


// Shared function to handle preference update
async function handlePreferenceUpdate(ctx, userId) {
  // Send gender selection buttons
  ctx.reply("Jenis kelamin pasangan kamu apa?:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "👦", callback_data: "cowo" }],
        [{ text: "👩", callback_data: "cewe" }],
        [{ text: "👦👩", callback_data: "non_biner" }],
      ],
    },
  });

  // Set up a listener for gender selection
  bot.action(["cowo", "cewe", "non_biner"], async (ctx) => {
    const genderD = ctx.match[0];
    updatePrefGender(userId, genderD)

    // Send interest selection buttons
    ctx.reply("Kamu ingin mencari apa?:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Teman", callback_data: "teman" }],
          [{ text: "Pacar", callback_data: "pacar" }],
          [{ text: "Fwa", callback_data: "fwa" }],
        ],
      },
    });

    // Set up a listener for interest selection
    bot.action(["teman", "pacar", "fwa"], async (ctx) => {
      const interestToD = ctx.match[0];
      updatePrefInterestTo(userId,interestToD )

      let preference = await PreferensiPasangan.findOne({ userId });
     

      if (!preference) {
        // If preference does not exist, create a new one
        preference = new PreferensiPasangan({
          userId,
          gender: userPreferences[userId].genderPref,
          interestTo: userPreferences[userId].InterestToPref,
        });
        await preference.save();

        ctx.reply("Preferensi pasangan berhasil dibuat");
        delete userPreferences[userId]
        console.log(userPreferences)
      } else {
        // If preference already exists, update it
        preference.gender = userPreferences[userId].genderPref,
          preference.interestTo = userPreferences[userId].InterestToPref;
        await preference.save();

        ctx.reply("Preferensi pasangan berhasil diupdate!");
        delete userPreferences[userId]
        console.log(userPreferences)
      }
    });
  });
}




// Fungsi untuk menampilkan profil
const showProfile = (ctx, currentIndex, matchingProfiles, userId) => {
  const profile = matchingProfiles[currentIndex];
  console.log(profile);

  if (!profile) {
    const message = "Tidak ada pengguna yang cocok lagi dengan preferensi Anda.";
    const inlineKeyboard = [[{ text: "Previous", callback_data: "prev" }]];

    ctx.reply(message, {
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    });
  } else {
    const message = `
    📄 Profil Pengguna:
    🧍‍♂️ Nama: ${profile.name}
    👤 Jenis Kelamin: ${profile.gender}
    🖼️ Face Claim: ${profile.faceClaim}
    💆‍♀️ Kepribadian: ${profile.personality}
    `;

    const inlineKeyboard = [
      [
        { text: "Previous", callback_data: "prev" },
        { text: "Next", callback_data: "next" }
      ],
      [
        { text: "Mulai Obrolan", callback_data: `start_chat_${profile.userId}_${userId}` }
      ]
    ];

    ctx.reply(message, {
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    });
  }
};

bot.command('search',checkMembership, async (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text;
  
  if (text.includes('/search muse')) {
    const faceClaimName = text.split('/search muse ')[1];

    // Cari profil dengan faceClaim yang sesuai
    const matchingProfiles = await Profile.find({ faceClaim: faceClaimName });

    if (!matchingProfiles.length > 0) {
      ctx.reply("Tidak ada pengguna dengan faceClaim tersebut.");
    } else {
      let currentIndex = userCurrentIndex[userId] || 0;
      showProfile(ctx, currentIndex, matchingProfiles, userId);
      userCurrentIndex[userId] = currentIndex;
    }
  } else if (text.includes('/search random')) {
    // Cari semua profil yang tidak memiliki faceClaim 'pacar'
    const matchingProfiles = await Profile.find({ faceClaim: { $ne: 'pacar' } });

    if (!matchingProfiles.length > 0) {
      ctx.reply("Tidak ada pengguna yang tersedia.");
    } else {
      let currentIndex = userCurrentIndex[userId] || 0;
      showProfile(ctx, currentIndex, matchingProfiles, userId);
      userCurrentIndex[userId] = currentIndex;
    }
  } else {
    // Ambil preferensi pasangan dari database berdasarkan ID pengguna
    const preferensi = await PreferensiPasangan.findOne({ userId });

    if (!preferensi) {
      return ctx.reply('Anda belum memiliki preferensi pasangan. Silakan gunakan /updatePreferensi untuk membuatnya.');
    }

    const { gender, interestTo } = preferensi;
    const matchingProfiles = await Profile.find({ gender, interestTo });

    if (!matchingProfiles.length > 0) {
      ctx.reply("Tidak ada pengguna yang cocok");
    } else {
      let currentIndex = userCurrentIndex[userId] || 0;
      showProfile(ctx, currentIndex, matchingProfiles, userId);
      userCurrentIndex[userId] = currentIndex;
    }
  }
});

// Fungsi untuk menampilkan profil berikutnya
bot.action('next', async (ctx) => {
  const userId = ctx.callbackQuery.from.id;

  // Ambil preferensi pasangan dari database berdasarkan ID pengguna
  const preferensi = await PreferensiPasangan.findOne({ userId });

  if (!preferensi) {
    return ctx.reply('Anda belum memiliki preferensi pasangan. Silakan gunakan /updatePreferensi untuk membuatnya.');
  }

  const { gender, interestTo } = preferensi;

  // Cari profil yang cocok berdasarkan preferensi
  const matchingProfiles = await Profile.find({ gender, interestTo });

  // Ambil indeks pengguna saat ini
  let currentIndex = userCurrentIndex[userId] || 0;

  // Periksa apakah currentIndex melebihi panjang matchingProfiles
  if (currentIndex >= matchingProfiles.length) {
    currentIndex = 0;
  }

  // Increment currentIndex
  currentIndex++;

  // Simpan indeks pengguna saat ini
  userCurrentIndex[userId] = currentIndex;

  showProfile(ctx, currentIndex, matchingProfiles, userId);
});

// Fungsi untuk menampilkan profil sebelumnya
bot.action('prev', async (ctx) => {
  const userId = ctx.callbackQuery.from.id;

  // Ambil preferensi pasangan dari database berdasarkan ID pengguna
  const preferensi = await PreferensiPasangan.findOne({ userId });

  if (!preferensi) {
    return ctx.reply('Anda belum memiliki preferensi pasangan. Silakan gunakan /updatePreferensi untuk membuatnya.');
  }

  const { gender, interestTo } = preferensi;

  // Cari profil yang cocok berdasarkan preferensi
  const matchingProfiles = await Profile.find({ gender, interestTo });

  // Ambil indeks pengguna saat ini
  let currentIndex = userCurrentIndex[userId] || 0;

  // Kurangi currentIndex
  currentIndex = Math.max(currentIndex - 1, 0);

  // Simpan indeks pengguna saat ini
  userCurrentIndex[userId] = currentIndex;

  showProfile(ctx, currentIndex, matchingProfiles, userId);
});
bot.action(/^start_chat_(\d+)_(\d+)$/, async (ctx) => {
  const chatId = ctx.chat.id;
  
  const roomKey = chatId.toString();
  const userId = ctx.callbackQuery.from.id;
  const profileUserId = parseInt(ctx.match[1]); // Mengambil user ID dari regexp match
  const userCurrentMatchingUserId = profileUserId;

  console.log("profileUserId:", profileUserId);

  // Periksa apakah matchingUserId adalah nilai yang valid
  if (!userCurrentMatchingUserId) {
    ctx.reply("Terjadi kesalahan saat mencoba mengirim undangan.");
    return;
  }

  const matchingProfile = await Profile.findOne({
    userId: userCurrentMatchingUserId,
  });

  if (!(await RoomModel.exists({ roomId: roomKey }))) {
    const room = new RoomModel({
      roomId: roomKey,
      messages: [],
      memberCreate: ctx.from.id,
      memberJoin: 0, // Set memberJoin ke 0 saat membuat obrolan baru.
    });
    await room.save();

    if (userCurrentMatchingUserId !== userId) {
      // Pengguna belum bergabung ke obrolan, mereka bisa menginvite orang lain.

      if (matchingProfile) {
        const message = `
          Anda telah diundang untuk berbicara\n Ketik /join ${roomKey} jika Anda ingin menerima undangan.
        `;

        bot.telegram.sendMessage(userCurrentMatchingUserId, message);
        ctx.reply("Undangan telah dikirim!");
      } else {
        ctx.reply("Profil pasangan tidak ditemukan.");
      }
    } else {
      // Pengguna sudah bergabung ke obrolan, beri tahu mereka.
      ctx.reply(
        "Anda telah bergabung ke obrolan. Tidak dapat menginvite orang lain."
      );
    }
  } else {
    // Cek apakah obrolan aktif dengan memeriksa memberJoin.
    const existingRoom = await RoomModel.findOne({ roomId: roomKey });

    if (existingRoom.memberJoin === 0) {
      if (matchingProfile) {
        const message = `
          Anda telah diundang untuk berbicara\n Ketik /join ${roomKey} jika Anda ingin menerima undangan.
        `;

        bot.telegram
          .sendMessage(userCurrentMatchingUserId, message)
          .then((response) => {
            ctx.reply("Undangan telah dikirim!");
          })
          .catch((error) => {
            console.error("Error Sending Message:", error);
            ctx.reply("Terjadi kesalahan saat mencoba mengirim undangan.");
          });
      } else {
        ctx.reply("Profil pasangan tidak ditemukan.");
      }
    } else {
      ctx.reply(
        "Anda sudah memiliki percakapan aktif. Gunakan perintah /end_room untuk mengakhiri obrolan sebelum membuat yang baru."
      );
    }
  }
});

bot.command("end_room",checkMembership, async (ctx) => {
  const chatId = ctx.chat.id;
  const roomKey = chatId.toString();

  if (await RoomModel.exists({ roomId: roomKey })) {
    await RoomModel.deleteOne({ roomId: roomKey });
    ctx.reply("obrolan telah diakhiri.");
  } else {
    ctx.reply("Anda tidak memiliki obrolan aktif.");
  }
});

// Fungsi untuk menghapus ruangan setelah 5 menit
const deleteRoomAfterFiveMinutes = async (roomKey, join, create) => {
  // Tunggu 5 menit sebelum menghapus ruangan
  await new Promise(() =>
    setTimeout(() => {
      bot.telegram.sendMessage(join, "Obrolan telah berakhir. 🙏");
      bot.telegram.sendMessage(create, "Obrolan telah berakhir. 🙏");
    }, 5 * 60 * 1000)
  );

  // Setelah 5 menit, hapus ruangan
  await RoomModel.deleteOne({ roomId: roomKey });
};

// Fungsi untuk mengirim pesan "test" setelah 4 menit
const sendTestMessageAfterFourMinutes = async (join, create) => {
  // Tunggu 4 menit sebelum mengirim pesan "test"
  await new Promise((resolve) => setTimeout(resolve, 4 * 60 * 1000));

  // Setelah 4 menit, kirim pesan "test"
  bot.telegram.sendMessage(join, "Chat ini akan berakhir dalam 4 menit. 🕓");
  bot.telegram.sendMessage(create, "Chat ini akan berakhir dalam 4 menit. 🕓");
};

bot.command("join",checkMembership, async (ctx) => {
  const chatId = ctx.chat.id;
  const roomKey = ctx.message.text.split(" ")[1];

  if (await RoomModel.exists({ roomId: roomKey })) {
    const room = await RoomModel.findOne({ roomId: roomKey });

    if (room) {
      if (room.memberJoin === ctx.from.id) {
        ctx.reply("Anda sudah bergabung ke obrolan ini.");
      } else if (room.memberJoin !== 0) {
        // Pengguna yang mengundang sudah bergabung ke obrolan lain
        ctx.reply(
          "Orang yang mengundang Anda sudah bergabung ke obrolan lain."
        );
      } else {
        room.memberJoin = ctx.from.id; // Update ID pengguna yang bergabung ke obrolan
        await room.save();
        ctx.reply(
          "Anda telah bergabung ke obrolan. Pesan yang Anda kirim akan diteruskan ke semua anggota obrolan."
        );

        // Setelah bergabung ke obrolan, mulai penghitungan waktu 5 menit untuk menghapus ruangan
        deleteRoomAfterFiveMinutes(roomKey, room.memberJoin, room.memberCreate);

        // Setelah bergabung ke obrolan, mulai penghitungan waktu 4 menit untuk mengirim pesan "test"
        sendTestMessageAfterFourMinutes(room.memberJoin, room.memberCreate);
        bot.telegram.sendMessage(
          room.memberCreate,
          "undangan kamu di terima nih, obrolan di mulai!"
        );
      }
    } else {
      ctx.reply(
        "Obrolan tidak ditemukan. Pastikan Anda menggunakan kode obrolan yang benar."
      );
    }
  } else {
    ctx.reply(
      "Obrolan tidak ditemukan. Pastikan Anda menggunakan kode obrolan yang benar."
    );
  }
});


// Mendengarkan pesan dari bot
bot.on("text", async (ctx) => {
  const userId = ctx.from.id; // Mendapatkan ID pengguna yang mengirim pesan
  const text = ctx.message.text; // Mendapatkan teks pesan

  // search ruangan yang memiliki memberCreate atau memberJoin sama dengan userId
  const room = await RoomModel.findOne({
    $or: [{ memberCreate: userId }, { memberJoin: userId }],
  });

  if (room) {
    // Tambahkan pesan ke dalam daftar pesan di ruangan
    room.messages.push(text);
    await room.save(); // Simpan perubahan ke dalam database

    // Balas pesan pengguna
    const profile = await Profile.findOne({ userId });
    const message = profile ? `${profile.name}: ${text}` : `${userId}: ${text}`; // Menggunakan ID jika profil tidak ditemukan

    if (userId === room.memberCreate) {
      // Jika pengguna adalah memberCreate, kirim pesan hanya ke memberJoin
      bot.telegram.sendMessage(room.memberJoin, message);
      ctx.reply("pesan berhasil terkirim!");
    } else if (userId === room.memberJoin) {
      // Jika pengguna adalah memberJoin, kirim pesan hanya ke memberCreate
      bot.telegram.sendMessage(room.memberCreate, message);
      ctx.reply("pesan berhasil terkirim!");
    }
  }
});

// Jalankan bot
bot.launch().then(() => {
  console.log("Bot berjalan!");
});

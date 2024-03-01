const { Client, Intents } = require('discord.js');
const ytdl = require('ytdl-core');
const { prefix, token } = require('./config.json');

const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES] });
const queue = new Map();

client.once('ready', () => {
    console.log('Bot sedang online!');
});

client.on('message', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const voiceChannel = message.member.voice.channel;
    const serverQueue = queue.get(message.guild.id);

    if (command === 'play') {
        execute(message, serverQueue);
        return;
    } else if (command === 'pause') {
        pause(message, serverQueue);
        return;
    } else if (command === 'queue') {
        showQueue(message, serverQueue);
        return;
    } else if (command === 'stop') {
        stop(message, serverQueue);
        return;
    } else {
        message.channel.send('Perintah yang kamu masukkan tidak valid!');
    }
});

async function execute(message, serverQueue) {
    const args = message.content.split(' ');
    const voiceChannel = message.member.voice.channel;
    
    if (!voiceChannel) return message.channel.send('Kamu perlu berada di dalam saluran suara untuk memutar musik!');
    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) {
        return message.channel.send('Bot tidak memiliki izin yang cukup untuk bergabung atau berbicara di saluran suara tersebut!');
    }

    const songInfo = await ytdl.getInfo(args[1]);
    const song = {
        title: songInfo.videoDetails.title,
        url: songInfo.videoDetails.video_url,
    };

    if (!serverQueue) {
        const queueContruct = {
            textChannel: message.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 5,
            playing: true,
        };

        queue.set(message.guild.id, queueContruct);

        queueContruct.songs.push(song);

        try {
            var connection = await voiceChannel.join();
            queueContruct.connection = connection;
            play(message.guild, queueContruct.songs[0]);
        } catch (err) {
            console.log(err);
            queue.delete(message.guild.id);
            return message.channel.send(err);
        }
    } else {
        serverQueue.songs.push(song);
        return message.channel.send(`✅ **${song.title}** telah ditambahkan ke dalam antrian!`);
    }
}

function play(guild, song) {
    const serverQueue = queue.get(guild.id);
    if (!song) {
        serverQueue.voiceChannel.leave();
        queue.delete(guild.id);
        return;
    }

    const dispatcher = serverQueue.connection
        .play(ytdl(song.url))
        .on('finish', () => {
            serverQueue.songs.shift();
            play(guild, serverQueue.songs[0]);
        })
        .on('error', error => {
            console.error(error);
        });
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
    serverQueue.textChannel.send(`🎶 Memutar sekarang: **${song.title}**`);
}

function pause(message, serverQueue) {
    if (!message.member.voice.channel) return message.channel.send('Kamu perlu berada di dalam saluran suara untuk menjeda musik!');
    if (!serverQueue) return message.channel.send('Tidak ada lagu yang sedang diputar.');
    if (!serverQueue.playing) return message.channel.send('Musik sudah dalam keadaan terjeda.');

    serverQueue.playing = false;
    serverQueue.connection.dispatcher.pause();
    message.channel.send('Musik telah dijeda.');
}

function showQueue(message, serverQueue) {
    if (!serverQueue) return message.channel.send('Tidak ada lagu dalam antrian.');
    message.channel.send(`
🎵 **Antrian Musik:**
${serverQueue.songs.map(song => `**-** ${song.title}`).join('\n')}
**Memutar sekarang:** ${serverQueue.songs[0].title}
    `);
}

function stop(message, serverQueue) {
    if (!message.member.voice.channel) return message.channel.send('Kamu perlu berada di dalam saluran suara untuk menghentikan musik!');
    if (!serverQueue) return message.channel.send('Tidak ada lagu yang sedang diputar.');
    serverQueue.songs = [];
    serverQueue.connection.dispatcher.end();
    message.channel.send('Musik telah dihentikan dan antrian telah dibersihkan.');
}

client.login(token);
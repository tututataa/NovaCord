const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

const messages = {
    geral: [],
    jogos: [],
    memes: []
};

const voiceChannels = {
    Geral: new Map(),
    Jogos: new Map()
};

io.on("connection", (socket) => {

    console.log("Usuário conectado:", socket.id);

    // ================================
    // CHAT
    // ================================

    socket.on("chat message", (data) => {

        if (!data) return;

        const username = String(
            data.username || "Usuário"
        ).substring(0, 20);

        const text = String(
            data.text || ""
        ).substring(0, 2000);

        const channel = String(
            data.channel || "geral"
        );

        if (!text.trim()) return;

        if (!messages[channel]) {
            messages[channel] = [];
        }

        const message = {
            username,
            text,
            channel
        };

        messages[channel].push(message);

        if (messages[channel].length > 100) {
            messages[channel].shift();
        }

        io.emit("chat message", message);
    });


    socket.on("request channel messages", (channel) => {

        if (!messages[channel]) {
            messages[channel] = [];
        }

        socket.emit("channel messages", {
            channel,
            messages: messages[channel]
        });
    });


    // ================================
    // ENTRAR NA CALL
    // ================================

    socket.on("voice:join", (data) => {

        if (!data) return;

        const channel = String(data.channel || "");
        const username = String(
            data.username || "Usuário"
        ).substring(0, 20);

        if (!voiceChannels[channel]) {
            return;
        }

        removerDasCalls(socket.id);

        const existingUsers = [];

        voiceChannels[channel].forEach((user, id) => {
            existingUsers.push({
                socketId: id,
                username: user.username
            });
        });

        voiceChannels[channel].set(socket.id, {
            username
        });

        socket.join(`voice-${channel}`);

        // Envia para o novo usuário quem já estava na call
        socket.emit("voice:peers", existingUsers);

        // Avisa quem já estava na call que entrou alguém novo
        socket.to(`voice-${channel}`).emit(
            "voice:user-joined",
            {
                socketId: socket.id,
                username
            }
        );

        enviarUsuariosDaCall(channel);

        console.log(
            `${username} entrou na call ${channel}`
        );
    });


    // ================================
    // SINALIZAÇÃO WEBRTC
    // ================================

    socket.on("voice:signal", (data) => {

        if (!data || !data.to) return;

        io.to(data.to).emit("voice:signal", {
            from: socket.id,
            signal: data.signal
        });
    });


    // ================================
    // SAIR DA CALL
    // ================================

    socket.on("voice:leave", () => {

        removerDasCalls(socket.id);
    });


    // ================================
    // DESCONECTAR
    // ================================

    socket.on("disconnect", () => {

        console.log(
            "Usuário desconectado:",
            socket.id
        );

        removerDasCalls(socket.id);
    });
});


// ====================================
// REMOVER DAS CALLS
// ====================================

function removerDasCalls(socketId) {

    for (const channelName in voiceChannels) {

        const channel = voiceChannels[channelName];

        if (channel.has(socketId)) {

            channel.delete(socketId);

            io.to(`voice-${channelName}`).emit(
                "voice:user-left",
                {
                    socketId
                }
            );

            enviarUsuariosDaCall(channelName);
        }
    }
}


// ====================================
// LISTA DE USUÁRIOS
// ====================================

function enviarUsuariosDaCall(channelName) {

    const channel = voiceChannels[channelName];

    const users = [];

    channel.forEach((user, socketId) => {

        users.push({
            socketId,
            username: user.username
        });

    });

    io.to(`voice-${channelName}`).emit(
        "voice:users",
        users
    );
}


// ====================================
// PORTA
// ====================================

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {

    console.log(
        `NovaCord rodando na porta ${PORT}`
    );

});
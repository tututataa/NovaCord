const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Servir os arquivos do NovaCord
app.use(express.static(__dirname));

// Socket.IO
io.on("connection", (socket) => {
    console.log("Usuário conectado:", socket.id);

    socket.on("chat message", (message) => {
        io.emit("chat message", message);
    });

    socket.on("disconnect", () => {
        console.log("Usuário desconectado:", socket.id);
    });
});

// Porta para hospedagem ou uso local
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`NovaCord rodando na porta ${PORT}`);
});
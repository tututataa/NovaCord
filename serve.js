const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");


const app = express();

const server = http.createServer(app);

const io = new Server(server);


/* SERVIR OS ARQUIVOS DO NOVACORD */

app.use(express.static(__dirname));


/* USUÁRIO CONECTADO */

io.on("connection", (socket) => {

    console.log("Usuário conectado:", socket.id);


    /* RECEBER MENSAGEM */

    socket.on("chat message", (message) => {

        console.log("Mensagem:", message);


        /* ENVIAR PARA TODOS */

        io.emit("chat message", message);

    });


    /* USUÁRIO DESCONECTADO */

    socket.on("disconnect", () => {

        console.log(
            "Usuário desconectado:",
            socket.id
        );

    });

});


/* PORTA DO SERVIDOR */

const PORT = 3000;


server.listen(PORT, () => {

    console.log(
        `NovaCord rodando em http://localhost:${PORT}`
    );

});
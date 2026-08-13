const socket = io();

const form = document.getElementById("messageForm");
const input = document.getElementById("messageInput");
const messages = document.getElementById("messages");

const channelName = document.getElementById("channelName");
const channelIcon = document.getElementById("channelIcon");

const usernameInput = document.getElementById("usernameInput");
const usernameDisplay = document.getElementById("usernameDisplay");
const userAvatar = document.getElementById("userAvatar");

const loginOverlay = document.getElementById("loginOverlay");
const enterButton = document.getElementById("enterButton");

let username = localStorage.getItem("novacord_username") || "";
let currentChannel = "geral";

let localStream = null;
let currentVoiceChannel = null;

const peers = {};
const remoteAudios = {};

const rtcConfig = {
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        },
        {
            urls: "stun:stun1.l.google.com:19302"
        }
    ]
};


// ========================================
// NOME
// ========================================

function atualizarUsuario() {

    if (!username) return;

    if (usernameDisplay) {
        usernameDisplay.textContent = username;
    }

    if (userAvatar) {
        userAvatar.firstChild.textContent =
            username.charAt(0).toUpperCase();
    }

    if (loginOverlay) {
        loginOverlay.style.display = "none";
    }
}


if (username) {

    atualizarUsuario();

} else if (loginOverlay) {

    loginOverlay.style.display = "flex";

    setTimeout(() => {

        if (usernameInput) {
            usernameInput.focus();
        }

    }, 100);
}


if (enterButton) {

    enterButton.addEventListener(
        "click",
        entrar
    );
}


if (usernameInput) {

    usernameInput.addEventListener(
        "keydown",
        (event) => {

            if (event.key === "Enter") {
                entrar();
            }

        }
    );
}


function entrar() {

    if (!usernameInput) return;

    const nome =
        usernameInput.value.trim();

    if (!nome) {

        usernameInput.focus();

        return;
    }

    username =
        nome.substring(0, 20);

    localStorage.setItem(
        "novacord_username",
        username
    );

    atualizarUsuario();
}


// ========================================
// CANAIS DE TEXTO
// ========================================

const textChannels =
    document.querySelectorAll(
        '.channel[data-type="text"]'
    );


textChannels.forEach((channel) => {

    channel.addEventListener(
        "click",
        () => {

            mudarCanal(
                channel.dataset.channel
            );

        }
    );

});


function mudarCanal(nome) {

    currentChannel = nome;

    textChannels.forEach((channel) => {

        channel.classList.remove("active");

    });


    const selecionado =
        document.querySelector(
            `.channel[data-type="text"][data-channel="${nome}"]`
        );


    if (selecionado) {
        selecionado.classList.add("active");
    }


    if (channelName) {
        channelName.textContent = nome;
    }

    if (channelIcon) {
        channelIcon.textContent = "#";
    }

    if (input) {
        input.placeholder =
            `Enviar mensagem em #${nome}`;
    }


    if (messages) {

        messages.innerHTML = "";

        const welcome =
            document.createElement("div");

        welcome.className = "welcome";

        welcome.innerHTML = `

            <div class="welcome-icon">
                #
            </div>

            <h1>
                Bem-vindo ao canal #${escapeHTML(nome)}!
            </h1>

            <p>
                Este é o começo do canal #${escapeHTML(nome)}.
            </p>

        `;

        messages.appendChild(welcome);
    }


    socket.emit(
        "request channel messages",
        nome
    );
}


// ========================================
// CANAIS DE VOZ
// ========================================

const voiceChannels =
    document.querySelectorAll(
        '.channel[data-type="voice"]'
    );


voiceChannels.forEach((channel) => {

    channel.addEventListener(
        "click",
        () => {

            entrarNaCall(
                channel.dataset.channel
            );

        }
    );

});


async function entrarNaCall(nome) {

    if (!username) {

        if (loginOverlay) {
            loginOverlay.style.display = "flex";
        }

        if (usernameInput) {
            usernameInput.focus();
        }

        return;
    }


    if (currentVoiceChannel === nome) {
        return;
    }


    if (currentVoiceChannel) {
        sairDaCall();
    }


    try {

        localStream =
            await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false
            });


        currentVoiceChannel = nome;


        socket.emit("voice:join", {

            channel: nome,

            username: username

        });


        mostrarPainelDaCall(nome);


        console.log(
            "Entrou na call:",
            nome
        );


    } catch (error) {

        console.error(
            "Erro ao acessar microfone:",
            error
        );

        alert(
            "Não foi possível acessar o microfone. Verifique a permissão do navegador."
        );

    }
}


// ========================================
// WEBRTC - CRIAR CONEXÃO
// ========================================

function criarPeerConnection(
    socketId,
    criarOferta
) {

    if (peers[socketId]) {
        return peers[socketId];
    }


    const peer =
        new RTCPeerConnection(
            rtcConfig
        );


    peers[socketId] = peer;


    if (localStream) {

        localStream
            .getTracks()
            .forEach((track) => {

                peer.addTrack(
                    track,
                    localStream
                );

            });

    }


    peer.ontrack = (event) => {

        const stream =
            event.streams[0];

        if (!stream) return;


        let audio =
            remoteAudios[socketId];


        if (!audio) {

            audio =
                document.createElement("audio");

            audio.autoplay = true;
            audio.controls = false;
            audio.volume = 1;
            audio.style.display = "none";

            document.body.appendChild(audio);

            remoteAudios[socketId] =
                audio;
        }


        audio.srcObject = stream;


        audio.play().catch(() => {

            console.log(
                "O navegador bloqueou o áudio automático."
            );

        });

    };


    peer.onicecandidate = (event) => {

        if (!event.candidate) return;


        socket.emit("voice:signal", {

            to: socketId,

            signal: {
                type: "ice-candidate",
                candidate: event.candidate
            }

        });

    };


    peer.onconnectionstatechange = () => {

        console.log(
            `Conexão ${socketId}:`,
            peer.connectionState
        );


        if (
            peer.connectionState === "failed" ||
            peer.connectionState === "closed" ||
            peer.connectionState === "disconnected"
        ) {

            removerPeer(socketId);

        }

    };


    if (criarOferta) {

        criarOfertaParaPeer(
            socketId,
            peer
        );

    }


    return peer;
}


// ========================================
// CRIAR OFFER
// ========================================

async function criarOfertaParaPeer(
    socketId,
    peer
) {

    try {

        const offer =
            await peer.createOffer();


        await peer.setLocalDescription(
            offer
        );


        socket.emit("voice:signal", {

            to: socketId,

            signal: {
                type: "offer",
                sdp: peer.localDescription
            }

        });

    } catch (error) {

        console.error(
            "Erro ao criar offer:",
            error
        );

    }

}


// ========================================
// RECEBER SINAL WEBRTC
// ========================================

socket.on(
    "voice:signal",
    async (data) => {

        if (!data || !data.signal) {
            return;
        }


        const socketId =
            data.from;

        const signal =
            data.signal;


        let peer =
            peers[socketId];


        if (signal.type === "offer") {

            peer =
                criarPeerConnection(
                    socketId,
                    false
                );


            try {

                await peer.setRemoteDescription(
                    new RTCSessionDescription(
                        signal.sdp
                    )
                );


                const answer =
                    await peer.createAnswer();


                await peer.setLocalDescription(
                    answer
                );


                socket.emit(
                    "voice:signal",
                    {

                        to: socketId,

                        signal: {
                            type: "answer",
                            sdp: peer.localDescription
                        }

                    }
                );


            } catch (error) {

                console.error(
                    "Erro ao responder offer:",
                    error
                );

            }

            return;
        }


        if (signal.type === "answer") {

            if (!peer) {
                return;
            }


            try {

                await peer.setRemoteDescription(
                    new RTCSessionDescription(
                        signal.sdp
                    )
                );

            } catch (error) {

                console.error(
                    "Erro ao receber answer:",
                    error
                );

            }

            return;
        }


        if (
            signal.type ===
            "ice-candidate"
        ) {

            if (!peer) {
                return;
            }


            try {

                await peer.addIceCandidate(
                    new RTCIceCandidate(
                        signal.candidate
                    )
                );

            } catch (error) {

                console.error(
                    "Erro ICE:",
                    error
                );

            }

        }

    }
);


// ========================================
// USUÁRIOS QUE JÁ ESTAVAM NA CALL
// ========================================

socket.on(
    "voice:peers",
    async (users) => {

        for (const user of users) {

            criarPeerConnection(
                user.socketId,
                true
            );

        }

    }
);


// ========================================
// NOVO USUÁRIO
// ========================================

socket.on(
    "voice:user-joined",
    (user) => {

        console.log(
            `${user.username} entrou na call`
        );

    }
);


// ========================================
// USUÁRIO SAIU
// ========================================

socket.on(
    "voice:user-left",
    (data) => {

        if (!data) return;

        removerPeer(
            data.socketId
        );

    }
);


// ========================================
// REMOVER PEER
// ========================================

function removerPeer(socketId) {

    if (peers[socketId]) {

        peers[socketId].close();

        delete peers[socketId];

    }


    if (remoteAudios[socketId]) {

        remoteAudios[socketId].srcObject =
            null;

        remoteAudios[socketId].remove();

        delete remoteAudios[socketId];

    }

}


// ========================================
// PAINEL DA CALL
// ========================================

function mostrarPainelDaCall(nome) {

    let painel =
        document.getElementById(
            "voicePanel"
        );


    if (!painel) {

        painel =
            document.createElement("div");

        painel.id =
            "voicePanel";


        painel.innerHTML = `

            <div class="voice-panel-title">
                🔊 ${escapeHTML(nome)}
            </div>

            <div
                id="voiceUsers"
                class="voice-users"
            ></div>

            <div class="voice-controls">

                <button
                    id="muteButton"
                    type="button"
                >
                    🎤
                </button>

                <button
                    id="leaveVoiceButton"
                    type="button"
                >
                    📞
                </button>

            </div>

        `;


        document.body.appendChild(
            painel
        );


        document
            .getElementById("muteButton")
            .addEventListener(
                "click",
                alternarMute
            );


        document
            .getElementById("leaveVoiceButton")
            .addEventListener(
                "click",
                sairDaCall
            );

    }


    painel.style.display =
        "block";

}


// ========================================
// USUÁRIOS NA CALL
// ========================================

socket.on(
    "voice:users",
    (users) => {

        const container =
            document.getElementById(
                "voiceUsers"
            );


        if (!container) {
            return;
        }


        container.innerHTML = "";


        users.forEach((user) => {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "voice-user";


            item.textContent =
                `🟢 ${user.username}`;


            container.appendChild(
                item
            );

        });

    }
);


// ========================================
// MUTE
// ========================================

function alternarMute() {

    if (!localStream) {
        return;
    }


    const track =
        localStream.getAudioTracks()[0];


    if (!track) {
        return;
    }


    track.enabled =
        !track.enabled;


    const button =
        document.getElementById(
            "muteButton"
        );


    if (button) {

        button.textContent =
            track.enabled
                ? "🎤"
                : "🔇";

    }

}


// ========================================
// SAIR DA CALL
// ========================================

function sairDaCall() {

    if (!currentVoiceChannel) {
        return;
    }


    socket.emit(
        "voice:leave"
    );


    Object.keys(peers).forEach((id) => {
        delete peers[id];
    });


    Object.keys(remoteAudios).forEach((id) => {

        if (remoteAudios[id]) {

            remoteAudios[id].srcObject = null;
            remoteAudios[id].remove();

        }

        delete remoteAudios[id];

    });


    if (localStream) {

        localStream
            .getTracks()
            .forEach(
                (track) =>
                    track.stop()
            );

        localStream = null;

    }


    currentVoiceChannel =
        null;


    const painel =
        document.getElementById(
            "voicePanel"
        );


    if (painel) {

        painel.style.display =
            "none";

    }

}


// ========================================
// CHAT
// ========================================

if (form) {

    form.addEventListener(
        "submit",
        (event) => {

            event.preventDefault();


            if (!username) {

                loginOverlay.style.display =
                    "flex";

                usernameInput.focus();

                return;
            }


            const text =
                input.value.trim();


            if (!text) {
                return;
            }


            socket.emit(
                "chat message",
                {

                    username,
                    text,
                    channel: currentChannel

                }
            );


            input.value = "";

            input.focus();

        }
    );

}


// ========================================
// RECEBER MENSAGEM
// ========================================

socket.on(
    "chat message",
    (data) => {

        if (!data) return;

        if (
            data.channel !==
            currentChannel
        ) {
            return;
        }


        addMessage(
            data.username,
            data.text
        );


        if (messages) {
            messages.scrollTop =
                messages.scrollHeight;
        }

    }
);


// ========================================
// HISTÓRICO
// ========================================

socket.on(
    "channel messages",
    (data) => {

        if (!data) return;

        if (
            data.channel !==
            currentChannel
        ) {
            return;
        }


        data.messages.forEach(
            (message) => {

                addMessage(
                    message.username,
                    message.text
                );

            }
        );


        if (messages) {
            messages.scrollTop =
                messages.scrollHeight;
        }

    }
);


// ========================================
// CRIAR MENSAGEM
// ========================================

function addMessage(
    username,
    text
) {

    if (!messages) return;

    const message =
        document.createElement(
            "div"
        );


    message.className =
        "message";


    message.innerHTML = `

        <div class="avatar message-avatar">
            ${escapeHTML(
                username.charAt(0).toUpperCase()
            )}
        </div>

        <div class="message-content">

            <div>

                <strong>
                    ${escapeHTML(username)}
                </strong>

                <span class="time">
                    agora
                </span>

            </div>

            <p>
                ${escapeHTML(text)}
            </p>

        </div>

    `;


    messages.appendChild(
        message
    );

}


// ========================================
// SEGURANÇA
// ========================================

function escapeHTML(text) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        text;

    return div.innerHTML;

}


// ========================================
// FECHAR PÁGINA
// ========================================

window.addEventListener(
    "beforeunload",
    () => {

        if (currentVoiceChannel) {

            socket.emit(
                "voice:leave"
            );

        }

    }
);
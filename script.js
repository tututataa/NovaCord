const socket = io();

const form = document.getElementById("messageForm");
const input = document.getElementById("messageInput");
const messages = document.getElementById("messages");


/* ENVIAR MENSAGEM */

form.addEventListener("submit", function (event) {

    event.preventDefault();

    const text = input.value.trim();

    if (text === "") {
        return;
    }

    socket.emit("chat message", text);

    input.value = "";

    input.focus();

});


/* RECEBER MENSAGEM */

socket.on("chat message", function (text) {

    addMessage("Você", text);

    messages.scrollTop = messages.scrollHeight;

});


/* CRIAR MENSAGEM NA TELA */

function addMessage(username, text) {

    const message = document.createElement("div");

    message.className = "message";


    message.innerHTML = `

        <div class="avatar message-avatar">

            ${username.charAt(0).toUpperCase()}

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


    messages.appendChild(message);

}


/* PROTEÇÃO CONTRA HTML MALICIOSO */

function escapeHTML(text) {

    const div = document.createElement("div");

    div.textContent = text;

    return div.innerHTML;

}
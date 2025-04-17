document.addEventListener('DOMContentLoaded', () => {
    const chatBody = document.getElementById('chat-body');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const exportButton = document.getElementById('export-button');
    const nuevaConversacionBtn = document.getElementById('nueva-conversacion');
    const historialLista = document.getElementById('historial-lista');
    const subirBtn = document.getElementById('subir-archivo');
    const archivoInput = document.getElementById('archivo-input');

    const API_KEY = 'apii';
    
    let historial = [];
    let conversaciones = [];

    cargarHistorial();

    async function sendMessage() {
        const userMessage = userInput.value.trim();
        if (userMessage === '') return;

        agregarMensaje('Usuario', userMessage, 'user.png');
        userInput.value = '';

        const loadingMessage = document.createElement('div');
        loadingMessage.classList.add('message');
        loadingMessage.innerHTML = `
            <img src="imagenes/bot.png" alt="Bot">
            <span><em>Escribiendo...</em></span>
        `;
        chatBody.appendChild(loadingMessage);
        chatBody.scrollTop = chatBody.scrollHeight;

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo-0125',
                    messages: [
                        { role: 'system', content: 'Eres JurisLibre, un asistente jurídico profesional que habla con formalidad, claridad y lenguaje legal.' },
                        { role: 'user', content: userMessage }
                    ]
                })
            });

            const data = await response.json();
            const reply = data.choices[0].message.content;

            loadingMessage.remove();
            agregarMensaje('JurisLibre', reply, 'bot.png');
        } catch (error) {
            loadingMessage.querySelector('span').textContent = 'Error al obtener respuesta.';
            console.error('Error en la API:', error);
        }
    }

    async function agregarMensaje(origen, texto, imagen, archivos = []) {
        const hora = new Date().toLocaleTimeString();
        let referenciasHTML = '';

        if (archivos.length > 0) {
            const nombres = await Promise.all(archivos.map(async (fileId) => {
                const res = await fetch(`https://api.openai.com/v1/files/${fileId}`, {
                    headers: {
                        'Authorization': `Bearer ${API_KEY}`
                    }
                });
                const data = await res.json();
                return data.filename || fileId;
            }));

            referenciasHTML = `<br><small>📄 Basado en: ${nombres.map(n => `<code>${n}</code>`).join(', ')}</small>`;
        }

        const mensaje = document.createElement('div');
        mensaje.classList.add('message');
        mensaje.innerHTML = `
            <img src="imagenes/${imagen}" alt="${origen}">
            <span><strong>${origen}:</strong> ${texto}${referenciasHTML}</span>
        `;
        chatBody.appendChild(mensaje);
        chatBody.scrollTop = chatBody.scrollHeight;

        historial.push({ origen, texto, hora });
        localStorage.setItem('historial', JSON.stringify(historial));
    }

    function cargarHistorial() {
        const datos = localStorage.getItem('historial');
        if (historial.length > 0) {
            conversaciones.push(historial);
        }

        if (!datos) return;
        historial = JSON.parse(datos);

        historial.forEach(m => {
            const mensaje = document.createElement('div');
            mensaje.classList.add('message');
            mensaje.innerHTML = `
                <img src="imagenes/${m.origen === 'Usuario' ? 'user.png' : 'bot.png'}" alt="${m.origen}">
                <span><strong>${m.origen}:</strong> ${m.texto}</span>
            `;
            chatBody.appendChild(mensaje);
        });

        if (historial.length > 0) {
            const item = document.createElement('li');
            item.textContent = `Conversación ${conversaciones.length + 1}`;
            item.addEventListener('click', () => {
                chatBody.innerHTML = '';
                historial.forEach(m => {
                    const mensaje = document.createElement('div');
                    mensaje.classList.add('message');
                    mensaje.innerHTML = `
                        <img src="imagenes/${m.origen === 'Usuario' ? 'user.png' : 'bot.png'}" alt="${m.origen}">
                        <span><strong>${m.origen}:</strong> ${m.texto}</span>
                    `;
                    chatBody.appendChild(mensaje);
                });
            });
            historialLista.appendChild(item);
        }
    }

    nuevaConversacionBtn.addEventListener('click', () => {
        if (historial.length > 0) {
            conversaciones.push(historial);
        }

        const nombre = `Conversación ${conversaciones.length + 1}`;
        const item = document.createElement('li');
        item.textContent = nombre;
        item.addEventListener('click', () => {
            chatBody.innerHTML = '';
            conversaciones[conversaciones.length - 1].forEach(m => {
                const mensaje = document.createElement('div');
                mensaje.classList.add('message');
                mensaje.innerHTML = `
                    <img src="imagenes/${m.origen === 'Usuario' ? 'user.png' : 'bot.png'}" alt="${m.origen}">
                    <span><strong>${m.origen}:</strong> ${m.texto}</span>
                `;
                chatBody.appendChild(mensaje);
            });
        });
        historialLista.appendChild(item);

        historial = [];
        localStorage.removeItem('historial');
        chatBody.innerHTML = '';
    });

    exportButton.addEventListener('click', () => {
        if (historial.length === 0) return;

        const contenido = historial.map(m => `${m.origen} [${m.hora}]: ${m.texto}`).join('\n\n');
        const blob = new Blob([contenido], { type: 'text/plain' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'conversacion_juridica.txt';
        link.click();
    });

    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    subirBtn.addEventListener('click', async () => {
        const archivos = archivoInput.files;
        if (archivos.length === 0) {
            alert('Selecciona al menos un archivo.');
            return;
        }

        for (let archivo of archivos) {
            const formData = new FormData();
            formData.append("file", archivo);
            formData.append("purpose", "assistants");

            const res = await fetch("https://api.openai.com/v1/files", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${API_KEY}`
                },
                body: formData
            });

            const data = await res.json();
            console.log(`✅ Archivo subido: ${data.filename} (${data.id})`);
            alert(`✅ Archivo subido correctamente: ${data.filename}`);
        }

        archivoInput.value = "";
    });
});

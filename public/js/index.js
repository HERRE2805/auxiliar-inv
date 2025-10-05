document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM cargado, inicializando aplicación...');

    const chatBody = document.getElementById('chat-body');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const exportButton = document.getElementById('export-button');
    const nuevaConversacionBtn = document.getElementById('nueva-conversacion');
    const historialLista = document.getElementById('historial-lista');
    const subirBtn = document.getElementById('subir-archivo');
    const archivoInput = document.getElementById('archivo-input');
    const toggleButton = document.getElementById('toggle-theme');
    const micButton = document.getElementById('mic-button'); // 🎤 Botón de micrófono

    // Verificar elementos esenciales
    if (!chatBody) console.error('Error: #chat-body no encontrado en el DOM');
    if (!userInput) console.error('Error: #user-input no encontrado en el DOM');
    if (!sendButton) console.error('Error: #send-button no encontrado en el DOM');
    if (!nuevaConversacionBtn) console.error('Error: #nueva-conversacion no encontrado en el DOM');
    if (!historialLista) console.error('Error: #historial-lista no encontrado en el DOM');

    // Verificar dependencias
    if (!window.marked) console.error('Error: marked no está cargado. Asegúrate de incluir <script src="https://cdn.jsdelivr.net/npm/marked@4.3.0/lib/marked.min.js"></script> en index.html');
    if (!window.DOMPurify) console.error('Error: DOMPurify no está cargado. Asegúrate de incluir <script src="https://cdnjs.cloudflare.com/ajax/libs/dompurify/2.4.0/purify.min.js"></script> en index.html');

    // Configurar marked explícitamente
    if (window.marked) {
        window.marked.setOptions({
            gfm: true,
            breaks: true,
            pedantic: false,
            smartLists: true,
            smartypants: true
        });
        console.log('marked configurado con opciones GFM');
    }

    const API_KEY = 'API_KEY';

    let historial = [];
    let conversaciones = [];
    let chatCounter = 0;
    let currentConversationIndex = -1;
    let selectedFiles = [];

    cargarHistorial();

    async function filterRelevantFiles(query, files) {
        console.log('Filtrando archivos relevantes para la consulta:', query);
        if (!files || files.length === 0) {
            console.log('No hay archivos subidos para filtrar');
            return [];
        }

        const casualGreetings = ['hola', 'hello', 'hey', 'saludos', 'hi'];
        if (casualGreetings.some(greeting => query.toLowerCase().includes(greeting))) {
            console.log('Consulta casual detectada, no se mostrarán fuentes');
            return [];
        }

        const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);
        const relevantFiles = files.filter(file => {
            const filename = file.filename.toLowerCase();
            return keywords.some(keyword => filename.includes(keyword));
        }).slice(0, 3);

        const uniqueFiles = Array.from(new Set(relevantFiles.map(f => f.id)))
            .map(id => relevantFiles.find(f => f.id === id));

        console.log('Archivos relevantes encontrados:', uniqueFiles.map(f => f.filename));
        return uniqueFiles;
    }

    async function sendMessage() {
        const userMessage = userInput.value.trim();
        if (userMessage === '') return;

        console.log('Enviando mensaje del usuario:', userMessage);

        try {
            await agregarMensaje('Usuario', userMessage, 'user.png');
        } catch (error) {
            console.error('Error al agregar mensaje del usuario:', error);
            return;
        }

        userInput.value = '';

        const loadingMessage = document.createElement('div');
        loadingMessage.classList.add('message');
        loadingMessage.innerHTML = `
            <img src="imagenes/bot.png" alt="Bot">
            <span><em>Escribiendo...</em></span>
        `;
        if (chatBody) {
            chatBody.appendChild(loadingMessage);
            chatBody.scrollTop = chatBody.scrollHeight;
        } else {
            console.error('Error: chatBody no está definido');
            return;
        }

        try {
            console.log('Obteniendo lista de archivos subidos...');
            let files = [];
            let fileIds = [];
            try {
                const filesResponse = await fetch('https://api.openai.com/v1/files', {
                    headers: {
                        'Authorization': `Bearer ${API_KEY}`
                    }
                });
                if (filesResponse.ok) {
                    const filesData = await filesResponse.json();
                    files = filesData.data.filter(file => file.purpose === 'assistants');
                    console.log('Archivos subidos:', files.map(f => f.filename));
                    const relevantFiles = await filterRelevantFiles(userMessage, files);
                    fileIds = relevantFiles.map(file => file.id);
                } else {
                    const errorData = await filesResponse.json();
                    console.error(`Error al obtener archivos: ${filesResponse.status} ${filesResponse.statusText} - ${JSON.stringify(errorData)}`);
                }
            } catch (error) {
                console.error('Error al cargar archivos:', error);
            }

            const isCasualGreeting = ['hola', 'hello', 'hey', 'saludos', 'hi'].some(greeting => userMessage.toLowerCase().includes(greeting));
            const systemPrompt = isCasualGreeting
                ? 'Eres JurisLibre, un asistente jurídico amigable. Responde de manera breve y cordial a saludos casuales.'
                : 'Eres JurisLibre, un asistente jurídico profesional. Responde con formalidad, claridad y lenguaje técnico o legal. Usa exclusivamente Markdown.';

            console.log('Enviando mensaje a chat/completions con prompt:', systemPrompt);
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userMessage }
                    ],
                    temperature: 0.7
                })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Error al enviar mensaje: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
            }
            const data = await response.json();
            const reply = data.choices[0].message.content;

            console.log('Respuesta cruda de la API:', reply);

            const cleanedReply = reply.replace(/\\_/g, '_');

            loadingMessage.remove();
            await agregarMensaje('JurisLibre', cleanedReply, 'bot.png', fileIds.length > 0 ? fileIds : []);
        } catch (error) {
            console.error('Error en sendMessage:', error);
            loadingMessage.querySelector('span').innerHTML = `Error: ${error.message}`;
        }
    }

    async function agregarMensaje(origen, texto, imagen, fileIds = []) {
        console.log(`Agregando mensaje: ${origen}: ${texto}`);
        const hora = new Date().toLocaleTimeString();
        let sourcesHTML = '';

        if (fileIds.length > 0) {
            try {
                const nombres = await Promise.all(fileIds.map(async (fileId) => {
                    try {
                        const res = await fetch(`https://api.openai.com/v1/files/${fileId}`, {
                            headers: {
                                'Authorization': `Bearer ${API_KEY}`
                            }
                        });
                        if (!res.ok) return fileId;
                        const data = await res.json();
                        return (data.filename || fileId).replace(/^_+|_+$/g, '');
                    } catch {
                        return fileId;
                    }
                }));

                sourcesHTML = `
                    <div class="message-sources">
                        <p>📄 Basado en:</p>
                        <ul>
                            ${nombres.map((nombre, index) => `
                                <li class="${index >= 3 ? 'hidden' : ''}">${nombre}</li>
                            `).join('')}
                        </ul>
                        ${nombres.length > 3 ? '<span class="show-more">Ver más</span>' : ''}
                    </div>
                `;
            } catch {
                sourcesHTML = '<div class="message-sources"><p>Error al cargar fuentes.</p></div>';
            }
        }

        let formattedText = texto;
        try {
            if (window.marked && window.DOMPurify) {
                formattedText = window.DOMPurify.sanitize(window.marked.parse(texto));
            } else {
                formattedText = texto.replace(/\\_/g, '_');
            }
        } catch {
            formattedText = texto.replace(/\\_/g, '_');
        }

        const mensaje = document.createElement('div');
        mensaje.classList.add('message');
        mensaje.innerHTML = `
            <img src="imagenes/${imagen}" alt="${origen}">
            <span><strong>${origen}:</strong> ${formattedText}${sourcesHTML}</span>
        `;
        if (chatBody) {
            chatBody.appendChild(mensaje);
            chatBody.scrollTop = chatBody.scrollHeight;
        }

        if (fileIds.length > 3) {
            const showMore = mensaje.querySelector('.show-more');
            if (showMore) {
                showMore.addEventListener('click', () => {
                    mensaje.querySelectorAll('.message-sources li.hidden')
                        .forEach(item => item.classList.remove('hidden'));
                    showMore.remove();
                });
            }
        }

        historial.push({ origen, texto, hora });

        if (currentConversationIndex >= 0 && conversaciones[currentConversationIndex]) {
            conversaciones[currentConversationIndex].mensajes = [...historial];
            localStorage.setItem('conversaciones', JSON.stringify(conversaciones));
        }

        localStorage.setItem('historial', JSON.stringify(historial));
    }

    async function loadUploadedFiles() {
        console.log('Cargando archivos subidos...');
        const uploadedFilesList = document.getElementById('uploaded-files-list');
        if (!uploadedFilesList) return;
        uploadedFilesList.innerHTML = '';

        try {
            const response = await fetch('https://api.openai.com/v1/files', {
                headers: { 'Authorization': `Bearer ${API_KEY}` }
            });
            if (!response.ok) return;
            const data = await response.json();
            const files = data.data.filter(file => file.purpose === 'assistants');
            files.forEach((file, index) => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <span class="file-order">${index + 1}</span>
                    <span class="file-name">${file.filename.replace(/^_+|_+$/g, '')}</span>
                `;
                uploadedFilesList.appendChild(li);
            });
        } catch (error) {
            console.error('Error al cargar archivos subidos:', error);
        }
    }

    function cargarHistorial() {
        console.log('Cargando historial y conversaciones...');
        try {
            const datosConversaciones = localStorage.getItem('conversaciones');
            if (datosConversaciones) {
                conversaciones = JSON.parse(datosConversaciones).filter(conv => conv?.mensajes?.length);
                chatCounter = conversaciones.length;
            }
        } catch {
            conversaciones = [];
            chatCounter = 0;
        }

        try {
            const datosHistorial = localStorage.getItem('historial');
            if (datosHistorial) historial = JSON.parse(datosHistorial);
        } catch {
            historial = [];
        }

        if (conversaciones.length === 0) {
            chatCounter = 1;
            conversaciones.push({ id: chatCounter, mensajes: [] });
            currentConversationIndex = 0;
            localStorage.setItem('conversaciones', JSON.stringify(conversaciones));
        }

        if (historialLista) {
            historialLista.innerHTML = '';
            conversaciones.forEach((conv, index) => {
                const item = document.createElement('li');
                item.textContent = `Conversación ${conv.id}`;
                item.classList.add('conversacion-item');
                item.dataset.index = index;
                item.addEventListener('click', () => {
                    if (currentConversationIndex >= 0) {
                        conversaciones[currentConversationIndex].mensajes = [...historial];
                        localStorage.setItem('conversaciones', JSON.stringify(conversaciones));
                    }
                    currentConversationIndex = index;
                    historial = [...conversaciones[index].mensajes];
                    localStorage.setItem('historial', JSON.stringify(historial));

                    if (chatBody) {
                        chatBody.innerHTML = '';
                        historial.forEach(m => {
                            const mensaje = document.createElement('div');
                            mensaje.classList.add('message');
                            let formattedText = m.texto;
                            try {
                                if (window.marked && window.DOMPurify) {
                                    formattedText = window.DOMPurify.sanitize(window.marked.parse(m.texto));
                                }
                            } catch {
                                formattedText = m.texto.replace(/\\_/g, '_');
                            }
                            mensaje.innerHTML = `
                                <img src="imagenes/${m.origen === 'Usuario' ? 'user.png' : 'bot.png'}" alt="${m.origen}">
                                <span><strong>${m.origen}:</strong> ${formattedText}</span>
                            `;
                            chatBody.appendChild(mensaje);
                        });
                        chatBody.scrollTop = chatBody.scrollHeight;
                    }
                });
                historialLista.appendChild(item);
            });
        }
    }

    function crearNuevaConversacion() {
        if (currentConversationIndex >= 0) {
            conversaciones[currentConversationIndex].mensajes = [...historial];
            localStorage.setItem('conversaciones', JSON.stringify(conversaciones));
        }

        chatCounter++;
        const nuevaConversacion = { id: chatCounter, mensajes: [] };
        conversaciones.push(nuevaConversacion);
        currentConversationIndex = conversaciones.length - 1;
        historial = [];
        localStorage.setItem('conversaciones', JSON.stringify(conversaciones));
        localStorage.setItem('chatCounter', chatCounter);
        localStorage.setItem('currentConversationIndex', currentConversationIndex);
        localStorage.setItem('historial', JSON.stringify(historial));

        if (chatBody) chatBody.innerHTML = '';

        if (historialLista) {
            const item = document.createElement('li');
            item.textContent = `Conversación ${nuevaConversacion.id}`;
            item.classList.add('conversacion-item');
            item.dataset.index = currentConversationIndex;
            item.addEventListener('click', () => {
                currentConversationIndex = parseInt(item.dataset.index);
                historial = [...conversaciones[currentConversationIndex].mensajes];
                localStorage.setItem('historial', JSON.stringify(historial));

                if (chatBody) {
                    chatBody.innerHTML = '';
                    historial.forEach(m => {
                        const mensaje = document.createElement('div');
                        mensaje.classList.add('message');
                        let formattedText = m.texto;
                        try {
                            if (window.marked && window.DOMPurify) {
                                formattedText = window.DOMPurify.sanitize(window.marked.parse(m.texto));
                            }
                        } catch {
                            formattedText = m.texto.replace(/\\_/g, '_');
                        }
                        mensaje.innerHTML = `
                            <img src="imagenes/${m.origen === 'Usuario' ? 'user.png' : 'bot.png'}" alt="${m.origen}">
                            <span><strong>${m.origen}:</strong> ${formattedText}</span>
                        `;
                        chatBody.appendChild(mensaje);
                    });
                    chatBody.scrollTop = chatBody.scrollHeight;
                }
            });
            historialLista.appendChild(item);
        }
    }

    function exportChatToPDF() {
        console.log('Exportando chat a PDF...');
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        let y = 10;
        doc.setFontSize(12);
        historial.forEach(mensaje => {
            const text = `${mensaje.hora} - ${mensaje.origen}: ${mensaje.texto.replace(/\\_/g, '_')}`;
            const splitText = doc.splitTextToSize(text, 180);
            doc.text(splitText, 10, y);
            y += splitText.length * 10;
            if (y > 280) {
                doc.addPage();
                y = 10;
            }
        });

        doc.save('chat.pdf');
    }

    function uploadFiles() {
        console.log('Subiendo archivos seleccionados...');
        const previewList = document.getElementById('file-preview-list');
        if (!selectedFiles || selectedFiles.length === 0) {
            console.warn('No hay archivos seleccionados para subir');
            return;
        }

        Array.from(selectedFiles).forEach(async (file, index) => {
            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('purpose', 'assistants');

                console.log(`Subiendo archivo ${index + 1}: ${file.name}`);

                const response = await fetch('https://api.openai.com/v1/files', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${API_KEY}`
                    },
                    body: formData
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(`Error al subir archivo ${file.name}: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
                }
                const data = await response.json();
                console.log(`Archivo ${file.name} subido con ID: ${data.id}`);

                const li = document.createElement('li');
                li.textContent = file.name;
                if (previewList) {
                    previewList.appendChild(li);
                }

                loadUploadedFiles();
            } catch (error) {
                console.error(`Error al subir archivo ${file.name}:`, error);
            }
        });
        selectedFiles = [];
        if (previewList) previewList.innerHTML = '';
    }

    // 🎤 Reconocimiento de voz con toggle
    let recognition;
    let escuchando = false;

    function toggleReconocimientoVoz() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert('Tu navegador no soporta reconocimiento de voz.');
            return;
        }

        if (!recognition) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognition = new SpeechRecognition();
            recognition.lang = 'es-ES';
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;

            recognition.onstart = () => {
                console.log('🎙️ Reconocimiento de voz iniciado...');
                micButton.textContent = '⬛'; // Indicador de grabando
            };

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                console.log('Texto reconocido:', transcript);
                userInput.value = transcript;
            };

            recognition.onerror = (event) => {
                console.error('Error en reconocimiento de voz:', event.error);
                alert('Error en reconocimiento de voz: ' + event.error);
            };

            recognition.onend = () => {
                console.log('🎤 Reconocimiento de voz finalizado.');
                micButton.textContent = '🎤';
                escuchando = false;
            };
        }

        if (!escuchando) {
            recognition.start();
            escuchando = true;
        } else {
            recognition.stop();
            escuchando = false;
            micButton.textContent = '🎤';
        }
    }

    // Eventos
    if (sendButton) sendButton.addEventListener('click', sendMessage);
    if (userInput) userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    if (nuevaConversacionBtn) nuevaConversacionBtn.addEventListener('click', crearNuevaConversacion);
    if (exportButton) exportButton.addEventListener('click', exportChatToPDF);
    if (subirBtn) subirBtn.addEventListener('click', uploadFiles);
    if (archivoInput) archivoInput.addEventListener('change', (e) => {
        selectedFiles = e.target.files;
        const previewList = document.getElementById('file-preview-list');
        if (previewList) {
            previewList.innerHTML = '';
            Array.from(selectedFiles).forEach(file => {
                const li = document.createElement('li');
                li.textContent = file.name;
                previewList.appendChild(li);
            });
        }
    });
    if (toggleButton) toggleButton.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        toggleButton.textContent = document.body.classList.contains('dark-mode') ? '☀️' : '🌙';
    });
    if (micButton) micButton.addEventListener('click', toggleReconocimientoVoz);

    loadUploadedFiles();
});

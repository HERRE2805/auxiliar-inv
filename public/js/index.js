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

    const API_KEY = 'API';

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
                ? 'Eres JurisLibre, un asistente jurídico amigable. Responde de manera breve y cordial a saludos casuales, por ejemplo, "¡Saludos! ¿En qué puedo ayudarte hoy en cuestiones legales?". Usa solo texto plano sin Markdown ni HTML.'
                : 'Eres JurisLibre, un asistente jurídico profesional de la Universidad Libre - Semilleros de IA Facultad de Derecho y Semillero Sensorama Ingeniería de Sistemas - 2024. Responde con formalidad, claridad y lenguaje técnico o legal según la consulta. Estructura todas tus respuestas exclusivamente en Markdown puro. Usa negritas (**texto**), listas con guiones (- Item), y saltos de línea para párrafos. No uses HTML (<b>, <p>, etc.), texto plano sin formato, ni ningún otro formato. Ejemplo: **Título**\n\n- **Punto 1**: Descripción.\n- **Punto 2**: Descripción.\n\nPárrafo adicional.';

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
            console.log('Obteniendo nombres de archivos para fileIds:', fileIds);
            try {
                const nombres = await Promise.all(fileIds.map(async (fileId) => {
                    try {
                        const res = await fetch(`https://api.openai.com/v1/files/${fileId}`, {
                            headers: {
                                'Authorization': `Bearer ${API_KEY}`
                            }
                        });
                        if (!res.ok) {
                            console.error(`Error al obtener archivo ${fileId}: ${res.status} ${res.statusText}`);
                            return fileId;
                        }
                        const data = await res.json();
                        const cleanFilename = (data.filename || fileId).replace(/^_+|_+$/g, '');
                        return cleanFilename;
                    } catch (error) {
                        console.error(`Error al obtener nombre del archivo ${fileId}:`, error);
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
            } catch (error) {
                console.error('Error al generar fuentes:', error);
                sourcesHTML = '<div class="message-sources"><p>Error al cargar fuentes.</p></div>';
            }
        }

        let formattedText = texto;
        try {
            if (window.marked && window.DOMPurify) {
                console.log('Procesando markdown para:', texto);
                formattedText = window.DOMPurify.sanitize(window.marked.parse(texto));
                console.log('Markdown procesado:', formattedText);
            } else {
                console.warn('marked o DOMPurify no disponibles, usando texto plano');
                formattedText = texto.replace(/\\_/g, '_');
            }
        } catch (error) {
            console.error('Error al procesar markdown:', error);
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
        } else {
            console.error('Error: chatBody no está definido');
            throw new Error('chatBody no está definido');
        }

        if (fileIds.length > 3) {
            const showMore = mensaje.querySelector('.show-more');
            if (showMore) {
                showMore.addEventListener('click', () => {
                    const hiddenItems = mensaje.querySelectorAll('.message-sources li.hidden');
                    hiddenItems.forEach(item => item.classList.remove('hidden'));
                    showMore.remove();
                });
            }
        }

        const mensajeObj = { origen, texto, hora };
        historial.push(mensajeObj);

        if (currentConversationIndex >= 0 && conversaciones[currentConversationIndex]) {
            conversaciones[currentConversationIndex].mensajes = [...historial];
            try {
                localStorage.setItem('conversaciones', JSON.stringify(conversaciones));
            } catch (error) {
                console.error('Error al guardar conversaciones en localStorage:', error);
            }
        }

        try {
            localStorage.setItem('historial', JSON.stringify(historial));
        } catch (error) {
            console.error('Error al guardar historial en localStorage:', error);
        }
    }

    async function loadUploadedFiles() {
        console.log('Cargando archivos subidos...');
        const uploadedFilesList = document.getElementById('uploaded-files-list');
        if (!uploadedFilesList) {
            console.error('Error: #uploaded-files-list no encontrado');
            return;
        }
        uploadedFilesList.innerHTML = '';

        try {
            const response = await fetch('https://api.openai.com/v1/files', {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`
                }
            });
            if (!response.ok) {
                const errorData = await response.json();
                console.error(`Error al cargar archivos desde /v1/files: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
                alert('No se pudieron cargar los archivos subidos. Verifica la API Key o la configuración de OpenAI.');
                return;
            }
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
            console.log('Archivos subidos cargados (/v1/files):', files.map(f => f.filename));
        } catch (error) {
            console.error('Error al cargar archivos subidos:', error);
            alert('No se pudieron cargar los archivos subidos. Verifica la conexión o la API Key.');
        }
    }

    function cargarHistorial() {
        console.log('Cargando historial y conversaciones...');
        try {
            const datosConversaciones = localStorage.getItem('conversaciones');
            if (datosConversaciones) {
                conversaciones = JSON.parse(datosConversaciones);
                conversaciones = conversaciones.filter(conv => conv && conv.mensajes && conv.mensajes.length > 0);
                conversaciones = conversaciones.map((conv, index) => ({
                    id: index + 1,
                    mensajes: conv.mensajes
                }));
                chatCounter = conversaciones.length;
                try {
                    localStorage.setItem('conversaciones', JSON.stringify(conversaciones));
                    localStorage.setItem('chatCounter', chatCounter);
                } catch (error) {
                    console.error('Error al guardar conversaciones o chatCounter en localStorage:', error);
                }
            }
        } catch (error) {
            console.error('Error al cargar conversaciones desde localStorage:', error);
            conversaciones = [];
            chatCounter = 0;
        }

        try {
            const datosHistorial = localStorage.getItem('historial');
            if (datosHistorial) {
                historial = JSON.parse(datosHistorial);
            }
        } catch (error) {
            console.error('Error al cargar historial desde localStorage:', error);
            historial = [];
        }

        try {
            const storedIndex = parseInt(localStorage.getItem('currentConversationIndex')) || -1;
            if (storedIndex >= 0 && storedIndex < conversaciones.length) {
                currentConversationIndex = storedIndex;
            } else {
                currentConversationIndex = conversaciones.length > 0 ? 0 : -1;
            }
            localStorage.setItem('currentConversationIndex', currentConversationIndex);
        } catch (error) {
            console.error('Error al cargar currentConversationIndex desde localStorage:', error);
            currentConversationIndex = -1;
        }

        if (conversaciones.length === 0 && chatCounter === 0) {
            chatCounter = 1;
            conversaciones.push({ id: chatCounter, mensajes: [] });
            currentConversationIndex = 0;
            try {
                localStorage.setItem('chatCounter', chatCounter);
                localStorage.setItem('conversaciones', JSON.stringify(conversaciones));
                localStorage.setItem('currentConversationIndex', currentConversationIndex);
                localStorage.setItem('historial', JSON.stringify(historial));
            } catch (error) {
                console.error('Error al inicializar localStorage:', error);
            }
        }

        if (historialLista) {
            historialLista.innerHTML = '';
            conversaciones.forEach((conv, index) => {
                const item = document.createElement('li');
                item.textContent = `Conversación ${conv.id}`;
                item.classList.add('conversacion-item');
                item.dataset.index = index;
                item.addEventListener('click', () => {
                    if (currentConversationIndex >= 0 && historial.length > 0) {
                        conversaciones[currentConversationIndex].mensajes = [...historial];
                        try {
                            localStorage.setItem('conversaciones', JSON.stringify(conversaciones));
                        } catch (error) {
                            console.error('Error al guardar conversaciones en localStorage:', error);
                        }
                    }

                    currentConversationIndex = index;
                    localStorage.setItem('currentConversationIndex', currentConversationIndex);
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
                            } catch (error) {
                                console.error('Error al procesar markdown en historial:', error);
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

        if (currentConversationIndex >= 0 && conversaciones[currentConversationIndex]) {
            historial = [...conversaciones[currentConversationIndex].mensajes];
            try {
                localStorage.setItem('historial', JSON.stringify(historial));
            } catch (error) {
                console.error('Error al guardar historial en localStorage:', error);
            }
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
                    } catch (error) {
                        console.error('Error al procesar markdown en historial:', error);
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
        }

        loadUploadedFiles();
    }

    if (nuevaConversacionBtn) {
        nuevaConversacionBtn.addEventListener('click', () => {
            console.log('Clic en #nueva-conversacion', { chatCounter, currentConversationIndex, conversacionesLength: conversaciones.length });

            if (currentConversationIndex >= 0 && historial.length > 0 && conversaciones[currentConversationIndex]) {
                conversaciones[currentConversationIndex].mensajes = [...historial];
                try {
                    localStorage.setItem('conversaciones', JSON.stringify(conversaciones));
                } catch (error) {
                    console.error('Error al guardar conversaciones en localStorage:', error);
                }
            }

            chatCounter++;
            try {
                localStorage.setItem('chatCounter', chatCounter);
            } catch (error) {
                console.error('Error al guardar chatCounter en localStorage:', error);
            }
            const nombre = `Conversación ${chatCounter}`;
            conversaciones.push({ id: chatCounter, mensajes: [] });
            const newIndex = conversaciones.length - 1;

            if (historialLista) {
                const item = document.createElement('li');
                item.textContent = nombre;
                item.classList.add('conversacion-item');
                item.dataset.index = newIndex;
                item.addEventListener('click', () => {
                    if (currentConversationIndex >= 0 && historial.length > 0) {
                        conversaciones[currentConversationIndex].mensajes = [...historial];
                        try {
                            localStorage.setItem('conversaciones', JSON.stringify(conversaciones));
                        } catch (error) {
                            console.error('Error al guardar conversaciones en localStorage:', error);
                        }
                    }

                    currentConversationIndex = newIndex;
                    try {
                        localStorage.setItem('currentConversationIndex', currentConversationIndex);
                    } catch (error) {
                        console.error('Error al guardar currentConversationIndex en localStorage:', error);
                    }
                    historial = [...conversaciones[newIndex].mensajes];
                    try {
                        localStorage.setItem('historial', JSON.stringify(historial));
                    } catch (error) {
                        console.error('Error al guardar historial en localStorage:', error);
                    }

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
                            } catch (error) {
                                console.error('Error al procesar markdown en historial:', error);
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
                historialLista.scrollTop = historialLista.scrollHeight;
            }

            currentConversationIndex = newIndex;
            try {
                localStorage.setItem('currentConversationIndex', currentConversationIndex);
            } catch (error) {
                console.error('Error al guardar currentConversationIndex en localStorage:', error);
            }
            historial = [];
            try {
                localStorage.setItem('historial', JSON.stringify(historial));
            } catch (error) {
                console.error('Error al guardar historial en localStorage:', error);
            }
            if (chatBody) {
                chatBody.innerHTML = '';
            }
            userInput.value = '';
        });
    }

    if (exportButton) {
        exportButton.addEventListener('click', () => {
            if (historial.length === 0) return;

            const contenido = historial.map(m => `${m.origen} [${m.hora}]: ${m.texto}`).join('\n\n');
            const blob = new Blob([contenido], { type: 'text/plain' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'conversacion_juridica.txt';
            link.click();
        });
    }

    if (sendButton) {
        sendButton.addEventListener('click', sendMessage);
    }
    if (userInput) {
        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }

    if (subirBtn) {
        subirBtn.addEventListener('click', async () => {
            if (selectedFiles.length === 0) {
                alert('Selecciona al menos un archivo.');
                return;
            }

            console.log('Subiendo archivos:', selectedFiles.map(f => f.name));
            for (let archivo of selectedFiles) {
                try {
                    const formData = new FormData();
                    formData.append("file", archivo);
                    formData.append("purpose", "assistants");

                    const fileUploadRes = await fetch("https://api.openai.com/v1/files", {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${API_KEY}`
                        },
                        body: formData
                    });
                    if (!fileUploadRes.ok) {
                        const errorData = await fileUploadRes.json();
                        console.error(`Error al subir archivo ${archivo.name}: ${fileUploadRes.status} ${fileUploadRes.statusText} - ${JSON.stringify(errorData)}`);
                        alert(`❌ Error al subir ${archivo.name}`);
                        continue;
                    }
                    const data = await fileUploadRes.json();
                    console.log(`✅ Archivo subido: ${data.filename} (${data.id})`);
                    alert(`✅ Archivo subido correctamente: ${data.filename}`);
                } catch (error) {
                    console.error('Error al subir archivo:', error);
                    alert(`❌ Error al subir ${archivo.name}`);
                }
            }

            selectedFiles = [];
            archivoInput.value = '';
            updateFilePreview();
            await loadUploadedFiles();
        });
    }

    if (archivoInput) {
        archivoInput.addEventListener('change', () => {
            const newFiles = Array.from(archivoInput.files);
            selectedFiles = [...selectedFiles, ...newFiles];
            updateFilePreview();
        });
    }

    function updateFilePreview() {
        const filePreviewList = document.getElementById('file-preview-list');
        if (!filePreviewList) {
            console.error('Error: #file-preview-list no encontrado');
            return;
        }
        filePreviewList.innerHTML = '';

        selectedFiles.forEach((file, index) => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="file-order">${index + 1}</span>
                <span class="file-name">${file.name.replace(/^_+|_+$/g, '')}</span>
                <button class="file-remove" data-index="${index}">🗑️</button>
            `;
            filePreviewList.appendChild(li);

            li.querySelector('.file-remove').addEventListener('click', () => {
                selectedFiles.splice(index, 1);
                updateFilePreview();
            });
        });
    }

    if (localStorage.getItem('tema') === 'oscuro') {
        document.body.classList.add('dark-mode');
        if (toggleButton) toggleButton.textContent = '☀️';
    }

    if (toggleButton) {
        toggleButton.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            toggleButton.textContent = isDark ? '☀️' : '🌙';
            localStorage.setItem('tema', isDark ? 'oscuro' : 'claro');
        });
    }
});
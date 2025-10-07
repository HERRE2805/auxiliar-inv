document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM cargado, inicializando JurisLibre...');

    const chatBody = document.getElementById('chat-body');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const exportButton = document.getElementById('export-button');
    const nuevaConversacionBtn = document.getElementById('nueva-conversacion');
    const historialLista = document.getElementById('historial-lista');
    const subirBtn = document.getElementById('subir-archivo');
    const archivoInput = document.getElementById('archivo-input');
    const toggleButton = document.getElementById('toggle-theme');
    const micButton = document.getElementById('mic-button');

    const statusContainer = document.createElement('div');
    statusContainer.id = 'upload-status';
    subirBtn.insertAdjacentElement('afterend', statusContainer);

    if (!window.marked || !window.DOMPurify) {
        console.error('Faltan dependencias: marked o DOMPurify');
    } else {
        window.marked.setOptions({ gfm: true, breaks: true });
    }

    const API_KEY = "API_KEY";
    let historial = [];
    let conversaciones = [];
    let currentConversationIndex = -1;
    let selectedFiles = [];
    let documentosLocales = [];

    // Restaurar tema guardado
    const temaGuardado = localStorage.getItem('tema');
    if (temaGuardado === 'oscuro') {
        document.body.classList.add('dark-mode');
        toggleButton.textContent = '☀️';
    }

    // Restaurar documentos guardados solo si se recarga la pestaña
    const documentosGuardados = sessionStorage.getItem('documentosLocales');
    if (documentosGuardados) {
        documentosLocales = JSON.parse(documentosGuardados);
        const uploadedList = document.getElementById('uploaded-files-list');
        if (uploadedList) {
            uploadedList.innerHTML = '';
            documentosLocales.forEach(doc => {
                const li = document.createElement('li');
                li.textContent = doc.nombre;
                uploadedList.appendChild(li);
            });
        }
        console.log('Archivos restaurados desde sesión:', documentosLocales.map(d => d.nombre));
    }

    // Borrar documentos solo al cerrar la ventana (no al recargar)
    window.addEventListener('beforeunload', (e) => {
        if (!window.performance.navigation || window.performance.navigation.type === 0) {
            sessionStorage.removeItem('documentosLocales');
        }
    });

    // Cargar historial/conversaciones previas
    cargarHistorial();

    // Integración con el lector de archivos avanzado
    async function procesarArchivosSeleccionados(archivos) {
        try {
            const resultados = await FileReaderHelper.procesarArchivos(archivos);
            return resultados.map(r => ({
                nombre: r.nombre,
                contenido: r.contenido.substring(0, 10000)
            }));
        } catch (error) {
            console.error('Error al procesar archivos:', error);
            return [];
        }
    }

    async function uploadFiles() {
        console.log('Cargando archivos localmente...');
        const previewList = document.getElementById('file-preview-list');
        if (!selectedFiles.length) {
            statusContainer.innerHTML = '<span style="color:#c0392b;">No hay archivos seleccionados</span>';
            return;
        }

        documentosLocales = await procesarArchivosSeleccionados(selectedFiles);

        if (previewList) {
            previewList.innerHTML = '';
            documentosLocales.forEach(doc => {
                const li = document.createElement('li');
                li.textContent = doc.nombre;
                previewList.appendChild(li);
            });
        }

        sessionStorage.setItem('documentosLocales', JSON.stringify(documentosLocales));
        console.log('Archivos procesados localmente:', documentosLocales.map(d => d.nombre));
        statusContainer.innerHTML = `<span style="color:green;">${documentosLocales.length} archivo(s) procesado(s) correctamente.</span>`;
        selectedFiles = [];
    }

    async function sendMessage() {
        const userMessage = userInput.value.trim();
        if (userMessage === '') return;

        await agregarMensaje('Usuario', userMessage, 'user.png');
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
            let contextoDocumentos = '';

            if (documentosLocales.length > 0) {
                const relevantes = documentosLocales.filter(doc =>
                    userMessage.toLowerCase().includes(doc.nombre.split('.')[0].toLowerCase())
                );

                const docsAIncluir = relevantes.length ? relevantes : documentosLocales.slice(0, 2);
                contextoDocumentos = docsAIncluir.map(doc =>
                    `[Documento: ${doc.nombre}]\n${doc.contenido.substring(0, 3000)}`
                ).join('\n---\n');
            }

            const systemPrompt = documentosLocales.length > 0
                ? 'Eres JurisLibre, un asistente jurídico experto. Usa los documentos adjuntos solo si son relevantes. Si no hay información suficiente, dilo claramente.'
                : 'Eres JurisLibre, un asistente jurídico experto. Si no hay documentos relevantes, responde sin inventar información.';

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`
                },
                body: JSON.stringify({
                    model: 'gpt-4-turbo',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userMessage + (contextoDocumentos ? `\n\nContexto:\n${contextoDocumentos}` : '') }
                    ],
                    temperature: 0.6
                })
            });

            if (!response.ok) throw new Error(`Error ${response.status}`);
            const data = await response.json();
            let reply = data.choices[0].message.content || 'No se pudo generar respuesta.';

            // Detección de fuentes relevantes basada en coincidencia de nombre o contenido
            const fuentesUsadas = documentosLocales
                .filter(doc => {
                    const nombreCoincide = reply.toLowerCase().includes(doc.nombre.toLowerCase());
                    const contextoCoincide = reply.toLowerCase().includes(doc.contenido.substring(0, 200).toLowerCase());
                    return nombreCoincide || contextoCoincide;
                })
                .map(doc => doc.nombre);

            // Solo mostrar fuentes cuando realmente se usaron
            if (fuentesUsadas.length > 0) {
                reply += `\n\n📄 <em>Fuente${fuentesUsadas.length > 1 ? 's' : ''}: ${fuentesUsadas.join(', ')}</em>`;
            }

            loadingMessage.remove();
            await agregarMensaje('JurisLibre', reply, 'bot.png');
        } catch (error) {
            console.error('Error al procesar mensaje:', error);
            loadingMessage.querySelector('span').innerHTML = `Error: ${error.message}`;
        }
    }

    // Mostrar mensaje
    async function agregarMensaje(origen, texto, imagen) {
        const hora = new Date().toLocaleTimeString();
        let formattedText = texto;

        try {
            if (window.marked && window.DOMPurify) {
                formattedText = window.DOMPurify.sanitize(window.marked.parse(texto));
            }
        } catch {
            formattedText = texto;
        }

        const mensaje = document.createElement('div');
        mensaje.classList.add('message');
        mensaje.innerHTML = `
            <img src="imagenes/${imagen}" alt="${origen}">
            <span><strong>${origen}:</strong> ${formattedText}</span>
        `;
        chatBody.appendChild(mensaje);
        chatBody.scrollTop = chatBody.scrollHeight;

        historial.push({ origen, texto, hora });
        if (currentConversationIndex >= 0 && conversaciones[currentConversationIndex]) {
            conversaciones[currentConversationIndex].mensajes = [...historial];
            localStorage.setItem('conversaciones', JSON.stringify(conversaciones));
        }
        localStorage.setItem('historial', JSON.stringify(historial));
    }

    // Exportar chat a PDF
    async function exportChatToPDF() {
        console.log('📄 Exportando PDF...');
        if (!chatBody || chatBody.children.length === 0) {
            alert('No hay mensajes para exportar.');
            return;
        }

        // Crear clon invisible del chat
        const chatClone = chatBody.cloneNode(true);
        chatClone.style.background = getComputedStyle(document.body).backgroundColor;
        chatClone.style.padding = '20px';
        chatClone.style.width = '800px';
        chatClone.style.maxHeight = 'none';
        chatClone.style.overflow = 'visible';

        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.left = '-9999px';
        container.appendChild(chatClone);
        document.body.appendChild(container);

        try {
            // Capturar imagen del chat
            const canvas = await html2canvas(chatClone, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL('image/png');

            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');

            // Dimensiones A4 en mm
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();

            // Calcular proporciones
            const imgWidth = pageWidth;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            let heightLeft = imgHeight;
            let position = 0;

            // Añadir todas las páginas necesarias
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            pdf.save('Conversacion_JurisLibre.pdf');
            console.log('PDF exportado correctamente.');
        } catch (error) {
            console.error('Error al exportar PDF:', error);
            alert('Error al exportar el PDF. Revisa la consola para más detalles.');
        } finally {
            container.remove();
        }
    }


    // Historial
    function cargarHistorial() {
        try {
            const datosConversaciones = localStorage.getItem('conversaciones');
            if (datosConversaciones) conversaciones = JSON.parse(datosConversaciones).filter(c => c.mensajes?.length);
        } catch {
            conversaciones = [];
        }
        if (conversaciones.length === 0) {
            conversaciones.push({ id: 1, mensajes: [] });
            currentConversationIndex = 0;
        }
        renderizarConversaciones();
    }

    function renderizarConversaciones() {
        historialLista.innerHTML = '';
        conversaciones.forEach((conv, index) => {
            const item = document.createElement('li');
            item.textContent = `Conversación ${conv.id}`;
            item.classList.add('conversacion-item');
            item.dataset.index = index;
            item.addEventListener('click', () => cambiarConversacion(index));
            historialLista.appendChild(item);
        });
    }

    function cambiarConversacion(index) {
        if (currentConversationIndex >= 0)
            conversaciones[currentConversationIndex].mensajes = [...historial];
        currentConversationIndex = index;
        historial = [...conversaciones[index].mensajes];
        chatBody.innerHTML = '';
        historial.forEach(m => {
            const msg = document.createElement('div');
            msg.classList.add('message');
            msg.innerHTML = `
                <img src="imagenes/${m.origen === 'Usuario' ? 'user.png' : 'bot.png'}" alt="${m.origen}">
                <span><strong>${m.origen}:</strong> ${m.texto}</span>
            `;
            chatBody.appendChild(msg);
        });
    }

    // Nueva conversación
    nuevaConversacionBtn.addEventListener('click', () => {
        const nueva = { id: conversaciones.length + 1, mensajes: [] };
        conversaciones.push(nueva);
        currentConversationIndex = conversaciones.length - 1;
        historial = [];
        chatBody.innerHTML = '';
        localStorage.setItem('conversaciones', JSON.stringify(conversaciones));
        renderizarConversaciones();
    });

    // Reconocimiento de voz
    let recognition;
    let escuchando = false;
    function toggleReconocimientoVoz() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('Tu navegador no soporta reconocimiento de voz.');
            return;
        }
        if (!recognition) {
            recognition = new SpeechRecognition();
            recognition.lang = 'es-ES';
            recognition.interimResults = false;
            recognition.onstart = () => micButton.textContent = '⬛';
            recognition.onresult = e => userInput.value = e.results[0][0].transcript;
            recognition.onend = () => { micButton.textContent = '🎤'; escuchando = false; };
        }
        if (!escuchando) {
            recognition.start();
            escuchando = true;
        } else {
            recognition.stop();
            escuchando = false;
        }
    }

    // Eventos
    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', e => { if (e.key === 'Enter') sendMessage(); });
    exportButton.addEventListener('click', exportChatToPDF);
    subirBtn.addEventListener('click', uploadFiles);
    archivoInput.addEventListener('change', e => {
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
    toggleButton.addEventListener('click', () => {
        const esOscuro = document.body.classList.toggle('dark-mode');
        toggleButton.textContent = esOscuro ? '☀️' : '🌙';
        localStorage.setItem('tema', esOscuro ? 'oscuro' : 'claro');
    });
    micButton.addEventListener('click', toggleReconocimientoVoz);
});

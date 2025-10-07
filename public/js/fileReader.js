// Lector de archivos local
const FileReaderHelper = {
    async procesarArchivos(fileList) {
        const archivosProcesados = [];

        for (const file of fileList) {
            const extension = file.name.split('.').pop().toLowerCase();
            let contenido = '';

            try {
                if (extension === 'pdf') {
                    contenido = await this.leerPDF(file);
                } else if (extension === 'docx') {
                    contenido = await this.leerDOCX(file);
                } else if (extension === 'txt') {
                    contenido = await this.leerTXT(file);
                } else {
                    console.warn(`Tipo de archivo no soportado: ${extension}`);
                    continue;
                }

                archivosProcesados.push({
                    nombre: file.name,
                    contenido: contenido.trim()
                });
            } catch (error) {
                console.error(`Error procesando ${file.name}:`, error);
            }
        }

        console.log(`${archivosProcesados.length} archivo(s) procesado(s) localmente.`);
        return archivosProcesados;
    },

    async leerPDF(file) {
        return new Promise(async (resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async function() {
                try {
                    const pdfData = new Uint8Array(this.result);
                    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
                    let texto = '';
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const content = await page.getTextContent();
                        texto += content.items.map(i => i.str).join(' ') + '\n';
                    }
                    resolve(texto);
                } catch (err) {
                    reject(err);
                }
            };
            reader.readAsArrayBuffer(file);
        });
    },

    async leerDOCX(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async function(event) {
                try {
                    const arrayBuffer = event.target.result;
                    const result = await window.mammoth.extractRawText({ arrayBuffer });
                    resolve(result.value);
                } catch (err) {
                    reject(err);
                }
            };
            reader.readAsArrayBuffer(file);
        });
    },

    async leerTXT(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsText(file);
        });
    }
};

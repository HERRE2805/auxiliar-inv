const floatingSection = document.getElementById("floatingSection");
const floatingHeader = document.getElementById("floatingHeader");
const floatingContent = document.getElementById("floatingContent");
const closeBtn = document.getElementById("closeBtn");
const minimizeBtn = document.getElementById("minimizeBtn");

closeBtn.addEventListener("click", () => {
    floatingSection.style.display = "none";
});

let minimized = false;
minimizeBtn.addEventListener("click", () => {
    minimized = !minimized;
    floatingContent.style.display = minimized ? "none" : "block";
});

floatingHeader.addEventListener("mousedown", (e) => {
    isDragging = true;
    offsetX = e.clientX - floatingSection.getBoundingClientRect().left;
    offsetY = e.clientY - floatingSection.getBoundingClientRect().top;
    floatingSection.style.right = 'auto';
});

document.addEventListener("mousemove", (e) => {
    if (isDragging) {
        floatingSection.style.left = `${e.clientX - offsetX}px`;
        floatingSection.style.top = `${e.clientY - offsetY}px`;
    }
});

document.addEventListener("mouseup", () => {
    isDragging = false;
});

const header = document.getElementById("floatingHeader");
const section = document.getElementById("floatingSection");

let isDragging = false;
let offsetX, offsetY;

header.addEventListener("mousedown", (e) => {
    isDragging = true;
    offsetX = e.clientX - section.offsetLeft;
    offsetY = e.clientY - section.offsetTop;
    section.style.cursor = "grabbing";
});

document.addEventListener("mouseup", () => {
    isDragging = false;
    section.style.cursor = "default";
});

document.addEventListener("mousemove", (e) => {
    if (isDragging) {
        section.style.left = `${e.clientX - offsetX}px`;
        section.style.top = `${e.clientY - offsetY}px`;
    }
});
function actualizarFlotante(texto) {
    document.getElementById("floatingContent").innerHTML = `<p>${texto}</p>`;
}
document.getElementById("send-button").addEventListener("click", () => {
    actualizarFlotante("💡 Tip: Recuerda incluir fechas o nombres relevantes para mejores respuestas.");
});

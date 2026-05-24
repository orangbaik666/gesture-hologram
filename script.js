const particleCanvas = document.getElementById("particles");
const particleCtx = particleCanvas.getContext("2d");

const video = document.getElementById("webcam");
const canvas = document.getElementById("output");
const ctx = canvas.getContext("2d");

const statusText = document.getElementById("status");
const hologram = document.getElementById("hologram");
const hologramContent = hologram.querySelector(".hologram-content");

const recordBtn = document.getElementById("recordBtn");
const gestureList = document.getElementById("gestureList");

const mouseBtn = document.getElementById("mouseBtn");
const virtualCursor = document.getElementById("virtualCursor");

const confidenceFill = document.getElementById("confidenceFill");
const confidenceText = document.getElementById("confidenceText");
const gestureMatch = document.getElementById("gestureMatch");
const aiStatus = document.getElementById("aiStatus");

const handAura = document.getElementById("handAura");

const drawBtn = document.getElementById("drawBtn");
const whiteboardPanel = document.getElementById("whiteboardPanel");
const whiteboardCanvas = document.getElementById("whiteboardCanvas");
const clearBoardBtn = document.getElementById("clearBoardBtn");
const wbCtx = whiteboardCanvas.getContext("2d");
const wbCursor = document.getElementById("wbCursor"); 

const gesturePanel = document.getElementById("gesturePanel");
const scannerPanel = document.getElementById("scannerPanel");

const videoPlayerPanel = document.getElementById("videoPlayerPanel");
const specialVideoPlayer = document.getElementById("specialVideoPlayer");
const closeVideoBtn = document.getElementById("closeVideoBtn");

/* =========================
   STATE
========================= */

let mouseMode = false;
let drawMode = false;
let latestLandmarks = null;

let smoothX = 0;
let smoothY = 0;

// Whiteboard state
let penDown = false;
let lastDrawX = null;
let lastDrawY = null;
let drawColor = "#00ffff";
let drawSize = 3;

let videoMode = false;
const specialVideoGestureName = "Special Video Request"; 

/* =========================
   JARVIS + SOUND
========================= */

const jarvis = {
    speak(text) {
        const msg = new SpeechSynthesisUtterance(text);
        msg.lang = "en-US";
        msg.rate = 1;
        msg.pitch = 0.9;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(msg);
    },

    boot() {
        this.speak("System online. Gesture AI activated.");
        playSound("scan");
    },

    detect(text) {
        this.speak(text);
    }
};

const sounds = {
    scan: new Audio("assets/freesound_community-cyberpunk-beat-64649.mp3"),
    beep: new Audio("assets/alexis_gaming_cam-digi-beep-qst-346094.mp3"),
    glitch: new Audio("assets/soundreality-glitch-master-140900.mp3"),
    love: new Audio("assets/voice-love.mp3")
};

function playSound(name) {
    const s = sounds[name];
    if (!s) return;
    s.currentTime = 0;
    s.volume = 0.6;
    s.play().catch(() => { });
}

/* =========================
   GESTURE STORAGE
========================= */

const savedGestures = [];

/* =========================
   NORMALIZE & DISTANCE
========================= */

function normalize(landmarks) {
    const base = landmarks[0];
    return landmarks.map(p => ({
        x: p.x - base.x,
        y: p.y - base.y
    }));
}

function distance(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function compareGestures(current, saved) {
    const n1 = normalize(current);
    const n2 = normalize(saved);

    let total = 0;
    for (let i = 0; i < n1.length; i++) {
        total += distance(n1[i], n2[i]);
    }

    return (total / n1.length) < 0.05;
}

function calculateConfidence(current, saved) {
    const n1 = normalize(current);
    const n2 = normalize(saved);

    let total = 0;
    for (let i = 0; i < n1.length; i++) {
        total += distance(n1[i], n2[i]);
    }

    const avg = total / n1.length;
    return Math.max(0, Math.floor(100 - avg * 1000));
}

/* =========================
   THRESHOLD SOUND CONTROL
========================= */

let lastSoundState = null;

function playThresholdSound(score) {
    let state = score < 40 ? "glitch" : "beep";

    if (state === lastSoundState) return;

    lastSoundState = state;
    playSound(state);
}

/* =========================
   PARTICLES
========================= */

const particles = [];

function createParticle(x, y) {
    if (particles.length > 120) particles.shift();

    particles.push({
        x,
        y,
        size: Math.random() * 5 + 2,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 3,
        alpha: 1
    });
}

function updateParticles() {
    particleCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);

    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.02;

        particleCtx.beginPath();
        particleCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        particleCtx.fillStyle = `rgba(0,255,255,${p.alpha})`;
        particleCtx.shadowBlur = 20;
        particleCtx.shadowColor = "#00ffff";
        particleCtx.fill();

        if (p.alpha <= 0) particles.splice(i, 1);
    }

    requestAnimationFrame(updateParticles);
}

/* =========================
   UI
========================= */

function renderGestures() {
    gestureList.innerHTML = "";

    savedGestures.forEach(g => {
        const div = document.createElement("div");
        div.className = "gesture-item";
        div.innerHTML = `
            <span>${g.name}</span>
            <button onclick="removeGesture(${g.id})">X</button>
        `;
        gestureList.appendChild(div);
    });
}

window.removeGesture = function (id) {
    const i = savedGestures.findIndex(g => g.id === id);
    if (i !== -1) savedGestures.splice(i, 1);
    renderGestures();
};

/* =========================
   SAVE GESTURE
========================= */

recordBtn.onclick = () => {
    if (!latestLandmarks) return;

    const name = prompt(`Gesture name? (Use '${specialVideoGestureName}' for the video gesture)`, specialVideoGestureName);
    if (!name) return;

    savedGestures.push({
        id: Date.now(),
        name,
        landmarks: latestLandmarks
    });

    renderGestures();

    hologramContent.innerText = "GESTURE SAVED";
    hologram.classList.remove("hidden");

    setTimeout(() => hologram.classList.add("hidden"), 1500);
};

/* =========================
   CAMERA
========================= */

async function setupCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;

    return new Promise(res => {
        video.onloadedmetadata = () => res(video);
    });
}

function resize() {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    particleCanvas.width = video.videoWidth;
    particleCanvas.height = video.videoHeight;
}

/* =========================
   RESET UI
========================= */

function resetUI() {
    confidenceFill.style.width = "0%";
    confidenceText.innerText = "0%";
    gestureMatch.innerText = "NONE";
    aiStatus.innerText = "IDLE";
}

/* =========================
   VIDEO FUNCTIONS
========================= */

function showSpecialVideo() {
    if (videoMode) return; 

    videoMode = true;
    hologram.classList.add("hidden");
    whiteboardPanel.classList.add("hidden"); 
    [gesturePanel, scannerPanel].forEach(el => el.classList.add("hidden"));

    videoPlayerPanel.classList.remove("hidden");
    specialVideoPlayer.play();

    jarvis.speak("Special request video detected. Playing now.");
    statusText.innerText = "SPECIAL VIDEO MODE ACTIVE";
}

function hideSpecialVideo() {
    videoMode = false;
    specialVideoPlayer.pause();
    specialVideoPlayer.currentTime = 0; 
    videoPlayerPanel.classList.add("hidden");

    [gesturePanel, scannerPanel].forEach(el => el.classList.remove("hidden"));

    jarvis.speak("Video closed. Gestures system reactivated.");
    statusText.innerText = "HAND DETECTED";
}

closeVideoBtn.onclick = hideSpecialVideo;
specialVideoPlayer.addEventListener('ended', hideSpecialVideo);


/* =========================
   DETECTION ENGINE
========================= */

function onResults(results) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!results.multiHandLandmarks) {
        statusText.innerText = "Scanning...";
        resetUI();
        if (!videoMode) hologram.classList.add("hidden"); 
        latestLandmarks = null;
        lastSoundState = null;
        return;
    }

    statusText.innerText = "HAND DETECTED";

    let best = null;
    let bestScore = 0;
    let detected = false;

    for (const landmarks of results.multiHandLandmarks) {
        latestLandmarks = landmarks;

        const index = landmarks[8];
        const palm = landmarks[9];

        handAura.style.left = `${(1 - palm.x) * canvas.width}px`; 
        handAura.style.top = `${palm.y * canvas.height}px`;

        if (mouseMode) {
            const rect = document.querySelector(".camera-section").getBoundingClientRect();

            const targetX = (1 - index.x) * rect.width; 
            const targetY = index.y * rect.height;

            smoothX += (targetX - smoothX) * 0.25;
            smoothY += (targetY - smoothY) * 0.25;

            virtualCursor.style.transform =
                `translate(${smoothX}px, ${smoothY}px)`;
        }

        /* =========================
           DRAW MODE (PINCH TO DRAW)
        ========================= */

        if (drawMode) {
            const thumbTip = landmarks[4];
            const indexTip = landmarks[8];

            const pinchDist = Math.sqrt(
                (thumbTip.x - indexTip.x) ** 2 +
                (thumbTip.y - indexTip.y) ** 2
            );
            const isPinching = pinchDist < 0.06;

            const wbX = (1 - (thumbTip.x + indexTip.x) / 2) * whiteboardCanvas.width;
            const wbY = ((thumbTip.y + indexTip.y) / 2) * whiteboardCanvas.height;

            const cursorPercX = (wbX / whiteboardCanvas.width) * 100;
            const cursorPercY = (wbY / whiteboardCanvas.height) * 100;
            wbCursor.style.left = `${cursorPercX}%`;
            wbCursor.style.top = `${cursorPercY}%`;

            if (isPinching) {
                virtualCursor.classList.add("drawing");
                wbCursor.classList.add("pinching");

                if (penDown && lastDrawX !== null) {
                    wbCtx.beginPath();
                    wbCtx.moveTo(lastDrawX, lastDrawY);
                    wbCtx.lineTo(wbX, wbY);
                    wbCtx.strokeStyle = drawColor;
                    wbCtx.lineWidth = drawSize;
                    wbCtx.lineCap = "round";
                    wbCtx.lineJoin = "round";
                    wbCtx.shadowBlur = 12;
                    wbCtx.shadowColor = drawColor;
                    wbCtx.stroke();
                }

                penDown = true;
                lastDrawX = wbX;
                lastDrawY = wbY;
            } else {
                virtualCursor.classList.remove("drawing");
                wbCursor.classList.remove("pinching");
                penDown = false;
                lastDrawX = null;
                lastDrawY = null;
            }
        }

        createParticle(
            index.x * particleCanvas.width,
            index.y * particleCanvas.height
        );

        drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {
            color: "#00ffff",
            lineWidth: 3
        });

        drawLandmarks(ctx, landmarks, {
            color: "#ff00ff",
            radius: 4
        });

        /* =========================
           VIDEO GESTURE CHECK
        ========================= */

        let specialGestureFound = false;

        for (const g of savedGestures) {
            if (g.name === specialVideoGestureName && compareGestures(landmarks, g.landmarks)) {
                specialGestureFound = true;
                break;
            }
        }

        if (specialGestureFound) {
            showSpecialVideo();
            return; 
        }

        if (videoMode) return; 

        /* =========================
           REGULAR GESTURE CHECK
        ========================= */

        for (const g of savedGestures) {
            const score = calculateConfidence(landmarks, g.landmarks);

            if (score > bestScore) {
                bestScore = score;
                best = g;
            }

            if (compareGestures(landmarks, g.landmarks)) {
                detected = true;

                hologramContent.innerText = `🔥 ${g.name}`;
                hologram.classList.remove("hidden");
                statusText.innerText = `${g.name} DETECTED`;

                jarvis.detect(`${g.name} detected`);
                break;
            }
        }

        if (best && detected) {
            confidenceFill.style.width = `${bestScore}%`;
            confidenceText.innerText = `${bestScore}%`;
            gestureMatch.innerText = best.name;

            aiStatus.innerText =
                bestScore > 80 ? "HIGH CONFIDENCE" :
                    bestScore > 50 ? "ANALYZING" :
                        "LOW MATCH";

            playThresholdSound(bestScore);
        }
        else {
            confidenceFill.style.width = "0%";
            confidenceText.innerText = "0%";
            gestureMatch.innerText = "NONE";
            aiStatus.innerText = "IDLE";

            if (savedGestures.length > 0) {
                statusText.innerText = "GESTURE NOT DETECTED";
                hologramContent.innerText = "❌ NOT DETECTED";
                hologram.classList.remove("hidden");

                if (lastSoundState !== "error_voice") {
                    jarvis.speak("Gesture not detected");
                    lastSoundState = "error_voice";
                }
            } else {
                hologram.classList.add("hidden");
                lastSoundState = null;
            }
        }
    }
}

/* =========================
   MOUSE MODE
========================= */

mouseBtn.onclick = () => {
    mouseMode = !mouseMode;
    mouseBtn.innerText = mouseMode ? "MOUSE ON" : "MOUSE OFF";
    virtualCursor.style.display = mouseMode ? "block" : "none";
};

/* =========================
   DRAW MODE
========================= */

function initWhiteboard() {
    whiteboardCanvas.width = whiteboardCanvas.offsetWidth;
    whiteboardCanvas.height = whiteboardCanvas.offsetHeight;
    wbCtx.fillStyle = "#04060f";
    wbCtx.fillRect(0, 0, whiteboardCanvas.width, whiteboardCanvas.height);
}

drawBtn.onclick = () => {
    if (videoMode) hideSpecialVideo(); 

    drawMode = !drawMode;
    drawBtn.innerText = drawMode ? "DRAW MODE ON" : "DRAW MODE OFF";
    hologram.classList.add("hidden");

    if (drawMode) {
        [gesturePanel, scannerPanel].forEach(el => {
            el.classList.add("panel-leave");
            el.addEventListener("animationend", () => {
                el.classList.add("hidden");
                el.classList.remove("panel-leave");
            }, { once: true });
        });

        whiteboardPanel.classList.remove("hidden");
        whiteboardPanel.classList.remove("wb-leave");
        void whiteboardPanel.offsetWidth; 
        whiteboardPanel.classList.add("wb-enter");
        whiteboardPanel.addEventListener("animationend", () => {
            whiteboardPanel.classList.remove("wb-enter");
        }, { once: true });

        requestAnimationFrame(initWhiteboard);
        wbCursor.style.display = "block";
        jarvis.speak("Draw mode activated. Pinch to draw.");

    } else {
        whiteboardPanel.classList.remove("wb-enter");
        whiteboardPanel.classList.add("wb-leave");
        whiteboardPanel.addEventListener("animationend", () => {
            whiteboardPanel.classList.add("hidden");
            whiteboardPanel.classList.remove("wb-leave");
        }, { once: true });

        [gesturePanel, scannerPanel].forEach(el => {
            el.classList.remove("hidden");
            el.classList.remove("panel-leave");
            void el.offsetWidth; 
            el.classList.add("panel-enter");
            el.addEventListener("animationend", () => {
                el.classList.remove("panel-enter");
            }, { once: true });
        });

        penDown = false;
        lastDrawX = null;
        lastDrawY = null;
        virtualCursor.classList.remove("drawing");
        wbCursor.style.display = "none";
        wbCursor.classList.remove("pinching");
        jarvis.speak("Draw mode off.");
    }
};

clearBoardBtn.onclick = () => {
    wbCtx.fillStyle = "#04060f";
    wbCtx.fillRect(0, 0, whiteboardCanvas.width, whiteboardCanvas.height);
};

document.querySelectorAll(".wb-color").forEach(el => {
    el.addEventListener("click", () => {
        document.querySelectorAll(".wb-color").forEach(e => e.classList.remove("active"));
        el.classList.add("active");
        drawColor = el.dataset.color;
    });
});

document.querySelectorAll(".wb-size").forEach(el => {
    el.addEventListener("click", () => {
        document.querySelectorAll(".wb-size").forEach(e => e.classList.remove("active"));
        el.classList.add("active");
        drawSize = parseInt(el.dataset.size);
    });
});

/* =========================
   INIT
========================= */

async function main() {
    await setupCamera();
    resize();

    const hands = new Hands({
        locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
    });

    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7
    });

    hands.onResults(onResults);

    const camera = new Camera(video, {
        onFrame: async () => {
            // 👉 TAMBAHKAN LOGIKA INI: 
            // Hanya jalankan deteksi AI jika videoMode sedang false (mati)
            if (!videoMode) {
                await hands.send({ image: video });
            }
        },
        width: 1280,
        height: 720
    });

    camera.start();

    setTimeout(() => jarvis.boot(), 1000);
    updateParticles();
}

main();
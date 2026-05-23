const particleCanvas =
    document.getElementById(
        "particles"
    );

const particleCtx =
    particleCanvas.getContext("2d");

const video =
    document.getElementById(
        "webcam"
    );

const canvas =
    document.getElementById(
        "output"
    );

const ctx =
    canvas.getContext("2d");

const statusText =
    document.getElementById(
        "status"
    );

const hologram =
    document.getElementById(
        "hologram"
    );

const hologramContent =
    hologram.querySelector(
        ".hologram-content"
    );

const recordBtn =
    document.getElementById(
        "recordBtn"
    );

const gestureList =
    document.getElementById(
        "gestureList"
    );

const mouseBtn =
    document.getElementById(
        "mouseBtn"
    );

const virtualCursor =
    document.getElementById(
        "virtualCursor"
    );

const confidenceFill =
    document.getElementById(
        "confidenceFill"
    );

const confidenceText =
    document.getElementById(
        "confidenceText"
    );

const gestureMatch =
    document.getElementById(
        "gestureMatch"
    );

const aiStatus =
    document.getElementById(
        "aiStatus"
    );

const handAura =
    document.getElementById(
        "handAura"
    );

/* =========================
   STATES
========================= */

let mouseMode = false;

let latestLandmarks = null;

let smoothX = 0;
let smoothY = 0;

/* =========================
   GESTURE ENGINE
========================= */

const gestures = [];

function registerGesture(
    name,
    detector,
    action
) {

    gestures.push({

        name,
        detector,
        action

    });
}

/* =========================
   CUSTOM GESTURES
========================= */

const savedGestures = [];

function normalizeLandmarks(
    landmarks
) {

    const wrist =
        landmarks[0];

    return landmarks.map(
        point => {

            return {

                x:
                    point.x - wrist.x,

                y:
                    point.y - wrist.y
            };
        }
    );
}

function compareGestures(
    current,
    saved
) {

    const normalizedCurrent =
        normalizeLandmarks(
            current
        );

    const normalizedSaved =
        normalizeLandmarks(
            saved
        );

    let totalDistance = 0;

    for (
        let i = 0;
        i < current.length;
        i++
    ) {

        const dx =
            normalizedCurrent[i].x -
            normalizedSaved[i].x;

        const dy =
            normalizedCurrent[i].y -
            normalizedSaved[i].y;

        totalDistance +=
            Math.sqrt(
                dx * dx +
                dy * dy
            );
    }

    const averageDistance =
        totalDistance /
        current.length;

    return averageDistance < 0.05;
}

function calculateConfidence(
    current,
    saved
) {

    const normalizedCurrent =
        normalizeLandmarks(
            current
        );

    const normalizedSaved =
        normalizeLandmarks(
            saved
        );

    let totalDistance = 0;

    for (
        let i = 0;
        i < current.length;
        i++
    ) {

        const dx =
            normalizedCurrent[i].x -
            normalizedSaved[i].x;

        const dy =
            normalizedCurrent[i].y -
            normalizedSaved[i].y;

        totalDistance +=
            Math.sqrt(
                dx * dx +
                dy * dy
            );
    }

    const averageDistance =
        totalDistance /
        current.length;

    const confidence =
        Math.max(
            0,
            100 -
            (
                averageDistance *
                1000
            )
        );

    return Math.floor(
        confidence
    );
}

/* =========================
   PARTICLES
========================= */

const particles = [];

function createParticle(
    x,
    y
) {

    if (
        particles.length > 120
    ) {

        particles.shift();
    }

    particles.push({

        x,
        y,

        size:
            Math.random() * 6 + 2,

        speedX:
            (
                Math.random() - 0.5
            ) * 4,

        speedY:
            (
                Math.random() - 0.5
            ) * 4,

        alpha: 1
    });
}

function updateParticles() {

    particleCtx.clearRect(
        0,
        0,
        particleCanvas.width,
        particleCanvas.height
    );

    for (
        let i =
            particles.length - 1;

        i >= 0;

        i--
    ) {

        const p =
            particles[i];

        p.x += p.speedX;
        p.y += p.speedY;

        p.alpha -= 0.02;

        particleCtx.beginPath();

        particleCtx.arc(
            p.x,
            p.y,
            p.size,
            0,
            Math.PI * 2
        );

        particleCtx.fillStyle =
            `rgba(
                0,
                255,
                255,
                ${p.alpha}
            )`;

        particleCtx.shadowBlur =
            20;

        particleCtx.shadowColor =
            "#00ffff";

        particleCtx.fill();

        if (p.alpha <= 0) {

            particles.splice(
                i,
                1
            );
        }
    }

    requestAnimationFrame(
        updateParticles
    );
}

/* =========================
   GESTURE UI
========================= */

function renderGestures() {

    gestureList.innerHTML =
        "";

    for (
        const gesture
        of savedGestures
    ) {

        const item =
            document.createElement(
                "div"
            );

        item.className =
            "gesture-item";

        item.innerHTML = `

            <span class="gesture-name">
                ${gesture.name}
            </span>

            <button
                class="delete-btn"
                onclick="removeGesture(${gesture.id})"
            >
                X
            </button>

        `;

        gestureList.appendChild(
            item
        );
    }
}

function deleteGesture(id) {

    const index =
        savedGestures.findIndex(
            g => g.id === id
        );

    if (index !== -1) {

        savedGestures.splice(
            index,
            1
        );

        renderGestures();
    }
}

window.removeGesture =
    function (id) {

        deleteGesture(id);
    };

/* =========================
   SAVE GESTURE
========================= */

recordBtn.addEventListener(
    "click",
    () => {

        if (
            !latestLandmarks
        ) return;

        const name =
            prompt(
                "Gesture name:"
            );

        if (!name) return;

        savedGestures.push({

            id: Date.now(),

            name,

            landmarks:
                latestLandmarks
        });

        renderGestures();

        hologramContent.innerText =
            "GESTURE SAVED";

        hologram.classList.remove(
            "hidden"
        );

        setTimeout(() => {

            hologram.classList.add(
                "hidden"
            );

        }, 2000);
    }
);

/* =========================
   CAMERA
========================= */

async function setupCamera() {

    const stream =
        await navigator
            .mediaDevices
            .getUserMedia({

                video: true,
                audio: false
            });

    video.srcObject =
        stream;

    return new Promise(
        (resolve) => {

            video.onloadedmetadata =
                () => {

                    resolve(video);
                };
        }
    );
}

function resizeCanvas() {

    canvas.width =
        video.videoWidth;

    canvas.height =
        video.videoHeight;

    particleCanvas.width =
        video.videoWidth;

    particleCanvas.height =
        video.videoHeight;
}

/* =========================
   RESULTS
========================= */

function onResults(results) {

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    if (
        results.multiHandLandmarks
    ) {

        statusText.innerText =
            "HAND DETECTED";

        for (
            const landmarks
            of results.multiHandLandmarks
        ) {

            latestLandmarks =
                landmarks;

            const indexFinger =
                landmarks[8];

            const palm =
                landmarks[9];

            const auraX =
                palm.x * canvas.width;

            const auraY =
                palm.y * canvas.height;

            handAura.style.left =
                `${auraX}px`;

            handAura.style.top =
                `${auraY}px`;

            /* =========================
               CURSOR
            ========================= */

            if (mouseMode) {

                const cameraSection =
                    document.querySelector(
                        ".camera-section"
                    );

                const rect =
                    cameraSection.getBoundingClientRect();

                const targetX =
                    (
                        1 -
                        indexFinger.x
                    ) * rect.width;

                const targetY =
                    indexFinger.y *
                    rect.height;

                smoothX +=
                    (
                        targetX -
                        smoothX
                    ) * 0.25;

                smoothY +=
                    (
                        targetY -
                        smoothY
                    ) * 0.25;

                virtualCursor.style.transform =
                    `translate(
                        ${smoothX}px,
                        ${smoothY}px
                    )`;
            }

            /* =========================
               PARTICLES
            ========================= */

            const x =
                indexFinger.x *
                particleCanvas.width;

            const y =
                indexFinger.y *
                particleCanvas.height;

            /* =========================
               DRAW HAND
            ========================= */

            drawConnectors(

                ctx,
                landmarks,
                HAND_CONNECTIONS,

                {
                    color:
                        "#00ffff",

                    lineWidth: 3
                }
            );

            drawLandmarks(

                ctx,
                landmarks,

                {
                    color:
                        "#ff00ff",

                    lineWidth: 2,

                    radius: 5
                }
            );

            /* =========================
               DETECTION
            ========================= */

            let detected =
                false;

            let customDetected =
                false;

            let bestMatch =
                null;

            let highestConfidence =
                0;

            for (
                const saved
                of savedGestures
            ) {

                const confidence =
                    calculateConfidence(

                        landmarks,
                        saved.landmarks
                    );

                if (
                    confidence >
                    highestConfidence
                ) {

                    highestConfidence =
                        confidence;

                    bestMatch =
                        saved;
                }

                if (
                    compareGestures(

                        landmarks,
                        saved.landmarks
                    )
                ) {

                    hologramContent.innerText =
                        `🔥 ${saved.name}`;

                    hologram.classList.remove(
                        "hidden"
                    );

                    statusText.innerText =
                        `${saved.name} DETECTED`;

                    customDetected =
                        true;

                    detected =
                        true;

                    particleCtx.clearRect(
                        0,
                        0,
                        particleCanvas.width,
                        particleCanvas.height
                    );

                    break;
                }
            }

            /* =========================
               AI SCANNER
            ========================= */

            if (bestMatch) {

                confidenceFill.style.width =
                    `${highestConfidence}%`;

                confidenceFill.style.boxShadow =
                    `0 0 ${highestConfidence / 3
                    }px #00ffff`;

                confidenceText.innerText =
                    `${highestConfidence}%`;

                gestureMatch.innerText =
                    `MATCHING: ${bestMatch.name}`;

                if (
                    highestConfidence > 80
                ) {

                    aiStatus.innerText =
                        "STATUS: HIGH CONFIDENCE";

                } else if (
                    highestConfidence > 50
                ) {

                    aiStatus.innerText =
                        "STATUS: ANALYZING";

                } else {

                    aiStatus.innerText =
                        "STATUS: LOW MATCH";
                }
            }

            /* =========================
               IDLE MODE
            ========================= */

            if (!customDetected) {

                createParticle(
                    x,
                    y
                );

                hologram.classList.add(
                    "hidden"
                );

                confidenceFill.style.width =
                    "0%";

                confidenceText.innerText =
                    "0%";

                gestureMatch.innerText =
                    "MATCHING: NONE";

                aiStatus.innerText =
                    "STATUS: IDLE";
            }
        }

    } else {

        statusText.innerText =
            "Scanning hands...";

        confidenceFill.style.width =
            "0%";

        confidenceText.innerText =
            "0%";

        gestureMatch.innerText =
            "MATCHING: NONE";

        aiStatus.innerText =
            "STATUS: IDLE";

        hologram.classList.add(
            "hidden"
        );
    }
}

/* =========================
   MOUSE MODE
========================= */

mouseBtn.addEventListener(
    "click",
    () => {

        mouseMode =
            !mouseMode;

        if (mouseMode) {

            mouseBtn.innerText =
                "MOUSE MODE ON";

            virtualCursor.style.display =
                "block";

        } else {

            mouseBtn.innerText =
                "MOUSE MODE OFF";

            virtualCursor.style.display =
                "none";
        }
    }
);

/* =========================
   MAIN
========================= */

async function main() {

    await setupCamera();

    resizeCanvas();

    const hands =
        new Hands({

            locateFile: (
                file
            ) => {

                return `
https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });

    hands.setOptions({

        maxNumHands: 1,

        modelComplexity: 1,

        minDetectionConfidence:
            0.7,

        minTrackingConfidence:
            0.7
    });

    hands.onResults(
        onResults
    );

    const camera =
        new Camera(

            video,

            {

                onFrame:
                    async () => {

                        await hands.send({

                            image: video
                        });
                    },

                width: 1280,

                height: 720
            }
        );

    camera.start();
}

main();

updateParticles();
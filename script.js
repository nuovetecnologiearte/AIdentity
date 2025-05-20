const video = document.getElementById('webcamVideo');
const emotionText = document.getElementById('emotionText');
const MODEL_URL = './models'; // Path to your models directory
const imageContainer = document.getElementById('imageContainer'); // Add this element to your HTML
const emotionFolders = {
    happy: './src/happy',
    sad: './src/sad',
    angry: './src/angry',
    neutral: './src/neutral',
    surprised: './src/surprised',
    fearful: './src/fearful',
    disgusted: './src/disgusted'
};
const detectionInterval = 1000; // ms - How often to detect faces (adjust for performance)
let detectionIntervalId = null;
let currentEmotion = ''; // Store the currently displayed emotion
let lastDetectionTime = 0;

const socket = io('http://localhost:3001');
let ready = false;

const landingPage = document.getElementById('landingPage');
const mainContent = document.getElementById('mainContent');



// Write data in src/to_show.json
async function writeData(emotion) {
    socket.emit('emotion', emotion);
    console.log('Data send on server:', emotion);
}

// Pick a random image from the specified emotion folder
async function getRandomImage(emotion) {
    try {
        const defaultBackground = document.getElementById('defaultBackground');
        const response = await fetch(`${emotionFolders[emotion]}/manifest.json`);
        if (!response.ok) {
            throw new Error(`Failed to fetch manifest for ${emotion}`);
        }

        const mediaList = await response.json();
        if (!Array.isArray(mediaList) || mediaList.length === 0) {
            throw new Error(`No media files found for ${emotion}`);
        }

        const randomIndex = Math.floor(Math.random() * mediaList.length);
        const mediaFile = mediaList[randomIndex];
        
        if (!mediaFile) {
            throw new Error(`Invalid media file for ${emotion}`);
        }

        // Hide default background when showing media
        defaultBackground.style.display = 'none';

        const isVideo = mediaFile.toLowerCase().endsWith('.mp4');
        
        if (isVideo) {
            imageContainer.innerHTML = `
                <video autoplay loop muted playsinline style="width: 100%; height: 100vh; object-fit: cover; position: fixed; top: 0; left: 0; z-index: -1;">
                    <source src="${emotionFolders[emotion]}/${mediaFile}" type="video/mp4">
                </video>`;
        } 

        
    } catch (error) {
        console.error('Error loading media:', error);
        // Show default background if media fails to load
        defaultBackground.style.display = 'block';
        return null;
    }
}


// Load models required by face-api.js
async function loadModels() {
    console.log("Loading models...");
    try {
        // Check if faceapi is available
        if (typeof faceapi === 'undefined') {
            console.error('face-api.js script not loaded yet!');
            emotionText.textContent = 'ERROR: Library Missing';
            return false;
        }

        // Use Promise.all for parallel loading
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL), // Fast detector
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL), // Detect facial landmarks
            faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)  // Detect expressions
        ]);
        console.log("Models loaded successfully!");
        return true;
    } catch (error) {
        console.error("Error loading models:", error);
        return false;
    }
}

// Access the user's webcam
async function startWebcam() {
    console.log("Requesting webcam access...");
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {} // Request video access
            // audio: false // No audio needed
        });
        video.srcObject = stream;
        console.log("Webcam access granted.");
        return true; 
    } catch (error) {
        console.error("Error accessing webcam:", error);
        emotionText.textContent = 'WEBCAM ERROR';
        if (error.name === 'NotAllowedError') {
            emotionText.textContent = 'PERMISSION DENIED';
        } else if (error.name === 'NotFoundError') {
            emotionText.textContent = 'NO WEBCAM FOUND';
        }
        return false; 
    }
}

// Find the dominant emotion from detection results
function getDominantEmotion(expressions) {
    if (!expressions || Object.keys(expressions).length === 0) {
        return null; // No expressions detected
    }

    // Use reduce to find the emotion with the highest probability
    return Object.keys(expressions).reduce((a, b) =>
        expressions[a] > expressions[b] ? a : b
    );
}


// Detect faces and expressions in real-time
async function detectFaces() {
    const now = Date.now();
    if (now - lastDetectionTime < detectionInterval) {
        return;
    }
    lastDetectionTime = now;

    if (video.paused || video.ended || !faceapi.nets.tinyFaceDetector.params) {
        console.log("Detection stopped: Video not ready or models not loaded.");
        return;
    }

    const detections = await faceapi.detectSingleFace(
        video,
        new faceapi.TinyFaceDetectorOptions()
    )
        .withFaceLandmarks()
        .withFaceExpressions();

    if (detections && detections.expressions) {
        const isSmiling = detections.expressions.happy > 0.7; // Threshold

        if (isSmiling && !ready) {
            // Aggiungiamo una transizione fluida
            landingPage.classList.add('fade-out');
            
            // Attendiamo che la transizione sia completata prima di nascondere la landing page
            setTimeout(() => {
                landingPage.style.display = 'none';
                mainContent.style.display = 'block';
                // Aggiungiamo una classe per l'effetto di fade-in
                mainContent.classList.add('fade-in');
                video.style.opacity = '1';
                
                // Avviamo l'applicazione
                setTimeout(async () => {
                    ready = true;
                    await writeData(currentEmotion); // Inizia a scrivere i dati
                }, 500);
            }, 1000);
        }

        const dominantEmotion = getDominantEmotion(detections.expressions);

        if (dominantEmotion && dominantEmotion !== currentEmotion) {
            let displayEmotion = dominantEmotion.toUpperCase();
            emotionText.textContent = displayEmotion;
            currentEmotion = dominantEmotion;

            // Display random image for the emotion
            const imagePath = await getRandomImage(dominantEmotion);
            if (imagePath) {
                imageContainer.innerHTML = `<img src="${imagePath}" alt="${dominantEmotion}" style="width: 100%; height: 100vh; object-fit: cover; position: fixed; top: 0; left: 0; z-index: -1;">`;
            }
        } else if (!dominantEmotion && currentEmotion !== 'NO FACE') {
            emotionText.textContent = 'Nessuna faccia rilevata';
            currentEmotion = 'NO FACE';
        }
    } else {
        if (currentEmotion !== 'NO FACE') {
            emotionText.textContent = 'Nessuna faccia rilevata';
            currentEmotion = 'NO FACE';
        }
    }
    if (ready) await writeData(currentEmotion); // Write the emotion to JSON
}

// Main initialization function
async function initializeApp() {

    const modelsLoaded = await loadModels();
    if (!modelsLoaded) {
        console.error("Initialization failed: Models could not be loaded.");
        return; // Stop initialization if models failed
    }

    const webcamStarted = await startWebcam();
    if (!webcamStarted) {
        console.error("Initialization failed: Webcam could not be started.");
        return; // Stop initialization if webcam failed
    }

    // Add event listener to start detection *after* the video is ready and playing
    video.addEventListener('play', () => {
        console.log("Video playing, starting detection loop.");
    
        // Clear any previous interval
        if (detectionIntervalId) {
            clearInterval(detectionIntervalId);
        }

        // Start the detection loop
        detectionIntervalId = setInterval(detectFaces, detectionInterval);
    });

    // Handle potential video errors
    video.addEventListener('error', (e) => {
        console.error("Video error:", e);
        emotionText.textContent = 'VIDEO ERROR';
        if (detectionIntervalId) clearInterval(detectionIntervalId);
    });
}

// --- Start the Application ---

// Inizializza l'applicazione quando il documento è caricato
document.addEventListener('DOMContentLoaded', () => {
    // Mostra subito la landing page con una transizione
    landingPage.style.opacity = '0';
    setTimeout(() => {
        landingPage.style.opacity = '1';
        landingPage.classList.add('fade-in');
    }, 100);
    
    // Inizializza face-api e webcam in modo asincrono
    setTimeout(async () => {
        // Carica i modelli
        const modelsLoaded = await loadModels();
        if (!modelsLoaded) {
            console.error("Initialization failed: Models could not be loaded.");
            emotionText.textContent = 'ERRORE CARICAMENTO MODELLI';
            return;
        }
        
        // Avvia la webcam
        const webcamStarted = await startWebcam();
        if (!webcamStarted) {
            console.error("Initialization failed: Webcam could not be started.");
            return;
        }
        
        // Inizia a rilevare i volti per individuare il sorriso
        video.addEventListener('play', () => {
            console.log("Video playing, starting detection loop for smile detection.");
            
            // Avvia il loop di rilevamento
            if (detectionIntervalId) {
                clearInterval(detectionIntervalId);
            }
            detectionIntervalId = setInterval(detectFaces, detectionInterval);
        });
    }, 1500);
});

// Modifica il posizionamento del video nella landing page
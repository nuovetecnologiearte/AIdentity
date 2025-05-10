const localIP = 'http://192.168.10.217:3001';
// Do not touch the top line!
 
const video = document.getElementById('webcamVideo');
const emotionText = document.getElementById('emotionText');
const MODEL_URL = './models'; // Path to your models directory
const imageContainer = document.getElementById('imageContainer');
const defaultBackground = document.getElementById('defaultBackground');
const emotionFolders = {
    happy: './src/happy',
    sad: './src/sad',
    angry: './src/angry',
    neutral: './src/neutral',
    surprised: './src/surprised',
    fearful: './src/fearful',
    disgusted: './src/disgusted'
};

const socket = io(localIP);

let faceToShow = 'none';
let currentEmotion = ''; // Store the currently displayed emotion
let detectionIntervalId = null;

const landingPage = document.getElementById('landingPage');
const mainContent = document.getElementById('mainContent');

// Inizializza l'applicazione quando il documento è caricato
document.addEventListener('DOMContentLoaded', () => {
    // Mostra subito la landing page
    landingPage.style.opacity = '1';
    
    
    // Inizializza face-api e webcam in modo asincrono
    setTimeout(() => {
        initializeApp().then(() => {
            console.log('App initialized successfully');
        }).catch(error => {
            console.error('Failed to initialize app:', error);
        });
    }, 1500); // Ritarda l'inizializzazione di 1.5s per permettere alle animazioni di partire
});

// Main initialization function
async function initializeApp() {
    // Inizializza subito la visualizzazione principale
    landingPage.style.display = 'none';
    mainContent.style.display = 'block';
    
    // Carica i dati e i modelli
    loadData();
    
    const modelsLoaded = await loadModels();
    if (!modelsLoaded) {
        console.error("Initialization failed: Models could not be loaded.");
        return; // Stop initialization if models failed
    }

    // Avvia il rilevamento delle emozioni
    startEmotionDetection();
    
    // Gestisci eventuali errori video
    video.addEventListener('error', (e) => {
        console.error("Video error:", e);
        emotionText.textContent = 'ERRORE VIDEO';
        if (detectionIntervalId) clearInterval(detectionIntervalId);
    });
}

// Load data from socket
function loadData() {
    socket.on('update', (data) => {
        faceToShow = data;
        console.log("Face to show:", faceToShow);
        // Verifica se l'emozione è cambiata e aggiorna l'interfaccia
        updateEmotionDisplay();
    });
}

// Avvia il rilevamento delle emozioni
function startEmotionDetection() {
    // Pulisci eventuali intervalli precedenti
    if (detectionIntervalId) {
        clearInterval(detectionIntervalId);
    }
    
    // Imposta un nuovo intervallo per il rilevamento
    detectionIntervalId = setInterval(updateEmotionDisplay, 1000);
}

// Aggiorna il display dell'emozione solo se è cambiata
function updateEmotionDisplay() {
    // Verifica se l'emozione è cambiata
    if (faceToShow !== 'none' && faceToShow !== currentEmotion) {
        console.log(`Emozione cambiata da ${currentEmotion} a ${faceToShow}`);
        
        // Aggiorna l'emozione corrente
        currentEmotion = faceToShow;
        
        // Aggiorna il testo dell'emozione
        let displayEmotion = currentEmotion.toUpperCase();
        emotionText.textContent = displayEmotion;
        
        // Carica e visualizza un'immagine casuale per l'emozione
        getRandomImage(currentEmotion);
    }
}

// Load models required by face-api.js
async function loadModels() {
    console.log("Loading models...");
    try {
        // Check if faceapi is available
        if (typeof faceapi === 'undefined') {
            console.error('face-api.js script not loaded yet!');
            emotionText.textContent = 'ERRORE: LIBRERIA MANCANTE';
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

// Pick a random image from the specified emotion folder
async function getRandomImage(emotion) {
    try {
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

        // Only allow videos for happy and surprised emotions
        const isVideo = mediaFile.toLowerCase().endsWith('.mp4') && 
                       (emotion === 'happy' || emotion === 'surprised');
        
        if (isVideo) {
            imageContainer.innerHTML = `
                <video autoplay loop muted playsinline style="width: 100%; height: 100vh; object-fit: cover; position: fixed; top: 0; left: 0; z-index: -1;">
                    <source src="${emotionFolders[emotion]}/${mediaFile}" type="video/mp4">
                </video>`;
        } else {
            imageContainer.innerHTML = `
                <img src="${emotionFolders[emotion]}/${mediaFile}" alt="${emotion}" 
                     style="width: 100%; height: 100vh; object-fit: cover; position: fixed; top: 0; left: 0; z-index: -1;">`;
        }
    } catch (error) {
        console.error('Error loading media:', error);
        // Show default background if media fails to load
        defaultBackground.style.display = 'block';
    }
}

require('dotenv').config();
const { Client, MessageMedia, LocalAuth, MessageTypes } = require('whatsapp-web.js');
const { OpenAI } = require('openai');
const qrcode = require('qrcode-terminal');
const { AssemblyAI } = require('assemblyai');
const ElevenLabs = require('elevenlabs-node');

// Initialize ElevenLabs Client
const voice = new ElevenLabs({
    apiKey: process.env.ELEVENLABS_API_KEY,       // API key from Elevenlabs
});

// Initialize WhatsApp Client
const client = new Client({
    authStrategy: new LocalAuth()
});

// Initialize OpenAI Client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const assemblyAI = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY });

// QR code generation for authentication
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

// Confirmation the bot is ready
client.on('ready', () => {
    console.log('Bot is ready!');
});

// Message handling
client.on('message', async msg => {
    console.log(`Message From: ${msg.from}\nHas Media: ${msg.hasMedia}\nMessage Type: ${msg.type}`);

    if (msg.hasMedia && (msg.type === MessageTypes.AUDIO || msg.type === MessageTypes.VOICE)) {
        try {
            const media = await msg.downloadMedia();
            // get audio transcription
            const transcription = await transcribeAudio(media.data);
            if (transcription) {
                // get chatgpt response
                const chatGPTResponse = await getChatGPTResponse(transcription);
                // convert the response from text to speech
                const audioPath = await convertTextToSpeech(chatGPTResponse);
                if (audioPath) {
                    // send audio back
                    const audioMedia = await MessageMedia.fromFilePath(audioPath);
                    client.sendMessage(msg.from, audioMedia);
                } else {
                    client.sendMessage(msg.from, 'Sorry, I could not process the reply');
                }
            }
        } catch (error) {
            // handle error
            console.error('Error processing message:', error);
            client.sendMessage(msg.from, 'Sorry, an error occurred.');
        }
    }
});

client.initialize();

// Function to transcribe audio using AssemblyAI
async function transcribeAudio(audioData) {
    try {
        const audioBuffer = Buffer.from(audioData, 'base64');
        const transcript = await assemblyAI.transcripts.transcribe({ audio: audioBuffer });
        return transcript.text;
    } catch (error) {
        console.error('Error in transcription:', error);
        return null;
    }
}

// Function to get response from ChatGPT
async function getChatGPTResponse(text) {
    try {
        const response = await openai.completions.create({
            model: "gpt-3.5-turbo-instruct-0914",
            prompt: text,
            max_tokens: 256,
        });
        return response.choices[0].text.trim();
    } catch (error) {
        console.error('Error with ChatGPT:', error);
        return 'I am having trouble processing this right now.';
    }
}

// Function to convert text to speech using ElevenLabs
async function convertTextToSpeech(text) {
    try {
        const fileName = `${Date.now()}.mp3`;
        const response = await voice.textToSpeech({
            fileName: fileName,
            textInput: text,
        });

        if (response.status === 'ok') {
            return fileName;
        }
        return null;
    } catch (error) {
        console.error('Error with text-to-speech conversion:', error);
        return null;
    }
}

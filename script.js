document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const chatContainer = document.getElementById('chat-container');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const generateImageBtn = document.getElementById('generate-image-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsBtn = document.getElementById('close-settings');
    const saveSettingsBtn = document.getElementById('save-settings');
    const welcomeScreen = document.getElementById('welcome-screen');
    const typingIndicator = document.getElementById('typing-indicator');

    // Inputs
    const openrouterKeyInput = document.getElementById('openrouter-key');
    const hfKeyInput = document.getElementById('hf-key');
    const textModelInput = document.getElementById('text-model');

    // URLs and State
    const openRouterUrl = "https://openrouter.ai/api/v1/chat/completions";
    const hfBaseUrl = "https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-base-1.0";
    let conversationHistory = [];

    // Initialize Settings
    function loadSettings() {
        const orKey = localStorage.getItem('openrouter_key') || '';
        const hfKey = localStorage.getItem('hf_key') || '';
        const tModel = localStorage.getItem('text_model') || 'meta-llama/llama-3-8b-instruct';
        
        openrouterKeyInput.value = orKey;
        hfKeyInput.value = hfKey;
        textModelInput.value = tModel;
        
        if (!orKey && !hfKey) {
            settingsModal.classList.remove('hidden');
        }
    }
    
    loadSettings();

    // Event Listeners for Settings Modal
    settingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
    closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
    saveSettingsBtn.addEventListener('click', () => {
        localStorage.setItem('openrouter_key', openrouterKeyInput.value.trim());
        localStorage.setItem('hf_key', hfKeyInput.value.trim());
        localStorage.setItem('text_model', textModelInput.value.trim() || 'meta-llama/llama-3-8b-instruct');
        settingsModal.classList.add('hidden');
        messageInput.focus();
    });

    // Auto-resize logic for input
    messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        if (this.value.trim() === '') this.style.height = 'auto';
    });

    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend(false);
        }
    });

    sendBtn.addEventListener('click', () => handleSend(false));
    generateImageBtn.addEventListener('click', () => handleSend(true));

    // UI Utility Functions: addMessage and addImageMessage
    function addMessage(role, content, isError = false) {
        if (welcomeScreen) welcomeScreen.style.display = 'none';

        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${role}`;
        
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'avatar';
        avatarDiv.innerHTML = role === 'user' ? '<i class="fa-solid fa-user"></i>' : '<i class="fa-solid fa-robot"></i>';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = `message-content ${isError ? 'error' : ''}`;
        contentDiv.textContent = content;
        
        msgDiv.appendChild(avatarDiv);
        msgDiv.appendChild(contentDiv);
        chatContainer.appendChild(msgDiv);
        scrollToBottom();
    }

    function addImageMessage(role, imageUrl) {
        if (welcomeScreen) welcomeScreen.style.display = 'none';

        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${role}`;
        
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'avatar';
        avatarDiv.innerHTML = role === 'user' ? '<i class="fa-solid fa-user"></i>' : '<i class="fa-solid fa-robot"></i>';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        const img = document.createElement('img');
        img.src = imageUrl;
        img.className = 'image-content';
        img.alt = 'Generated via AI';
        
        contentDiv.appendChild(img);
        msgDiv.appendChild(avatarDiv);
        msgDiv.appendChild(contentDiv);
        
        chatContainer.appendChild(msgDiv);
        scrollToBottom();
    }

    function scrollToBottom() {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function updateTypingIndicator(show, text = "") {
        if (show) {
            typingIndicator.classList.remove('hidden');
            if (text) {
                // If it's an image generation text, temporarily override styling
                typingIndicator.innerHTML = `<span></span><span></span><span></span> <span style="margin-left:8px;font-style:italic;">${text}</span>`;
            } else {
                typingIndicator.innerHTML = `<span></span><span></span><span></span>`;
            }
        } else {
            typingIndicator.classList.add('hidden');
        }
    }

    function setButtonsState(disabled) {
        sendBtn.disabled = disabled;
        generateImageBtn.disabled = disabled;
        messageInput.disabled = disabled;
    }

    // Core Logical Implementations
    async function queryText(prompt) {
        const orKey = localStorage.getItem('openrouter_key');
        if (!orKey) {
            alert('Please configure your OpenRouter API key in settings first.');
            settingsModal.classList.remove('hidden');
            return;
        }

        const model = localStorage.getItem('text_model') || 'meta-llama/llama-3-8b-instruct';
        
        // Prepare context
        conversationHistory.push({ role: 'user', content: prompt });
        updateTypingIndicator(true);
        setButtonsState(true);

        try {
            const response = await fetch(openRouterUrl, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${orKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: model,
                    messages: conversationHistory
                })
            });

            const result = await response.json();
            
            if (response.ok) {
                const reply = result.choices[0].message.content;
                conversationHistory.push({ role: 'assistant', content: reply });
                addMessage('bot', reply);
            } else {
                addMessage('bot', `API Error: ${result.error?.message || 'Unknown error'}`, true);
            }
        } catch (error) {
            addMessage('bot', `Network Error: ${error.message}`, true);
        } finally {
            updateTypingIndicator(false);
            setButtonsState(false);
            messageInput.focus();
        }
    }

    async function generateImage(prompt) {
        const hfKey = localStorage.getItem('hf_key');
        if (!hfKey) {
            alert('Please configure your Hugging Face API Token in settings first.');
            settingsModal.classList.remove('hidden');
            return;
        }

        updateTypingIndicator(true, "Generating image...");
        setButtonsState(true);

        try {
            const response = await fetch(hfBaseUrl, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${hfKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ inputs: prompt })
            });

            if (!response.ok) {
                const errorResult = await response.json();
                throw new Error(errorResult.error || `HTTP error! status: ${response.status}`);
            }

            const imageBlob = await response.blob();
            const imageUrl = URL.createObjectURL(imageBlob);
            
            addImageMessage('bot', imageUrl);
            
            conversationHistory.push({ role: 'user', content: `Please generate an image: ${prompt}` });
            conversationHistory.push({ role: 'assistant', content: `[Image Generated for: ${prompt}]` });

        } catch (error) {
            addMessage('bot', `Failed to generate image: ${error.message}`, true);
        } finally {
            updateTypingIndicator(false);
            setButtonsState(false);
            messageInput.focus();
        }
    }

    async function handleSend(isExplicitImageRequest) {
        const prompt = messageInput.value.trim();
        if (!prompt) return;

        // Clear input field after sending
        messageInput.value = '';
        messageInput.style.height = 'auto';

        addMessage('user', prompt);

        // Detect keywords more flexibly
        const lowerPrompt = prompt.toLowerCase();
        const matchesKeyword = lowerPrompt.includes('draw') || 
                               (lowerPrompt.includes('generate') && lowerPrompt.includes('image')) ||
                               (lowerPrompt.includes('create') && lowerPrompt.includes('image'));

        // Route to appropriate function
        if (isExplicitImageRequest || matchesKeyword) {
            await generateImage(prompt);
        } else {
            await queryText(prompt);
        }
    }
});

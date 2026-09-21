/**
 * bramhastra26 — Interactive Chatbot Client
 * Handles chat messaging, speech recognition, speech synthesis, 
 * multilingual translations, 20-query limits, ₹5/question premium checkout,
 * and dynamic image generation lightbox.
 */

document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    const chatWindow = document.getElementById("chat-window");
    const messagesList = document.getElementById("messages-list");
    const welcomeCard = document.getElementById("welcome-card");
    const userInput = document.getElementById("user-input");
    const sendBtn = document.getElementById("btn-send");
    const voiceBtn = document.getElementById("btn-voice-input");
    const imageModeBtn = document.getElementById("btn-image-mode");
    const inputHelperBar = document.getElementById("input-helper-bar");
    const cancelImageMode = document.getElementById("cancel-image-mode");
    const languageSelect = document.getElementById("language-select");

    // Sidebar & Navigation
    const sidebar = document.getElementById("sidebar");
    const menuBtn = document.getElementById("menu-btn");
    const closeSidebarBtn = document.getElementById("close-sidebar-btn");
    const navNewChat = document.getElementById("nav-new-chat");
    const navImageStudio = document.getElementById("nav-image-studio");
    const navTranslator = document.getElementById("nav-translator");
    const navSettings = document.getElementById("nav-settings");
    const themeToggle = document.getElementById("theme-toggle");
    const themeText = document.getElementById("theme-text");
    const clearChatBtn = document.getElementById("clear-chat-btn");

    // Status & Counters
    const queryProgressBar = document.getElementById("query-progress-bar");
    const queryCountDisplay = document.getElementById("query-count-display");
    const remainingText = document.getElementById("remaining-text");
    const headerQueryCount = document.getElementById("header-query-count");
    const tierBadge = document.getElementById("tier-badge");
    const tierRate = document.getElementById("tier-rate");
    const upgradeBtn = document.getElementById("upgrade-btn");

    // Modals
    const upgradeModal = document.getElementById("upgrade-modal");
    const closeUpgradeModal = document.getElementById("close-upgrade-modal");
    const cancelUpgradeModal = document.getElementById("cancel-upgrade-modal");
    const confirmRechargeBtn = document.getElementById("confirm-recharge-btn");

    const settingsModal = document.getElementById("settings-modal");
    const closeSettingsModal = document.getElementById("close-settings-modal");
    const closeSettingsBtn = document.getElementById("close-settings-btn");
    const saveApiKeyBtn = document.getElementById("save-api-key-btn");
    const groqApiKeyInput = document.getElementById("groq-api-key-input");
    const toggleKeyVisibility = document.getElementById("toggle-key-visibility");
    const apiKeyStatusBox = document.getElementById("api-key-status-box");
    const apiKeyStatusText = document.getElementById("api-key-status-text");

    const translatorModal = document.getElementById("translator-modal");
    const closeTranslatorModal = document.getElementById("close-translator-modal");
    const closeTranslatorBtn = document.getElementById("close-translator-btn");
    const executeTranslateBtn = document.getElementById("execute-translate-btn");
    const translateInput = document.getElementById("translate-input");
    const modalTargetLang = document.getElementById("modal-target-lang");
    const translatedResultWrap = document.getElementById("translated-result-wrap");
    const translationResult = document.getElementById("translation-result");

    const lightboxModal = document.getElementById("lightbox-modal");
    const closeLightbox = document.getElementById("close-lightbox");
    const lightboxImg = document.getElementById("lightbox-img");
    const lightboxCaption = document.getElementById("lightbox-caption");
    const lightboxDownload = document.getElementById("lightbox-download");

    // App State
    let isImageMode = false;
    let isProcessing = false;
    let currentQueryCount = 0;
    let freeLimit = 20;
    let isPremium = false;
    let premiumCredits = 0;
    let recognition = null;
    let isRecording = false;

    // Configure Marked
    if (window.marked) {
        marked.setOptions({
            highlight: function(code, lang) {
                if (window.hljs) {
                    if (lang && hljs.getLanguage(lang)) {
                        return hljs.highlight(code, { language: lang }).value;
                    }
                    return hljs.highlightAuto(code).value;
                }
                return code;
            },
            breaks: true,
            gfm: true
        });
    }

    // Initialize Status
    fetchStatus();

    // Auto-grow Textarea
    userInput.addEventListener("input", () => {
        userInput.style.height = "auto";
        userInput.style.height = Math.min(userInput.scrollHeight, 160) + "px";
    });

    // Enter to Send (Shift+Enter for new line)
    userInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    sendBtn.addEventListener("click", sendMessage);

    // Starter Prompt Chips
    document.querySelectorAll(".starter-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            const prompt = chip.getAttribute("data-prompt");
            if (prompt) {
                userInput.value = prompt;
                sendMessage();
            }
        });
    });

    // Mobile Sidebar Toggle
    if (menuBtn) {
        menuBtn.addEventListener("click", () => sidebar.classList.add("open"));
    }
    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener("click", () => sidebar.classList.remove("open"));
    }

    // Image Mode Toggle
    imageModeBtn.addEventListener("click", () => {
        isImageMode = !isImageMode;
        updateImageModeUI();
    });

    if (cancelImageMode) {
        cancelImageMode.addEventListener("click", () => {
            isImageMode = false;
            updateImageModeUI();
        });
    }

    function updateImageModeUI() {
        if (isImageMode) {
            imageModeBtn.classList.add("active");
            inputHelperBar.style.display = "flex";
            userInput.placeholder = "Describe the image you want bramhastra26 to generate...";
        } else {
            imageModeBtn.classList.remove("active");
            inputHelperBar.style.display = "none";
            userInput.placeholder = "Ask bramhastra26 anything (factual, empathetic, images, any language)...";
        }
        userInput.focus();
    }

    // Voice Input Setup
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => {
            isRecording = true;
            voiceBtn.classList.add("recording");
            showToast("Listening... Speak into your microphone");
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            userInput.value = (userInput.value ? userInput.value + " " : "") + transcript;
            userInput.dispatchEvent(new Event("input"));
        };

        recognition.onerror = (e) => {
            console.warn("Speech recognition error:", e);
            voiceBtn.classList.remove("recording");
            isRecording = false;
        };

        recognition.onend = () => {
            voiceBtn.classList.remove("recording");
            isRecording = false;
        };

        voiceBtn.addEventListener("click", () => {
            if (isRecording) {
                recognition.stop();
            } else {
                // Set language matching dropdown if possible
                const lang = languageSelect.value;
                if (lang === "Hindi") recognition.lang = "hi-IN";
                else if (lang === "Telugu") recognition.lang = "te-IN";
                else if (lang === "Tamil") recognition.lang = "ta-IN";
                else if (lang === "Spanish") recognition.lang = "es-ES";
                else if (lang === "French") recognition.lang = "fr-FR";
                else if (lang === "German") recognition.lang = "de-DE";
                else recognition.lang = "en-US";

                recognition.start();
            }
        });
    } else {
        voiceBtn.style.display = "none";
    }

    // Theme Toggle (Default is White Theme)
    themeToggle.addEventListener("click", () => {
        if (document.body.classList.contains("theme-light")) {
            document.body.classList.remove("theme-light");
            document.body.classList.add("theme-dark");
            themeToggle.querySelector("i").className = "fa-solid fa-moon";
            themeText.textContent = "Dark Cosmic";
        } else {
            document.body.classList.remove("theme-dark");
            document.body.classList.add("theme-light");
            themeToggle.querySelector("i").className = "fa-solid fa-sun";
            themeText.textContent = "White Theme";
        }
    });

    // Navigation Buttons
    navNewChat.addEventListener("click", resetChat);
    clearChatBtn.addEventListener("click", resetChat);

    navImageStudio.addEventListener("click", () => {
        isImageMode = true;
        updateImageModeUI();
        if (window.innerWidth <= 820) sidebar.classList.remove("open");
    });

    navTranslator.addEventListener("click", () => {
        translatorModal.style.display = "flex";
        if (window.innerWidth <= 820) sidebar.classList.remove("open");
    });

    navSettings.addEventListener("click", () => {
        settingsModal.style.display = "flex";
        fetchStatus();
        if (window.innerWidth <= 820) sidebar.classList.remove("open");
    });

    // Upgrade Modal Triggers
    upgradeBtn.addEventListener("click", () => openUpgradeModal());

    function openUpgradeModal(reason) {
        const remainingFree = Math.max(0, freeLimit - currentQueryCount);
        const freeBanner = document.getElementById("modal-free-active-banner");
        const expiredBanner = document.getElementById("modal-expired-banner");
        const premiumBanner = document.getElementById("modal-premium-banner");
        const lockOverlay = document.getElementById("scanner-lock-overlay");
        const freeCountSpan = document.getElementById("modal-free-count");
        const freeDesc = document.getElementById("modal-free-desc");
        const lockOverlayText = document.getElementById("lock-overlay-text");

        if (remainingFree > 0 && !isPremium) {
            // Free queries are still active! Strict user constraint: Payment is LOCKED!
            if (freeBanner) freeBanner.style.display = "flex";
            if (expiredBanner) expiredBanner.style.display = "none";
            if (premiumBanner) premiumBanner.style.display = "none";
            if (lockOverlay) {
                lockOverlay.classList.remove("hidden");
                lockOverlay.style.display = "flex";
            }
            if (freeCountSpan) freeCountSpan.textContent = remainingFree;
            if (freeDesc) {
                freeDesc.textContent = `You currently have ${remainingFree} free queries remaining! Payment is only accepted after all 20 free queries have expired. Please enjoy your free questions first.`;
            }
            if (lockOverlayText) {
                lockOverlayText.textContent = `${remainingFree} Free Queries Left`;
            }
            confirmRechargeBtn.disabled = true;
            confirmRechargeBtn.classList.add("disabled");
            confirmRechargeBtn.style.opacity = "0.6";
            confirmRechargeBtn.style.cursor = "not-allowed";
            confirmRechargeBtn.innerHTML = `<i class="fa-solid fa-lock"></i> Payment Locked (${remainingFree} Free Queries Left)`;
        } else if (remainingFree === 0 && !isPremium) {
            // 20 Free queries have expired! Present Koushik MR's scanner & unlock payment
            if (freeBanner) freeBanner.style.display = "none";
            if (expiredBanner) expiredBanner.style.display = "flex";
            if (premiumBanner) premiumBanner.style.display = "none";
            if (lockOverlay) {
                lockOverlay.classList.add("hidden");
                lockOverlay.style.display = "none";
            }
            confirmRechargeBtn.disabled = false;
            confirmRechargeBtn.classList.remove("disabled");
            confirmRechargeBtn.style.opacity = "1";
            confirmRechargeBtn.style.cursor = "pointer";
            confirmRechargeBtn.innerHTML = `<i class="fa-solid fa-bolt"></i> I Have Paid — Unlock Extra Questions`;
        } else {
            // Premium active / Extra queries remaining
            if (freeBanner) freeBanner.style.display = "none";
            if (expiredBanner) expiredBanner.style.display = "none";
            if (premiumBanner) premiumBanner.style.display = "flex";
            const credSpan = document.getElementById("modal-premium-credits");
            if (credSpan) credSpan.textContent = premiumCredits;
            if (lockOverlay) {
                lockOverlay.classList.add("hidden");
                lockOverlay.style.display = "none";
            }
            confirmRechargeBtn.disabled = false;
            confirmRechargeBtn.classList.remove("disabled");
            confirmRechargeBtn.style.opacity = "1";
            confirmRechargeBtn.style.cursor = "pointer";
            confirmRechargeBtn.innerHTML = `<i class="fa-solid fa-bolt"></i> I Have Paid — Add More Questions`;
        }

        upgradeModal.style.display = "flex";
    }

    closeUpgradeModal.addEventListener("click", () => upgradeModal.style.display = "none");
    cancelUpgradeModal.addEventListener("click", () => upgradeModal.style.display = "none");

    // Scanner Buttons (Sidebar & Header)
    const navScannerBtn = document.getElementById("nav-scanner-btn");
    const headerQrBtn = document.getElementById("header-qr-btn");
    const displayAmountDue = document.getElementById("display-amount-due");
    const displayPackDesc = document.getElementById("display-pack-desc");
    const upiUtrInput = document.getElementById("upi-utr-input");

    if (navScannerBtn) {
        navScannerBtn.addEventListener("click", () => {
            openUpgradeModal();
            if (window.innerWidth <= 820) sidebar.classList.remove("open");
        });
    }

    if (headerQrBtn) {
        headerQrBtn.addEventListener("click", () => openUpgradeModal());
    }

    // Pack Selector with Dynamic Calculation
    document.querySelectorAll(".pack-card").forEach(card => {
        card.addEventListener("click", () => {
            document.querySelectorAll(".pack-card").forEach(c => c.classList.remove("selected"));
            card.classList.add("selected");
            const radio = card.querySelector("input[type='radio']");
            if (radio) radio.checked = true;

            const price = card.getAttribute("data-price") || "50";
            const qty = card.getAttribute("data-qty") || "10";
            if (displayAmountDue) {
                displayAmountDue.textContent = price === "0" ? "Free" : `₹${price}`;
            }
            if (displayPackDesc) {
                if (price === "0") {
                    displayPackDesc.textContent = "Evaluation sandbox mode with instant testing";
                } else {
                    displayPackDesc.textContent = `For ${qty} Question${qty === "1" ? "" : "s"} at ₹5 per question`;
                }
            }
        });
    });

    // Confirm Recharge with Scanner & UTR
    confirmRechargeBtn.addEventListener("click", async () => {
        const remainingFree = Math.max(0, freeLimit - currentQueryCount);
        if (remainingFree > 0 && !isPremium) {
            showToast(`Payment is locked! You still have ${remainingFree} free queries left. Please use them first.`);
            return;
        }

        const selectedPack = document.querySelector("input[name='recharge-pack']:checked")?.value || "pack_10";
        const utrNumber = upiUtrInput ? upiUtrInput.value.trim() : "";

        confirmRechargeBtn.disabled = true;
        confirmRechargeBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Verifying Payment...`;

        try {
            const res = await fetch("/api/upgrade", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    pack: selectedPack,
                    utr: utrNumber
                })
            });
            const data = await res.json();

            if (!res.ok && data.error === "FREE_QUERIES_ACTIVE") {
                showToast(data.message);
                fetchStatus();
                return;
            }

            if (data.success) {
                upgradeModal.style.display = "none";
                showToast(`Payment Verified! Added ${data.added_credits} questions.`);
                if (upiUtrInput) upiUtrInput.value = "";
                await fetchStatus();
                appendBotMessage({
                    response: `🎉 **Payment Verified via Koushik MR Scanner!**\n\n• **Amount:** ₹${data.amount_paid}\n• **Unlocked Questions:** ${data.added_credits} questions (at ₹5/question)\n• **Total Credits Active:** ${data.premium_credits}\n\nYour Bramhastra26 account is fully active. What question would you like to explore next?`,
                    emotion: "Inspiring"
                });
            } else {
                showToast(data.message || data.error || "Payment verification failed");
            }
        } catch (err) {
            showToast("Failed to process payment: " + err.message);
        } finally {
            confirmRechargeBtn.disabled = false;
            confirmRechargeBtn.innerHTML = `<i class="fa-solid fa-bolt"></i> I Have Paid — Unlock Questions`;
        }
    });

    // Settings Modal
    closeSettingsModal.addEventListener("click", () => settingsModal.style.display = "none");
    closeSettingsBtn.addEventListener("click", () => settingsModal.style.display = "none");

    toggleKeyVisibility.addEventListener("click", () => {
        const type = groqApiKeyInput.getAttribute("type") === "password" ? "text" : "password";
        groqApiKeyInput.setAttribute("type", type);
        toggleKeyVisibility.querySelector("i").className = type === "password" ? "fa-solid fa-eye" : "fa-solid fa-eye-slash";
    });

    saveApiKeyBtn.addEventListener("click", async () => {
        const key = groqApiKeyInput.value.trim();
        if (!key) {
            showToast("Please enter an API key");
            return;
        }
        saveApiKeyBtn.disabled = true;
        saveApiKeyBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Verifying...`;

        try {
            const res = await fetch("/api/set-api-key", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ api_key: key })
            });
            const data = await res.json();
            if (res.ok) {
                showToast("Key verified and saved!");
                settingsModal.style.display = "none";
                groqApiKeyInput.value = "";
                fetchStatus();
            } else {
                showToast(data.error || "Failed to verify key");
            }
        } catch (e) {
            showToast("Connection error: " + e.message);
        } finally {
            saveApiKeyBtn.disabled = false;
            saveApiKeyBtn.innerHTML = "Save Key";
        }
    });

    // Translator Modal
    closeTranslatorModal.addEventListener("click", () => translatorModal.style.display = "none");
    closeTranslatorBtn.addEventListener("click", () => translatorModal.style.display = "none");

    executeTranslateBtn.addEventListener("click", async () => {
        const text = translateInput.value.trim();
        const target_lang = modalTargetLang.value;
        if (!text) {
            showToast("Please enter text to translate");
            return;
        }

        executeTranslateBtn.disabled = true;
        executeTranslateBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Translating...`;

        try {
            const res = await fetch("/api/translate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text, target_language: target_lang })
            });
            const data = await res.json();
            if (res.ok) {
                translatedResultWrap.style.display = "block";
                translationResult.textContent = data.translated_text;
            } else {
                showToast(data.error || "Translation failed");
            }
        } catch (e) {
            showToast("Error: " + e.message);
        } finally {
            executeTranslateBtn.disabled = false;
            executeTranslateBtn.innerHTML = "Translate Now";
        }
    });

    // Lightbox Modal
    closeLightbox.addEventListener("click", () => lightboxModal.style.display = "none");
    lightboxModal.addEventListener("click", (e) => {
        if (e.target === lightboxModal) lightboxModal.style.display = "none";
    });

    // Send Message Logic
    async function sendMessage() {
        if (isProcessing) return;

        let message = userInput.value.trim();
        if (!message) return;

        if (isImageMode && !message.toLowerCase().includes("image") && !message.toLowerCase().includes("picture") && !message.toLowerCase().includes("draw")) {
            message = `Generate an image of ${message}`;
        }

        // Hide welcome card once first message is sent
        if (welcomeCard) welcomeCard.style.display = "none";

        // Append User Message
        appendUserMessage(message);

        // Clear input and reset height
        userInput.value = "";
        userInput.style.height = "auto";
        isImageMode = false;
        updateImageModeUI();

        // Show typing indicator
        const typingEl = showTypingIndicator();
        isProcessing = true;
        sendBtn.disabled = true;

        try {
            const selectedLanguage = languageSelect.value;
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: message,
                    language: selectedLanguage
                })
            });

            const data = await res.json();
            removeTypingIndicator(typingEl);

            if (res.status === 403 && data.requires_upgrade) {
                // Free limit reached!
                appendUpgradeRequiredMessage(data.message);
                openUpgradeModal(data.message);
                fetchStatus();
                return;
            }

            if (res.status === 500 && data.requires_api_key) {
                appendApiKeyPromptMessage(data.message);
                settingsModal.style.display = "flex";
                fetchStatus();
                return;
            }

            if (!res.ok) {
                appendErrorMessage(data.message || data.error || "An error occurred");
                return;
            }

            // Successful Bot Reply
            appendBotMessage(data);

            // Update usage display
            updateStatusUI(data);

        } catch (err) {
            removeTypingIndicator(typingEl);
            appendErrorMessage("Failed to connect to bramhastra26 server: " + err.message);
        } finally {
            isProcessing = false;
            sendBtn.disabled = false;
            userInput.focus();
        }
    }

    // Message Rendering Helpers
    function appendUserMessage(text) {
        const row = document.createElement("div");
        row.className = "msg-row user";

        const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

        row.innerHTML = `
            <div class="msg-content-wrap">
                <div class="msg-header-meta">
                    <span class="msg-author">You</span>
                    <span class="msg-time">${time}</span>
                </div>
                <div class="msg-bubble">${escapeHTML(text)}</div>
            </div>
            <div class="msg-avatar">
                <i class="fa-solid fa-user"></i>
            </div>
        `;

        messagesList.appendChild(row);
        scrollToBottom();
    }

    function appendBotMessage(data) {
        const row = document.createElement("div");
        row.className = "msg-row bot";

        const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const emotion = data.emotion || "Empathetic";
        const emotionIcon = getEmotionIcon(emotion);

        // Parse markdown safely
        const rawContent = data.response || "";
        const formattedHtml = window.marked ? marked.parse(rawContent) : escapeHTML(rawContent);

        // Build image card if available
        let imageCardHtml = "";
        if (data.image_url) {
            const promptText = escapeHTML(data.image_prompt || "Generated Visual");
            imageCardHtml = `
                <div class="image-card" data-img-url="${data.image_url}" data-caption="${promptText}">
                    <img src="${data.image_url}" alt="${promptText}" loading="lazy" />
                    <div class="image-card-caption">
                        <span><i class="fa-solid fa-wand-magic-sparkles"></i> ${promptText}</span>
                        <i class="fa-solid fa-expand"></i>
                    </div>
                </div>
            `;
        }

        // Build YouTube Music Player Card if music requested
        let musicCardHtml = "";
        if (data.music_data) {
            const encodedQuery = encodeURIComponent(data.music_data.youtube_query);
            musicCardHtml = `
                <div class="youtube-player-card">
                    <div class="yt-header">
                        <span><i class="fa-brands fa-youtube" style="color: #ef4444;"></i> Playing on YouTube: <strong>${escapeHTML(data.music_data.title)}</strong></span>
                        <span style="font-size: 0.72rem; opacity: 0.8;">bramhastra26 Music</span>
                    </div>
                    <div class="yt-player-wrap">
                        <iframe 
                            src="https://www.youtube.com/embed?listType=search&list=${encodedQuery}" 
                            title="${escapeHTML(data.music_data.title)}" 
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                            allowfullscreen></iframe>
                    </div>
                    <div class="yt-footer">
                        <span>Song ready to stream</span>
                        <a href="${data.music_data.youtube_search_url}" target="_blank" class="yt-direct-btn">
                            <i class="fa-solid fa-arrow-up-right-from-square"></i> Open in YouTube
                        </a>
                    </div>
                </div>
            `;
        }

        // Build Google Search & Verified Link Card if requested
        let linkCardHtml = "";
        if (data.link_data) {
            linkCardHtml = `
                <div class="google-link-card">
                    <div class="google-link-info">
                        <span class="google-link-title"><i class="fa-brands fa-google"></i> Google Verified Link</span>
                        <span class="google-link-sub">Search link for "${escapeHTML(data.link_data.query)}"</span>
                    </div>
                    <a href="${data.link_data.google_url}" target="_blank" class="btn-open-link">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i> Open Google Link
                    </a>
                </div>
            `;
        }

        // Build Instagram Card if Instagram query
        let instagramCardHtml = "";
        if (data.is_instagram) {
            instagramCardHtml = `
                <div class="instagram-helper-card">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <i class="fa-brands fa-instagram" style="font-size: 1.6rem; color: #e1306c;"></i>
                        <div>
                            <div style="font-weight: 700; font-size: 0.9rem;">Instagram Specialist Connected</div>
                            <div style="font-size: 0.74rem; color: var(--text-dim);">Reels, Algorithm, Growth & Features</div>
                        </div>
                    </div>
                    <a href="https://www.instagram.com" target="_blank" class="btn-open-instagram">
                        <i class="fa-brands fa-instagram"></i> Open Instagram
                    </a>
                </div>
            `;
        }

        row.innerHTML = `
            <div class="msg-avatar">
                <img src="/static/images/bramhastra26_logo.jpg" alt="bramhastra26" class="bot-avatar-img">
            </div>
            <div class="msg-content-wrap">
                <div class="msg-header-meta">
                    <span class="msg-author">bramhastra26</span>
                    <span class="badge-verified"><i class="fa-solid fa-shield-check"></i> Factually Verified</span>
                    <span class="badge-emotion">${emotionIcon} ${emotion}</span>
                    <span class="msg-time">${time}</span>
                </div>
                <div class="msg-bubble">
                    ${formattedHtml}
                    ${imageCardHtml}
                    ${musicCardHtml}
                    ${linkCardHtml}
                    ${instagramCardHtml}
                </div>
                <div class="msg-actions">
                    <button class="btn-msg-action btn-read-aloud" title="Read Aloud">
                        <i class="fa-solid fa-volume-high"></i> Listen
                    </button>
                    <button class="btn-msg-action btn-copy-text" title="Copy response">
                        <i class="fa-solid fa-copy"></i> Copy
                    </button>
                    <button class="btn-msg-action btn-translate-msg" title="Translate response">
                        <i class="fa-solid fa-language"></i> Translate
                    </button>
                </div>
            </div>
        `;

        // Wire up listeners for image card, read aloud, copy, translate
        const imgCard = row.querySelector(".image-card");
        if (imgCard) {
            imgCard.addEventListener("click", () => {
                const url = imgCard.getAttribute("data-img-url");
                const cap = imgCard.getAttribute("data-caption");
                lightboxImg.src = url;
                lightboxCaption.textContent = cap;
                lightboxDownload.href = url;
                lightboxModal.style.display = "flex";
            });
        }

        const readBtn = row.querySelector(".btn-read-aloud");
        readBtn.addEventListener("click", () => readTextAloud(rawContent, readBtn));

        const copyBtn = row.querySelector(".btn-copy-text");
        copyBtn.addEventListener("click", () => {
            navigator.clipboard.writeText(rawContent);
            showToast("Copied to clipboard!");
        });

        const transBtn = row.querySelector(".btn-translate-msg");
        transBtn.addEventListener("click", () => {
            translateInput.value = rawContent;
            translatorModal.style.display = "flex";
        });

        messagesList.appendChild(row);
        scrollToBottom();
    }

    function appendUpgradeRequiredMessage(message) {
        const row = document.createElement("div");
        row.className = "msg-row bot";

        row.innerHTML = `
            <div class="msg-avatar" style="border: 2px solid var(--accent-gold); padding: 0;">
                <img src="/static/images/bramhastra26_logo.jpg" alt="bramhastra26" class="bot-avatar-img">
            </div>
            <div class="msg-content-wrap">
                <div class="msg-header-meta">
                    <span class="msg-author">bramhastra26</span>
                    <span class="badge-emotion" style="background: rgba(245, 158, 11, 0.2); color: var(--accent-gold); border-color: rgba(245, 158, 11, 0.4);">
                        <i class="fa-solid fa-lock"></i> Usage Limit (20 Queries)
                    </span>
                </div>
                <div class="msg-bubble" style="border: 1px solid rgba(245, 158, 11, 0.4); background: rgba(245, 158, 11, 0.05);">
                    <p><strong>⚠️ Free Limit Reached (20/20 Questions)</strong></p>
                    <p style="margin-top: 6px;">${message}</p>
                    
                    <div style="display: flex; align-items: center; gap: 14px; margin: 14px 0; background: rgba(0, 0, 0, 0.04); border: 1px solid rgba(245, 158, 11, 0.35); border-radius: 10px; padding: 12px;">
                        <img src="/static/images/upi_scanner.jpg" alt="Koushik MR Scanner" style="width: 72px; height: 72px; border-radius: 8px; object-fit: contain; background: #fff; border: 2px solid var(--accent-gold);">
                        <div>
                            <div style="font-weight: 800; font-size: 0.95rem; color: var(--accent-gold);"><i class="fa-solid fa-qrcode"></i> Koushik MR Scanner</div>
                            <div style="font-size: 0.78rem; color: var(--text-dim); margin-top: 2px;">Scan with Google Pay, PhonePe, or Paytm for ₹5 per question.</div>
                            <div style="font-size: 0.75rem; color: var(--accent-emerald); font-weight: 600; margin-top: 4px;">⚡ Instant Extra Question Chances</div>
                        </div>
                    </div>

                    <div style="margin-top: 10px;">
                        <button class="btn-primary-glow inline-upgrade-trigger">
                            <i class="fa-solid fa-qrcode"></i> Open Scanner & Unlock Extra Questions (₹5/Q)
                        </button>
                    </div>
                </div>
            </div>
        `;

        row.querySelector(".inline-upgrade-trigger").addEventListener("click", () => openUpgradeModal(message));
        messagesList.appendChild(row);
        scrollToBottom();
    }

    function appendApiKeyPromptMessage(message) {
        const row = document.createElement("div");
        row.className = "msg-row bot";

        row.innerHTML = `
            <div class="msg-avatar">
                <i class="fa-solid fa-key"></i>
            </div>
            <div class="msg-content-wrap">
                <div class="msg-header-meta">
                    <span class="msg-author">bramhastra26</span>
                </div>
                <div class="msg-bubble" style="border: 1px solid rgba(99, 102, 241, 0.4);">
                    <p><strong>⚙️ Groq API Key Needed</strong></p>
                    <p style="margin-top: 6px;">${message}</p>
                    <div style="margin-top: 12px;">
                        <button class="btn-secondary" id="prompt-open-settings">
                            <i class="fa-solid fa-gear"></i> Open API Key Settings
                        </button>
                    </div>
                </div>
            </div>
        `;

        row.querySelector("#prompt-open-settings").addEventListener("click", () => {
            settingsModal.style.display = "flex";
        });
        messagesList.appendChild(row);
        scrollToBottom();
    }

    function appendErrorMessage(msg) {
        const row = document.createElement("div");
        row.className = "msg-row bot";
        row.innerHTML = `
            <div class="msg-avatar" style="background: var(--accent-rose);">
                <i class="fa-solid fa-triangle-exclamation"></i>
            </div>
            <div class="msg-content-wrap">
                <div class="msg-bubble" style="border-color: rgba(244, 63, 94, 0.4); color: #fca5a5;">
                    <i class="fa-solid fa-circle-exclamation"></i> ${escapeHTML(msg)}
                </div>
            </div>
        `;
        messagesList.appendChild(row);
        scrollToBottom();
    }

    function showTypingIndicator() {
        const row = document.createElement("div");
        row.className = "msg-row bot typing-row";
        row.innerHTML = `
            <div class="msg-avatar">
                <img src="/static/images/bramhastra26_logo.jpg" alt="bramhastra26" class="bot-avatar-img">
            </div>
            <div class="msg-bubble">
                <div class="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        messagesList.appendChild(row);
        scrollToBottom();
        return row;
    }

    function removeTypingIndicator(el) {
        if (el && el.parentNode) {
            el.parentNode.removeChild(el);
        }
    }

    // Text-to-Speech
    function readTextAloud(text, buttonEl) {
        if (!window.speechSynthesis) {
            showToast("Speech synthesis not supported in this browser");
            return;
        }

        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            buttonEl.innerHTML = `<i class="fa-solid fa-volume-high"></i> Listen`;
            return;
        }

        // Clean markdown tags for clean reading
        const plainText = text.replace(/[*_~`#\[\]\(\)>-]/g, "").trim();
        const utterance = new SpeechSynthesisUtterance(plainText);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        buttonEl.innerHTML = `<i class="fa-solid fa-stop"></i> Stop`;

        utterance.onend = () => {
            buttonEl.innerHTML = `<i class="fa-solid fa-volume-high"></i> Listen`;
        };
        utterance.onerror = () => {
            buttonEl.innerHTML = `<i class="fa-solid fa-volume-high"></i> Listen`;
        };

        window.speechSynthesis.speak(utterance);
    }

    // Reset Chat
    async function resetChat() {
        if (isProcessing) return;
        try {
            await fetch("/api/reset", { method: "POST" });
            messagesList.innerHTML = "";
            if (welcomeCard) welcomeCard.style.display = "flex";
            if (window.speechSynthesis) window.speechSynthesis.cancel();
            fetchStatus();
            showToast("Conversation reset successfully!");
            if (window.innerWidth <= 820) sidebar.classList.remove("open");
        } catch (e) {
            showToast("Failed to reset conversation");
        }
    }

    // Fetch & Update Status
    async function fetchStatus() {
        try {
            const res = await fetch("/api/status");
            const data = await res.json();
            updateStatusUI(data);

            if (data.has_api_key) {
                apiKeyStatusText.textContent = "Groq API Key is active & connected";
                apiKeyStatusBox.style.borderColor = "rgba(16, 185, 129, 0.35)";
                apiKeyStatusBox.querySelector("i").className = "fa-solid fa-circle-check text-success";
            } else {
                apiKeyStatusText.textContent = "No valid API key detected. Please add one below.";
                apiKeyStatusBox.style.borderColor = "rgba(244, 63, 94, 0.35)";
                apiKeyStatusBox.querySelector("i").className = "fa-solid fa-circle-exclamation text-danger";
            }
        } catch (e) {
            console.warn("Status fetch error:", e);
        }
    }

    function updateStatusUI(data) {
        currentQueryCount = data.query_count || 0;
        freeLimit = data.free_limit || 20;
        isPremium = data.is_premium || false;
        premiumCredits = data.premium_credits || 0;

        queryCountDisplay.textContent = currentQueryCount;
        const pct = Math.min(100, Math.round((currentQueryCount / freeLimit) * 100));
        queryProgressBar.style.width = pct + "%";

        const remainingFree = Math.max(0, freeLimit - currentQueryCount);
        const headerQueryPill = document.getElementById("header-query-pill");
        const queryStatusNote = document.getElementById("query-status-note");

        if (isPremium && premiumCredits > 0) {
            tierBadge.textContent = "⭐ Extra Active";
            tierBadge.style.color = "var(--accent-emerald)";
            tierRate.textContent = `${premiumCredits} Chances Remaining`;
            remainingText.textContent = `${premiumCredits} extra chances remaining`;
            headerQueryCount.textContent = `⭐ ${premiumCredits} Extra Left`;
            if (headerQueryPill) {
                headerQueryPill.className = "query-counter-pill premium";
                headerQueryPill.title = `${premiumCredits} extra question chances available`;
            }
            upgradeBtn.className = "btn-upgrade";
            upgradeBtn.innerHTML = `<i class="fa-solid fa-plus"></i> Recharge More (₹5/Q)`;
            if (queryStatusNote) {
                queryStatusNote.innerHTML = `<i class="fa-solid fa-circle-check text-success"></i> ${premiumCredits} extra question chances active (₹5/Q)`;
            }
        } else if (remainingFree === 0 || (isPremium && premiumCredits <= 0)) {
            // 20 Queries Expired!
            tierBadge.textContent = "⚠️ Queries Expired";
            tierBadge.style.color = "var(--accent-rose)";
            tierRate.textContent = "Scan QR to Recharge";
            remainingText.textContent = "0 free left (Expired)";
            headerQueryCount.textContent = "⚠️ 0 Left (Expired)";
            if (headerQueryPill) {
                headerQueryPill.className = "query-counter-pill expired";
                headerQueryPill.title = "Your 20 free queries have expired. Scan QR to recharge.";
            }
            upgradeBtn.className = "btn-upgrade btn-upgrade-expired";
            upgradeBtn.innerHTML = `<i class="fa-solid fa-qrcode"></i> Scan QR to Recharge (₹5/Q)`;
            if (queryStatusNote) {
                queryStatusNote.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-danger"></i> 20 queries expired. Scan QR to recharge extra chances.`;
            }
        } else {
            // Free Queries Active (payment locked!)
            tierBadge.textContent = "Free Plan";
            tierBadge.style.color = "var(--accent-gold)";
            tierRate.textContent = "20 Queries Free";
            remainingText.textContent = `${remainingFree} free queries left`;
            headerQueryCount.textContent = `${remainingFree} Free Left`;
            if (headerQueryPill) {
                headerQueryPill.className = "query-counter-pill";
                headerQueryPill.title = `You have ${remainingFree} free queries remaining. Payment accepted only after 20 queries.`;
            }
            upgradeBtn.className = "btn-upgrade btn-upgrade-locked";
            upgradeBtn.innerHTML = `<i class="fa-solid fa-shield-halved"></i> Free Queries (${remainingFree} left)`;
            if (queryStatusNote) {
                queryStatusNote.innerHTML = `<i class="fa-solid fa-circle-info"></i> Payment accepted only after 20 free queries expire`;
            }
        }
    }

    // Emotion Icon Map
    function getEmotionIcon(emotion) {
        switch ((emotion || "").toLowerCase()) {
            case "joyful": return "🎉";
            case "calming": return "🌿";
            case "analytical": return "💡";
            case "supportive": return "🤝";
            case "curious": return "🔍";
            case "inspiring": return "✨";
            default: return "❤️";
        }
    }

    function escapeHTML(str) {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }

    function scrollToBottom() {
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    function showToast(message) {
        const existing = document.querySelector(".toast-msg");
        if (existing) existing.remove();

        const toast = document.createElement("div");
        toast.className = "toast-msg";
        toast.innerHTML = `<i class="fa-solid fa-circle-info text-info"></i> <span>${escapeHTML(message)}</span>`;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3200);
    }
});

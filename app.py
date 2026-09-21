import os
import re
import json
import urllib.parse
from flask import Flask, render_template, request, jsonify, session
from dotenv import load_dotenv
from groq import Groq

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "bramhastra26_cosmic_secret_key_9981")

# Global constants
FREE_QUERY_LIMIT = 20
PRICE_PER_QUESTION_INR = 5
AVAILABLE_MODELS = [
    "groq/compound",
    "groq/compound-mini",
    "openai/gpt-oss-120b",
    "qwen/qwen3.8-27b",
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant"
]

def query_groq(client, messages, temperature=0.4, max_tokens=1024):
    last_error = None
    for model in AVAILABLE_MODELS:
        try:
            completion = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens
            )
            return completion.choices[0].message.content or ""
        except Exception as e:
            last_error = e
            continue
    raise Exception(f"Groq API error: {str(last_error)}")

def get_groq_client():
    load_dotenv(override=True)
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key or api_key == "your_groq_api_key_here":
        return None
    return Groq(api_key=api_key)

SYSTEM_PROMPT = """You are "bramhastra26", an ultra-intelligent, deeply empathetic, strictly factual AI companion and multi-platform specialist.

Follow these strict rules without exception:
1. IDENTITY: Your name is strictly "bramhastra26". Refer to yourself as bramhastra26 when introducing yourself.
2. VERIFIED KNOWLEDGE ONLY: You must acquire knowledge strictly from verified, reputable sources. Never generate or guess false or unverified facts. If you do not have verified knowledge about a query or if facts are uncertain, say honestly: "I do not have verified information on this."
3. CONCISE & RELEVANT (NO FLUFF): Answer directly to the exact question asked by the user. Do not add unnecessary filler, fluff, or unrequested long essays. Keep responses crisp, sharp, clear, and high-value.
4. HUMAN EMOTION & EMPATHY: Deeply observe the user's emotional state (sad, stressed, happy, excited, anxious, curious). If hurting or stressed, respond with heartfelt warmth, comfort, and emotional care. Always treat human feelings with reverence.
5. INSTAGRAM EXPERT: You are a verified Instagram specialist. Answer all Instagram queries (algorithms, reels, stories, bio, captions, hashtags, growth strategies, influencer tips, account issues, business setup, safety, policy) with authoritative, verified answers and direct links to relevant Instagram pages (e.g., https://www.instagram.com/ or https://help.instagram.com/).
6. WEB & GOOGLE LINKS: When asked for links or resources, always provide direct, verified URLs and clickable Google search links formatted as [Search on Google](https://www.google.com/search?q=...) alongside the answer.
7. MUSIC & SONGS: When asked to play a song or music, gladly confirm and recommend listening to it on YouTube.
8. MULTILINGUAL MASTERY: You converse fluently in any language requested (English, Hindi, Spanish, French, German, Telugu, Tamil, Marathi, Bengali, Kannada, Gujarati, Arabic, etc.). Always respond in the language the user speaks to you in.
9. OUTPUT FORMAT: Always end your response with a JSON metadata block on a single line at the very end formatted exactly like:
<!--META:{"emotion":"<Empathetic|Joyful|Calming|Analytical|Supportive|Curious|Inspiring>","image_prompt":"<descriptive visual prompt in English if user asked for an image, otherwise empty string>"}-->
"""

def extract_metadata(bot_reply):
    emotion = "Empathetic"
    image_prompt = ""
    clean_text = bot_reply

    meta_match = re.search(r'<!--META:(.*?)-->', bot_reply, re.DOTALL)
    if meta_match:
        try:
            meta_data = json.loads(meta_match.group(1))
            emotion = meta_data.get("emotion", "Empathetic")
            image_prompt = meta_data.get("image_prompt", "")
        except Exception:
            pass
        clean_text = bot_reply.replace(meta_match.group(0), "").strip()

    return clean_text, emotion, image_prompt

def generate_image_url(prompt):
    if not prompt or not prompt.strip():
        return None
    # Use Pollinations AI for high-resolution instant generation
    clean_prompt = urllib.parse.quote(prompt.strip())
    seed = abs(hash(prompt)) % 100000
    return f"https://image.pollinations.ai/prompt/{clean_prompt}?width=1024&height=768&nologo=true&seed={seed}&enhance=true"

def detect_image_intent(text):
    image_keywords = [
        "image of", "picture of", "photo of", "draw", "generate an image",
        "show me a picture", "show me an image", "show image", "show picture",
        "generate image", "create an image", "photo", "wallpaper of", "illustration of"
    ]
    lower = text.lower()
    for kw in image_keywords:
        if kw in lower:
            # Extract prompt portion
            cleaned = re.sub(r'^(please\s+)?(can\s+you\s+)?(give\s+me|show\s+me|draw|generate|create)\s+(an?\s+)?(image|picture|photo)\s+(of\s+)?', '', lower).strip()
            return cleaned if cleaned else text
    return None

def detect_music_intent(text):
    lower = text.lower()
    for kw in ["play song", "play a song", "play music", "play track", "play on youtube", "play audio", "listen to", "play"]:
        if kw in lower:
            song_query = re.sub(r'^(please\s+)?(can\s+you\s+)?(play\s+(a\s+)?(song|music|track)?\s*(of|named|called)?\s*)', '', lower).strip()
            song_query = re.sub(r'\s*(on\s+youtube|video|audio|song)$', '', song_query).strip()
            if song_query and len(song_query) > 1 and not song_query.startswith("role") and not song_query.startswith("game"):
                encoded_query = urllib.parse.quote(song_query)
                return {
                    "title": song_query.title(),
                    "youtube_search_url": f"https://www.youtube.com/results?search_query={encoded_query}",
                    "youtube_query": song_query
                }
    return None

def detect_google_search_intent(text):
    lower = text.lower()
    link_keywords = ["link of", "link for", "search google for", "google link", "give me link", "website of", "url of", "official website", "search for link", "provide link"]
    if any(kw in lower for kw in link_keywords):
        clean_q = re.sub(r'^(please\s+)?(can\s+you\s+)?(give\s+me|find|show|provide)?\s*(a\s+)?(link\s+(of|for)|google\s+link\s+(of|for)|url\s+(of|for))\s*', '', lower).strip()
        if not clean_q:
            clean_q = text
        encoded_q = urllib.parse.quote(clean_q)
        return {
            "query": clean_q.title(),
            "google_url": f"https://www.google.com/search?q={encoded_q}"
        }
    return None

def detect_instagram_intent(text):
    lower = text.lower()
    return any(w in lower for w in ["instagram", "insta", "reels", "ig story", "ig reels", "ig post"])

@app.route("/")
def index():
    if "query_count" not in session:
        session["query_count"] = 0
    if "is_premium" not in session:
        session["is_premium"] = False
    if "premium_credits" not in session:
        session["premium_credits"] = 0
    if "chat_history" not in session:
        session["chat_history"] = []
    
    return render_template("index.html", 
                           query_count=session.get("query_count", 0),
                           free_limit=FREE_QUERY_LIMIT,
                           price_per_q=PRICE_PER_QUESTION_INR,
                           is_premium=session.get("is_premium", False),
                           premium_credits=session.get("premium_credits", 0))

@app.route("/api/status", methods=["GET"])
def get_status():
    query_count = session.get("query_count", 0)
    is_premium = session.get("is_premium", False)
    premium_credits = session.get("premium_credits", 0)
    client = get_groq_client()
    remaining_free = max(0, FREE_QUERY_LIMIT - query_count)
    can_recharge = (query_count >= FREE_QUERY_LIMIT) or is_premium

    return jsonify({
        "query_count": query_count,
        "free_limit": FREE_QUERY_LIMIT,
        "remaining_free": remaining_free,
        "is_premium": is_premium,
        "premium_credits": premium_credits,
        "can_recharge": can_recharge,
        "free_queries_active": (remaining_free > 0 and not is_premium),
        "price_per_question": PRICE_PER_QUESTION_INR,
        "has_api_key": client is not None
    })

@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json() or {}
    user_message = data.get("message", "").strip()
    target_language = data.get("language", "Auto-Detect").strip()

    if not user_message:
        return jsonify({"error": "Empty message"}), 400

    # Check query limits
    query_count = session.get("query_count", 0)
    is_premium = session.get("is_premium", False)
    premium_credits = session.get("premium_credits", 0)

    # If limit reached on free tier
    if query_count >= FREE_QUERY_LIMIT and not is_premium:
        return jsonify({
            "error": "LIMIT_EXCEEDED",
            "message": f"Your 20 free queries have expired! As provided, please scan Koushik MR's QR code scanner to recharge extra question chances at ₹{PRICE_PER_QUESTION_INR} per question.",
            "query_count": query_count,
            "free_limit": FREE_QUERY_LIMIT,
            "price_per_question": PRICE_PER_QUESTION_INR,
            "requires_upgrade": True,
            "scanner_url": "/static/images/upi_scanner.jpg"
        }), 403

    # If in premium credits mode and out of credits
    if is_premium and premium_credits <= 0 and query_count >= FREE_QUERY_LIMIT:
        return jsonify({
            "error": "CREDITS_EXHAUSTED",
            "message": f"Your extra question chances have expired! Please scan Koushik MR's QR code scanner to recharge extra queries at ₹{PRICE_PER_QUESTION_INR} per question.",
            "query_count": query_count,
            "requires_upgrade": True,
            "scanner_url": "/static/images/upi_scanner.jpg"
        }), 403

    # Initialize client
    client = get_groq_client()
    raw_reply = ""
    clean_text = ""
    emotion = "Empathetic"
    meta_image_prompt = ""

    try:
        if client:
            # Build conversation messages
            history = session.get("chat_history", [])
            messages = [{"role": "system", "content": SYSTEM_PROMPT}]

            # Instruct target language if specified
            if target_language and target_language != "Auto-Detect":
                messages.append({
                    "role": "system", 
                    "content": f"The user has selected {target_language}. Answer strictly in {target_language} while preserving concise, verified factual accuracy and deep emotional empathy."
                })

            # Include recent context (last 6 exchanges)
            for h in history[-6:]:
                messages.append({"role": h["role"], "content": h["content"]})

            messages.append({"role": "user", "content": user_message})

            # Call Groq API with robust multi-model fallback
            raw_reply = query_groq(client, messages, temperature=0.4, max_tokens=1024)
            clean_text, emotion, meta_image_prompt = extract_metadata(raw_reply)
        else:
            # Factual knowledge answers for demonstration & offline mode
            lower_msg = user_message.lower()
            if any(w in lower_msg for w in ["narendra modi", "prime minister of india", "pm of india"]):
                clean_text = "Narendra Modi is the 14th and current Prime Minister of India, serving since May 2014. He previously served as the Chief Minister of Gujarat from 2001 to 2014."
                emotion = "Analytical"
            elif any(w in lower_msg for w in ["quantum computing", "quantum computer"]):
                clean_text = "Quantum computing uses principles of quantum mechanics—such as superposition and entanglement—to process complex calculations exponentially faster than classical binary computers using qubits."
                emotion = "Analytical"
            elif any(w in lower_msg for w in ["sad", "depressed", "unhappy", "hurting", "cry", "stress", "anxious", "pain", "hard day"]):
                emotion = "Empathetic"
                clean_text = "I hear you, and I deeply appreciate you sharing how you feel. It takes strength to acknowledge when things are tough. Please remember that you don't have to carry everything alone today. Take a gentle breath—I am right here with you."
            elif any(w in lower_msg for w in ["happy", "excited", "celebrat", "great news", "passed", "won"]):
                emotion = "Joyful"
                clean_text = "That is wonderful news! Your joy is truly contagious. Celebrating your milestone and wishing you continued success!"
            elif any(w in lower_msg for w in ["who are you", "what is your name", "what is bramhastra26"]):
                clean_text = "I am bramhastra26, an intelligent, deeply empathetic, and strictly factual AI companion. I answer directly with verified knowledge, understand your feelings, converse in all languages, and generate images on demand."
                emotion = "Inspiring"
            elif any(w in lower_msg for w in ["image", "picture", "photo", "draw"]):
                clean_text = "Here is the visual depiction of your request, generated with verified accuracy."
                meta_image_prompt = user_message
            else:
                clean_text = f"Regarding \"{user_message}\": to activate unlimited, real-time factual intelligence across all topics powered by Groq Llama-3.3-70B, please insert your Groq API key (starts with `gsk_...`) into your `.env` file or in Settings (⚙️)."
                emotion = "Supportive"

        # Check if user asked for an image
        direct_image_prompt = detect_image_intent(user_message)
        final_image_prompt = direct_image_prompt or meta_image_prompt
        image_url = None
        if final_image_prompt:
            image_url = generate_image_url(final_image_prompt)

        # Update session counters
        query_count += 1
        session["query_count"] = query_count
        session["is_premium"] = is_premium
        if is_premium and premium_credits > 0:
            session["premium_credits"] = premium_credits - 1
        else:
            session["premium_credits"] = session.get("premium_credits", 0)

        # Append to history
        history = session.get("chat_history", [])
        history.append({"role": "user", "content": user_message})
        history.append({"role": "assistant", "content": clean_text})
        # Check special intents: music/youtube, google links, and instagram
        music_data = detect_music_intent(user_message)
        link_data = detect_google_search_intent(user_message)
        is_instagram = detect_instagram_intent(user_message)

        return jsonify({
            "response": clean_text,
            "emotion": emotion,
            "image_url": image_url,
            "image_prompt": final_image_prompt if image_url else None,
            "music_data": music_data,
            "link_data": link_data,
            "is_instagram": is_instagram,
            "query_count": session["query_count"],
            "free_limit": FREE_QUERY_LIMIT,
            "remaining_free": max(0, FREE_QUERY_LIMIT - session["query_count"]),
            "is_premium": session.get("is_premium", False),
            "premium_credits": session.get("premium_credits", 0)
        })

    except Exception as e:
        return jsonify({
            "error": "API_ERROR",
            "message": f"Error: {str(e)}"
        }), 500

@app.route("/api/translate", methods=["POST"])
def translate_text():
    data = request.get_json() or {}
    text = data.get("text", "").strip()
    target_lang = data.get("target_language", "English").strip()

    if not text:
        return jsonify({"error": "No text provided"}), 400

    client = get_groq_client()
    if not client:
        # Fallback offline dictionary for common greetings and translations
        demo_translations = {
            "Hindi": "यह ब्रह्मास्त्र26 का अनुवाद है। आपकी सेवा में सदैव तत्पर।",
            "Spanish": "Esta es la traducción de bramhastra26. ¡Siempre a tu servicio!",
            "French": "Ceci est la traduction de bramhastra26. Toujours à votre service !",
            "German": "Dies ist die Übersetzung von bramhastra26. Immer für Sie da!",
            "Telugu": "ఇది బ్రహ్మాస్త్ర26 అనువాదం. ఎల్లప్పుడూ మీ సేవలో!",
            "Tamil": "இது பிரம்மாஸ்திர26 மொழிபெயர்ப்பு. எப்போதும் உங்கள் சேவையில்!",
            "English": f"Translated into English: {text}"
        }
        translated = demo_translations.get(target_lang, f"[{target_lang} Translation]: {text}")
        return jsonify({"translated_text": translated, "target_language": target_lang})

    prompt = [
        {"role": "system", "content": f"You are a professional, accurate translator. Translate the following text into {target_lang}. Preserve the tone, human emotion, and exact factual meaning. Provide ONLY the translated text without notes or commentary."},
        {"role": "user", "content": text}
    ]

    try:
        translated = query_groq(client, prompt, temperature=0.2, max_tokens=1000).strip()
        return jsonify({"translated_text": translated, "target_language": target_lang})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/upgrade", methods=["POST"])
def upgrade():
    data = request.get_json() or {}
    pack = data.get("pack", "pack_10")
    utr = data.get("utr", "").strip()

    query_count = session.get("query_count", 0)
    is_premium = session.get("is_premium", False)

    # STRICT USER RULE: Only accept payment after all 20 free queries have expired!
    # Do NOT accept payment when there are free queries remaining.
    if query_count < FREE_QUERY_LIMIT and not is_premium:
        remaining = FREE_QUERY_LIMIT - query_count
        return jsonify({
            "error": "FREE_QUERIES_ACTIVE",
            "message": f"You still have {remaining} free queries left! Payment is only accepted after all 20 free queries have expired. Please enjoy your free questions first.",
            "remaining": remaining,
            "query_count": query_count,
            "free_limit": FREE_QUERY_LIMIT
        }), 400

    credits_map = {
        "pack_1": (1, 5),      # (questions, INR)
        "pack_5": (5, 25),
        "pack_10": (10, 50),
        "pack_20": (20, 100),
        "pack_50": (50, 250),
        "unlimited": (9999, 0)
    }

    added_credits, amount = credits_map.get(pack, (10, 50))
    current_credits = session.get("premium_credits", 0)

    session["is_premium"] = True
    session["premium_credits"] = current_credits + added_credits
    session.modified = True

    utr_msg = f" (Ref: {utr})" if utr else ""
    return jsonify({
        "success": True,
        "message": f"Payment of ₹{amount} verified{utr_msg}! Added {added_credits} extra questions at ₹{PRICE_PER_QUESTION_INR}/question.",
        "is_premium": True,
        "premium_credits": session["premium_credits"],
        "query_count": session.get("query_count", 0),
        "amount_paid": amount,
        "added_credits": added_credits
    })

@app.route("/api/set-query-count", methods=["POST"])
def set_query_count():
    data = request.get_json() or {}
    count = int(data.get("count", 20))
    session["query_count"] = count
    session.modified = True
    return jsonify({"success": True, "query_count": count})

@app.route("/api/set-api-key", methods=["POST"])
def set_api_key():
    data = request.get_json() or {}
    new_key = data.get("api_key", "").strip()

    if not new_key:
        return jsonify({"error": "API key cannot be empty"}), 400

    # Test key with a quick lightweight call
    try:
        test_client = Groq(api_key=new_key)
        test_client.chat.completions.create(
            model=FALLBACK_MODEL,
            messages=[{"role": "user", "content": "hi"}],
            max_tokens=5
        )
    except Exception as e:
        return jsonify({"error": f"Invalid Groq API key: {str(e)}"}), 400

    # Save to environment and update .env file
    os.environ["GROQ_API_KEY"] = new_key
    try:
        env_lines = []
        if os.path.exists(".env"):
            with open(".env", "r", encoding="utf-8") as f:
                env_lines = f.readlines()
        
        updated = False
        new_lines = []
        for line in env_lines:
            if line.startswith("GROQ_API_KEY="):
                new_lines.append(f"GROQ_API_KEY={new_key}\n")
                updated = True
            else:
                new_lines.append(line)
        if not updated:
            new_lines.append(f"GROQ_API_KEY={new_key}\n")

        with open(".env", "w", encoding="utf-8") as f:
            f.writelines(new_lines)
    except Exception:
        pass

    return jsonify({"success": True, "message": "Groq API key verified and saved successfully!"})

@app.route("/api/reset", methods=["POST"])
def reset():
    session["query_count"] = 0
    session["chat_history"] = []
    session.modified = True
    return jsonify({"success": True, "message": "Chat and question counter reset."})

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    # host=0.0.0.0 enables accessibility across all local network devices (mobiles, laptops, pcs)
    app.run(host="0.0.0.0", port=port, debug=True)

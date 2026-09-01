import json
from datetime import datetime
from flask import current_app
from cryptography.fernet import Fernet, InvalidToken
from app import db


def get_fernet_cipher():
    """Initializes Fernet cipher using master key from config."""
    key = current_app.config.get("FERNET_ENCRYPTION_KEY")
    if not key:
        raise ValueError("FERNET_ENCRYPTION_KEY is missing from configuration / .env")
    if isinstance(key, str):
        key = key.encode("utf-8")
    return Fernet(key)


# ==========================================
# 🔐 GOOGLE CREDENTIALS ENCRYPTION & STORAGE
# ==========================================

def save_studio_credentials(creds_data):
    """
    Encrypts and saves the Google Service Account JSON in MongoDB.
    Accepts a dict or a raw JSON string.
    """
    try:
        if isinstance(creds_data, dict):
            raw_json_str = json.dumps(creds_data)
        else:
            # Validate JSON format if passed as string
            json.loads(creds_data)
            raw_json_str = creds_data

        cipher = get_fernet_cipher()
        encrypted_token = cipher.encrypt(raw_json_str.encode("utf-8")).decode("utf-8")

        db.studio_config.update_one(
            {"config_type": "google_drive_credentials"},
            {
                "$set": {
                    "encrypted_data": encrypted_token,
                    "updated_at": datetime.utcnow()
                }
            },
            upsert=True
        )
        return {"success": True, "message": "Credentials encrypted and saved successfully"}
    except Exception as e:
        return {"success": False, "error": f"Failed to save credentials: {str(e)}"}


def get_studio_credentials():
    """
    Retrieves and decrypts the Google Service Account JSON from MongoDB.
    Returns a Python dictionary or None.
    """
    try:
        record = db.studio_config.find_one({"config_type": "google_drive_credentials"})
        if not record or "encrypted_data" not in record:
            return None

        cipher = get_fernet_cipher()
        decrypted_bytes = cipher.decrypt(record["encrypted_data"].encode("utf-8"))
        return json.loads(decrypted_bytes.decode("utf-8"))
    except InvalidToken:
        print("Security Alert: Invalid Fernet Token for Drive credentials.")
        return None
    except Exception as e:
        print(f"Decryption Error: {e}")
        return None


# ==========================================
# 🏢 STUDIO PROFILE & BRANDING SETTINGS
# ==========================================

def get_studio_profile():
    """Fetches the current studio's profile and branding configurations."""
    profile = db.studio_profile.find_one({"type": "main_profile"}, {"_id": 0})
    if not profile:
        return {
            "studio_name": "FastFrame Studio",
            "tagline": "Capturing Moments In High Definition",
            "logo_url": "/static/img/ff_logo.svg",
            "primary_color": "#000000",
            "contact_email": "",
            "contact_phone": "",
            "address": "",
            "social_links": {}
        }
    return profile


def update_studio_profile(data):
    """Updates studio branding, contact info, and profile details."""
    try:
        data["updated_at"] = datetime.utcnow()
        db.studio_profile.update_one(
            {"type": "main_profile"},
            {"$set": data},
            upsert=True
        )
        return {"success": True, "message": "Studio profile updated successfully"}
    except Exception as e:
        return {"success": False, "error": str(e)}
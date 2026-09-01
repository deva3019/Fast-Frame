import os
import random
import string
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
from flask import session
from app import db


# ==========================================
# 🛡️ SECURITY & VERIFICATION CODE SYSTEM
# ==========================================

def get_product_owner_secret():
    """Master security key defined in deployment env to authorize studio onboarding."""
    return os.getenv("PRODUCT_OWNER_SECRET", "FF-MASTER-KEY-2026")


def generate_otp(length=6):
    """Generates a secure numeric OTP."""
    return "".join(random.choices(string.digits, k=length))


def create_studio_verification(email):
    """Creates a temporary OTP record for studio authorization."""
    otp = generate_otp(6)
    expires_at = datetime.utcnow() + timedelta(minutes=15)

    db.verification_codes.update_one(
        {"email": email},
        {
            "$set": {
                "otp": otp,
                "expires_at": expires_at,
                "verified": False,
                "created_at": datetime.utcnow()
            }
        },
        upsert=True
    )
    # In production, send this OTP to the product owner/admin via Email/SMS
    print(f"[FF-AUTH] Generated Verification OTP for {email}: {otp}")
    return otp


def verify_security_code(email, code_entered):
    """
    Validates either the direct Product Owner Master Secret
    or the dynamic OTP generated for studio onboarding.
    """
    # 1. Direct Master Secret check
    master_secret = get_product_owner_secret()
    if code_entered.strip() == master_secret:
        return True

    # 2. Dynamic OTP check
    record = db.verification_codes.find_one({"email": email, "verified": False})
    if record:
        if datetime.utcnow() > record.get("expires_at", datetime.min):
            return False
        if record.get("otp") == code_entered.strip():
            db.verification_codes.update_one({"_id": record["_id"]}, {"$set": {"verified": True}})
            return True

    return False


# ==========================================
# 👤 STUDIO REGISTRATION & LOGIN
# ==========================================

def register_studio_admin(studio_name, email, password, security_code):
    """Registers a studio admin after security verification."""
    if not verify_security_code(email, security_code):
        return {"success": False, "error": "Invalid or expired authorization code"}

    existing_user = db.users.find_one({"email": email})
    if existing_user:
        return {"success": False, "error": "An account with this email already exists"}

    user_doc = {
        "studio_name": studio_name,
        "email": email,
        "password_hash": generate_password_hash(password),
        "role": "studio_admin",
        "created_at": datetime.utcnow(),
        "is_active": True
    }
    db.users.insert_one(user_doc)

    # Initialize default studio profile
    db.studio_profile.update_one(
        {"type": "main_profile"},
        {
            "$set": {
                "studio_name": studio_name,
                "contact_email": email,
                "logo_url": "/static/img/ff_logo.svg",
                "updated_at": datetime.utcnow()
            }
        },
        upsert=True
    )

    return {"success": True, "message": "Studio registered successfully"}


def authenticate_user(email, password):
    """Validates login credentials and initiates user session."""
    user = db.users.find_one({"email": email, "is_active": True})
    if not user or not check_password_hash(user["password_hash"], password):
        return {"success": False, "error": "Invalid email or password"}

    session["user_id"] = str(user["_id"])
    session["studio_name"] = user.get("studio_name", "FastFrame Studio")
    session["email"] = user["email"]
    session["role"] = user.get("role", "studio_admin")

    return {"success": True, "user": {"email": user["email"], "studio_name": user.get("studio_name")}}


def logout_user():
    """Clears the session data."""
    session.clear()
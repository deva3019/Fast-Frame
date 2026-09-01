import json
from flask import Blueprint, request, jsonify, current_app, render_template
from app.blueprints.auth import login_required

# Make sure these are actually defined in your db_service!
from app.services.db_service import (
    get_studio_credentials, 
    save_studio_credentials,
    get_studio_profile,
    update_studio_profile
)
from app.services.drive_service import test_drive_connection

settings_bp = Blueprint("settings", __name__)

# ==========================================
# ⚙️ HTML ROUTE (DASHBOARD SHELL)
# ==========================================

@settings_bp.route("/", methods=["GET"])
@login_required
def settings_page():
    """Serves the frontend HTML shell for the Settings section."""
    return render_template("admin/settings.html")


# ==========================================
# 📝 STUDIO PROFILE API
# ==========================================

@settings_bp.route("/api/profile", methods=["GET", "POST"])
@login_required
def profile_api():
    """Fetches or updates the studio's branding and contact profile."""
    if request.method == "GET":
        profile_data = get_studio_profile()
        return jsonify({"success": True, "profile": profile_data})
    
    if request.method == "POST":
        data = request.get_json()
        
        # Filter allowed fields to prevent arbitrary data injection
        allowed_fields = [
            "studio_name", "tagline", "primary_color", 
            "contact_email", "contact_phone", "address", 
            "social_links", "logo_url"
        ]
        update_data = {k: v for k, v in data.items() if k in allowed_fields}
        
        result = update_studio_profile(update_data)
        status_code = 200 if result["success"] else 400
        return jsonify(result), status_code


# ==========================================
# 🔐 GOOGLE CREDENTIALS API (Unified)
# ==========================================

@settings_bp.route("/api/credentials", methods=["GET", "POST"])
@login_required
def manage_credentials():
    """Handles fetching (redacted) and updating Google Drive JSON credentials."""
    
    # --- GET: Return Redacted Preview ---
    if request.method == "GET":
        creds = get_studio_credentials()
        if not creds:
            return jsonify({"success": True, "has_credentials": False})
        
        redacted_preview = {
            "type": creds.get("type"),
            "project_id": creds.get("project_id"),
            "private_key_id": creds.get("private_key_id", "")[:10] + "********",
            "private_key": "-----BEGIN PRIVATE KEY-----\n[REDACTED FOR SECURITY]\n-----END PRIVATE KEY-----\n",
            "client_email": creds.get("client_email"),
            "client_id": creds.get("client_id")
        }
        
        return jsonify({
            "success": True, 
            "has_credentials": True, 
            "client_email": creds.get("client_email"),
            "preview": json.dumps(redacted_preview, indent=4)
        })

    # --- POST: Validate, Test, and Save Keys ---
    if request.method == "POST":
        data = request.get_json()
        
        if not data or "credentials_json" not in data:
            return jsonify({"success": False, "error": "No credential payload provided"}), 400
            
        raw_json = data.get("credentials_json")
        if not raw_json:
            return jsonify({"success": False, "error": "Credential data is empty"}), 400
            
        try:
            # Parse if it's a string, otherwise assume it's already a dict
            if isinstance(raw_json, str):
                creds_dict = json.loads(raw_json.strip())
            else:
                creds_dict = raw_json
                
            # Pre-flight Check: Test connection to Google Drive
            is_valid, msg = test_drive_connection(creds_dict)
            if not is_valid:
                return jsonify({
                    "success": False, 
                    "error": f"Invalid Google Credentials: {msg}. Please check your JSON file."
                }), 400
                
            # Encrypt & Save to Database
            save_studio_credentials(creds_dict)
            return jsonify({"success": True, "message": "Keys Encrypted & Secured"}), 200
            
        except json.JSONDecodeError:
            return jsonify({"success": False, "error": "Invalid JSON format uploaded."}), 400
        except Exception as e:
            return jsonify({"success": False, "error": f"Server processing error: {str(e)}"}), 500
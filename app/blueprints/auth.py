from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for
from functools import wraps
from app.services.auth_service import authenticate_user, register_studio_admin, logout_user

auth_bp = Blueprint("auth", __name__)

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user_id" not in session:
            if request.is_json:
                return jsonify({"success": False, "error": "Authentication required", "redirect": url_for("auth.login")}), 401
            return redirect(url_for("auth.login"))
        return f(*args, **kwargs)
    return decorated_function

@auth_bp.route("/verify", methods=["GET"])
def verify():
    """Serves the verification UI for the second step of registration."""
    return render_template("auth/verify.html")

@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "GET":
        return render_template("auth/login.html")

    data = request.get_json()
    email = data.get("email", "").strip()
    password = data.get("password", "")

    result = authenticate_user(email, password)
    if result["success"]:
        return jsonify({"success": True, "redirect": url_for("admin.dashboard")})
    
    return jsonify(result), 401


@auth_bp.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "GET":
        return render_template("auth/register.html")

    data = request.get_json()
    studio_name = data.get("studio_name", "").strip()
    email = data.get("email", "").strip()
    password = data.get("password", "")
    security_code = data.get("security_code", "").strip()

    result = register_studio_admin(studio_name, email, password, security_code)
    if result["success"]:
        return jsonify({"success": True, "redirect": url_for("auth.login")})
    
    return jsonify(result), 401


@auth_bp.route("/logout", methods=["GET", "POST"])
def logout():
    logout_user()
    if request.is_json:
        return jsonify({"success": True, "redirect": url_for("auth.login")})
    return redirect(url_for("auth.login"))
from flask import Blueprint, render_template, session, redirect, url_for
from app.blueprints.auth import login_required

admin_bp = Blueprint("admin", __name__)

@admin_bp.route("/")
@login_required
def index():
    return redirect(url_for("admin.dashboard"))

@admin_bp.route("/dashboard")
@login_required
def dashboard():
    return render_template("admin/dashboard.html", studio_name=session.get("studio_name", "Studio"))

@admin_bp.route("/clients")
@login_required
def clients():
    return render_template("admin/clients.html", studio_name=session.get("studio_name", "Studio"))

@admin_bp.route("/galleries")
@login_required
def galleries():
    return render_template("admin/galleries.html", studio_name=session.get("studio_name", "Studio"))

@admin_bp.route("/photos")
@login_required
def photos():
    return render_template("admin/photos.html", studio_name=session.get("studio_name", "Studio"))

@admin_bp.route("/users")
@login_required
def users():
    return render_template("admin/users.html", studio_name=session.get("studio_name", "Studio"))
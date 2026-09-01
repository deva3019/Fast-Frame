from flask import Blueprint, render_template

landing_bp = Blueprint("landing", __name__)

@landing_bp.route("/")
def index():
    """
    Serves the public FastFrame landing page.
    No login required.
    """
    return render_template("landing.html")
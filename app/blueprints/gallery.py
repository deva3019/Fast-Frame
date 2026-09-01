from flask import Blueprint, render_template, current_app, redirect, url_for
from pymongo import MongoClient

gallery_bp = Blueprint("gallery", __name__)

def get_db():
    client = MongoClient(current_app.config["MONGO_URI"])
    return client[current_app.config["MONGO_DB_NAME"]]

@gallery_bp.route("/<special_id>")
def client_gallery(special_id):
    """
    Fetches the lightweight client shell (name, event tabs) from MongoDB.
    The heavy Google Drive image data is fetched asynchronously via JS.
    """
    special_id_clean = special_id.strip().upper()
    db = get_db()
    
    client_data = db.clients.find_one({"special_id": special_id_clean})
    
    if not client_data:
        # If someone types a random ID in the URL, send them back to the landing page
        return redirect(url_for('landing.index'))
        
    return render_template("gallery.html", client=client_data, special_id=special_id_clean)
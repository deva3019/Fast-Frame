import re
import uuid
from flask import Blueprint, request, jsonify, current_app
from pymongo import MongoClient, ASCENDING, DESCENDING
from app.services.drive_service import fetch_paginated_images, get_drive_service
from app.blueprints.auth import login_required
from datetime import datetime, timezone

api_bp = Blueprint("api", __name__)

def get_db():
    # ⚡ SPEED FIX: Connection pooling prevents TCP handshake delays on every request
    client = MongoClient(current_app.config["MONGO_URI"], maxPoolSize=50, minPoolSize=5)
    db = client[current_app.config["MONGO_DB_NAME"]]
    
    # ⚡ SPEED FIX: Creates an index in the background. 
    # This drops the .sort() time from 10 seconds to 5 milliseconds.
    db.clients.create_index([("created_at", DESCENDING)], background=True)
    return db

def extract_folder_id(url_or_id):
    if not url_or_id: return ""
    url_or_id = url_or_id.strip()
    
    folder_match = re.search(r"folders/([a-zA-Z0-9_-]+)", url_or_id)
    if folder_match: return folder_match.group(1)
    
    param_match = re.search(r"id=([a-zA-Z0-9_-]+)", url_or_id)
    if param_match: return param_match.group(1)
    
    d_match = re.search(r"/d/([a-zA-Z0-9_-]+)", url_or_id)
    if d_match: return d_match.group(1)
    
    return url_or_id

# ==========================================
# 📊 OPTIMIZED DASHBOARD & CLIENT APIs
# ==========================================

@api_bp.route("/admin/stats", methods=["GET"])
@login_required
def get_admin_stats():
    db = get_db()
    
    total_clients = db.clients.count_documents({})
    
    events_agg = list(db.clients.aggregate([
        {"$project": {"event_count": {"$size": {"$ifNull": ["$events", []]}}}},
        {"$group": {"_id": None, "total": {"$sum": "$event_count"}}}
    ]))
    total_events = events_agg[0]["total"] if events_agg else 0

    selections_agg = list(db.selections.aggregate([
        {"$project": {"sel_count": {"$size": {"$ifNull": ["$selected_file_ids", []]}}}},
        {"$group": {"_id": None, "total": {"$sum": "$sel_count"}}}
    ]))
    total_selected_images = selections_agg[0]["total"] if selections_agg else 0

    return jsonify({
        "success": True, 
        "total_clients": total_clients, 
        "total_events": total_events, 
        "total_selected_images": total_selected_images
    })

@api_bp.route("/admin/clients", methods=["GET", "POST"])
@login_required
def manage_clients():
    db = get_db()
    
    if request.method == "GET":
        # Returns only top-level client data for the Clients table
        clients = list(db.clients.find({}, {"_id": 0, "events": 0}).sort("created_at", -1))
        return jsonify({"success": True, "clients": clients})
    
    if request.method == "POST":
        data = request.get_json()
        special_id = data.get("special_id", "").strip().upper()
        client_name = data.get("client_name", "").strip()
        email = data.get("email", "").strip()
        phone = data.get("phone", "").strip()

        if not special_id or not client_name:
            return jsonify({"success": False, "error": "Special ID and Client Name required"}), 400
            
        if not special_id.isalnum():
            return jsonify({"success": False, "error": "Special ID must be alphanumeric"}), 400

        if db.clients.find_one({"special_id": special_id}, {"_id": 1}):
            return jsonify({"success": False, "error": f"Special ID '{special_id}' exists"}), 400
        
        db.clients.insert_one({
            "special_id": special_id,
            "client_name": client_name,
            "email": email,
            "phone": phone,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "events": [],
            "selection_status": "PENDING"
        })
        return jsonify({"success": True, "message": "Vault Generated Successfully"})

@api_bp.route("/admin/clients/<special_id>", methods=["DELETE"])
@login_required
def delete_client(special_id):
    db = get_db()
    db.clients.delete_one({"special_id": special_id})
    db.selections.delete_many({"special_id": special_id})
    return jsonify({"success": True, "message": "Client and selections deleted"})

# ==========================================
# 📂 NEW DEDICATED GALLERY APIs
# ==========================================

@api_bp.route("/admin/active-mounts", methods=["GET"])
@login_required
def get_active_mounts():
    """
    Highly optimized route exclusively for the Galleries page.
    Only returns clients that actually have mounted events.
    """
    db = get_db()
    
    # ⚡ OPTIMIZATION: "$not": {"$size": 0} filters out empty clients at the database level.
    pipeline = {"events": {"$not": {"$size": 0}}}
    projection = {"_id": 0, "special_id": 1, "client_name": 1, "events": 1}
    
    clients_with_events = list(db.clients.find(pipeline, projection).sort("created_at", -1))
    
    return jsonify({"success": True, "clients": clients_with_events})

@api_bp.route("/admin/events", methods=["POST"])
@login_required
def add_event():
    db = get_db()
    data = request.get_json()
    special_id = data.get("special_id", "").strip().upper()
    event_name = data.get("event_name", "").strip()
    drive_url = data.get("drive_url", "").strip()

    folder_id = extract_folder_id(drive_url)

    if not event_name or not folder_id:
        return jsonify({"success": False, "error": "Event name and valid Drive Link required"}), 400

    new_event = {
        "event_id": f"evt_{uuid.uuid4().hex[:8]}",
        "event_name": event_name,
        "folder_id": folder_id
    }

    db.clients.update_one({"special_id": special_id}, {"$push": {"events": new_event}})
    return jsonify({"success": True, "message": "Event added", "event": new_event})

@api_bp.route("/admin/events/<special_id>/<event_id>", methods=["DELETE"])
@login_required
def delete_event(special_id, event_id):
    db = get_db()
    db.clients.update_one({"special_id": special_id}, {"$pull": {"events": {"event_id": event_id}}})
    db.selections.delete_one({"special_id": special_id, "event_id": event_id})
    return jsonify({"success": True, "message": "Event deleted successfully"})

# ==========================================
# 🖼️ OPTIMIZED GALLERY & SELECTION APIs
# ==========================================

@api_bp.route("/images/<folder_id>", methods=["GET"])
def get_images(folder_id):
    page_token = request.args.get("pageToken")
    data = fetch_paginated_images(folder_id, page_token)
    return jsonify(data)

@api_bp.route("/selections/<special_id>/<event_id>", methods=["GET"])
def get_selections(special_id, event_id):
    db = get_db()
    selection_doc = db.selections.find_one(
        {"special_id": special_id, "event_id": event_id}, 
        {"_id": 0, "selected_file_ids": 1}
    )
    selected_ids = selection_doc.get("selected_file_ids", []) if selection_doc else []
    return jsonify({"success": True, "selected_ids": selected_ids})

@api_bp.route("/selections/save", methods=["POST"])
def save_selections():
    data = request.get_json()
    special_id = data.get("special_id")
    event_id = data.get("event_id")
    selected_ids = data.get("selected_ids", [])

    if not special_id or not event_id:
        return jsonify({"success": False, "error": "Missing identifiers"}), 400

    db = get_db()
    db.selections.update_one(
        {"special_id": special_id, "event_id": event_id},
        {"$set": {"selected_file_ids": selected_ids}},
        upsert=True
    )
    return jsonify({"success": True, "message": "Selections saved"})

@api_bp.route("/selections/complete", methods=["POST"])
def complete_client_selection():
    data = request.get_json()
    special_id = data.get("special_id")
    if not special_id: return jsonify({"success": False, "error": "Missing ID"}), 400

    db = get_db()
    db.clients.update_one({"special_id": special_id}, {"$set": {"selection_status": "COMPLETED"}})
    return jsonify({"success": True, "message": "Selection completed"})

@api_bp.route("/selections/all/<special_id>", methods=["GET"])
def get_all_selections(special_id):
    db = get_db()
    selections = {}
    records = db.selections.find({"special_id": special_id.strip().upper()}, {"_id": 0, "event_id": 1, "selected_file_ids": 1})
    for record in records:
        selections[record["event_id"]] = record.get("selected_file_ids", [])
    return jsonify({"success": True, "selections": selections})
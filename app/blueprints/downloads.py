import re
from flask import Blueprint, current_app, request, jsonify
from pymongo import MongoClient
from app.services.drive_service import get_drive_service
from googleapiclient.errors import HttpError
from app.blueprints.auth import login_required

downloads_bp = Blueprint("downloads", __name__)

def get_db():
    client = MongoClient(current_app.config["MONGO_URI"])
    return client[current_app.config["MONGO_DB_NAME"]]

def create_drive_folder(service, folder_name, parent_id=None):
    """Creates a folder in Google Drive and returns its ID."""
    file_metadata = {
        'name': folder_name,
        'mimeType': 'application/vnd.google-apps.folder'
    }
    if parent_id:
        file_metadata['parents'] = [parent_id]
        
    folder = service.files().create(body=file_metadata, fields='id, webViewLink').execute()
    return folder

def batch_callback(request_id, response, exception):
    """Callback for batch requests to catch isolated file errors."""
    if exception:
        print(f"[Drive Batch Error] Failed to create shortcut: {exception}")

def extract_target_id(url_or_id):
    """Slices the raw Google Drive Folder ID out of any pasted link."""
    if not url_or_id:
        return ""
    url_or_id = url_or_id.strip()
    
    folder_match = re.search(r"folders/([a-zA-Z0-9_-]+)", url_or_id)
    if folder_match: return folder_match.group(1)
    
    param_match = re.search(r"id=([a-zA-Z0-9_-]+)", url_or_id)
    if param_match: return param_match.group(1)
    
    d_match = re.search(r"/d/([a-zA-Z0-9_-]+)", url_or_id)
    if d_match: return d_match.group(1)
    
    return url_or_id


@downloads_bp.route("/zip/<special_id>", methods=["POST"])
@login_required
def sync_to_drive(special_id):
    """Clones selected client images into a specified Google Drive folder."""
    special_id_clean = special_id.strip().upper()
    data = request.get_json()
    
    # NEW: Automatically clean the pasted URL to get just the ID
    raw_target_url = data.get("target_folder_id", "")
    target_folder_id = extract_target_id(raw_target_url)
    
    if not target_folder_id:
        return jsonify({"success": False, "error": "Destination folder link/ID is required."}), 400

    db = get_db()
    client = db.clients.find_one({"special_id": special_id_clean})
    if not client:
        return jsonify({"success": False, "error": "Client not found."}), 404

    selections = list(db.selections.find({"special_id": special_id_clean}))
    if not selections:
        return jsonify({"success": False, "error": "No photos have been selected yet."}), 400

    drive_service = get_drive_service()
    if not drive_service:
        return jsonify({"success": False, "error": "Google Drive integration error. Please check Settings."}), 500

    # Pre-fetch original filenames
    file_names_map = {}
    event_map = {}
    
    for event in client.get("events", []):
        event_id = event["event_id"]
        event_map[event_id] = event["event_name"]
        folder_id = event.get("folder_id")
        
        if not folder_id:
            continue
            
        page_token = None
        while True:
            try:
                results = drive_service.files().list(
                    q=f"'{folder_id}' in parents and trashed = false",
                    fields="nextPageToken, files(id, name)",
                    pageSize=1000,
                    pageToken=page_token
                ).execute()
                
                for f in results.get('files', []):
                    file_names_map[f['id']] = f['name']
                
                page_token = results.get('nextPageToken')
                if not page_token:
                    break
            except HttpError as e:
                print(f"Error fetching names for folder {folder_id}: {e}")
                break

    # Create Root "Final Selections" Folder
    root_folder_name = f"{client['client_name'].replace(' ', '_')} - Final Selections"
    try:
        root_folder = create_drive_folder(drive_service, root_folder_name, parent_id=target_folder_id)
        root_folder_id = root_folder['id']
        root_folder_link = root_folder['webViewLink']
    except Exception as e:
        print(f"Drive Creation Error: {e}")
        return jsonify({"success": False, "error": "Failed to create root folder in Google Drive. Check permissions."}), 500

    # Create Subfolders and Execute BATCH Copy (Shortcuts)
    for sel in selections:
        event_name = event_map.get(sel["event_id"], "Other")
        file_ids = sel.get("selected_file_ids", [])
        
        if not file_ids:
            continue
            
        subfolder = create_drive_folder(drive_service, event_name, parent_id=root_folder_id)
        subfolder_id = subfolder['id']
        
        batch = drive_service.new_batch_http_request(callback=batch_callback)
        request_count = 0
        
        for file_id in file_ids:
            file_name = file_names_map.get(file_id, f"{file_id}.jpg")
            
            body = {
                'name': file_name,
                'mimeType': 'application/vnd.google-apps.shortcut',
                'shortcutDetails': {
                    'targetId': file_id
                },
                'parents': [subfolder_id]
            }
            
            batch.add(drive_service.files().create(body=body, fields='id'))
            request_count += 1
            
            # Google Drive API allows max 100 requests per batch
            if request_count % 100 == 0:
                batch.execute()
                batch = drive_service.new_batch_http_request(callback=batch_callback)
        
        if request_count % 100 != 0:
            batch.execute()

    return jsonify({"success": True, "message": "Files cloned successfully.", "link": root_folder_link})
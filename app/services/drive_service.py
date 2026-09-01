import os
import json
from google.oauth2 import service_account
from googleapiclient.discovery import build
from app import cache
from app.services.db_service import get_studio_credentials

def get_drive_service():
    """
    Initializes and returns the Google Drive API service.
    """
    scopes = ["https://www.googleapis.com/auth/drive.readonly"] # Downgraded scope for faster, safer read-only access
    credentials = None

    try:
        db_creds = get_studio_credentials()
        if db_creds:
            credentials = service_account.Credentials.from_service_account_info(db_creds, scopes=scopes)
        elif os.getenv("GOOGLE_CREDENTIALS_JSON"):
            env_json = json.loads(os.getenv("GOOGLE_CREDENTIALS_JSON"))
            credentials = service_account.Credentials.from_service_account_info(env_json, scopes=scopes)
        elif os.path.exists("credentials.json"):
            credentials = service_account.Credentials.from_service_account_file("credentials.json", scopes=scopes)

        if not credentials:
            return None

        # cache_discovery=False prevents memory leaks on server restarts
        return build("drive", "v3", credentials=credentials, cache_discovery=False)
    except Exception as e:
        print(f"[Drive Service] Authentication Error: {e}")
        return None

def test_drive_connection(creds_dict):
    """Validates raw credentials before saving them to the database."""
    scopes = ["https://www.googleapis.com/auth/drive.readonly"]
    try:
        credentials = service_account.Credentials.from_service_account_info(creds_dict, scopes=scopes)
        service = build("drive", "v3", credentials=credentials, cache_discovery=False)
        service.files().list(pageSize=1, fields="files(id)").execute()
        return True, "Connection successful"
    except Exception as e:
        return False, str(e)

@cache.memoize(timeout=1800)
def fetch_paginated_images(folder_id, page_token=None):
    """
    Fetches images utilizing Google's Edge CDN to bypass Drive API rate limits.
    Optimized for extremely low memory footprint.
    """
    service = get_drive_service()
    if not service:
        return {"images": [], "next_page_token": None, "error": "Drive service not configured"}

    try:
        query = f"'{folder_id}' in parents and mimeType contains 'image/' and trashed = false"
        
        # ⚡ OPTIMIZATION 1: Extreme Field Masking. 
        # Removed 'size' and 'createdTime' to reduce JSON payload size by ~40% per request.
        results = service.files().list(
            q=query,
            pageSize=100, # Increased batch size safely due to payload reduction
            pageToken=page_token,
            fields="nextPageToken, files(id, name, thumbnailLink)",
            orderBy="name"
        ).execute()

        files = results.get("files", [])
        next_page_token = results.get("nextPageToken")

        images = []
        for f in files:
            thumb_link = f.get("thumbnailLink", "")
            
            # ⚡ OPTIMIZATION 2: CDN Hijacking.
            # We strip the default scaling parameters and force Google's global Edge CDN
            # to serve both the thumbnail and the full-res image instantly.
            if thumb_link:
                base_url = thumb_link.split("=")[0]
                # =w600-h750-p: WebP format, cropped to 4/5 aspect ratio, highly compressed
                fast_thumbnail = f"{base_url}=w600-h750-p"
                # =s0: Original resolution, served via CDN (Bypasses /uc?id= rate limits!)
                fast_full = f"{base_url}=s0"
            else:
                # Fallback only if absolutely necessary
                fast_thumbnail = f"https://drive.google.com/uc?id={f['id']}"
                fast_full = fast_thumbnail

            images.append({
                "id": f["id"],
                "name": f["name"],
                "thumbnail": fast_thumbnail,
                "full": fast_full
            })

        return {"images": images, "next_page_token": next_page_token}
    except Exception as e:
        print(f"[Drive Service] API Fetch Error: {e}")
        return {"images": [], "next_page_token": None, "error": str(e)}
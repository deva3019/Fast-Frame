import os
import zipfile
import random
from PIL import Image, ImageDraw

def create_dummy_images(count=500, output_zip="dummy_photos.zip"):
    print(f"Generating {count} high-res dummy images (Simulating 500kb-1MB). Please wait...")
    os.makedirs("dummy_photos", exist_ok=True)
    
    with zipfile.ZipFile(output_zip, 'w') as zf:
        for i in range(1, count + 1):
            # Random dark background
            bg_color = (random.randint(15, 40), random.randint(15, 40), random.randint(15, 40))
            img = Image.new('RGB', (1200, 1800), color=bg_color) # Slightly larger dimensions
            d = ImageDraw.Draw(img)
            
            # Draw random geometric lines to add visual complexity (this bloats the file size realistically)
            for _ in range(400):
                x1, y1 = random.randint(0, 1200), random.randint(0, 1800)
                x2, y2 = random.randint(0, 1200), random.randint(0, 1800)
                line_color = (random.randint(50, 200), random.randint(50, 200), random.randint(50, 200))
                d.line([(x1, y1), (x2, y2)], fill=line_color, width=3)
            
            # Draw the FastFrame branding box
            text_color = (255, 255, 255)
            d.rectangle([(100, 100), (1100, 1700)], outline=text_color, width=8)
            
            # Draw text (if you have a TTF font, you can load it, otherwise this uses default)
            d.text((500, 850), f"FF FRAME {i:04d}", fill=text_color, align="center")
            
            filename = f"dummy_photos/FF_TEST_{i:04d}.jpg"
            
            # Save at high quality to hit that 500kb+ target
            img.save(filename, format="JPEG", quality=95, subsampling=0)
            
            # Add to zip
            zf.write(filename, os.path.basename(filename))
            
            if i % 50 == 0:
                print(f"Processed {i}/{count} images...")
            
    print(f"✅ Done! {output_zip} is ready to be uploaded to Google Drive.")

if __name__ == "__main__":
    create_dummy_images(500)
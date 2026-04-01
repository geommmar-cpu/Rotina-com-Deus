import os
from PIL import Image

def convert_to_webp(source_path):
    try:
        target_path = os.path.splitext(source_path)[0] + ".webp"
        with Image.open(source_path) as img:
            # Resize if it's too large (over 1600px wide)
            if img.width > 1600:
                new_width = 1600
                new_height = int((new_width / img.width) * img.height)
                img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            
            img.save(target_path, "WEBP", quality=85)
            print(f"Converted {source_path} to {target_path}")
            return target_path
    except Exception as e:
        print(f"Error converting {source_path}: {e}")
        return None

images_to_convert = [
    "public/mockups/mockup-terco.png",
    "public/logo2.png",
    "public/mockups/mockup-audio-ia.png",
    "public/hero-premium.png",
    "public/mockups/mockup-biblia-365.png"
]

for img_path in images_to_convert:
    if os.path.exists(img_path):
        convert_to_webp(img_path)
    else:
        print(f"File not found: {img_path}")

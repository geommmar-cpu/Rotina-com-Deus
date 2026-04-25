import os
from PIL import Image

def optimize_image(source_path, target_width=None, quality=80):
    try:
        target_path = os.path.splitext(source_path)[0] + ".webp"
        with Image.open(source_path) as img:
            # Convert to RGB if necessary (for PNG with alpha, WebP supports alpha but sometimes we want to flatten)
            # Actually WebP is fine with RGBA.
            
            if target_width and img.width > target_width:
                new_width = target_width
                new_height = int((new_width / img.width) * img.height)
                img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            
            img.save(target_path, "WEBP", quality=quality, method=6) # method 6 is slowest/best compression
            print(f"Optimized: {source_path} -> {target_path} ({img.width}x{img.height})")
            return target_path
    except Exception as e:
        print(f"Error {source_path}: {e}")
        return None

# Directories to process
dirs_config = {
    "public/testimonials": {"width": 120, "quality": 75},
    "public/mockups": {"width": 1000, "quality": 80},
    "public": {"width": 1200, "quality": 85} # Default for root
}

for folder, config in dirs_config.items():
    if not os.path.exists(folder):
        continue
    
    for filename in os.listdir(folder):
        if filename.lower().endswith((".png", ".jpg", ".jpeg")):
            # Skip if it's already a specialized webp we want to keep
            file_path = os.path.join(folder, filename)
            optimize_image(file_path, target_width=config["width"], quality=config["quality"])

print("\n--- Otimização concluída! ---")

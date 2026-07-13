"""Convert a PNG to ICO using Pillow (or fall back to dummy ICO)."""
import sys, os

def convert(src, dst):
    try:
        from PIL import Image
        img = Image.open(src).convert("RGBA")
        img.save(dst, format="ICO", sizes=[(16,16),(32,32),(48,48),(256,256)])
        print(f"ICO created: {dst}")
    except ImportError:
        print("Pillow not available — skipping ICO conversion.")
    except Exception as e:
        print(f"ICO conversion error: {e}")

if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv)>1 else "logo.png"
    dst = sys.argv[2] if len(sys.argv)>2 else "logo.ico"
    convert(src, dst)

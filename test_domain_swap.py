"""
Quick test: does swapping images-na.ssl-images-amazon.com for
m.media-amazon.com fix the broken/placeholder images?

Run from C:\\clearpick:
    python test_domain_swap.py
"""

import csv
import io
import requests
from PIL import Image

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}


def get_dims(url):
    try:
        resp = requests.get(url, headers=HEADERS, timeout=12)
        if resp.status_code != 200:
            return f"HTTP {resp.status_code}"
        if "image" not in resp.headers.get("Content-Type", ""):
            return "NOT IMAGE"
        img = Image.open(io.BytesIO(resp.content))
        return f"{img.size[0]}x{img.size[1]}"
    except Exception as e:
        return f"ERROR: {type(e).__name__}"


def main():
    # Read the broken ones from image_report.csv
    broken = []
    with open("image_report.csv", "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row["flag"] != "OK":
                broken.append(row)

    print(f"Testing domain swap on {len(broken)} broken images...\n")

    fixed_count = 0
    for row in broken:
        old_url = row["image_url"]
        new_url = old_url.replace(
            "images-na.ssl-images-amazon.com", "m.media-amazon.com"
        )
        old_dims = get_dims(old_url)
        new_dims = get_dims(new_url)

        is_fixed = "x" in new_dims and not new_dims.startswith("1x1")
        if is_fixed:
            fixed_count += 1

        print(f"{row['name']}")
        print(f"  old ({old_dims}): {old_url}")
        print(f"  new ({new_dims}): {new_url}")
        print(f"  {'FIXED' if is_fixed else 'still broken'}\n")

    print(f"\n{'='*50}")
    print(f"RESULT: {fixed_count}/{len(broken)} fixed by domain swap")
    print(f"{'='*50}")


if __name__ == "__main__":
    main()

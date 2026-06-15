"""
ClearPick Image Health Checker
--------------------------------
Reads products.json and checks every product's image URL:
  - Does it return a successful response (200)?
  - Is the content actually an image?
  - Is it suspiciously tiny (likely a broken/placeholder image)?

Run this from the root of your project (where products.json lives):

    pip install requests pillow
    python check_product_images.py

Output: prints a summary to the console AND writes a CSV report
(image_report.csv) listing every product with its status, so you
can quickly find which ones need a fixed image URL.
"""

import json
import csv
import io
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from PIL import Image

PRODUCTS_JSON_PATH = "products.json"
OUTPUT_CSV = "image_report.csv"
MAX_WORKERS = 16
MIN_DIMENSION = 50  # px - anything smaller is almost certainly a placeholder/broken image
TIMEOUT = 12

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}


def check_one(product):
    """Check a single product's image URL. Returns a result dict."""
    pid = product.get("id", "")
    name = product.get("name", "")
    url = product.get("image", "")
    page = product.get("page", "")

    result = {
        "id": pid,
        "name": name,
        "page": page,
        "image_url": url,
        "status": "",
        "content_type": "",
        "width": "",
        "height": "",
        "flag": "",
    }

    if not url:
        result["status"] = "MISSING"
        result["flag"] = "NO IMAGE URL"
        return result

    try:
        resp = requests.get(url, headers=HEADERS, timeout=TIMEOUT, stream=True)
        result["status"] = resp.status_code
        ctype = resp.headers.get("Content-Type", "")
        result["content_type"] = ctype

        if resp.status_code != 200:
            result["flag"] = f"HTTP {resp.status_code}"
            return result

        if "image" not in ctype:
            result["flag"] = "NOT AN IMAGE (wrong content-type)"
            return result

        # Read content to check actual dimensions
        content = resp.content
        try:
            img = Image.open(io.BytesIO(content))
            w, h = img.size
            result["width"] = w
            result["height"] = h

            if w < MIN_DIMENSION or h < MIN_DIMENSION:
                result["flag"] = f"TINY IMAGE ({w}x{h}) - likely placeholder"
            elif len(content) < 1000:
                result["flag"] = "VERY SMALL FILE - check manually"
            else:
                result["flag"] = "OK"
        except Exception as e:
            result["flag"] = f"UNREADABLE IMAGE DATA ({e})"

    except requests.exceptions.RequestException as e:
        result["status"] = "ERROR"
        result["flag"] = f"REQUEST FAILED ({type(e).__name__})"

    return result


def main():
    with open(PRODUCTS_JSON_PATH, "r", encoding="utf-8") as f:
        products = json.load(f)

    if isinstance(products, dict):
        # handle case where products.json is {"products": [...]}
        products = products.get("products", list(products.values()))

    print(f"Checking {len(products)} product images with {MAX_WORKERS} workers...\n")

    results = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(check_one, p): p for p in products}
        done = 0
        for future in as_completed(futures):
            results.append(future.result())
            done += 1
            if done % 25 == 0 or done == len(products):
                print(f"  ...checked {done}/{len(products)}")

    # Sort: problems first
    results.sort(key=lambda r: (r["flag"] == "OK", r["id"]))

    ok_count = sum(1 for r in results if r["flag"] == "OK")
    problem_results = [r for r in results if r["flag"] != "OK"]

    print(f"\n{'='*60}")
    print(f"DONE: {ok_count} OK, {len(problem_results)} need attention")
    print(f"{'='*60}\n")

    if problem_results:
        print("Products needing attention:\n")
        for r in problem_results:
            print(f"  [{r['flag']}]")
            print(f"    {r['name']}  ({r['id']})")
            print(f"    page: {r['page']}")
            print(f"    image: {r['image_url']}")
            print()

    # Write CSV
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["id", "name", "page", "image_url", "status", "content_type", "width", "height", "flag"],
        )
        writer.writeheader()
        for r in results:
            writer.writerow(r)

    print(f"Full report written to {OUTPUT_CSV}")


if __name__ == "__main__":
    main()

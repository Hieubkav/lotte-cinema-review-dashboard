import json
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / "tmp-official-places.json"
out_yaml = ROOT / "seed-official-businesses.yaml"
out_txt = ROOT / "seed-official-urls.txt"

data = json.loads(source.read_text(encoding="utf-8"))
rows = data.get("data", [])

yaml_lines = [
    "# Generated from https://online-reputation-management-system.vercel.app/api/places/official",
    f"# Total businesses: {len(rows)}",
    "businesses:",
]
url_lines = []

for row in rows:
    place_id = row.get("placeId", "")
    name = row.get("name", "")
    query = quote(name)
    url = f"https://www.google.com/maps/search/?api=1&query={query}&query_place_id={place_id}"
    yaml_lines.append(f"  - url: \"{url}\"")
    yaml_lines.append("    custom_params:")
    yaml_lines.append(f"      placeId: \"{place_id}\"")
    yaml_lines.append(f"      company: \"{name.replace(chr(34), '\\"')}\"")
    yaml_lines.append("      source: \"official-api\"")
    url_lines.append(url)

out_yaml.write_text("\n".join(yaml_lines) + "\n", encoding="utf-8")
out_txt.write_text("\n".join(url_lines) + "\n", encoding="utf-8")

print(f"Generated: {out_yaml}")
print(f"Generated: {out_txt}")
print(f"Total: {len(rows)}")

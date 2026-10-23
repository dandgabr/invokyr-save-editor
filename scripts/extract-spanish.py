"""Add official Spanish I2 strings to schema-items.json from the verified game's resources.assets.

Run with: uv run --with UnityPy python scripts/extract-spanish.py /path/to/Invokyr_Data/resources.assets
The script verifies English and Brazilian Portuguese against the existing export before writing.
"""
import json
import struct
import sys
from pathlib import Path

import UnityPy

source = Path(sys.argv[1])
target = Path(__file__).resolve().parents[1] / "docs/schema-items.json"
data = json.loads(target.read_text())
if data["meta"]["gameBuild"] != "26154962":
    raise SystemExit("Game build differs from the verified export")
obj = next(o for o in UnityPy.load(str(source)).objects if o.path_id == 1510)
raw = obj.get_raw_data()


def term_strings(term: str) -> list[str] | None:
    needle = term.encode("utf-8")
    start = raw.find(needle)
    if start < 0:
        return None
    pos = (start + len(needle) + 3) & ~3
    _, count = struct.unpack_from("<II", raw, pos)
    if count != 13:
        raise ValueError(f"Unexpected language count for {term}: {count}")
    pos += 8
    values = []
    for _ in range(count):
        length = struct.unpack_from("<I", raw, pos)[0]
        pos += 4
        values.append(raw[pos : pos + length].decode("utf-8"))
        pos = (pos + length + 3) & ~3
    return values


added = 0
for item in data["items"]:
    for field in ("name", "desc"):
        value = item.get(field)
        if not isinstance(value, dict) or not value.get("term") or value["term"] == "-":
            continue
        texts = term_strings(value["term"])
        if texts is None:
            continue
        for code, index in (("en", 0), ("pt-BR", 2)):
            if value.get(code) and value[code] != texts[index]:
                raise ValueError(f"Existing {code} differs for {value['term']}")
        if texts[4]:
            value["es-419"] = texts[4]
            added += 1

data["meta"]["note"] = (
    "Todos os campos vêm de typetree UnityPy (bundles Addressables 26154962). "
    "Strings en/pt-BR/es-419 vêm de I2Languages (resources.assets, PathID 1510), "
    "idiomas índices 0/2/4; Spanish do jogo é usado como es-419 no editor."
)
target.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
print(f"Added {added} Spanish names/descriptions")

"""Bundle readable page sources and the lunar texture into a single Worker."""

import base64
import json
import subprocess
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
TEXTURE_URL = "https://www.solarsystemscope.com/textures/download/2k_moon.jpg"


def load_lunar_texture():
    """Download the attributed texture once and validate its JPEG signature."""
    texture_path = PROJECT_ROOT / ".cache/moon.jpg"
    texture_path.parent.mkdir(exist_ok=True)

    if not texture_path.exists():
        subprocess.run(
            [
                "curl", "--fail", "--location", "--max-time", "60",
                "--output", str(texture_path), TEXTURE_URL,
            ],
            check=True,
        )

    texture = texture_path.read_bytes()
    if not texture.startswith(b"\xff\xd8"):
        raise ValueError("Expected a JPEG lunar texture")
    return base64.b64encode(texture).decode("ascii")


def bundle_page():
    """Embed page assets in their original execution order for Worker hosting."""
    source_directory = PROJECT_ROOT / "src"
    html = (source_directory / "index.html").read_text(encoding="utf-8")
    stylesheet = (source_directory / "styles.css").read_text(encoding="utf-8")
    html = html.replace(
        '<link rel="stylesheet" href="styles.css" />',
        f"<style>\n{stylesheet}\n</style>",
    )

    for filename in ["app.js", "mission-model.js", "recommendations.js", "flight-model.js", "flight.js", "planning-model.js", "planning.js", "interface.js", "route-model.js", "terrain-model.js", "route.js", "terrain.js"]:
        script = (source_directory / filename).read_text(encoding="utf-8")
        html = html.replace(
            f'<script src="{filename}"></script>',
            f"<script>\n{script}\n</script>",
        )
    return html


def main():
    template = (PROJECT_ROOT / "src/worker.template.mjs").read_text(encoding="utf-8")
    worker = template.replace("__HTML__", json.dumps(bundle_page())).replace(
        "__IMG__", json.dumps(load_lunar_texture())
    )
    assets = {"/assets/" + asset.name: base64.b64encode(asset.read_bytes()).decode("ascii") for asset in (PROJECT_ROOT / "src/assets").glob("*.jpg")}
    worker = worker.replace("__ASSETS__", json.dumps(assets))
    terrain_service = (PROJECT_ROOT / "src/terrain-service.mjs").read_text(encoding="utf-8")
    terrain_service = terrain_service.replace("export const ", "const ").replace("export function ", "function ").replace("export async function ", "async function ")
    worker = worker.replace("__TERRAIN_SERVICE__", terrain_service)
    horizons_client = (PROJECT_ROOT / "src/horizons-client.mjs").read_text(encoding="utf-8")
    horizons_client = horizons_client.replace("export const ", "const ").replace("export function ", "function ")
    worker = worker.replace("__HORIZONS_CLIENT__", horizons_client)
    output_path = PROJECT_ROOT / "dist/server/index.mjs"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(worker, encoding="utf-8")
    print("Built", output_path)


if __name__ == "__main__":
    main()

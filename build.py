from pathlib import Path
import base64,json,subprocess
p=Path(__file__).resolve().parent
asset=p/".cache/moon.jpg"
asset.parent.mkdir(exist_ok=True)
if not asset.exists():
    subprocess.run(["curl","--fail","--location","--max-time","60","--output",str(asset),"https://www.solarsystemscope.com/textures/download/2k_moon.jpg"],check=True)
if not asset.read_bytes().startswith(b"\xff\xd8"):
    raise ValueError("Expected a JPEG lunar texture")
html=(p/"src/index.html").read_text()
image=base64.b64encode(asset.read_bytes()).decode()
worker=(p/"src/worker.template.mjs").read_text().replace("__HTML__",json.dumps(html)).replace("__IMG__",json.dumps(image))
out=p/"dist/server/index.mjs"
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(worker)
print("Built",out)

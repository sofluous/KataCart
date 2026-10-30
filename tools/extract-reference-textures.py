"""Extract original-resolution PNG textures. Requires Pillow and psd-tools."""
import json
from pathlib import Path
from PIL import Image, ImageDraw
from psd_tools import PSDImage

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'textures' / 'reference'

# Half-open pixel bounds follow PSD panel edges; no resizing is applied.
SHEETS = [
    ('gamecube', 'GC/Gamecube Template - Shenske.png', 'gamecube-case', 'ready', (0, 1543, 1700, 3256), (0, 2156)),
    ('ps2-ketaros', 'PS2/PS2 Template - Ketaros.psd', 'ps2-case', 'ready', (0, 1526, 1696, 3225), (0, 2156)),
    ('ps2-juanky', 'PS2/template_playstation_2_cover_by_juanky_d3cdvp8.png', 'ps2-case', 'ready', (121, 1039, 1100, 2009), (99, 1382)),
    ('ps1-shenske', 'PS1/PS1 Template - Shenske.psd', 'ps1-jewel', 'review: tall layout does not match jewel-case proportions', (0, 1527, 1696, 3225), (0, 2156)),
    ('psp-retail', 'PSP/PSP Template - Shenske.png', None, 'requires retail-case model; incompatible with psp-umd shell', (0, 1150, 1315, 2465), (0, 1980)),
]

def extract():
    manifest = []
    for name, relative, model, status, edges, vertical in SHEETS:
        source = ROOT / '_reference' / relative
        image = (PSDImage.open(source).topil() if source.suffix == '.psd' else Image.open(source)).convert('RGBA')
        folder = OUT / name
        folder.mkdir(exist_ok=True)
        faces = {}
        left, back_end, spine_end, right = edges
        top, bottom = vertical
        for face, bounds in {
            'cover_back': (left, top, back_end, bottom),
            'spine': (back_end, top, spine_end, bottom),
            'cover_front': (spine_end, top, right, bottom),
        }.items():
            texture = image.crop(bounds)
            destination = folder / (face + '.png')
            texture.save(destination)
            with Image.open(destination) as check:
                check.verify()
            faces[face] = {'path': destination.relative_to(ROOT).as_posix(), 'crop': list(bounds), 'size': list(texture.size)}
        manifest.append({'name': name, 'source': source.relative_to(ROOT).as_posix(), 'model': model, 'status': status, 'faces': faces})
    # Keep case scans separate from cover sheets; they include plastic and branding.
    extras = [
        ('disc/disc_art.png', 'Disc/pngimg.com - compact_disc_PNG102166.png', None),
        ('ps1-case/cover_front.png', 'PS1/NicePng_empty-box-png_2874227.png', None),
        ('ps1-case/cover_back.png', 'PS1/pngkey.com-ps1-logo-png-3460985.png', (0, 0, 278, 247)),
        ('ps1-case/spine.png', 'PS1/pngkey.com-ps1-logo-png-3460985.png', (296, 0, 324, 247)),
        ('ps1-case/cover_front-alternate.png', 'PS1/pngkey.com-ps1-logo-png-3460985.png', (343, 0, 620, 247)),
    ]
    for destination, relative, bounds in extras:
        image = Image.open(ROOT / '_reference' / relative).convert('RGBA')
        if bounds:
            image = image.crop(bounds)
        target = OUT / destination
        target.parent.mkdir(exist_ok=True)
        image.save(target)
        manifest.append({'path': target.relative_to(ROOT).as_posix(), 'source': '_reference/' + relative, 'crop': bounds, 'size': list(image.size), 'status': 'reference: case scan or disc underside; not auto-assigned'})
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print('Exported', len(SHEETS)*3 + len(extras), 'PNG textures; originals untouched.')

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    inventory, tiles = [], []
    for source in sorted((ROOT / '_reference').rglob('*')):
        if source.suffix.lower() not in {'.png', '.psd'}:
            continue
        entry = {'source': source.relative_to(ROOT).as_posix()}
        if source.suffix.lower() == '.psd':
            psd = PSDImage.open(source)
            image = psd.topil().convert('RGBA')
            entry['layers'] = [{'name': l.name, 'bounds': list(l.bbox), 'visible': l.is_visible()} for l in psd.descendants()]
        else:
            image = Image.open(source).convert('RGBA')
        entry['size'] = list(image.size)
        inventory.append(entry)
        thumb = image.copy()
        thumb.thumbnail((480, 330))
        tile = Image.new('RGB', (500, 380), '#b0b0b0')
        tile.paste(thumb, ((500-thumb.width)//2, 30), thumb)
        ImageDraw.Draw(tile).text((8, 8), source.parent.name + '/' + source.name, fill='black')
        tiles.append(tile)
    sheet = Image.new('RGB', (1500, 380*((len(tiles)+2)//3)), 'white')
    for i, tile in enumerate(tiles):
        sheet.paste(tile, ((i%3)*500, (i//3)*380))
    sheet.save(OUT / 'contact-sheet.jpg')
    (OUT / 'inventory.json').write_text(json.dumps(inventory, indent=2), encoding='utf-8')
    extract()

if __name__ == '__main__':
    main()

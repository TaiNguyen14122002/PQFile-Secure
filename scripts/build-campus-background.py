#!/usr/bin/env python3
"""Build the visual-only high-resolution campus background for PQFile Secure.

Usage: python3 scripts/build-campus-background.py path/to/original.png
Optional development dependency: python3 -m pip install Pillow

The original photo contains 1172×701 genuine pixels. This script improves
perceived edge clarity and display scaling; it cannot recover lost detail.
"""
from __future__ import annotations

import argparse
from pathlib import Path

try:
    from PIL import Image, ImageEnhance, ImageFilter, ImageOps
except ImportError as exc:
    raise SystemExit('Thiếu Pillow. Chạy: python3 -m pip install Pillow') from exc


def main() -> None:
    parser = argparse.ArgumentParser(description='Tạo ảnh nền WebP sắc nét cho PQFile Secure')
    parser.add_argument('input', type=Path, help='Ảnh gốc do người dùng cung cấp (.png/.jpg)')
    parser.add_argument('--output', type=Path,
                        default=Path(__file__).resolve().parent.parent / 'apps/web/public/campus-background-hd.webp')
    parser.add_argument('--width', type=int, default=3000,
                        help='Chiều rộng xuất ảnh (mặc định: 3000px)')
    args = parser.parse_args()
    if args.width < 1172 or args.width > 6000:
        parser.error('--width phải nằm trong khoảng 1172–6000')
    if not args.input.is_file():
        parser.error(f'Không tìm thấy ảnh gốc: {args.input}')

    with Image.open(args.input) as source:
        image = ImageOps.exif_transpose(source).convert('RGB')
    image = ImageEnhance.Contrast(image).enhance(1.045)
    image = ImageEnhance.Color(image).enhance(1.035)
    # Enhance native edges before a smooth, high-quality enlargement.
    image = image.filter(ImageFilter.UnsharpMask(radius=1.1, percent=110, threshold=3))
    width = args.width
    height = round(image.height * width / image.width)
    image = image.resize((width, height), Image.Resampling.LANCZOS)
    image = image.filter(ImageFilter.UnsharpMask(radius=1.35, percent=105, threshold=2))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    image.save(args.output, format='WEBP', quality=87, method=6)
    print(f'Đã xuất {args.output} — {width}×{height}px, {args.output.stat().st_size / 1024:.0f} KB')


if __name__ == '__main__':
    main()

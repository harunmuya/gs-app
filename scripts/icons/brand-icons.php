<?php
/**
 * Regenerate the app's icons and logo from the website's own artwork.
 *
 * The app shipped a different mark entirely (a blue swoosh with stars) that
 * appears nowhere on the site. These are cut from gsm-mark-* and gsm-logo-*,
 * the files the site itself uses as its site icon and custom logo, so the
 * launcher icon, the PWA icon and the in-app logo are one identity.
 *
 *   php scripts/icons/brand-icons.php brand .
 */

function loadPng(string $path) {
    $im = imagecreatefrompng($path);
    if (!$im) { fwrite(STDERR, "cannot read $path\n"); exit(1); }
    imagealphablending($im, false);
    imagesavealpha($im, true);
    return $im;
}

/*
  The bounding box of the actual ink.

  Both source files sit in a large transparent margin, and gsm-mark-black also
  carries a stray speck a few hundred pixels below the monogram. Trimming on
  "any non-transparent pixel" takes that speck as the bottom of the artwork,
  which both shrinks the mark and pushes it off centre.

  Counting ink per row cannot separate the two: the orange wedge tapers to a
  point, so its last rows hold fewer pixels than the speck's do, and any
  threshold that drops the speck also clips the wedge. So the ink is split into
  connected components instead and the small ones are dropped — the speck is a
  thousandth of the monogram's area, while the letters of the wordmark are all
  within a few times each other.
*/
function inkBox($im): array {
    // Each source is rendered at several sizes; the scan is the expensive part.
    static $cache = [];
    $key = spl_object_id($im);
    if (isset($cache[$key])) return $cache[$key];

    $w = imagesx($im); $h = imagesy($im);

    // One byte per pixel rather than an array: these sources are 4M pixels.
    $mask = str_repeat("\0", $w * $h);
    for ($y = 0; $y < $h; $y++) {
        $row = $y * $w;
        for ($x = 0; $x < $w; $x++) {
            // GD alpha: 0 = opaque, 127 = fully transparent.
            if ((imagecolorat($im, $x, $y) >> 24 & 0x7F) < 64) $mask[$row + $x] = "\1";
        }
    }

    $seen = str_repeat("\0", $w * $h);
    $parts = [];

    for ($p = 0, $n = $w * $h; $p < $n; $p++) {
        if ($mask[$p] === "\0" || $seen[$p] === "\1") continue;

        $stack = [$p];
        $seen[$p] = "\1";
        $area = 0;
        $x0 = $x1 = $p % $w;
        $y0 = $y1 = intdiv($p, $w);

        while ($stack) {
            $q = array_pop($stack);
            $qx = $q % $w; $qy = intdiv($q, $w);
            $area++;
            if ($qx < $x0) $x0 = $qx; if ($qx > $x1) $x1 = $qx;
            if ($qy < $y0) $y0 = $qy; if ($qy > $y1) $y1 = $qy;

            foreach ([[1, 0], [-1, 0], [0, 1], [0, -1]] as [$dx, $dy]) {
                $nx = $qx + $dx; $ny = $qy + $dy;
                if ($nx < 0 || $ny < 0 || $nx >= $w || $ny >= $h) continue;
                $r = $ny * $w + $nx;
                if ($mask[$r] === "\1" && $seen[$r] === "\0") { $seen[$r] = "\1"; $stack[] = $r; }
            }
        }
        $parts[] = [$area, $x0, $y0, $x1, $y1];
    }

    if (!$parts) { fwrite(STDERR, "no ink found\n"); exit(1); }

    $largest = max(array_column($parts, 0));
    $x0 = $y0 = PHP_INT_MAX; $x1 = $y1 = -1;
    $kept = 0;
    foreach ($parts as [$area, $ax0, $ay0, $ax1, $ay1]) {
        if ($area < $largest * 0.02) continue;
        $kept++;
        $x0 = min($x0, $ax0); $y0 = min($y0, $ay0);
        $x1 = max($x1, $ax1); $y1 = max($y1, $ay1);
    }
    fprintf(STDERR, "    components %d, kept %d\n", count($parts), $kept);

    return $cache[$key] = [$x0, $y0, $x1 - $x0 + 1, $y1 - $y0 + 1];
}

/**
 * Draw the trimmed artwork centred on a canvas, scaled to $ratio of the canvas.
 * $bg is null for transparent, [r,g,b] for a flat ground, or ['circle',r,g,b]
 * for a filled disc on transparent — what Android's legacy round icon wants.
 */
function render($src, int $outW, int $outH, float $ratio, ?array $bg, string $out) {
    [$sx, $sy, $sw, $sh] = inkBox($src);

    $canvas = imagecreatetruecolor($outW, $outH);
    imagealphablending($canvas, false);
    imagesavealpha($canvas, true);

    $round = $bg !== null && $bg[0] === 'circle';
    imagefill($canvas, 0, 0, $bg === null || $round
        ? imagecolorallocatealpha($canvas, 0, 0, 0, 127)
        : imagecolorallocate($canvas, $bg[0], $bg[1], $bg[2]));

    if ($round) {
        imagealphablending($canvas, true);
        imageantialias($canvas, true);
        imagefilledellipse($canvas, intdiv($outW, 2), intdiv($outH, 2), $outW, $outH,
            imagecolorallocate($canvas, $bg[1], $bg[2], $bg[3]));
        imagealphablending($canvas, false);
    }

    $scale = min(($outW * $ratio) / $sw, ($outH * $ratio) / $sh);
    $dw = max(1, (int) round($sw * $scale));
    $dh = max(1, (int) round($sh * $scale));

    imagealphablending($canvas, true);
    imagecopyresampled($canvas, $src,
        (int) round(($outW - $dw) / 2), (int) round(($outH - $dh) / 2),
        $sx, $sy, $dw, $dh, $sw, $sh);
    imagealphablending($canvas, false);

    imagepng($canvas, $out, 9);
    imagedestroy($canvas);
    printf("%-30s %4dx%-4d  art %dx%d\n", basename($out), $outW, $outH, $dw, $dh);
}

[$srcDir, $outDir] = [rtrim($argv[1], '/'), rtrim($argv[2], '/')];
@mkdir($outDir, 0755, true);
@mkdir("$outDir/public/icons", 0755, true);

$markBlack = loadPng("$srcDir/gsm-mark-black.png");
$logoBlack = loadPng("$srcDir/gsm-logo-black.png");
$logoWhite = loadPng("$srcDir/gsm-logo-white.png");

/*
  Two sets of square icons, because one file cannot serve both jobs.

  A "maskable" icon is cropped by the launcher to whatever shape the phone
  uses, and only the middle 80% is guaranteed to survive, so that set is drawn
  at 0.68 and keeps its corners empty. The plain "any" set is never cropped,
  so drawing it at the same size would just look small; it goes to 0.86.

  White ground, not teal: the mark is black and orange on white everywhere on
  the site, and the manifest's background_color is already #ffffff.
*/
foreach ([192, 512] as $size) {
    render($markBlack, $size, $size, 0.86, [255, 255, 255], "$outDir/public/icons/icon-$size.png");
    render($markBlack, $size, $size, 0.68, [255, 255, 255], "$outDir/public/icons/icon-$size-maskable.png");
}
render($markBlack, 180, 180, 0.86, [255, 255, 255], "$outDir/public/apple-touch-icon.png");
render($markBlack, 500, 500, 0.86, [255, 255, 255], "$outDir/public/gs-icon.png");

/*
  The wordmark keeps a transparent ground so it can sit on any header, and
  comes in both inks: the app has a dark theme, and the black wordmark
  disappears on it.
*/
/**
 * The wordmark, cropped to the ink with no margin, at $height tall. A fixed
 * canvas would bake in padding and leave the component guessing at the aspect
 * ratio — which is how it came to assume 4.8 when the artwork is near 13.
 */
function renderTight($src, int $height, string $out) {
    [, , $sw, $sh] = inkBox($src);
    render($src, (int) round($height * $sw / $sh), $height, 1.0, null, $out);
}

renderTight($logoBlack, 56, "$outDir/public/gs-logo.png");
renderTight($logoWhite, 56, "$outDir/public/gs-logo-white.png");

/*
  Android's launcher icons.

  ic_launcher_foreground is the adaptive-icon layer: it sits on a 108dp canvas
  of which only the middle 72dp is always visible, the rest being what the
  launcher eats when it animates or masks the icon, so the art goes to 0.60 and
  the layer itself stays transparent — the white ground is the background layer,
  already declared as @color/ic_launcher_background (#FFFFFF).

  ic_launcher and ic_launcher_round are the pre-Oreo fallbacks and are masked
  by nothing, so they carry their own ground: a square for one, a disc for the
  other.
*/
$densities = [
    'mdpi' => [48, 108], 'hdpi' => [72, 162], 'xhdpi' => [96, 216],
    'xxhdpi' => [144, 324], 'xxxhdpi' => [192, 432],
];
foreach ($densities as $d => [$legacy, $fg]) {
    $dir = "$outDir/android/app/src/main/res/mipmap-$d";
    @mkdir($dir, 0755, true);
    render($markBlack, $legacy, $legacy, 0.80, [255, 255, 255], "$dir/ic_launcher.png");
    render($markBlack, $legacy, $legacy, 0.70, ['circle', 255, 255, 255], "$dir/ic_launcher_round.png");
    render($markBlack, $fg, $fg, 0.60, null, "$dir/ic_launcher_foreground.png");
}

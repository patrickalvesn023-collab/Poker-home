Add-Type -AssemblyName System.Drawing
$sizes = 192,512
foreach ($s in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap $s, $s
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::FromArgb(255, 13, 15, 13))
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 201, 162, 39))
    $font = New-Object System.Drawing.Font('Arial', [math]::Max(1, $s / 2.5), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $text = 'P'
    $sizeText = $g.MeasureString($text, $font)
    $x = ($s - $sizeText.Width) / 2
    $y = ($s - $sizeText.Height) / 2
    $g.DrawString($text, $font, $brush, [System.Drawing.PointF]::new($x, $y))
    $g.Dispose()
    $bmp.Save("icon-$s.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

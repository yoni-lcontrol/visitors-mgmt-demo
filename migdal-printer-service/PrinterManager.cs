using Custom.CuCustomWndAPI;
using System.Drawing.Imaging;
using System.Drawing.Text;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Text.Json.Serialization;
using QRCoder;

public sealed class PrinterManager : IHostedService
{
    public bool IsSdkInitialized => _api != null;

    private readonly object _sync = new object();
    private readonly ILogger<PrinterManager> _log;

    private CuCustomWndAPIWrap? _api;
    private CuCustomWndDevice? _dev;

    public PrinterManager(ILogger<PrinterManager> log)
    {
        _log = log;
    }

    public void PrintCard(string fullName, string id)
    {
        lock (_sync)
        {
            try
            {

                _log.LogInformation("PrintCard started. FullName={FullName}, Id={Id}", fullName, id);

                EnsureOpen();

                // --- TEXT STYLE ---
                var pfs = new PrintFontSettings
                {
                    Emphasized = true,
                    Italic = false,
                    Underline = false,
                    CharWidth = PrintFontSettings.FontSize.FONT_SIZE_X2,
                    CharHeight = PrintFontSettings.FontSize.FONT_SIZE_X5,
                    Justification = PrintFontSettings.FontJustification.FONT_JUSTIFICATION_RIGHT,
                    CharFontType = PrintFontSettings.FontType.FONT_TYPE_4
                };

                // --- BARCODE (QR) ON LEFT ---
                var pbs = new PrintBarcodeSettings
                {
                    BType = PrintBarcodeSettings.BarcodeType.BARCODE_TYPE_QRCODE, // adjust if name differs
                    BarcodeWidth = 120,   // QR module size (tune)
                    BarcodeHeight = 120,  // some SDKs ignore for QR
                    HRIPosition = PrintBarcodeSettings.BarcodeHRIPosition.BARCODE_HRI_NONE,
                    AlignMode = PrintBarcodeSettings.BarcodeAlign.BARCODE_ALIGN_TO_RIGHT
                };


                // --- TEXT BLOCK ON RIGHT (simulate X offset with spaces) ---
                const string pad = "    "; // tune (increase/decrease spaces)
                var now = DateTime.Now;

                var line1 = $"{now:dd/MM/yyyy} {now:HH:mm}";
                var line_diff = $"----------------";
                var line2 = $"{fullName}";
                var line3 = $"{id}";

                var finalText = line1 + "\r\n" + line2 + "\r\n" + line3;
                var imgPath = CreateRotatedTextImage(finalText, lineSpacingMultiplier: 1.4f);

                _log.LogDebug("Card text image created at {ImagePath}", imgPath);


                // 2) Configure how the printer converts the image to B/W
                // Try dithering first; threshold can work better for text sometimes.
                byte threshold = 0x7F; // used only for threshold mode

                _dev!.SetGrModeToBlackWhite(PrintImageSettings.ImageGRMode.IMAGE_GRMODE_DITHERING, 0);

                // 3) Image print settings (adjust width if needed)
                var pis = new PrintImageSettings
                {
                    PrintScaleMode = PrintImageSettings.ImageScale.IMAGE_SCALE_NONE, // or FIT_WIDTH if supported
                    PrintScaleWidthValue = 300
                };

                // 4) Print the image
                _dev.PrintImageFromPath(imgPath, pis);
                _dev.PrintBarcode(id, pbs);

                _log.LogDebug("Card image and barcode sent to printer. Id={Id}", id);


                // Optional: feed a bit so it’s visible
                // _dev.Feed(5);

                // Optional: cleanup temp file
                try
                {
                    File.Delete(imgPath);
                    _log.LogDebug("Temporary card image deleted: {ImagePath}", imgPath);
                }
                catch (Exception ex)
                {
                    _log.LogWarning(ex, "Failed to delete temporary card image: {ImagePath}", imgPath);
                }
                //var pfs = new PrintFontSettings
                //{
                //    Emphasized = true,   // stronger strokes
                //    Italic = false,
                //    Underline = false,
                //    CharWidth = PrintFontSettings.FontSize.FONT_SIZE_X2,
                //    CharHeight = PrintFontSettings.FontSize.FONT_SIZE_X2,
                //    Justification = PrintFontSettings.FontJustification.FONT_JUSTIFICATION_LEFT,
                //    CharFontType = PrintFontSettings.FontType.FONT_TYPE_5 // try 0 then 1
                //};

                //_dev!.PrintText(text + "\r\n", pfs, true);

                _dev.Eject(CuCustomWndDevice.EjectType.EJ_EJECT);
                _dev.Cut(CuCustomWndDevice.CutType.CUT_TOTAL);

                _log.LogInformation("PrintCard completed successfully. FullName={FullName}, Id={Id}", fullName, id);

            }
            catch (Exception ex)
            {
                _log.LogError(ex, "PrintCard failed. FullName={FullName}, Id={Id}", fullName, id);
                throw;
            }
        }
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        lock (_sync)
        {
            // Make sure native DLLs are discoverable:
            // We copy them to: <output>\native
            NativeDllPath.AddNativeSearchPath();

            try
            {
                var logDir = Path.Combine(AppContext.BaseDirectory, "logs");
                Directory.CreateDirectory(logDir);

                _api = new CuCustomWndAPIWrap(CuCustomWndAPIWrap.CcwLogVerbosity.CCW_LOG_DEEP_DEBUG, logDir);
                _api.InitLibrary();
                _api.SetOpenDeviceMode(CuCustomWndAPIWrap.OpenDeviceMode.TXRX_STS);

                _log.LogInformation("SDK initialized. BaseDir={BaseDir}", AppContext.BaseDirectory);
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Printer SDK initialization failed — service will run without printer hardware.");
                _api = null;
            }
        }

        return Task.CompletedTask;
    }

    private static bool IsPrinterSdkInstalled()
    {
        try
        {
            using var key = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Custom\CuCustomWndAPI");
            return key != null;
        }
        catch
        {
            return false;
        }
    }

    static void DrawQrElement(Graphics g, TemplateElement el, string qrValue, int scale)
    {
        if (string.IsNullOrWhiteSpace(qrValue)) return;

        // pick QR size: use el.Width/Height if exists (even if "text"), otherwise fallback
        float size = 120f; // template units (tune)
        if (el.Width > 0 && el.Height > 0) size = Math.Min(el.Width, el.Height);
        else if (el.FontSize > 0) size = el.FontSize * 5; // heuristic

        float x = el.X * scale;
        float y = el.Y * scale;
        float w = size * scale;
        float h = size * scale;

        using var gen = new QRCodeGenerator();
        using var data = gen.CreateQrCode(qrValue, QRCodeGenerator.ECCLevel.Q);
        using var qr = new QRCode(data);

        // pixelsPerModule affects quality; actual draw size is controlled by w/h
        using var qrBmp = qr.GetGraphic(pixelsPerModule: 6);

        var state = g.Save();
        try
        {
            g.TranslateTransform(x, y);
            if (Math.Abs(el.Rotation) > 0.001f) g.RotateTransform(el.Rotation);
            g.ScaleTransform(el.ScaleX, el.ScaleY);

            g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.NearestNeighbor;
            g.DrawImage(qrBmp, 0, 0, w, h);
        }
        finally
        {
            g.Restore(state);
        }
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        lock (_sync)
        {
            _log.LogInformation("Stopping PrinterManager");

            try
            {
                if (_dev != null)
                {
                    _dev.Terminate();
                    _log.LogInformation("Printer device terminated successfully");
                }
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Failed while terminating printer device");
            }
            finally
            {
                _dev = null;
            }

            try
            {
                if (_api != null)
                {
                    _api.DeInitLibrary();
                    _log.LogInformation("Printer SDK deinitialized successfully");
                }
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Failed while deinitializing printer SDK");
            }
            finally
            {
                _api = null;
            }
        }

        return Task.CompletedTask;
    }

    public void OpenUsbFirst()
    {
        lock (_sync)
        {
            try
            {
                _log.LogInformation("Opening first USB printer");

                EnsureApi();
                Close_NoThrow();

                var usb = _api!.EnumUSBDevices();
                if (usb == null || usb.Length == 0)
                {
                    _log.LogWarning("No USB printers found");
                    throw new InvalidOperationException("No USB devices found by EnumUSBDevices().");
                }

                _log.LogInformation("Found {DeviceCount} USB printer(s). Opening first device", usb.Length);

                _dev = _api.OpenPrinterUSB(usb[0]);

                _log.LogInformation("USB printer opened successfully");
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Failed to open first USB printer");
                throw;
            }
        }
    }

    static string RenderTemplateToPng(
        string templateJson,
        IReadOnlyDictionary<string, string> data,
        int outputScale = 3 // render at higher res, then printer scales down
    )
    {
        var opts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        var tpl = JsonSerializer.Deserialize<CanvasTemplate>(templateJson, opts)
                  ?? throw new InvalidOperationException("Failed to parse TemplateJson");

        int w = tpl.Width * outputScale;
        int h = tpl.Height * outputScale;

        string bg = string.IsNullOrWhiteSpace(tpl.BackgroundColor) ? "#ffffff" : tpl.BackgroundColor!;
        var bgColor = ColorTranslator.FromHtml(bg);

        var outPath = Path.Combine(Path.GetTempPath(), $"card_{Guid.NewGuid():N}.png");

        using var bmp = new Bitmap(w, h, PixelFormat.Format24bppRgb);
        bmp.SetResolution(300, 300);

        using (var g = Graphics.FromImage(bmp))
        {
            g.Clear(bgColor);
            g.TextRenderingHint = TextRenderingHint.SingleBitPerPixelGridFit;
            g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.HighQuality;
            g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;

            foreach (var el in tpl.Elements)
            {
                if (string.Equals(el.Type, "text", StringComparison.OrdinalIgnoreCase))
                {
                    DrawTextElement(g, el, data, outputScale);
                }
                else if (string.Equals(el.Type, "image", StringComparison.OrdinalIgnoreCase))
                {
                    DrawImageElement(g, el, outputScale);
                }
            }
        }

        // If template says rotated=true you can rotate final output (optional)
        if (tpl.Rotated)
        {
            using var src = (Bitmap)System.Drawing.Image.FromFile(outPath);
            src.RotateFlip(RotateFlipType.Rotate90FlipNone);
            src.Save(outPath, ImageFormat.Png);
        }
        else
        {
            bmp.Save(outPath, ImageFormat.Png);
        }

        return outPath;
    }

    static void DrawTextElement(Graphics g, TemplateElement el, IReadOnlyDictionary<string, string> data, int scale)
    {
        if (el.Visible == false) return;

        string text = el.Text ?? "";

        // visitor-field: resolve from data dictionary by visitorField key
        if (!string.IsNullOrWhiteSpace(el.VisitorField) && data.TryGetValue(el.VisitorField!, out var fieldVal))
        {
            text = fieldVal ?? "";
        }
        // legacy fallback: resolve by Name
        else if (!string.IsNullOrWhiteSpace(el.Name) && data.TryGetValue(el.Name!, out var nameVal))
        {
            text = nameVal ?? "";
        }

        if (string.IsNullOrEmpty(text)) return;

        var color = Color.Black;
        var colorStr = el.ResolvedColor;
        if (!string.IsNullOrWhiteSpace(colorStr))
        {
            try { color = ColorTranslator.FromHtml(colorStr); } catch { /* ignore */ }
        }

        float x = el.X * scale;
        float y = el.Y * scale;

        float fontSizePx = (el.FontSize <= 0 ? 14 : el.FontSize) * scale;
        var fontStyle = string.Equals(el.FontWeight, "bold", StringComparison.OrdinalIgnoreCase)
            ? FontStyle.Bold : FontStyle.Regular;
        var fontFamily = !string.IsNullOrWhiteSpace(el.FontFamily) ? el.FontFamily! : "Arial";
        using var font = new System.Drawing.Font(fontFamily, fontSizePx, fontStyle, GraphicsUnit.Pixel);
        using var brush = new SolidBrush(color);
        using var sf = new StringFormat(StringFormat.GenericTypographic)
        {
            FormatFlags = StringFormatFlags.NoClip | StringFormatFlags.NoWrap,
            Trimming = StringTrimming.None,
        };
        sf.Alignment = el.TextAlign?.ToLowerInvariant() switch
        {
            "center" => StringAlignment.Center,
            "right" => StringAlignment.Far,
            _ => StringAlignment.Near,
        };

        float elWidth = el.Width > 0 ? el.Width * scale : 0;
        float elHeight = el.Height > 0 ? el.Height * scale : 0;

        // Apply element rotation/scale around its top-left (simple + good enough)
        var state = g.Save();
        try
        {
            g.TranslateTransform(x, y);
            if (Math.Abs(el.Rotation) > 0.001f) g.RotateTransform(el.Rotation);
            g.ScaleTransform(el.ScaleX, el.ScaleY);

            if (elWidth > 0 && elHeight > 0)
                g.DrawString(text, font, brush, new RectangleF(0, 0, elWidth, elHeight), sf);
            else
                g.DrawString(text, font, brush, 0, 0, sf);
        }
        finally
        {
            g.Restore(state);
        }
    }

    static void DrawImageElement(Graphics g, TemplateElement el, int scale)
    {
        if (string.IsNullOrWhiteSpace(el.Base64)) return;

        byte[] bytes = DecodeDataUrl(el.Base64!);
        using var ms = new MemoryStream(bytes);
        using var img = System.Drawing.Image.FromStream(ms);

        float x = el.X * scale;
        float y = el.Y * scale;
        float w = (el.Width <= 0 ? img.Width : el.Width) * scale;
        float h = (el.Height <= 0 ? img.Height : el.Height) * scale;

        var state = g.Save();
        try
        {
            g.TranslateTransform(x, y);
            if (Math.Abs(el.Rotation) > 0.001f) g.RotateTransform(el.Rotation);
            g.ScaleTransform(el.ScaleX, el.ScaleY);

            g.DrawImage(img, 0, 0, w, h);
        }
        finally
        {
            g.Restore(state);
        }
    }

    static void DrawShapeElement(Graphics g, TemplateElement el, int scale)
    {
        if (el.Visible == false) return;

        float x = el.X * scale;
        float y = el.Y * scale;
        float w = el.Width * scale;
        float h = el.Height * scale;

        var state = g.Save();
        try
        {
            g.TranslateTransform(x, y);
            if (Math.Abs(el.Rotation) > 0.001f) g.RotateTransform(el.Rotation);
            g.ScaleTransform(el.ScaleX, el.ScaleY);

            // Fill
            if (!string.IsNullOrWhiteSpace(el.BackgroundColor) &&
                !string.Equals(el.BackgroundColor, "transparent", StringComparison.OrdinalIgnoreCase))
            {
                try
                {
                    using var brush = new SolidBrush(ColorTranslator.FromHtml(el.BackgroundColor));
                    g.FillRectangle(brush, 0, 0, w, h);
                }
                catch { /* ignore bad color */ }
            }

            // Border
            if (el.BorderWidth > 0 && !string.IsNullOrWhiteSpace(el.BorderColor))
            {
                try
                {
                    using var pen = new Pen(ColorTranslator.FromHtml(el.BorderColor), el.BorderWidth * scale);
                    g.DrawRectangle(pen, 0, 0, w, h);
                }
                catch { /* ignore bad color */ }
            }
        }
        finally
        {
            g.Restore(state);
        }
    }

    static string RenderTemplateToPngForSizeCm(string templateJson, IReadOnlyDictionary<string, string> data, double targetWidthCm, double targetHeightCm, int printerDpi)
    {
        var opts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        var tpl = JsonSerializer.Deserialize<CanvasTemplate>(templateJson, opts)
                  ?? throw new InvalidOperationException("Failed to parse TemplateJson");

        // cm -> inches -> pixels
        int targetPxW = (int)Math.Round((targetWidthCm / 2.54) * printerDpi);
        int targetPxH = (int)Math.Round((targetHeightCm / 2.54) * printerDpi);

        // Keep aspect ratio (uniform scale)
        float sx = (float)targetPxW / tpl.Width;
        float sy = (float)targetPxH / tpl.Height;
        float s = Math.Min(sx, sy);

        // Center content inside target image
        float contentW = tpl.Width * s;
        float contentH = tpl.Height * s;
        float offsetX = (targetPxW - contentW) / 2f;
        float offsetY = (targetPxH - contentH) / 2f;

        var bg = string.IsNullOrWhiteSpace(tpl.BackgroundColor) ? "#ffffff" : tpl.BackgroundColor!;
        var bgColor = ColorTranslator.FromHtml(bg);

        var outPath = Path.Combine(Path.GetTempPath(), $"card_{Guid.NewGuid():N}.png");

        using var bmp = new Bitmap(targetPxW, targetPxH, PixelFormat.Format24bppRgb);
        bmp.SetResolution(printerDpi, printerDpi);

        using (var g = Graphics.FromImage(bmp))
        {
            g.Clear(bgColor);
            g.TextRenderingHint = TextRenderingHint.SingleBitPerPixelGridFit;
            g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.HighQuality;
            g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;

            var state = g.Save();
            g.TranslateTransform(offsetX, offsetY);
            g.ScaleTransform(s, s);

            foreach (var el in tpl.Elements)
            {
                if (el.Visible == false) continue;

                var t = (el.Type ?? "").Trim().ToLowerInvariant();

                // ── QR code element ──
                if (t == "qr")
                {
                    string qrValue = "";
                    if (string.Equals(el.QrSourceType, "static", StringComparison.OrdinalIgnoreCase))
                    {
                        qrValue = el.QrStaticValue ?? "";
                    }
                    else if (!string.IsNullOrWhiteSpace(el.QrDynamicField) &&
                             data.TryGetValue(el.QrDynamicField!, out var dynVal))
                    {
                        qrValue = dynVal ?? "";
                    }
                    // fallback: try Barcode key
                    if (string.IsNullOrWhiteSpace(qrValue))
                        data.TryGetValue("Barcode", out qrValue!);

                    DrawQrElement(g, el, qrValue ?? "", scale: 1);
                    continue;
                }

                // ── Legacy barcode placeholder (type=text/barcode with Name="Barcode") ──
                bool isBarcodePlaceholder =
                    (t == "text" || t == "barcode") &&
                    (string.Equals(el.Name, "Barcode", StringComparison.OrdinalIgnoreCase) ||
                     string.Equals(el.Text?.Trim(), "[Barcode]", StringComparison.OrdinalIgnoreCase));

                if (isBarcodePlaceholder)
                {
                    data.TryGetValue("Barcode", out var qrValue);
                    DrawQrElement(g, el, qrValue ?? "", scale: 1);
                    continue;
                }

                // ── Text elements: visitor-field, static-text, and legacy text/date/time ──
                if (t == "visitor-field" || t == "static-text" ||
                    t == "text" || t == "date" || t == "time" || t == "datetime")
                {
                    DrawTextElement(g, el, data, scale: 1);
                    continue;
                }

                // ── Shape element (filled rectangle) ──
                if (t == "shape")
                {
                    DrawShapeElement(g, el, scale: 1);
                    continue;
                }

                // ── Image element ──
                if (t == "image")
                {
                    string? imgBase64 = null;

                    // Check named data (e.g. visitorField="visitorImage")
                    if (!string.IsNullOrWhiteSpace(el.VisitorField) &&
                        data.TryGetValue(el.VisitorField!, out var vfImage) &&
                        !string.IsNullOrWhiteSpace(vfImage))
                    {
                        imgBase64 = vfImage;
                    }
                    else if (!string.IsNullOrWhiteSpace(el.Name) &&
                        data.TryGetValue(el.Name!, out var namedImage) &&
                        !string.IsNullOrWhiteSpace(namedImage))
                    {
                        imgBase64 = namedImage;
                    }
                    else if (data.TryGetValue("Image", out var fallbackImage) &&
                             !string.IsNullOrWhiteSpace(fallbackImage))
                    {
                        imgBase64 = fallbackImage;
                    }

                    if (!string.IsNullOrWhiteSpace(imgBase64))
                    {
                        DrawBase64Image(g, el, imgBase64, 1);
                    }
                    else
                    {
                        DrawImageElement(g, el, 1);
                    }
                    continue;
                }
            }

            g.Restore(state);
        }

        bmp.Save(outPath, ImageFormat.Png);
        return outPath;
    }

    static void DrawBase64Image(Graphics g, TemplateElement el, string base64, int scale)
    {
        if (string.IsNullOrWhiteSpace(base64))
            return;

        byte[] bytes = DecodeDataUrl(base64);

        using var ms = new MemoryStream(bytes);
        using var img = System.Drawing.Image.FromStream(ms);

        float x = el.X * scale;
        float y = el.Y * scale;
        float w = (el.Width <= 0 ? img.Width : el.Width) * scale;
        float h = (el.Height <= 0 ? img.Height : el.Height) * scale;

        var state = g.Save();
        try
        {
            g.TranslateTransform(x, y);

            if (Math.Abs(el.Rotation) > 0.001f)
                g.RotateTransform(el.Rotation);

            g.ScaleTransform(el.ScaleX, el.ScaleY);

            g.DrawImage(img, 0, 0, w, h);
        }
        finally
        {
            g.Restore(state);
        }
    }

    public void PrintFromTemplateOuterJson(string outerJson, string fullName, string department, string cardNumber, string title, string idForQr, string base64Image)
    {
        // Extract TemplateJson from outer wrapper and delegate to PrintFromTemplate
        using var doc = JsonDocument.Parse(outerJson);
        var templateJson = doc.RootElement.GetProperty("TemplateJson").GetString()
                           ?? throw new InvalidOperationException("TemplateJson missing");
        PrintFromTemplate(templateJson, fullName, department, cardNumber, title, idForQr, base64Image);
    }

    public void PrintFromTemplate(string templateJson, string fullName, string department, string cardNumber, string title, string idForQr, string base64Image, IDictionary<string, string>? extraFields = null)
    {
        lock (_sync)
        {
            try
            {
                _log.LogInformation(
               "PrintFromTemplate started. FullName={FullName}, Department={Department}, CardNumber={CardNumber}, Title={Title}, HasImage={HasImage}",
               fullName, department, cardNumber, title, !string.IsNullOrWhiteSpace(base64Image));


                EnsureOpen();

                var now = DateTime.Now;

                // Provide data for placeholders by visitorField key
                // Keys must match frontend VISITOR_FIELDS
                var nameParts = (fullName ?? "").Split(' ', 2);
                var data = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    // Frontend visitorField keys (camelCase)
                    ["fullName"] = fullName,
                    ["firstName"] = nameParts.Length > 0 ? nameParts[0] : "",
                    ["lastName"] = nameParts.Length > 1 ? nameParts[1] : "",
                    ["personId"] = cardNumber,
                    ["company"] = department,
                    ["carNumber"] = "",
                    ["phone"] = "",
                    ["email"] = "",
                    ["hostName"] = "",
                    ["visitDate"] = now.ToString("dd/MM/yyyy"),
                    ["startTime"] = now.ToString("HH:mm"),
                    ["endTime"] = "",
                    ["visitorImage"] = base64Image,
                    ["visitRequesterFirstName"] = "",
                    ["visitRequesterLastName"] = "",

                    // Legacy PascalCase keys (for older templates)
                    ["FullName"] = fullName,
                    ["Department"] = department,
                    ["CardNumber"] = cardNumber,
                    ["Title"] = title,
                    ["Barcode"] = idForQr,
                    ["Image"] = base64Image,

                    // Date/time keys
                    ["dd/MM/yyyy"] = now.ToString("dd/MM/yyyy"),
                    ["hh:mm"] = now.ToString("HH:mm"),
                    ["Date"] = now.ToString("dd/MM/yyyy"),
                    ["Time"] = now.ToString("HH:mm"),
                    ["DateTime"] = now.ToString("dd/MM/yyyy HH:mm"),
                };

                // Merge extra fields from backend (overrides defaults)
                if (extraFields != null)
                {
                    foreach (var kv in extraFields)
                    {
                        if (!string.IsNullOrEmpty(kv.Value))
                            data[kv.Key] = kv.Value;
                    }
                }

                // Render template -> PNG
                var dpi = (int)(_dev!.GetCapPrinterResolution());
                if (dpi <= 0)
                {
                    _log.LogWarning("Printer returned invalid DPI {Dpi}. Falling back to 300 DPI", dpi);
                    dpi = 300;
                }

                _log.LogDebug("Rendering template to PNG. Dpi={Dpi}", dpi);

                var imgPath = RenderTemplateToPngForSizeCm(templateJson, data, 10.0, 6.0, dpi);
                _log.LogDebug("Template rendered to temporary image: {ImagePath}", imgPath);


                using (var src = (Bitmap)System.Drawing.Image.FromFile(imgPath))
                {
                    src.RotateFlip(RotateFlipType.Rotate90FlipNone);
                    src.Save(imgPath, ImageFormat.Png);
                }
                // Print image
                _dev!.SetGrModeToBlackWhite(PrintImageSettings.ImageGRMode.IMAGE_GRMODE_DITHERING, 0);

                var pis = new PrintImageSettings
                {
                    PrintScaleMode = PrintImageSettings.ImageScale.IMAGE_SCALE_NONE,
                    PrintScaleWidthValue = 300
                };

                _dev.PrintImageFromPath(imgPath, pis);
                _log.LogDebug("Template image sent to printer from {ImagePath}", imgPath);


                try
                {
                    File.Delete(imgPath);
                    _log.LogDebug("Temporary template image deleted: {ImagePath}", imgPath);
                }
                catch (Exception ex)
                {
                    _log.LogWarning(ex, "Failed to delete temporary template image: {ImagePath}", imgPath);
                }

                _dev.Eject(CuCustomWndDevice.EjectType.EJ_EJECT);
                _dev.Align(CuCustomWndDevice.PaperAlignType.PALIGN_CUT);

                // Cut
                _dev.Cut(CuCustomWndDevice.CutType.CUT_TOTAL);

                _log.LogInformation(
                "PrintFromTemplate completed successfully. FullName={FullName}, CardNumber={CardNumber}",
                fullName, cardNumber);
            }
            catch (Exception ex)
            {
                _log.LogError(ex,
                    "PrintFromTemplate failed. FullName={FullName}, Department={Department}, CardNumber={CardNumber}, Title={Title}",
                    fullName, department, cardNumber, title);
                throw;
            }
        }
    }

    static byte[] DecodeDataUrl(string dataUrl)
    {
        // supports "data:image/jpeg;base64,...."
        var comma = dataUrl.IndexOf(',');
        var b64 = comma >= 0 ? dataUrl[(comma + 1)..] : dataUrl;
        return Convert.FromBase64String(b64);
    }

    public void OpenInstalled(string printerName)
    {
        lock (_sync)
        {
            try
            {
                _log.LogInformation("Opening installed printer. PrinterName={PrinterName}", printerName);

                EnsureApi();
                Close_NoThrow();

                _dev = _api!.OpenInstalledPrinter(printerName);

                _log.LogInformation("Installed printer opened successfully. PrinterName={PrinterName}", printerName);
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Failed to open installed printer. PrinterName={PrinterName}", printerName);
                throw;
            }
        }
    }

    static string CreateRotatedTextImage(
       string text,
       int widthPx = 800,
       int padding = 10,
       float lineSpacingMultiplier = 0.78f // <--- smaller = tighter (try 0.65–0.9)
   )
    {
        var lines = (text ?? "")
            .Replace("\r\n", "\n")
            .Split('\n', StringSplitOptions.RemoveEmptyEntries);

        if (lines.Length == 0) lines = new[] { "" };

        // First measure using a temp bitmap so we can auto-pick height
        using var tmpBmp = new Bitmap(1, 1);
        using var tmpG = Graphics.FromImage(tmpBmp);
        using var font = new System.Drawing.Font("Arial", 30, FontStyle.Regular);

        var baseLineHeight = font.GetHeight(tmpG);           // normal line height
        var step = baseLineHeight * lineSpacingMultiplier;   // custom tight spacing
        var heightPx = (int)(padding * 2 + (lines.Length * step) + baseLineHeight * -0.2f);

        var tmpPath = Path.Combine(Path.GetTempPath(), $"print_text_{Guid.NewGuid():N}.png");

        using (var bmp = new Bitmap(widthPx, heightPx))
        using (var g = Graphics.FromImage(bmp))
        {
            g.Clear(Color.White);
            g.TextRenderingHint = TextRenderingHint.SingleBitPerPixelGridFit;

            // Right aligned (good for Hebrew / RTL look).
            using var fmt = new StringFormat
            {
                Alignment = StringAlignment.Center,
                LineAlignment = StringAlignment.Near
            };

            float y = padding;

            foreach (var line in lines)
            {
                // draw each line at a controlled Y position
                var rect = new RectangleF(padding, y, widthPx - padding * 2, baseLineHeight + 5);
                g.DrawString(line, font, Brushes.Black, rect, fmt);
                y += step;
            }

            bmp.Save(tmpPath, ImageFormat.Png);
        }

        var rotatedPath = Path.Combine(Path.GetTempPath(), $"print_text_rotated_{Guid.NewGuid():N}.png");
        using (var src = (Bitmap)System.Drawing.Image.FromFile(tmpPath))
        {
            src.RotateFlip(RotateFlipType.Rotate90FlipNone);
            src.Save(rotatedPath, ImageFormat.Png);
        }

        try { File.Delete(tmpPath); } catch { }
        return rotatedPath;
        //return tmpPath; // no rotation
    }
    public void PrintText(string text, bool bold, bool italic, bool underline)
    {
        lock (_sync)
        {

            try
            {
                _log.LogInformation("PrintText started. TextLength={TextLength}, Bold={Bold}, Italic={Italic}, Underline={Underline}", text?.Length ?? 0, bold, italic, underline);

                EnsureOpen();

                var imgPath = CreateRotatedTextImage(text);
                _log.LogDebug("Temporary text image created at {ImagePath}", imgPath);


                // 2) Configure how the printer converts the image to B/W
                // Try dithering first; threshold can work better for text sometimes.
                byte threshold = 0x7F; // used only for threshold mode

                _dev!.SetGrModeToBlackWhite(PrintImageSettings.ImageGRMode.IMAGE_GRMODE_DITHERING, 0);

                // 3) Image print settings (adjust width if needed)
                var pis = new PrintImageSettings
                {
                    PrintScaleMode = PrintImageSettings.ImageScale.IMAGE_SCALE_NONE, // or FIT_WIDTH if supported
                    PrintScaleWidthValue = 300
                };

                // 4) Print the image
                _dev.PrintImageFromPath(imgPath, pis);
                _log.LogDebug("Text image sent to printer from {ImagePath}", imgPath);

                // Optional: feed a bit so it’s visible
                // _dev.Feed(5);

                // Optional: cleanup temp file
                try
                {
                    File.Delete(imgPath);
                    _log.LogDebug("Temporary text image deleted: {ImagePath}", imgPath);
                }
                catch (Exception ex)
                {
                    _log.LogWarning(ex, "Failed to delete temporary text image: {ImagePath}", imgPath);
                }
                //var pfs = new PrintFontSettings
                //{
                //    Emphasized = true,   // stronger strokes
                //    Italic = false,
                //    Underline = false,
                //    CharWidth = PrintFontSettings.FontSize.FONT_SIZE_X2,
                //    CharHeight = PrintFontSettings.FontSize.FONT_SIZE_X2,
                //    Justification = PrintFontSettings.FontJustification.FONT_JUSTIFICATION_LEFT,
                //    CharFontType = PrintFontSettings.FontType.FONT_TYPE_5 // try 0 then 1
                //};

                //_dev!.PrintText(text + "\r\n", pfs, true);

                _dev.Eject(CuCustomWndDevice.EjectType.EJ_EJECT);
                _dev.Cut(CuCustomWndDevice.CutType.CUT_TOTAL);

                _log.LogInformation("PrintText completed successfully");

            }
            catch (Exception ex)
            {
                _log.LogError(ex, "PrintText failed");
                throw;
            }
        }
    }

    public string GetStatus()
    {
        lock (_sync)
        {
            try
            {
                _log.LogDebug("GetStatus called");

                if (_api == null)
                    return "sdk-not-initialized";

                EnsureOpen();
                var status = _dev!.GetPrinterFullStatus().ToString();

                _log.LogInformation("Printer status retrieved successfully. Status={Status}", status);

                return status;
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Failed to get printer status");
                throw;
            }
        }
    }

    public void Close()
    {
        lock (_sync)
        {
            try
            {
                _log.LogInformation("Closing printer device");

                Close_NoThrow();

                _log.LogInformation("Printer device closed successfully");
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Failed to close printer device");
                throw;
            }
        }
    }

    private void Close_NoThrow()
    {
        if (_dev != null)
        {
            try
            {
                _dev.Terminate();
                _log.LogDebug("Printer device terminated");
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Failed to terminate printer device during cleanup");
            }
            finally
            {
                _dev = null;
            }
        }
    }

    private void EnsureApi()
    {
        if (_api == null)
        {
            _log.LogError("Printer SDK is not initialized");
            throw new InvalidOperationException("Printer SDK not initialized — printer drivers may not be installed on this machine.");
        }
    }

    private void EnsureOpen()
    {
        EnsureApi();

        if (_dev != null)
        {
            _log.LogDebug("Printer device already exists. Reopening connection");
        }

        Close_NoThrow();

        var usb = _api!.EnumUSBDevices();
        if (usb == null || usb.Length == 0)
        {
            _log.LogWarning("No USB printers found while trying to ensure printer is open");
            throw new InvalidOperationException("No USB devices found by EnumUSBDevices().");
        }

        _log.LogDebug("Found {DeviceCount} USB printer(s). Opening first device", usb.Length);

        _dev = _api.OpenPrinterUSB(usb[0]);

        _log.LogDebug("Printer device opened successfully");
    }
}

internal static class NativeDllPath
{
    public static void AddNativeSearchPath()
    {
        var baseDir = AppContext.BaseDirectory;
        var nativeDir = Path.Combine(baseDir, "native");

        if (!Directory.Exists(nativeDir))
            return;

        // Add nativeDir to DLL search path (Windows)
        // This helps the wrapper find CuCustomWndAPI.dll and other native deps.
        var ok = SetDllDirectory(nativeDir);
        if (!ok)
        {
            // fallback: prepend to PATH
            var path = Environment.GetEnvironmentVariable("PATH") ?? "";
            if (!path.Split(';').Any(p => p.Equals(nativeDir, StringComparison.OrdinalIgnoreCase)))
            {
                Environment.SetEnvironmentVariable("PATH", nativeDir + ";" + path);
            }
        }
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool SetDllDirectory(string lpPathName);
}


public sealed class CanvasTemplate
{
    [JsonPropertyName("width")] public int Width { get; set; }
    [JsonPropertyName("height")] public int Height { get; set; }
    [JsonPropertyName("rotated")] public bool Rotated { get; set; }
    [JsonPropertyName("backgroundColor")] public string? BackgroundColor { get; set; }
    [JsonPropertyName("elements")] public List<TemplateElement> Elements { get; set; } = new();
}

public sealed class TemplateElement
{
    // type: "visitor-field" | "static-text" | "image" | "shape" | "qr"
    [JsonPropertyName("type")] public string Type { get; set; } = "";

    // text (static-text)
    [JsonPropertyName("text")] public string? Text { get; set; }

    // visitor-field mapping
    [JsonPropertyName("visitorField")] public string? VisitorField { get; set; }
    [JsonPropertyName("label")] public string? Label { get; set; }

    // legacy Konva-style name (fallback for older templates)
    [JsonPropertyName("name")] public string? Name { get; set; }
    [JsonPropertyName("isPlaceholder")] public bool IsPlaceholder { get; set; }

    // text styling
    [JsonPropertyName("fontSize")] public float FontSize { get; set; } = 14;
    [JsonPropertyName("fontWeight")] public string? FontWeight { get; set; }
    [JsonPropertyName("fontFamily")] public string? FontFamily { get; set; }
    [JsonPropertyName("textAlign")] public string? TextAlign { get; set; }
    [JsonPropertyName("color")] public string? Color { get; set; }
    [JsonPropertyName("fill")] public string? Fill { get; set; }  // legacy fallback
    [JsonPropertyName("backgroundColor")] public string? BackgroundColor { get; set; }

    // shared position/size
    [JsonPropertyName("x")] public float X { get; set; }
    [JsonPropertyName("y")] public float Y { get; set; }
    [JsonPropertyName("width")] public float Width { get; set; }
    [JsonPropertyName("height")] public float Height { get; set; }
    [JsonPropertyName("rotation")] public float Rotation { get; set; }
    [JsonPropertyName("scaleX")] public float ScaleX { get; set; } = 1;
    [JsonPropertyName("scaleY")] public float ScaleY { get; set; } = 1;
    [JsonPropertyName("visible")] public bool Visible { get; set; } = true;
    [JsonPropertyName("zIndex")] public int ZIndex { get; set; }

    // image
    [JsonPropertyName("key")] public string? Key { get; set; }
    [JsonPropertyName("base64")] public string? Base64 { get; set; }
    [JsonPropertyName("imageUrl")] public string? ImageUrl { get; set; }

    // QR
    [JsonPropertyName("qrSourceType")] public string? QrSourceType { get; set; }       // "static" | "dynamic"
    [JsonPropertyName("qrDynamicField")] public string? QrDynamicField { get; set; }   // e.g. "personId"
    [JsonPropertyName("qrStaticValue")] public string? QrStaticValue { get; set; }

    // border
    [JsonPropertyName("borderColor")] public string? BorderColor { get; set; }
    [JsonPropertyName("borderWidth")] public float BorderWidth { get; set; }

    /// <summary>Resolve effective text color from Color (new) or Fill (legacy).</summary>
    public string ResolvedColor => !string.IsNullOrWhiteSpace(Color) ? Color! : Fill ?? "#000000";
}

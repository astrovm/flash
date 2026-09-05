/* Build with i686-w64-mingw32-gcc -nostdlib -Wl,--entry=_mainCRTStartup
 * -lkernel32 -luser32 -lgdi32. Run inside the ISO-installed XP guest.
 * E: is the disposable shared output drive; no host fonts are involved. */
#define WINVER 0x0501
#include <windows.h>

static void render(const char *name, const char *text, const char *face,
                   int height, int weight, int italic, int quality) {
  HDC dc = CreateCompatibleDC(NULL);
  BITMAPINFO info = {0};
  info.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
  info.bmiHeader.biWidth = 640;
  info.bmiHeader.biHeight = -80;
  info.bmiHeader.biPlanes = 1;
  info.bmiHeader.biBitCount = 32;
  void *pixels;
  HBITMAP bitmap = CreateDIBSection(dc, &info, DIB_RGB_COLORS, &pixels, NULL, 0);
  if (!bitmap) ExitProcess(1);
  SelectObject(dc, bitmap);
  HFONT font = CreateFontA(-height, 0, 0, 0, weight, italic, 0, 0,
                          ANSI_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS,
                          quality, DEFAULT_PITCH, face);
  SelectObject(dc, font);
  PatBlt(dc, 0, 0, 640, 80, BLACKNESS);
  SetBkMode(dc, TRANSPARENT);
  SetTextColor(dc, RGB(255, 255, 255));
  TextOutA(dc, 8, 0, text, lstrlenA(text));
  GdiFlush();

  char path[128];
  wsprintfA(path, "E:\\%s-%d.bmp", name, quality);
  HANDLE output = CreateFileA(path, GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, 0, NULL);
  if (output == INVALID_HANDLE_VALUE) ExitProcess(2);
  BITMAPFILEHEADER header = {0};
  header.bfType = 0x4d42;
  header.bfOffBits = 54;
  header.bfSize = 54 + 640 * 80 * 4;
  DWORD written;
  WriteFile(output, &header, 14, &written, NULL);
  WriteFile(output, &info.bmiHeader, 40, &written, NULL);
  WriteFile(output, pixels, 640 * 80 * 4, &written, NULL);
  FlushFileBuffers(output);
  CloseHandle(output);
  DeleteDC(dc);
  DeleteObject(font);
  DeleteObject(bitmap);
}

void mainCRTStartup(void) {
  for (int quality = NONANTIALIASED_QUALITY;
       quality <= ANTIALIASED_QUALITY; quality++) {
    render("welcome", "welcome", "Arial", 48, FW_BOLD, 1, quality);
    render("instruction", "To begin, click your user name", "Arial", 19,
           FW_NORMAL, 0, quality);
    render("power", "Turn off computer", "Tahoma", 19, FW_NORMAL, 0, quality);
    render("astro", "astro", "Tahoma", 19, FW_NORMAL, 0, quality);
    render("logged-on", "Logged on", "Tahoma", 11, FW_BOLD, 0, quality);
    render("digits", "0123456789", "Tahoma", 11, FW_BOLD, 0, quality);
    render("program-running", " program running.", "Tahoma", 11, FW_BOLD, 0, quality);
    render("programs-running", " programs running.", "Tahoma", 11, FW_BOLD, 0, quality);
    render("loading", "Loading your personal settings...", "Tahoma", 11,
           FW_BOLD, 0, quality);
  }
  ExitProcess(0);
}
